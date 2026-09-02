import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export function openDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: Database.Database, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: string }).id)
  );

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const insert = db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = readFileSync(`${migrationsDir}/${file}`, "utf8");
    const run = db.transaction(() => {
      db.exec(sql);
      insert.run(file, new Date().toISOString());
    });
    run();
  }
}
