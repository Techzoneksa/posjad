import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const hardeningPath = path.join(serverRoot, "db", "hardening.sql");

dotenv.config({ path: path.join(serverRoot, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to apply migrations.");
}

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function ensureHistoryTable() {
  await client.query(`
    create table if not exists public._jaad_migration_history (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

async function wasApplied(id, sqlChecksum) {
  const { rows } = await client.query(
    "select checksum from public._jaad_migration_history where id = $1",
    [id],
  );

  if (rows.length === 0) {
    return false;
  }

  if (rows[0].checksum !== sqlChecksum) {
    throw new Error(`Migration ${id} was already applied with a different checksum.`);
  }

  return true;
}

async function applyMigration(id, sql) {
  const sqlChecksum = checksum(sql);

  if (await wasApplied(id, sqlChecksum)) {
    console.log(`skip ${id}`);
    return;
  }

  console.log(`apply ${id}`);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query(
      `insert into public._jaad_migration_history (id, checksum)
       values ($1, $2)
       on conflict (id) do update set checksum = excluded.checksum, applied_at = now()`,
      [id, sqlChecksum],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

await client.connect();

try {
  await ensureHistoryTable();

  for (const file of migrationFiles) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await applyMigration(file, sql);
  }

  const hardeningSql = await readFile(hardeningPath, "utf8");
  await applyMigration("99999999999999_jaad_hardening.sql", hardeningSql);

  console.log(`done: ${migrationFiles.length} migrations plus hardening layer`);
} finally {
  await client.end();
}
