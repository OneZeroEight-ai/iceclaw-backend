import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://sutra:password@postgres:5432/iceclaw'

const sql = postgres(connectionString)
export const db = drizzle(sql, { schema })
export { schema }
