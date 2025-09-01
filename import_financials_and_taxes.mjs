// migrate_legacy_financials.js
// Run with: node migrate_legacy_financials.js
// Options:
//   LOG_EVERY=100 node migrate_legacy_financials.js
//   QUIET=1 node migrate_legacy_financials.js
//   DRY_RUN=1 node migrate_legacy_financials.js

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const QUIET = process.env.QUIET === "1";
const DRY_RUN = process.env.DRY_RUN === "1";
const LOG_EVERY = Math.max(1, Number(process.env.LOG_EVERY || 1));

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "[INIT] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- small logging helpers ----------
const stamp = () => new Date().toISOString();
const log = (...args) => {
  if (!QUIET) console.log(...args);
};
const info = (...args) => console.log(...args);
const warn = (...args) => console.warn(...args);
const err = (...args) => console.error(...args);

const hr = () => console.log("".padEnd(80, "─"));
const fmtNum = (n) => (Number.isFinite(n) ? n.toLocaleString() : String(n));

// ---------- CSV ----------
const csvPath = path.resolve("./legacy_financials.csv");
if (!fs.existsSync(csvPath)) {
  err(`[INIT] CSV not found at ${csvPath}`);
  process.exit(1);
}

info(`[INIT] ${stamp()} Starting legacy financials migration`);
log(`[INIT] Using Supabase URL: ${SUPABASE_URL}`);
log(`[INIT] CSV path: ${csvPath}`);
const rows = parse(fs.readFileSync(csvPath), {
  columns: true,
  skip_empty_lines: true,
});
info(`[INIT] Parsed ${fmtNum(rows.length)} CSV rows`);
hr();

// ---------- helpers ----------
const normEmail = (e) => (e || "").trim().toLowerCase();
const asNum = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[, ]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const parseTS = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const yearOf = (isoOrNull) => {
  if (!isoOrNull) return new Date().getUTCFullYear();
  const d = new Date(isoOrNull);
  return Number.isNaN(d.getTime())
    ? new Date().getUTCFullYear()
    : d.getUTCFullYear();
};

// page through ALL auth users (10k+ ok)
async function getAllAuthUsers() {
  const started = Date.now();
  let page = 1,
    all = [];
  for (;;) {
    const t0 = Date.now();
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    const dt = Date.now() - t0;
    if (error) throw error;
    const count = data.users.length;
    info(`[AUTH] Page ${page} → ${fmtNum(count)} users in ${dt}ms`);
    if (!count) break;
    all.push(...data.users);
    if (count < 1000) break;
    page++;
  }
  info(
    `[AUTH] Loaded ${fmtNum(all.length)} auth users in ${
      Date.now() - started
    }ms`
  );
  return all;
}

// ---------- preload lookups ----------
let authUsers;
try {
  authUsers = await getAllAuthUsers();
} catch (e) {
  err(`[AUTH] Failed to list users: ${e.message || e}`);
  process.exit(1);
}
const authIdSet = new Set(authUsers.map((u) => u.id));
const authByEmail = {};
for (const u of authUsers)
  if (u.email) authByEmail[u.email.toLowerCase()] = u.id;

if (!QUIET) {
  const sample = authUsers
    .slice(0, 5)
    .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }));
  log("[AUTH] Sample users:", sample);
}
hr();

// ---------- logs ----------
const outSkipped = path.resolve("./financials_skipped.csv");
fs.writeFileSync(outSkipped, "uuid,email,reason\n");

// ---------- counters ----------
let upsertsEUR = 0,
  insertsUSD = 0,
  insertsCAD = 0,
  deposits = 0,
  taxDueUpserts = 0,
  taxPaidUpserts = 0,
  skipped = 0,
  processed = 0;

// ---------- dedupe per user (prefer uuid else email) ----------
const seen = new Set();

// ---------- main loop ----------
const tStart = Date.now();

for (const r of rows) {
  processed++;

  const csvUUID = (r.uuid || "").trim();
  const emailRaw = r.email || "";
  const email = normEmail(emailRaw);
  const key = csvUUID || email;

  if (!key) {
    skipped++;
    fs.appendFileSync(outSkipped, `,,${JSON.stringify("no uuid/email")}\n`);
    warn(`[ROW #${processed}] Skipped: no uuid/email`);
    continue;
  }
  if (seen.has(key)) {
    if (!QUIET && processed % LOG_EVERY === 0)
      log(`[ROW #${processed}] Duplicate key seen (${key}) → skip duplicate`);
    continue;
  }
  seen.add(key);

  // resolve user_id in auth.users
  let user_id = null;
  if (csvUUID && authIdSet.has(csvUUID)) user_id = csvUUID;
  else if (email && authByEmail[email]) user_id = authByEmail[email];

  if (!user_id) {
    skipped++;
    fs.appendFileSync(
      outSkipped,
      `${JSON.stringify(csvUUID)},${JSON.stringify(emailRaw)},${JSON.stringify(
        "no matching auth.users id"
      )}\n`
    );
    warn(
      `[ROW #${processed}] Skipped (no matching auth.users id) for email=${
        email || "(none)"
      } uuid=${csvUUID || "(none)"}`
    );
    continue;
  }

  // numbers (EUR values in your CSV)
  const eurBalance = asNum(r.balance);
  const totalDepositsEUR = asNum(r.total_deposits);
  const taxes_due = asNum(r.taxes_due);
  const taxes_paid = asNum(r.taxes_paid);
  const created_at = parseTS(r.created_at);
  const taxYear = yearOf(created_at);

  if (!QUIET || processed % LOG_EVERY === 0) {
    log(
      `\n[ROW #${processed}] user_id=${user_id} email=${
        email || "(none)"
      } created_at=${created_at || "(null)"} taxYear=${taxYear}`
    );
    log(
      `          EUR balance=${eurBalance} | total_deposits=${totalDepositsEUR} | taxes_due=${taxes_due} | taxes_paid=${taxes_paid}`
    );
  }

  try {
    // 1) Upsert EUR balance
    if (DRY_RUN) {
      if (!QUIET || processed % LOG_EVERY === 0)
        log("  [EUR] (dry-run) upsert euro_balances skipped");
      upsertsEUR++; // pretend success to preview summary
    } else {
      const { error } = await supabase
        .from("euro_balances")
        .upsert(
          {
            user_id,
            balance: eurBalance,
            created_at,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) {
        skipped++;
        fs.appendFileSync(
          outSkipped,
          `${JSON.stringify(csvUUID)},${JSON.stringify(
            emailRaw
          )},${JSON.stringify(
            `upsert euro_balances failed: ${error.message}`
          )}\n`
        );
        err(`  [EUR] Upsert failed: ${error.message}`);
        continue; // move to next row
      }
      if (!QUIET || processed % LOG_EVERY === 0)
        log(`  [EUR] Upserted euro_balances: balance=${eurBalance}`);
      upsertsEUR++;
    }

    // 2) Ensure USD and CAD rows exist with 0 (don't overwrite if already present)
    if (DRY_RUN) {
      if (!QUIET || processed % LOG_EVERY === 0)
        log("  [USD] (dry-run) ensure 0 row");
      if (!QUIET || processed % LOG_EVERY === 0)
        log("  [CAD] (dry-run) ensure 0 row");
      insertsUSD++;
      insertsCAD++;
    } else {
      {
        const { error } = await supabase
          .from("usd_balances")
          .insert(
            {
              user_id,
              balance: 0,
              created_at,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id", ignoreDuplicates: true }
          );
        if (!error) {
          insertsUSD++;
          if (!QUIET || processed % LOG_EVERY === 0)
            log("  [USD] Ensured usd_balances row (0)");
        } else {
          // Not fatal: ignoreDuplicates true handles common case; other errors are logged
          warn(`  [USD] Insert note: ${error.message}`);
        }
      }
      {
        const { error } = await supabase
          .from("cad_balances")
          .insert(
            {
              user_id,
              balance: 0,
              created_at,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id", ignoreDuplicates: true }
          );
        if (!error) {
          insertsCAD++;
          if (!QUIET || processed % LOG_EVERY === 0)
            log("  [CAD] Ensured cad_balances row (0)");
        } else {
          warn(`  [CAD] Insert note: ${error.message}`);
        }
      }
    }

    // 3) Insert a single aggregate EUR deposit if > 0 (idempotent)
    if (totalDepositsEUR > 0) {
      if (DRY_RUN) {
        if (!QUIET || processed % LOG_EVERY === 0)
          log(
            `  [DEP] (dry-run) would insert aggregate EUR deposit: ${totalDepositsEUR}`
          );
        deposits++;
      } else {
        const { data: existing, error: selErr } = await supabase
          .from("deposits")
          .select("id")
          .eq("user_id", user_id)
          .eq("currency", "EUR")
          .eq("method", "legacy_import")
          .limit(1)
          .maybeSingle();

        if (selErr) {
          warn(
            `  [DEP] Select existing failed (continuing): ${selErr.message}`
          );
        }
        if (!existing) {
          const { error } = await supabase.from("deposits").insert({
            user_id,
            client_id: email || `legacy:${user_id}`,
            currency: "EUR",
            amount: totalDepositsEUR,
            method: "legacy_import",
            reference_id: `legacy:EUR:${user_id}`,
            status: "Completed",
            bank_details: null,
            crypto_details: null,
            admin_notes: "Imported total deposits from legacy sheet (EUR).",
            created_at,
            updated_at: new Date().toISOString(),
          });
          if (!error) {
            deposits++;
            if (!QUIET || processed % LOG_EVERY === 0)
              log(`  [DEP] Inserted aggregate deposit EUR ${totalDepositsEUR}`);
          } else {
            fs.appendFileSync(
              outSkipped,
              `${JSON.stringify(csvUUID)},${JSON.stringify(
                emailRaw
              )},${JSON.stringify(`deposit insert failed: ${error.message}`)}\n`
            );
            warn(`  [DEP] Insert failed: ${error.message}`);
          }
        } else {
          if (!QUIET || processed % LOG_EVERY === 0)
            log("  [DEP] Aggregate EUR deposit already exists → skip");
        }
      }
    } else if (!QUIET || processed % LOG_EVERY === 0) {
      log("  [DEP] total_depositsEUR = 0 → no deposit insert");
    }

    // 4) Taxes (public.taxes)
    if (taxes_due > 0) {
      const dueRef = `legacy:EUR:due:${user_id}:${taxYear}`;
      if (DRY_RUN) {
        if (!QUIET || processed % LOG_EVERY === 0)
          log(`  [TAX] (dry-run) upsert due ref=${dueRef} amount=${taxes_due}`);
        taxDueUpserts++;
      } else {
        const dueRow = {
          client_id: email || `legacy:${user_id}`,
          user_id,
          tax_type: "legacy",
          tax_name: "Legacy taxes due",
          tax_rate: 0,
          tax_amount: Number(
            taxes_due.toFixed ? taxes_due.toFixed(2) : taxes_due
          ),
          taxable_income: 0,
          tax_period: "yearly",
          due_date: created_at ? created_at.substring(0, 10) : null,
          status: "pending",
          description: "Imported total taxes due from legacy sheet (EUR).",
          tax_year: taxYear,
          is_active: true,
          is_estimated: true,
          payment_reference: dueRef,
          created_at: created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("taxes")
          .upsert(dueRow, { onConflict: "payment_reference" });
        if (!error) {
          taxDueUpserts++;
          if (!QUIET || processed % LOG_EVERY === 0)
            log(`  [TAX] Upserted taxes due ref=${dueRef} amount=${taxes_due}`);
        } else {
          fs.appendFileSync(
            outSkipped,
            `${JSON.stringify(csvUUID)},${JSON.stringify(
              emailRaw
            )},${JSON.stringify(`tax due upsert failed: ${error.message}`)}\n`
          );
          warn(`  [TAX] Upsert due failed: ${error.message}`);
        }
      }
    } else if (!QUIET || processed % LOG_EVERY === 0) {
      log("  [TAX] taxes_due = 0 → no due row");
    }

    if (taxes_paid > 0) {
      const paidRef = `legacy:EUR:paid:${user_id}:${taxYear}`;
      if (DRY_RUN) {
        if (!QUIET || processed % LOG_EVERY === 0)
          log(
            `  [TAX] (dry-run) upsert paid ref=${paidRef} amount=${taxes_paid}`
          );
        taxPaidUpserts++;
      } else {
        const paidRow = {
          client_id: email || `legacy:${user_id}`,
          user_id,
          tax_type: "legacy",
          tax_name: "Legacy taxes paid",
          tax_rate: 0,
          tax_amount: Number(
            taxes_paid.toFixed ? taxes_paid.toFixed(2) : taxes_paid
          ),
          taxable_income: 0,
          tax_period: "yearly",
          due_date: created_at ? created_at.substring(0, 10) : null,
          status: "paid",
          description: "Imported total taxes paid from legacy sheet (EUR).",
          tax_year: taxYear,
          is_active: true,
          is_estimated: true,
          payment_reference: paidRef,
          created_at: created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("taxes")
          .upsert(paidRow, { onConflict: "payment_reference" });
        if (!error) {
          taxPaidUpserts++;
          if (!QUIET || processed % LOG_EVERY === 0)
            log(
              `  [TAX] Upserted taxes paid ref=${paidRef} amount=${taxes_paid}`
            );
        } else {
          fs.appendFileSync(
            outSkipped,
            `${JSON.stringify(csvUUID)},${JSON.stringify(
              emailRaw
            )},${JSON.stringify(`tax paid upsert failed: ${error.message}`)}\n`
          );
          warn(`  [TAX] Upsert paid failed: ${error.message}`);
        }
      }
    } else if (!QUIET || processed % LOG_EVERY === 0) {
      log("  [TAX] taxes_paid = 0 → no paid row");
    }
  } catch (e) {
    skipped++;
    fs.appendFileSync(
      outSkipped,
      `${JSON.stringify(csvUUID)},${JSON.stringify(emailRaw)},${JSON.stringify(
        `unhandled error: ${e.message || e}`
      )}\n`
    );
    err(`  [ERR] Unhandled row error: ${e.message || e}`);
  }

  // checkpoint
  if (processed % Math.max(50, LOG_EVERY) === 0) {
    info(
      `[CHK] Processed ${fmtNum(processed)} / ${fmtNum(
        rows.length
      )} rows... (skipped=${fmtNum(skipped)})`
    );
  }
}

hr();
info(`Done in ${((Date.now() - tStart) / 1000).toFixed(1)}s.`);
info(` EUR balances upserted: ${fmtNum(upsertsEUR)}`);
info(` USD rows ensured (0): ${fmtNum(insertsUSD)}`);
info(` CAD rows ensured (0): ${fmtNum(insertsCAD)}`);
info(` EUR deposits inserted: ${fmtNum(deposits)}`);
info(` Taxes due upserts:     ${fmtNum(taxDueUpserts)}`);
info(` Taxes paid upserts:    ${fmtNum(taxPaidUpserts)}`);
info(` Skipped rows:          ${fmtNum(skipped)}`);
info(` See: ${outSkipped}`);
if (skipped > 0 && !QUIET) {
  const lines = fs
    .readFileSync(outSkipped, "utf8")
    .split("\n")
    .slice(0, 12)
    .join("\n");
  log("\n[SKIPPED] Preview:");
  log(lines);
}
