import pg from 'pg'
import type { QueryResultRow } from 'pg'
import type { BackendConfig } from './config.js'

export type Database = {
  pool: pg.Pool
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<T>>
  close(): Promise<void>
}

export function createDatabase(config: BackendConfig): Database {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  return {
    pool,
    query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) {
      return pool.query<T>(text, values)
    },
    close() {
      return pool.end()
    },
  }
}
