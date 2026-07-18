import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createDatabase } from './db.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const schemaDir = join(currentDir, '..', 'schema')

export async function runMigrations() {
  const config = loadConfig()
  const db = createDatabase(config)
  try {
    await db.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const files = (await readdir(schemaDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right))

    for (const file of files) {
      const applied = await db.query('select filename from schema_migrations where filename = $1', [file])
      if (applied.rowCount) continue

      const sql = await readFile(join(schemaDir, file), 'utf8')
      await db.query('begin')
      try {
        await db.query(sql)
        await db.query('insert into schema_migrations (filename) values ($1)', [file])
        await db.query('commit')
        console.log(`Applied migration ${file}`)
      } catch (error) {
        await db.query('rollback')
        throw error
      }
    }
  } finally {
    await db.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Database migrations completed.')
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
