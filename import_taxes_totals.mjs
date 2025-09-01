import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { parse } from "csv-parse/sync";

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

// CSV columns (extra columns are fine):
// user_id,email,taxes_due,taxes_paid,...
const csvPath = "./taxes_to_import_later.csv";
const rows = parse(fs.readFileSync(csvPath), {
  columns: true,
  skip_empty_lines: true,
});

// ---------- helpers ----------
const normEmail = (e) => (e || "").trim().toLowerCase();
const asNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/[, ]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// fetch ALL auth users (handles 10k+)
async function getAllAuthUsers() {
  let page = 1,
    all = [];
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    if (!data.users.length) break;
    all.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return all;
}

// ---------- preload lookups ----------
const authUsers = await getAllAuthUsers();
const authIdSet = new Set(authUsers.map((u) => u.id));
const authByEmail = {};
for (const u of authUsers)
  if (u.email) authByEmail[u.email.toLowerCase()] = u.id;
console.log(`Loaded ${authUsers.length} auth users.`);

// logs
const outSkipped = "./taxes_skipped.csv";
fs.writeFileSync(outSkipped, "user_id,email,reason\n");

// counters
let dueUpserts = 0,
  skipped = 0;

// optional: dedupe by user (keep first line per user)
const seen = new Set();

for (const r of rows) {
  const csvUserId = (r.user_id || "").trim();
  const emailRaw = r.email || "";
  const email = normEmail(emailRaw);
  const key = csvUserId || email;
  if (!key) {
    skipped++;
    fs.appendFileSync(outSkipped, `,,${JSON.stringify("no user_id/email")}\n`);
    continue;
  }
  if (seen.has(key)) continue;
  seen.add(key);

  // resolve user_id (prefer csv user_id, else email)
  let user_id = null;
  if (csvUserId && authIdSet.has(csvUserId)) user_id = csvUserId;
  else if (email && authByEmail[email]) user_id = authByEmail[email];

  if (!user_id) {
    skipped++;
    fs.appendFileSync(
      outSkipped,
      `${JSON.stringify(csvUserId)},${JSON.stringify(
        emailRaw
      )},${JSON.stringify("no matching auth.users id")}\n`
    );
    continue;
  }

  const taxes_due = asNum(r.taxes_due);
  if (taxes_due <= 0) continue; // nothing to store

  // Build the single “Taxes due” total row
  const clientId = emailRaw || user_id; // client_id is NOT NULL
  const payment_reference = `EUR:due:${user_id}`; // one running total per user

  const row = {
    client_id: clientId,
    tax_type: null, // now allowed to be NULL
    tax_name: "Taxes due",
    tax_rate: 0, // required NOT NULL
    tax_amount: Number(taxes_due.toFixed ? taxes_due.toFixed(2) : taxes_due),
    taxable_income: 0,
    tax_period: "yearly",
    due_date: null,
    status: "pending",
    description: null,
    is_active: true,
    is_estimated: false,
    created_by: "system",
  };

  // ---- update-or-insert by (user_id, payment_reference) ----
  // 1) UPDATE
  const { data: upd, error: updErr } = await supabase
    .from("taxes")
    .update({ ...row }) // your trigger keeps updated_at fresh
    .eq("user_id", user_id)
    .eq("payment_reference", payment_reference)
    .select("id");

  if (updErr) {
    skipped++;
    fs.appendFileSync(
      outSkipped,
      `${JSON.stringify(csvUserId)},${JSON.stringify(
        emailRaw
      )},${JSON.stringify(`tax update failed: ${updErr.message}`)}\n`
    );
    continue;
  }
  if (upd && upd.length > 0) {
    dueUpserts++;
    continue;
  }

  // 2) INSERT if nothing updated
  const { error: insErr } = await supabase.from("taxes").insert({
    ...row,
    user_id,
    payment_reference,
  });
  if (insErr) {
    skipped++;
    fs.appendFileSync(
      outSkipped,
      `${JSON.stringify(csvUserId)},${JSON.stringify(
        emailRaw
      )},${JSON.stringify(`tax insert failed: ${insErr.message}`)}\n`
    );
    continue;
  }
  dueUpserts++;
}

console.log(`Done.
 Taxes due upserts:  ${dueUpserts}
 Skipped rows:       ${skipped}
See: ${outSkipped}`);
