import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { parse as parseCsv } from "csv-parse/sync";
import dotenv from "dotenv";

// ───────────────────────────────────────────────────────────────────────────────
// Load env
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY; // service role key
const CSV_PATH = process.argv[2] || "./taxes.csv";
const DRY_RUN = process.argv.includes("--dry-run"); // optional flag
const INSERT_CHUNK = 500; // rows per insert
const QUERY_CHUNK = 500; // emails per .in() query

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE env vars. Check .env.local");
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
const NULLY = /^(null|nil|n\/a|na|undefined|empty|-)$/i;

function normalizeEmail(e) {
  if (e === undefined || e === null) return null;
  let s = String(e)
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\u00A0/g, " ") // non-breaking space
    .trim();
  if (!s || NULLY.test(s)) return null;
  return s.toLowerCase();
}

function num(val) {
  if (val === undefined || val === null) return 0;
  const s = String(val).trim();
  if (!s || NULLY.test(s)) return 0;
  // keep digits, minus and dot; remove commas/currency/sci notation junk
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function first(obj, keys) {
  for (const k of keys) if (k in obj && obj[k] !== undefined) return obj[k];
  return undefined;
}

function unique(arr) {
  return [...new Set(arr)];
}

// ───────────────────────────────────────────────────────────────────────────────
// Init client
console.log("🔗 Connecting to Supabase…");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ───────────────────────────────────────────────────────────────────────────────
// Load CSV
console.log(`📂 Reading CSV: ${CSV_PATH}`);
const csvText = fs.readFileSync(CSV_PATH, "utf8");
const rawRows = parseCsv(csvText, { columns: true, skip_empty_lines: true });
console.log(`📊 CSV rows: ${rawRows.length}`);

// Accept multiple header variants just in case
const parsed = rawRows
  .map((row, i) => {
    const email = normalizeEmail(first(row, ["email", "Email", "EMAIL"]));
    const on_hold = num(
      first(row, ["on_hold", "On_Hold", "on hold", "ON_HOLD"])
    );
    const taxes_due = num(
      first(row, ["taxes_due", "taxes", "tax_due", "Taxes_Due"])
    );
    const taxes_paid = num(
      first(row, ["taxes_paid", "taxes_paic", "tax_paid", "Taxes_Paid", "paid"])
    );
    const created_at =
      (row.created_at && String(row.created_at).trim()) || null; // leave null to let DB default now()

    return { rownum: i + 1, email, on_hold, taxes_due, taxes_paid, created_at };
  })
  .filter((r) => !!r.email); // only keep rows that actually have an email

console.log(`✅ After cleaning: ${parsed.length} rows with usable email`);

// ───────────────────────────────────────────────────────────────────────────────
// Fetch users ONLY for emails in CSV (chunked .in())
// Then map by lowercased email for case-insensitive matching
async function fetchUsersForEmails(emails) {
  const result = [];
  const list = unique(emails).filter(Boolean);
  console.log(`👥 Need user IDs for ${list.length} unique emails`);

  for (let i = 0; i < list.length; i += QUERY_CHUNK) {
    const slice = list.slice(i, i + QUERY_CHUNK);
    console.log(
      `🔎 Querying users (exact match) ${i + 1}..${i + slice.length}`
    );
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .in("email", slice);

    if (error) {
      console.error("❌ Error querying users with .in():", error);
      process.exit(1);
    }
    result.push(...(data || []));
  }

  // Build map (lowercase)
  const map = new Map(result.map((u) => [normalizeEmail(u.email), u.id]));

  // Fallback: try case-insensitive lookups for any emails not found above
  const missing = list.filter((e) => !map.has(normalizeEmail(e)));
  if (missing.length) {
    console.log(
      `🟠 ${missing.length} emails not found by exact match. Trying case-insensitive lookups…`
    );
    // Query one-by-one with ilike (safe since it's only the remainder)
    for (const e of missing) {
      const { data, error } = await supabase
        .from("users")
        .select("id,email")
        .ilike("email", e) // ilike is case-insensitive; exact value, no wildcards
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn(`  ⚠ ilike lookup failed for ${e}:`, error.message);
        continue;
      }
      if (data) {
        map.set(normalizeEmail(data.email), data.id);
      }
    }
  }

  console.log(`✅ Resolved ${map.size} email → user_id mappings`);
  return map;
}

// ───────────────────────────────────────────────────────────────────────────────
// Build insert payload
async function run() {
  const emailList = parsed.map((r) => r.email);
  const emailToId = await fetchUsersForEmails(emailList);

  const toInsert = [];
  const unmatched = [];

  for (const r of parsed) {
    const user_id = emailToId.get(r.email);
    if (!user_id) {
      unmatched.push({ email: r.email, rownum: r.rownum });
      continue;
    }
    toInsert.push({
      user_id,
      taxes: r.taxes_due,
      on_hold: r.on_hold,
      paid: r.taxes_paid,
      // let DB default if missing/blank
      ...(r.created_at ? { created_at: r.created_at } : {}),
    });
  }

  console.log(`📦 Ready to insert: ${toInsert.length} rows`);
  console.log(`🚫 Unmatched emails: ${unmatched.length}`);

  // Write unmatched for review
  if (unmatched.length) {
    const out =
      "rownum,email\n" +
      unmatched.map((u) => `${u.rownum},${u.email}`).join("\n");
    fs.writeFileSync("./_unmatched_emails.csv", out);
    console.log(
      "📝 Wrote _unmatched_emails.csv with the rows that didn't match any user"
    );
  }

  if (DRY_RUN) {
    console.log(
      "🔎 DRY RUN — no inserts performed. Use without --dry-run to write."
    );
    return;
  }

  if (toInsert.length === 0) {
    console.log("⛔ Nothing to insert.");
    return;
  }

  // Chunked inserts
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    console.log(
      `🚀 Inserting ${chunk.length} rows (${i + 1}..${i + chunk.length})…`
    );
    const { error } = await supabase.from("taxes").insert(chunk);
    if (error) {
      console.error("❌ Insert error:", error);
      // Write the failing chunk so you can retry just that part
      fs.writeFileSync("./_failed_chunk.json", JSON.stringify(chunk, null, 2));
      console.log("📝 Wrote _failed_chunk.json with the payload that failed.");
      process.exit(1);
    }
  }

  console.log("🎉 Import complete!");
}

run().catch((e) => {
  console.error("💥 Fatal error:", e);
  process.exit(1);
});
