import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import crypto from "crypto";

// ====== CONFIG ======
const INPUT_PATH = "./scripts/TransactionHistory_rows.sql";
const BATCH_INSERT = 300;  // tune if needed
const LOG_EVERY = 200;     // progress cadence
const DEFAULT_CURRENCY = "EUR";  // schema requires not-null
const DEFAULT_AMOUNT = 0;        // no amounts in legacy rows
// ====================

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
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
const parseTS = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");

// split top-level tuples in VALUES (...), (...) respecting quotes/parentheses
function splitTuples(valuesStr) {
  const out = [];
  let depth = 0, cur = "", inStr = false, q = null, esc = false;
  for (let i = 0; i < valuesStr.length; i++) {
    const c = valuesStr[i];
    if (inStr) {
      cur += c;
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === q) { inStr = false; q = null; }
      continue;
    }
    if (c === "'" || c === '"') { inStr = true; q = c; cur += c; continue; }
    if (c === "(") { depth++; cur += c; continue; }
    if (c === ")") { depth--; cur += c; if (depth === 0) { out.push(cur.trim()); cur=""; } continue; }
    if (c === "," && depth === 0) { /* between tuples */ continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// split a tuple "(a,'b',NULL)" into raw values, respecting quotes
function splitValues(tupleStr) {
  const s = tupleStr.trim();
  let i = 0;
  if (s[0] === "(" && s[s.length - 1] === ")") i = 1;
  const end = s[s.length - 1] === ")" ? s.length - 1 : s.length;

  const vals = [];
  let cur = "", inStr = false, q = null, esc = false, depth = 0;
  for (; i < end; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === q) { inStr = false; q = null; }
      continue;
    }
    if (c === "'" || c === '"') { inStr = true; q = c; cur += c; continue; }
    if (c === "(") { depth++; cur += c; continue; }
    if (c === ")") { depth--; cur += c; continue; }
    if (c === "," && depth === 0) { vals.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) vals.push(cur.trim());
  return vals.map(v => {
    if (/^null$/i.test(v)) return null;
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      const body = v.slice(1, -1);
      return body.replace(/''/g, "'").replace(/\\"/g, '"');
    }
    return v;
  });
}

// Parse a single INSERT ... (columns...) VALUES (...) statement to rows
function parseInsertStatement(sqlText) {
  const insertRegex = /insert\s+into\s+["\w.]+\s*\(([^)]+)\)\s*values\s*(.+);?$/is;
  const m = sqlText.match(insertRegex);
  if (!m) throw new Error("Could not parse INSERT statement");
  const cols = m[1].split(",").map(c => c.replace(/["']/g, "").trim());
  const valuesStr = m[2].trim();
  const tuples = splitTuples(valuesStr);
  return tuples.map(t => {
    const vals = splitValues(t);
    const obj = {};
    cols.forEach((c, idx) => obj[c] = vals[idx]);
    return obj;
  });
}

// ---------- load & parse ----------
console.time("[READ]");
const sql = fs.readFileSync(INPUT_PATH, "utf8");
console.timeEnd("[READ]");
console.log(`[READ] bytes=${sql.length}`);

console.time("[PARSE]");
const rawRows = parseInsertStatement(sql);
console.timeEnd("[PARSE]");
console.log(`[PARSE] rows detected = ${rawRows.length}`);
console.log("[PARSE] columns present:", Object.keys(rawRows[0] || {}));

// ---------- preload users (normalized email -> auth id) ----------
async function preloadUsersMap() {
  const map = new Map();
  const BATCH = 2000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .order("id", { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const u of data) {
      const key = normalizeEmail(u.email);
      if (key) map.set(key, u.id);
    }
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return map;
}
console.time("[PRELOAD users]");
const usersByEmail = await preloadUsersMap();
console.timeEnd("[PRELOAD users]");
console.log(`[PRELOAD] users found: ${usersByEmail.size}`);

// ---------- transform ----------
const skippedPath = "./transactions_skipped.csv";
fs.writeFileSync(skippedPath, "legacy_id,thEmail,reason\n");

let built = [];
let skippedInvalidEmail = 0;
let skippedNoUser = 0;

for (let i = 0; i < rawRows.length; i++) {
  const src = rawRows[i];
  // expected source cols in your sample:
  // id, created_at, thType, thDetails, thPoi, thStatus, uuid, thEmail
  const legacyId = src.id ?? src.ID ?? null;
  const emailRaw = src.thEmail ?? src.email ?? src.Email ?? null;
  const email = normalizeEmail(emailRaw);
  const createdAt = parseTS(src.created_at ?? src.Created_At);
  const thType = src.thType ?? src.type ?? "legacy";
  const thDetails = src.thDetails ?? null;
  const thPoi = src.thPoi ?? null;
  const thStatus = src.thStatus ?? null;

  if (!email) {
    skippedInvalidEmail++;
    fs.appendFileSync(skippedPath, `${JSON.stringify(legacyId)},${JSON.stringify(emailRaw)},${JSON.stringify("invalid or empty email")}\n`);
    continue;
  }

  // resolve user_id by email (ignore legacy uuid)
  let user_id = usersByEmail.get(email);

  if (!user_id) {
    const { data: u1, error: e1 } = await supabase
      .from("users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();
    if (!e1 && u1?.id) {
      user_id = u1.id;
      usersByEmail.set(email, user_id);
      console.log(`[RESOLVE] #${i+1} EXACT -> ${email} id=${user_id}`);
    }
  }

  if (!user_id) {
    const { data: u2, error: e2 } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", email)
      .maybeSingle();
    if (!e2 && u2?.id) {
      user_id = u2.id;
      usersByEmail.set(email, user_id);
      console.log(`[RESOLVE] #${i+1} ILIKE -> db_email="${u2.email}" id=${user_id}`);
    }
  }

  if (!user_id) {
    const { data: many, error: e3 } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", `%${email}%`);
    if (!e3 && many?.length) {
      const match = many.find(u => normalizeEmail(u.email) === email);
      if (match?.id) {
        user_id = match.id;
        usersByEmail.set(email, user_id);
        console.log(`[RESOLVE] #${i+1} wildcard+normalize -> id=${user_id}`);
      }
    }
  }

  if (!user_id) {
    skippedNoUser++;
    fs.appendFileSync(skippedPath, `${JSON.stringify(legacyId)},${JSON.stringify(emailRaw)},${JSON.stringify("no matching user in public.users")}\n`);
    continue;
  }

  const reference_id = legacyId != null
    ? `legacy:TH:${legacyId}`
    : `legacy:TH:${sha1(`${email}|${thType}|${createdAt||''}|${thDetails||''}`)}`;

  const tx = {
    user_id,
    transaction_type: thType || "legacy",
    amount: DEFAULT_AMOUNT,
    currency: DEFAULT_CURRENCY,
    description: thDetails,
    status: thStatus ?? "Pending",
    platform: thPoi,
    recipient_name: null,
    reference_id,
    created_at: createdAt || new Date().toISOString(),
  };

  built.push(tx);

  if ((i + 1) % LOG_EVERY === 0) {
    console.log(`[BUILD] prepared ${i + 1}/${rawRows.length}`);
  }
}

console.log(`[BUILD] ready to insert: ${built.length}`);
console.log(`[BUILD] skipped invalid email: ${skippedInvalidEmail}, no user: ${skippedNoUser}`);

// ---------- idempotency: remove rows whose reference_id already exists ----------
console.log("[CHECK] fetching existing reference_ids…");
const allRefs = Array.from(new Set(built.map(b => b.reference_id)));
const existing = new Set();

for (let i = 0; i < allRefs.length; i += 1000) {
  const chunk = allRefs.slice(i, i + 1000);
  const { data, error } = await supabase
    .from("transactions")
    .select("reference_id")
    .in("reference_id", chunk);
  if (error) {
    console.log("[CHECK] IN reference_id error:", error.message || error);
    continue;
  }
  (data || []).forEach(d => existing.add(d.reference_id));
}

const toInsert = built.filter(b => !existing.has(b.reference_id));
console.log(`[DEDUPE] existing=${existing.size} | toInsert=${toInsert.length}`);

// ---------- insert in batches ----------
let inserted = 0, failed = 0;
for (let i = 0; i < toInsert.length; i += BATCH_INSERT) {
  const batch = toInsert.slice(i, i + BATCH_INSERT);
  console.log(`[INSERT] batch ${i / BATCH_INSERT + 1} (${batch.length})…`);
  const { error } = await supabase.from("transactions").insert(batch);
  if (error) {
    failed += batch.length;
    console.log("[INSERT] batch error:", error.message || error);
  } else {
    inserted += batch.length;
  }
}

console.log("\n========== SUMMARY ==========");
console.log("Input rows:                     ", rawRows.length);
console.log("Prepared (after user resolve):  ", built.length);
console.log("Already existed (reference_id): ", existing.size);
console.log("Inserted now:                   ", inserted);
console.log("Failed inserts (batch total):   ", failed);
console.log("Skipped invalid emails:         ", skippedInvalidEmail);
console.log("Skipped with no user match:     ", skippedNoUser);
console.log("Skipped details CSV:            ", skippedPath);
