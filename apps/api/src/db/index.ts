import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema/index.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

// { prepare: false } is REQUIRED for PgBouncer TRANSACTION mode.
// PgBouncer does not persist session state between transactions — prepared
// statements registered in one transaction are invisible to the next.
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
