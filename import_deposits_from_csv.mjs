import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { parse } from "csv-parse/sync";

// ====== CONFIG ======
const CSV_PATH = "./TransactionHistory_rows.csv";
const LOG_EVERY = 200; // progress cadence
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

// expected column names (from your screenshot)
const COL = {
  id: pick(headers, "id", "ID"),
  created_at: pick(headers, "created_at", "created_a", "created"),
  thType: pick(headers, "thType"),
  thDetails: pick(headers, "thDetails"),
  thPoi: pick(headers, "thPoi"),
  thStatus: pick(headers, "thStatus"),
  thEmail: pick(headers, "thEmail", "email", "Email"),
};
if (!COL.thEmail) {
  console.error("CSV must have a 'thEmail' column.");
  process.exit(1);
}

// ---------- preload users (normalized email -> { id, dbEmail }) ----------
async function preloadUsers() {
  const map = new Map();
  const PAGE = 1000;

  // optional total count
  try {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });
    if (typeof count === "number")
      console.log(`[PRELOAD] public.users total: ${count}`);
  } catch (e) {
    console.warn("[PRELOAD] count failed (non-fatal):", e.message || e);
  }

  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from("users")
      .select("id,email")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    for (const u of data) {
      const key = normalizeEmail(u.email);
      if (key) map.set(key, { id: u.id, dbEmail: u.email });
    }
    console.log(
      `[PRELOAD] loaded ${map.size} (batch ${from}-${to}, got ${data.length})`
    );
    if (data.length < PAGE) break;
  }
  return map;
}

console.time("[PRELOAD users]");
const usersByEmail = await preloadUsers();
console.timeEnd("[PRELOAD users]");
console.log(`[PRELOAD] users cached: ${usersByEmail.size}`);

// ---------- counters & logs ----------
let processed = 0,
  inserted = 0,
  skippedInvalidEmail = 0,
  skippedNoUser = 0;

const skippedPath = "./deposits_skipped.csv";
fs.writeFileSync(skippedPath, "row_id,thEmail,reason\n");

// ---------- main (row-by-row so logs are clear) ----------
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const csvId = r[COL.id] ?? null;

  const emailNorm = normalizeEmail(r[COL.thEmail]);
  if (!emailNorm) {
    skippedInvalidEmail++;
    fs.appendFileSync(
      skippedPath,
      `${JSON.stringify(csvId)},${JSON.stringify(
        r[COL.thEmail]
      )},${JSON.stringify("invalid or empty email")}\n`
    );
    console.log(`[ROW ${i + 1}] SKIP invalid email ->`, r[COL.thEmail]);
    continue;
  }

  const cached = usersByEmail.get(emailNorm);
  if (!cached) {
    skippedNoUser++;
    fs.appendFileSync(
      skippedPath,
      `${JSON.stringify(csvId)},${JSON.stringify(
        r[COL.thEmail]
      )},${JSON.stringify("no matching user in public.users")}\n`
    );
    console.log(`[ROW ${i + 1}] SKIP no user ->`, emailNorm);
    continue;
  }

  // Build row for public.deposits
  const created_at = parseTS(r[COL.created_at]) || null; // null => table default now()
  const row = {
    created_at,
    thType: r[COL.thType] ?? undefined, // leave undefined to use DB default when blank
    thDetails: r[COL.thDetails] ?? undefined,
    thPoi: r[COL.thPoi] ?? undefined,
    thStatus: r[COL.thStatus] ?? undefined,
    uuid: cached.id, // <-- use id from public.users
    thEmail: emailNorm, // store normalized email from CSV
  };

  console.log(
    `[ROW ${i + 1}] INSERT deposits -> uuid=${row.uuid} email=${
      row.thEmail
    } created_at=${row.created_at || "(default)"} type=${
      row.thType || "(default)"
    }`
  );

  const { error } = await supabase.from("deposits").insert(row);
  if (error) {
    console.log(`[ROW ${i + 1}] INSERT ERROR:`, error.message || error);
    fs.appendFileSync(
      skippedPath,
      `${JSON.stringify(csvId)},${JSON.stringify(
        r[COL.thEmail]
      )},${JSON.stringify("insert failed: " + error.message)}\n`
    );
    continue;
  }

  inserted++;
  processed++;

  if (processed % LOG_EVERY === 0) {
    console.log(
      `[PROGRESS] ${processed}/${rows.length} | inserted=${inserted} | skippedInvalidEmail=${skippedInvalidEmail} | skippedNoUser=${skippedNoUser}`
    );
  }
}

console.log("\n========== SUMMARY ==========");
console.log("CSV rows:                   ", rows.length);
console.log("Processed:                  ", processed);
console.log("Inserted:                   ", inserted);
console.log("Skipped invalid emails:     ", skippedInvalidEmail);
console.log("Skipped no user match:      ", skippedNoUser);
console.log("Skipped details file:       ", skippedPath);
