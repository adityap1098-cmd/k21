import postgres from 'postgres'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = postgres(process.env.DATABASE_URL || 'postgres://appuser:k21devpass@localhost:5433/k21')

const migrationSql = readFileSync(join(__dirname, 'drizzle', '0020_payroll_employees.sql'), 'utf-8')

console.log('Running migration 0020_payroll_employees...')
await sql.unsafe(migrationSql)
console.log('Migration 0020 complete.')
await sql.end()
