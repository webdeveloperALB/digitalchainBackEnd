// import_taxes_only.mjs
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

// CSV: uuid,email,total_deposits,balance,on_hold,taxes_due,taxes_paid,available_balance,total_funds,created_at
const csvPath = "./legacy_financials.csv";
const rows = parse(fs.readFileSync(csvPath), {
  columns: true,
  skip_empty_lines: true,
});

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
const yearOf = (iso) => {
  if (!iso) return new Date().getUTCFullYear();
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? new Date().getUTCFullYear()
    : d.getUTCFullYear();
};

// load ALL auth users (pagination)
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

const authUsers = await getAllAuthUsers();
const authIdSet = new Set(authUsers.map((u) => u.id));
const authByEmail = {};
for (const u of authUsers)
  if (u.email) authByEmail[u.email.toLowerCase()] = u.id;
console.log(`Loaded ${authUsers.length} auth users.`);

const outSkipped = "./taxes_skipped.csv";
fs.writeFileSync(outSkipped, "uuid,email,reason\n");

let dueUpserts = 0,
  paidUpserts = 0,
  skipped = 0;

// Optional: only one pair per user
const seen = new Set();

for (const r of rows) {
  const csvUUID = (r.uuid || "").trim();
  const emailRaw = r.email || "";
  const email = normEmail(emailRaw);
  const key = csvUUID || email;
  if (!key) {
    skipped++;
    fs.appendFileSync(outSkipped, `,,${JSON.stringify("no uuid/email")}\n`);
    continue;
  }
  if (seen.has(key)) continue;
  seen.add(key);

  // resolve user
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
    continue;
  }

  const created_at = parseTS(r.created_at);
  const taxYear = yearOf(created_at);
  const taxes_due = asNum(r.taxes_due);
  const taxes_paid = asNum(r.taxes_paid);

  async function updateOrInsert(row, payment_reference) {
    // UPDATE first (by user_id + payment_reference)
    const { data: upd, error: updErr } = await supabase
      .from("taxes")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("payment_reference", payment_reference)
      .select("id");

    if (updErr) {
      fs.appendFileSync(
        outSkipped,
        `${JSON.stringify(csvUUID)},${JSON.stringify(
          emailRaw
        )},${JSON.stringify(`tax update failed: ${updErr.message}`)}\n`
      );
      return false;
    }
    if (upd && upd.length > 0) return true;

    // INSERT if nothing updated
    const { error: insErr } = await supabase.from("taxes").insert({
      ...row,
      user_id,
      payment_reference,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) {
      fs.appendFileSync(
        outSkipped,
        `${JSON.stringify(csvUUID)},${JSON.stringify(
          emailRaw
        )},${JSON.stringify(`tax insert failed: ${insErr.message}`)}\n`
      );
      return false;
    }
    return true;
  }

  const clientId = email || user_id; // required, not null
  const common = {
    client_id: clientId,
    tax_type: null,
    tax_rate: 0, // NOT NULL column; keep 0 if unknown
    taxable_income: 0,
    tax_period: "yearly",
    due_date: created_at ? created_at.substring(0, 10) : null,
    tax_year: taxYear,
    is_active: true,
    is_estimated: false,
    description: null, // leave empty (NULL) if you want
    created_by: "system",
    created_at: created_at || new Date().toISOString(),
  };

  if (taxes_due > 0) {
    const dueRef = `EUR:due:${user_id}:${taxYear}`;
    const dueRow = {
      ...common,
      tax_name: "Taxes due",
      status: "pending",
      tax_amount: Number(taxes_due.toFixed ? taxes_due.toFixed(2) : taxes_due),
    };
    if (await updateOrInsert(dueRow, dueRef)) dueUpserts++;
  }

  if (taxes_paid > 0) {
    const paidRef = `EUR:paid:${user_id}:${taxYear}`;
    const paidRow = {
      ...common,
      tax_name: "Taxes paid",
      status: "paid",
      tax_amount: Number(
        taxes_paid.toFixed ? taxes_paid.toFixed(2) : taxes_paid
      ),
    };
    if (await updateOrInsert(paidRow, paidRef)) paidUpserts++;
  }
}

console.log(`Done.
 Taxes due upserts:  ${dueUpserts}
 Taxes paid upserts: ${paidUpserts}
 Skipped rows:       ${skipped}
See: ${outSkipped}`);
