import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { parse } from "csv-parse/sync";
import crypto from "crypto";

// ====== CONFIG ======
const CSV_PATH = "./users.csv"; // your Excel export as CSV
const THROTTLE_MS = 0;
// ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "[BOOT] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- helpers ----------
const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const sanitizeEmail = (raw) => {
  if (!raw) return "";
  const s = String(raw).trim();
  const m = s.match(emailRe);
  return m ? m[0].toLowerCase() : "";
};
const toBool = (v) => {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
};
const parseISO = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const pick = (hdrs, ...cands) => cands.find((k) => hdrs.includes(k)) || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- read CSV ----------
console.time("[CSV] read");
if (!fs.existsSync(CSV_PATH)) {
  console.error(`[CSV] File not found: ${CSV_PATH}`);
  process.exit(1);
}
const rows = parse(fs.readFileSync(CSV_PATH), {
  columns: true,
  skip_empty_lines: true,
});
console.timeEnd("[CSV] read");
console.log(`[CSV] rows: ${rows.length}`);

const headers = Object.keys(rows[0] || {});
console.log("[CSV] headers:", headers);

const COL = {
  email: pick(headers, "email", "Email"),
  password: pick(headers, "password", "Password"),
  first: pick(headers, "first_name", "First Name", "firstname", "First_Name"),
  last: pick(headers, "last_name", "Last Name", "lastname", "Last_Name"),
  full: pick(headers, "full_name", "Full Name", "fullName", "Full_Name"),
  verified: pick(headers, "verified", "is_verified", "kyc_verified"),
  createdAt: pick(headers, "created_at", "created_a", "created", "Created At"),
};
console.log("[MAP] columns:", COL);

// ---------- preload existing emails from DB (public + auth) ----------
async function preloadAllPublicEmails() {
  const set = new Set();
  const batch = 2000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("users")
      .select("email")
      .order("id", { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.email) set.add(r.email.toLowerCase());
    if (data.length < batch) break;
    from += batch;
  }
  return set;
}

async function preloadAllAuthEmails() {
  const set = new Set();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) if (u.email) set.add(u.email.toLowerCase());
    if (data.users.length < 1000) break;
    page++;
  }
  return set;
}

console.time("[PRELOAD] emails");
const publicEmails = await preloadAllPublicEmails();
const authEmails = await preloadAllAuthEmails();
console.timeEnd("[PRELOAD] emails");
console.log(`[PRELOAD] public.users emails: ${publicEmails.size}`);
console.log(`[PRELOAD] auth.users emails:   ${authEmails.size}`);

// union set: if email exists anywhere, we SKIP
const existingEmails = new Set([...publicEmails, ...authEmails]);

// ---------- logging ----------
const logFile = "./import_users_skip_duplicates.log";
fs.writeFileSync(logFile, "row,email,action,details\n");
const log = (row, email, action, details = "") =>
  fs.appendFileSync(
    logFile,
    `${row},${JSON.stringify(email)},${action},${JSON.stringify(details)}\n`
  );

// ---------- process ----------
let created = 0,
  skippedInvalid = 0,
  skippedCSVdupe = 0,
  skippedExisting = 0,
  failed = 0;
const seenCSV = new Set();

console.time("[RUN] rows");

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const rowNum = i + 1;

  const emailRaw = COL.email ? String(r[COL.email] ?? "").trim() : "";
  const email = sanitizeEmail(emailRaw);
  const pwdRaw = COL.password ? String(r[COL.password] ?? "") : "";
  const first_name = COL.first
    ? r[COL.first]
      ? String(r[COL.first]).trim()
      : null
    : null;
  const last_name = COL.last
    ? r[COL.last]
      ? String(r[COL.last]).trim()
      : null
    : null;
  const full_name = COL.full
    ? r[COL.full]
      ? String(r[COL.full]).trim()
      : null
    : first_name || last_name
    ? [first_name || "", last_name || ""].join(" ").trim()
    : null;
  const created_at = parseISO(COL.createdAt ? r[COL.createdAt] : null);
  const kyc_status = toBool(COL.verified ? r[COL.verified] : false)
    ? "approved"
    : "not_started";

  console.log(
    `\n[ROW ${rowNum}/${rows.length}] emailRaw=${emailRaw} -> email=${email}`
  );

  // 1) invalid email -> SKIP
  if (!email) {
    skippedInvalid++;
    log(rowNum, emailRaw, "skip_invalid_email");
    console.log(`[ROW ${rowNum}] SKIP (invalid email)`);
    continue;
  }

  // 2) duplicate in the SAME CSV -> SKIP (keep first)
  if (seenCSV.has(email)) {
    skippedCSVdupe++;
    log(rowNum, email, "skip_csv_duplicate");
    console.log(`[ROW ${rowNum}] SKIP (duplicate in CSV)`);
    continue;
  }
  seenCSV.add(email);

  // 3) already exists in DB (public OR auth) -> SKIP (NO update/insert)
  if (existingEmails.has(email)) {
    skippedExisting++;
    log(rowNum, email, "skip_existing_in_db");
    console.log(`[ROW ${rowNum}] SKIP (already exists in DB)`);
    continue;
  }

  // 4) brand-new -> create auth, then insert into public.users
  const authPassword =
    pwdRaw && pwdRaw.length >= 6 ? pwdRaw : crypto.randomUUID();

  console.time(`[ROW ${rowNum}] auth.create`);
  const { data: createdAuth, error: cErr } =
    await supabase.auth.admin.createUser({
      email,
      password: authPassword,
      email_confirm: true,
      user_metadata: { import_source: "excel" },
    });
  console.timeEnd(`[ROW ${rowNum}] auth.create`);

  if (cErr) {
    failed++;
    log(rowNum, email, "auth_create_error", cErr.message || cErr);
    console.error(`[ROW ${rowNum}] AUTH ERROR:`, cErr.message || cErr);
    continue;
  }
  const authId = createdAuth.user?.id;

  console.time(`[ROW ${rowNum}] users.insert`);
  const { error: insErr } = await supabase.from("users").insert({
    id: authId,
    email,
    password: pwdRaw || null, // WARNING: plaintext copy per your request
    first_name,
    last_name,
    full_name,
    created_at,
    kyc_status,
  });
  console.timeEnd(`[ROW ${rowNum}] users.insert`);

  if (insErr) {
    failed++;
    log(rowNum, email, "users_insert_error", insErr.message || insErr);
    console.error(`[ROW ${rowNum}] USERS ERROR:`, insErr.message || insErr);
    // rollback auth to avoid orphan
    try {
      await supabase.auth.admin.deleteUser(authId);
    } catch {}
    continue;
  }

  // mark as existing to protect against later rows in same run
  existingEmails.add(email);
  created++;
  log(rowNum, email, "created_auth_and_user", `id=${authId}`);
  console.log(`[ROW ${rowNum}] DONE (created)`);
  if (THROTTLE_MS) await sleep(THROTTLE_MS);
}

console.timeEnd("[RUN] rows");
console.log("\n==================== SUMMARY ====================");
console.log("Created new users:          ", created);
console.log("Skipped invalid emails:     ", skippedInvalid);
console.log("Skipped CSV duplicates:     ", skippedCSVdupe);
console.log("Skipped existing in DB:     ", skippedExisting);
console.log("Failed rows:                ", failed);
console.log("Log file:", logFile);
