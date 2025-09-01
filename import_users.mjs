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

const csvPath = "./legacy_users.csv";
const rows = parse(fs.readFileSync(csvPath), {
  columns: true,
  skip_empty_lines: true,
});

// helpers
function toBool(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}
function mapKycStatus(verifiedVal) {
  return toBool(verifiedVal) ? "approved" : "not_started";
}
function normEmail(e) {
  return (e || "").trim().toLowerCase();
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

// build a map of all existing auth users (lowercased email → id)
const existingUsers = {};
const authUsers = await getAllAuthUsers();
for (const u of authUsers) {
  if (u.email) existingUsers[u.email.toLowerCase()] = u.id;
}
console.log(`Loaded ${authUsers.length} existing auth users.`);

const seen = new Set();

for (const r of rows) {
  const rawEmail = r.email || "";
  const email = normEmail(rawEmail);

  if (!email) {
    console.warn("Row skipped: no email field at all");
    continue;
  }
  if (seen.has(email)) {
    console.warn("Skipping duplicate in CSV:", email);
    continue;
  }
  seen.add(email);

  const plainPw =
    r.password && String(r.password).trim().length >= 6
      ? String(r.password).trim()
      : null;
  const tempPw = plainPw || crypto.randomUUID();
  const emailConfirmed = toBool(r.verified);
  const kyc_status = mapKycStatus(r.verified);

  let userId = null;
  let createdInAuth = false;

  if (existingUsers[email]) {
    // Already known in auth
    userId = existingUsers[email];
    console.log("Auth already has user:", email);
  } else {
    // Try to create new auth user
    const { data: created, error: e1 } = await supabase.auth.admin.createUser({
      email,
      password: tempPw,
      email_confirm: emailConfirmed,
      user_metadata: {
        legacy_uuid: r.uuid || null,
        legacy_old_user_id: r.old_user_id || null,
        legacy_btc_wallet: r.btc_wallet || null,
        legacy_verified: r.verified ?? null,
      },
    });

    if (e1) {
      console.warn("auth create failed for", rawEmail, "-", e1.message);
      // no user in auth → fallback
    } else {
      userId = created.user?.id;
      createdInAuth = true;
      existingUsers[email] = userId; // add to map so later duplicates know about it
    }
  }

  // If no auth id, create random id just for public.users
  if (!userId) {
    userId = crypto.randomUUID();
    console.warn(
      "No auth id, generating new uuid for public.users only:",
      rawEmail
    );
  }

  // Insert into public.users if not exists
  let createdAt = null;
  try {
    if (r.created_at) createdAt = new Date(r.created_at).toISOString();
  } catch {}

  const { error: e2 } = await supabase.from("users").insert({
    id: userId,
    email: rawEmail || null, // preserve exactly what was in CSV
    password: plainPw || null,
    first_name: r.first_name || null,
    last_name: r.last_name || null,
    full_name: r.full_name || null,
    created_at: createdAt,
    kyc_status,
  });

  if (e2) {
    if (/duplicate key value/i.test(e2.message)) {
      console.warn("public.users already has row for:", rawEmail);
    } else {
      console.error("public.users insert error for", rawEmail, e2.message);
      continue;
    }
  }

  console.log(
    `Row done: ${rawEmail} -> ${userId} kyc: ${kyc_status}` +
      (createdInAuth
        ? " (auth created)"
        : existingUsers[email]
        ? " (auth existed)"
        : " (public only)")
  );
}

console.log("Done.");
