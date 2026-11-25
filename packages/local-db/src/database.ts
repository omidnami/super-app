import * as SQLite from 'expo-sqlite'
import { runMigrations } from './migrate'

export type SqlValue = string | number | null | Uint8Array

export interface LocalDatabase {
  exec(sql: string): Promise<void>
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>
  run(sql: string, params?: SqlValue[]): Promise<void>
  transaction<T>(task: (database: LocalDatabase) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export interface DatabaseFactory {
  open(name: string): Promise<LocalDatabase>
}

function wrapDatabase(database: SQLite.SQLiteDatabase): LocalDatabase {
  return {
    exec: (sql) => database.execAsync(sql),
    all: <T>(sql: string, params: SqlValue[] = []) => database.getAllAsync<T>(sql, params),
    get: <T>(sql: string, params: SqlValue[] = []) => database.getFirstAsync<T>(sql, params),
    run: (sql, params = []) => database.runAsync(sql, params).then(() => undefined),
    transaction: <T>(task: (database: LocalDatabase) => Promise<T>) => {
      let result: T | undefined
      return database
        .withExclusiveTransactionAsync(async (transaction) => {
          const localTransaction: LocalDatabase = {
            exec: (sql) => transaction.execAsync(sql),
            all: <TRow>(sql: string, params: SqlValue[] = []) =>
              transaction.getAllAsync<TRow>(sql, params),
            get: <TRow>(sql: string, params: SqlValue[] = []) =>
              transaction.getFirstAsync<TRow>(sql, params),
            run: (sql, params = []) => transaction.runAsync(sql, params).then(() => undefined),
            transaction: <TNext>(nextTask: (database: LocalDatabase) => Promise<TNext>) =>
              nextTask(localTransaction),
            close: () => Promise.resolve(),
          }
          result = await task(localTransaction)
        })
        .then(() => result as T)
    },
    close: () => database.closeAsync(),
  }
}

export function createExpoDatabaseFactory(): DatabaseFactory {
  return {
    async open(name: string) {
      const database = await SQLite.openDatabaseAsync(name, { enableChangeListener: true })
      const localDatabase = wrapDatabase(database)
      await runMigrations(localDatabase)
      return localDatabase
    },
  }
}
