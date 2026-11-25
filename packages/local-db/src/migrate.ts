import type { LocalDatabase } from './database'
import { MIGRATIONS } from './migrations'

export async function runMigrations(database: LocalDatabase) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  for (const migration of MIGRATIONS) {
    const existing = await database.get<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [migration.version],
    )
    if (existing) continue

    await database.transaction(async (transaction) => {
      await transaction.exec(migration.sql)
      await transaction.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, new Date().toISOString()],
      )
    })
  }
}
