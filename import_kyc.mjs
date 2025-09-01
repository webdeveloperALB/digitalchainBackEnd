import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { parse } from "csv-parse/sync";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const csvPath = "./kyc_legacy.csv"; // <-- put your new Excel export here (as CSV)
const rows = parse(fs.readFileSync(csvPath), {
  columns: true,
  skip_empty_lines: true,
});

// --- helpers ---
const normEmail = (e) => (e || "").trim().toLowerCase();

function mapStatus(s) {
  const v = (s || "").trim().toLowerCase();
  if (["approved", "verified", "ok", "success"].includes(v)) return "approved";
  if (["rejected", "denied", "failed"].includes(v)) return "rejected";
  if (v === "pending" || v === "in_review") return "pending";
  return "pending";
}

function parseTS(v) {
  // Return ISO string or null to let DB default to now()
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// fetch all auth users (handles >1000 via pagination)
async function getAllAuthUsers() {
  let page = 1;
  const all = [];
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

// Build lookup maps for auth.users
const authUsers = await getAllAuthUsers();
const authIdSet = new Set(authUsers.map((u) => u.id));
const authByEmail = {};
for (const u of authUsers)
  if (u.email) authByEmail[u.email.toLowerCase()] = u.id;
console.log(`Loaded ${authUsers.length} auth users.`);

// Prepare skipped log
const skippedPath = "./kyc_skipped.csv";
fs.writeFileSync(
  skippedPath,
  "user_id,full_name,email,status,submitted_at,reason\n"
);

// Deduper key: userKey|submitted_at
const seen = new Set();

let inserted = 0,
  skippedNoAuth = 0,
  skippedDup = 0,
  failed = 0;

for (const r of rows) {
  const csvUserId = (r.user_id || "").trim();
  const emailRaw = r.email || "";
  const email = normEmail(emailRaw);
  const submittedAt = parseTS(r.submitted_at);
  const status = mapStatus(r.status);
  const fullName = (r.full_name || "").trim();

  // dedupe key (prefer user_id if present; else email)
  const userKey = csvUserId || email;
  const deKey = `${userKey}|${submittedAt || ""}`;
  if (seen.has(deKey)) {
    skippedDup++;
    continue;
  }
  seen.add(deKey);

  // Find a valid auth user id
  let userId = null;
  if (csvUserId && authIdSet.has(csvUserId)) {
    userId = csvUserId;
  } else if (email && authByEmail[email]) {
    userId = authByEmail[email];
  }

  if (!userId) {
    // FK would fail — log and continue
    skippedNoAuth++;
    const line =
      [
        JSON.stringify(csvUserId),
        JSON.stringify(fullName),
        JSON.stringify(emailRaw),
        JSON.stringify(r.status || ""),
        JSON.stringify(r.submitted_at || ""),
        JSON.stringify("no matching auth.users id"),
      ].join(",") + "\n";
    fs.appendFileSync(skippedPath, line);
    continue;
  }

  // Build row with placeholders for required fields you don't have
  const row = {
    user_id: userId,
    document_type: "passport", // allowed: 'passport' | 'id_card'
    document_number: `LEGACY-${crypto.randomUUID()}`, // placeholder
    full_name: fullName || email || "Unknown",
    date_of_birth: "1970-01-01", // placeholder (NOT NULL)
    address: "Legacy import",
    city: "Unknown",
    country: "Unknown",
    postal_code: null,
    id_document_path: "legacy/placeholder", // placeholder path text
    driver_license_path: null, // optional
    utility_bill_path: "legacy/placeholder", // placeholder
    selfie_path: "legacy/placeholder", // placeholder
    status, // 'pending' | 'approved' | 'rejected'
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_at: submittedAt, // null -> DB default now()
    // created_at / updated_at default to now()
  };

  const { error } = await supabase.from("kyc_verifications").insert(row);
  if (error) {
    failed++;
    const line =
      [
        JSON.stringify(csvUserId),
        JSON.stringify(fullName),
        JSON.stringify(emailRaw),
        JSON.stringify(r.status || ""),
        JSON.stringify(r.submitted_at || ""),
        JSON.stringify(`insert failed: ${error.message}`),
      ].join(",") + "\n";
    fs.appendFileSync(skippedPath, line);
    continue;
  }
  inserted++;
}

console.log(
  `Done. Inserted: ${inserted}. Skipped (no auth match): ${skippedNoAuth}. Skipped dups: ${skippedDup}. Failed inserts: ${failed}.`
);
console.log(`See details for skipped in ${skippedPath}`);
