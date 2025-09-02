import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { parse } from "csv-parse/sync";

// ====== CONFIG ======
const CSV_PATH = "./taxes&balance.csv"; // your Excel exported to CSV
const CURRENCY = "EUR";
const DEPOSIT_METHOD = "legacy_import";
const DEPOSIT_REF_PREFIX = "sheet:total_deposits"; // makes deposits idempotent
const TAX_REF_PREFIX = "sheet:taxes_due"; // makes taxes idempotent
const LOG_EVERY = 100; // progress interval
// ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- helpers ----------
const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const normalizeEmail = (raw) => {
  if (!raw) return "";
  const s = String(raw).trim();
  const m = s.match(emailRe);
  return m ? m[0].trim().toLowerCase() : "";
};
const asNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const parseTS = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const pick = (hdrs, ...cands) => cands.find((k) => hdrs.includes(k)) || null;

// ---------- read CSV ----------
console.time("[CSV] read");
if (!fs.existsSync(CSV_PATH)) {
  console.error(`CSV not found: ${CSV_PATH}`);
  process.exit(1);
}
const rows = parse(fs.readFileSync(CSV_PATH), {
  columns: true,
  skip_empty_lines: true,
});
console.timeEnd("[CSV] read");
const headers = Object.keys(rows[0] || {});
console.log(`[CSV] rows=${rows.length}`);
console.log("[CSV] headers:", headers);

// Header variants supported
const COL = {
  email: pick(headers, "email", "Email"),
  total_deposits: pick(
    headers,
    "total_deposits",
    "total_dep",
    "total_deposit",
    "total_deps",
    "total_depo"
  ),
  total_funds: pick(headers, "total_funds", "total_func", "total_fund"),
  taxes_due: pick(headers, "taxes_due", "taxes due", "taxes_due "),
  created_at: pick(headers, "created_at", "created", "Created At"),
};

if (!COL.email) {
  console.error("CSV must have an 'email' header (case-insensitive).");
  process.exit(1);
}

// ---------- preload users: normalized email -> id ----------
async function preloadUsersByEmail() {
  const map = new Map(); // normEmail -> authId
  const BATCH = 2000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const u of data) {
      const key = normalizeEmail(u.email);
      if (key) map.set(key, u.id);
    }
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return map;
}

console.time("[PRELOAD] users");
const usersByEmail = await preloadUsersByEmail();
console.timeEnd("[PRELOAD] users");
console.log(`[PRELOAD] users with email: ${usersByEmail.size}`);

// ---------- counters & logs ----------
let eurUpserts = 0,
  taxesUpserts = 0,
  depositsInserted = 0,
  noEmail = 0,
  noUser = 0,
  csvDup = 0,
  processed = 0;

const skippedPath = "./balances_taxes_deposits_skipped.csv";
fs.writeFileSync(skippedPath, "email,reason\n");

// per-run CSV dedupe
const seen = new Set();

// ---------- main ----------
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const rowNo = i + 1;

  const emailRaw = r[COL.email] ?? "";
  const email = normalizeEmail(emailRaw);

  if (!email) {
    console.log(`[ROW ${rowNo}] SKIP: invalid/empty email ->`, emailRaw);
    noEmail++;
    fs.appendFileSync(
      skippedPath,
      `${JSON.stringify(emailRaw)},${JSON.stringify(
        "invalid or empty email"
      )}\n`
    );
    continue;
  }
  if (seen.has(email)) {
    console.log(`[ROW ${rowNo}] SKIP: duplicate email in CSV ->`, email);
    csvDup++;
    continue;
  }
  seen.add(email);

  // -------- resolve user_id (preload → exact → ILIKE → guarded wildcard) --------
  let user_id = usersByEmail.get(email);
  if (user_id) {
    console.log(
      `[ROW ${rowNo}] user resolved by PRELOAD -> ${email} id=${user_id}`
    );
  }

  if (!user_id) {
    const { data: u1, error: e1 } = await supabase
      .from("users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();
    if (!e1 && u1?.id) {
      user_id = u1.id;
      usersByEmail.set(email, user_id);
      console.log(
        `[ROW ${rowNo}] user resolved by EXACT match -> ${email} id=${user_id}`
      );
    }
  }

  if (!user_id) {
    const { data: u2, error: e2 } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", email) // case-insensitive equality
      .maybeSingle();
    if (!e2 && u2?.id) {
      user_id = u2.id;
      usersByEmail.set(email, user_id);
      console.log(
        `[ROW ${rowNo}] user resolved by ILIKE (exact) -> db_email="${u2.email}" id=${user_id}`
      );
    }
  }

  if (!user_id) {
    const { data: many, error: e3 } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", `%${email}%`); // guarded wildcard
    if (!e3 && many?.length) {
      const match = many.find((u) => normalizeEmail(u.email) === email);
      if (match?.id) {
        user_id = match.id;
        usersByEmail.set(email, user_id);
        console.log(
          `[ROW ${rowNo}] user resolved by wildcard+normalize -> db_email="${match.email}" id=${user_id}`
        );
      }
    }
  }

  if (!user_id) {
    console.log(
      `[ROW ${rowNo}] SKIP: email not found in public.users ->`,
      email,
      `(raw="${emailRaw}")`
    );
    noUser++;
    fs.appendFileSync(
      skippedPath,
      `${JSON.stringify(email)},${JSON.stringify(
        "no matching user in public.users"
      )}\n`
    );
    continue;
  }

  const totalDeposits = asNum(r[COL.total_deposits]);
  const totalFunds = asNum(r[COL.total_funds]);
  const taxesDue = asNum(r[COL.taxes_due]);
  const createdAt = parseTS(r[COL.created_at]);

  console.log(
    `[ROW ${rowNo}] email=${email} | user_id=${user_id} | funds=${totalFunds} | deposits=${totalDeposits} | taxes_due=${taxesDue} | created_at=${
      createdAt || "null"
    }`
  );

  // --- 1) Upsert EUR balance (total_funds)
  {
    const { error } = await supabase.from("euro_balances").upsert(
      {
        user_id,
        balance: totalFunds,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.log(
        `[ROW ${rowNo}] euro_balances UPSERT ERROR:`,
        error.message || error
      );
      fs.appendFileSync(
        skippedPath,
        `${JSON.stringify(email)},${JSON.stringify(
          "euro_balances upsert failed: " + error.message
        )}\n`
      );
    } else {
      eurUpserts++;
      console.log(
        `[ROW ${rowNo}] euro_balances UPSERT OK -> balance=${totalFunds}`
      );
    }
  }

  // --- 2) Taxes due (always write, even if 0)
  {
    const ref = `${TAX_REF_PREFIX}:${user_id}`;
    const taxRow = {
      client_id: email, // NOT NULL
      user_id, // FK
      tax_type: null, // leave empty
      tax_name: "Taxes due", // NOT NULL (minimal)
      tax_rate: 0, // NOT NULL
      tax_amount: Number(taxesDue.toFixed ? taxesDue.toFixed(2) : taxesDue),
      taxable_income: 0,
      tax_period: "yearly",
      due_date: null,
      status: "pending",
      description: null,
      is_active: true,
      is_estimated: false,
      payment_reference: ref,
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update-first (idempotent), then insert if not found
    const { data: upd, error: updErr } = await supabase
      .from("taxes")
      .update({ ...taxRow })
      .eq("user_id", user_id)
      .eq("payment_reference", ref)
      .select("id");

    if (updErr) {
      console.log(
        `[ROW ${rowNo}] taxes UPDATE ERROR:`,
        updErr.message || updErr
      );
      fs.appendFileSync(
        skippedPath,
        `${JSON.stringify(email)},${JSON.stringify(
          "taxes update failed: " + updErr.message
        )}\n`
      );
    } else if (!upd || upd.length === 0) {
      const { error: insErr } = await supabase
        .from("taxes")
        .insert({ ...taxRow });
      if (insErr) {
        console.log(
          `[ROW ${rowNo}] taxes INSERT ERROR:`,
          insErr.message || insErr
        );
        fs.appendFileSync(
          skippedPath,
          `${JSON.stringify(email)},${JSON.stringify(
            "taxes insert failed: " + insErr.message
          )}\n`
        );
      } else {
        taxesUpserts++;
        console.log(
          `[ROW ${rowNo}] taxes UPSERT OK -> amount=${taxRow.tax_amount}`
        );
      }
    } else {
      taxesUpserts++;
      console.log(
        `[ROW ${rowNo}] taxes UPSERT OK (updated) -> amount=${taxRow.tax_amount}`
      );
    }
  }

  // --- 3) Deposit (only if total_deposits > 0; insert once)
  if (totalDeposits > 0) {
    const ref = `${DEPOSIT_REF_PREFIX}:${CURRENCY}:${user_id}`;
    const { data: existing, error: selErr } = await supabase
      .from("deposits")
      .select("id")
      .eq("user_id", user_id)
      .eq("reference_id", ref)
      .limit(1)
      .maybeSingle();

    if (selErr) {
      console.log(
        `[ROW ${rowNo}] deposits SELECT ERROR:`,
        selErr.message || selErr
      );
      fs.appendFileSync(
        skippedPath,
        `${JSON.stringify(email)},${JSON.stringify(
          "deposits select failed: " + selErr.message
        )}\n`
      );
    } else if (existing) {
      console.log(`[ROW ${rowNo}] deposits SKIP (exists) -> ref=${ref}`);
    } else {
      const { error: insErr } = await supabase.from("deposits").insert({
        user_id,
        client_id: email,
        currency: CURRENCY,
        amount: totalDeposits,
        method: DEPOSIT_METHOD,
        reference_id: ref,
        status: "Completed",
        bank_details: null,
        crypto_details: null,
        admin_notes: "Imported aggregate deposits from legacy CSV",
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      });
      if (insErr) {
        console.log(
          `[ROW ${rowNo}] deposits INSERT ERROR:`,
          insErr.message || insErr
        );
        fs.appendFileSync(
          skippedPath,
          `${JSON.stringify(email)},${JSON.stringify(
            "deposits insert failed: " + insErr.message
          )}\n`
        );
      } else {
        depositsInserted++;
        console.log(
          `[ROW ${rowNo}] deposits INSERT OK -> amount=${totalDeposits}, ref=${ref}`
        );
      }
    }
  } else {
    console.log(`[ROW ${rowNo}] deposits SKIP (amount is 0)`);
  }

  processed++;
  if (processed % LOG_EVERY === 0) {
    console.log(
      `[PROGRESS] ${processed}/${rows.length} | EUR upserts=${eurUpserts} | taxes upserts=${taxesUpserts} | deposits=${depositsInserted}`
    );
  }
}

console.log(`\n======== SUMMARY ========`);
console.log(`Processed rows:            ${processed}`);
console.log(`EUR balances upserted:     ${eurUpserts}`);
console.log(`Taxes due upserts:         ${taxesUpserts}`);
console.log(`Deposits inserted:         ${depositsInserted}`);
console.log(`Skipped invalid emails:    ${noEmail}`);
console.log(`Skipped (email not found): ${noUser}`);
console.log(`Skipped CSV duplicates:    ${csvDup}`);
console.log(`Skipped log file:          ${skippedPath}`);
