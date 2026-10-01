#!/usr/bin/env node
// One-time migration: Supabase auth.users -> Clerk.
//
// Preserves account continuity for existing users by setting each Clerk
// user's externalId to their old Supabase UUID. The backend (see
// backend/main.go validateAuth()) reads the `external_id` claim from the
// Clerk session token in preference to `sub`, so every pre-existing
// job/node/billing row (all keyed by the old Supabase UUID as plain TEXT)
// keeps resolving correctly after the cutover — no data migration needed.
//
// Password hashes are imported as-is (bcrypt), so existing email/password
// users do not need to reset their password. Google-only accounts have no
// password in Supabase and are imported as verified-email-only; Clerk's
// default account-linking-by-verified-email then reconnects their Google
// sign-in automatically the next time they click "Continue with Google".
//
// Usage:
//   npm install pg @clerk/backend   (run once, anywhere — not an app dependency)
//   SUPABASE_DB_URL="postgres://postgres:<db-password>@<host>:5432/postgres" \
//   CLERK_SECRET_KEY="sk_live_..." \
//   node scripts/migrate-users-to-clerk.mjs [--dry-run]
//
// SUPABASE_DB_URL is Supabase's own Postgres connection string
// (Dashboard -> Project Settings -> Database -> Connection string),
// NOT the app's Render DATABASE_URL — those are two different databases.
//
// This script is meant to be run once, locally, by whoever holds these
// credentials. Nothing in this repo's app code reads or stores them.

import pg from "pg";
import { createClerkClient } from "@clerk/backend";

const DRY_RUN = process.argv.includes("--dry-run");

const dbUrl = process.env.SUPABASE_DB_URL;
const secretKey = process.env.CLERK_SECRET_KEY;

if (!dbUrl || !secretKey) {
  console.error("Set SUPABASE_DB_URL and CLERK_SECRET_KEY environment variables before running.");
  process.exit(1);
}

const clerkClient = createClerkClient({ secretKey });

async function main() {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const { rows } = await client.query(`
    SELECT id, email, encrypted_password, email_confirmed_at
    FROM auth.users
    WHERE email IS NOT NULL
    ORDER BY created_at ASC
  `);
  await client.end();

  console.log(`Found ${rows.length} Supabase users to migrate.${DRY_RUN ? " (dry run)" : ""}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const hasPassword = !!row.encrypted_password && !!row.email_confirmed_at;

    const params = {
      externalId: row.id,
      emailAddress: [row.email],
    };
    if (hasPassword) {
      params.passwordDigest = row.encrypted_password;
      params.passwordHasher = "bcrypt";
      params.skipPasswordChecks = true;
    } else {
      params.skipPasswordRequirement = true;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] would import ${row.email} (external_id=${row.id}, hasPassword=${hasPassword})`);
      continue;
    }

    try {
      await clerkClient.users.createUser(params);
      created++;
      console.log(`created: ${row.email}`);
    } catch (err) {
      const alreadyExists = err?.errors?.some((e) =>
        ["form_identifier_exists", "duplicate_record"].includes(e.code),
      );
      if (alreadyExists) {
        skipped++;
        console.log(`skipped (already exists): ${row.email}`);
      } else {
        failed++;
        console.error(`FAILED: ${row.email} —`, err?.errors ?? err);
      }
    }

    // Stay well under Clerk's Backend API rate limit.
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
