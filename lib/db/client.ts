import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { resetDemo } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

const store = globalThis as unknown as { __pulsequeueDb?: Db };

export function getDb(): Db {
  if (!store.__pulsequeueDb) {
    const db = createDb(path.join(process.cwd(), "data", "pulsequeue.db"));
    if (db.select().from(schema.services).all().length === 0) resetDemo(db);
    store.__pulsequeueDb = db;
  }
  return store.__pulsequeueDb;
}
