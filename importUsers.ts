import fs from "fs";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

// Use service role (admin access)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface CsvUser {
  created_at: string;
  uEmail: string;
  uFname: string;
  uLname: string;
  uPassword: string;
  uVerified: string;
}

async function main() {
  const users: CsvUser[] = [];

  // 1️⃣ Read CSV
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream("users.csv")
      .pipe(csv())
      .on("data", (row) => {
        users.push({
          created_at: row.created_at,
          uEmail: row.uEmail,
          uFname: row.uFname,
          uLname: row.uLname,
          uPassword: row.uPassword,
          uVerified: row.uVerified,
        });
      })
      .on("end", () => {
        console.log(`✅ Loaded ${users.length} rows from users.csv`);
        resolve();
      })
      .on("error", reject);
  });

// 2️⃣ Process users in parallel chunks (safe concurrency)
const CHUNK_SIZE = 10; // adjust to 5-20 if needed

for (let i = 0; i < users.length; i += CHUNK_SIZE) {
  const chunk = users.slice(i, i + CHUNK_SIZE);

  // run up to CHUNK_SIZE users at the same time
  await Promise.all(
    chunk.map(async (user, indexInChunk) => {
      const index = i + indexInChunk + 1;
      const id = uuidv4();
      const email = (user.uEmail || "").trim();
      const password = (user.uPassword || "DefaultPass123!").trim();

      const firstName = user.uFname
        ? user.uFname.charAt(0).toUpperCase() + user.uFname.slice(1).toLowerCase()
        : "";
      const lastName = user.uLname
        ? user.uLname.charAt(0).toUpperCase() + user.uLname.slice(1).toLowerCase()
        : "";
      const fullName = `${firstName} ${lastName}`.trim();

      const verified = (user.uVerified || "").toLowerCase() === "true";
      const kycStatus = verified ? "approved" : "not_started";

      console.log(`➡️  [${index}] Importing ${email || "<no email>"} ...`);

      try {
        // 3️⃣ Create Supabase Auth user (email_confirmed)
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { fullName },
        });

        const authId = authUser?.user?.id || id;
        if (authError)
          console.warn(`⚠️  Auth error for ${email}: ${authError.message}`);

        // 4️⃣ Insert into public.users
        const { error: usersError } = await supabase.from("users").insert([
          {
            id: authId,
            email,
            password,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            kyc_status: kycStatus,
            created_at: user.created_at
              ? new Date(user.created_at).toISOString()
              : new Date().toISOString(),
          },
        ]);
        if (usersError)
          console.warn(`⚠️  users insert error (${email}): ${usersError.message}`);

        // 5️⃣ Insert into public.profiles
        const { error: profilesError } = await supabase.from("profiles").insert([
          {
            id: authId,
            email,
            full_name: fullName,
            password,
            created_at: user.created_at
              ? new Date(user.created_at).toISOString()
              : new Date().toISOString(),
          },
        ]);
        if (profilesError)
          console.warn(`⚠️  profiles insert error (${email}): ${profilesError.message}`);

        console.log(`✅ Imported ${email || "(no email)"}\n`);
      } catch (err) {
        console.error(`💥 Error importing ${email}:`, err);
      }
    })
  );

  // optional short pause between chunks to avoid rate limits
  await new Promise((res) => setTimeout(res, 500));
}

console.log("🎉 Import finished!");

}

main().catch((err) => console.error("Fatal error:", err));
