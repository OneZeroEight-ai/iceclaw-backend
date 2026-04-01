import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const app = new Hono()

// GET /customer/:clerkUserId
app.get('/customer/:clerkUserId', async (c) => {
  const { clerkUserId } = c.req.param()
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer) return c.json({ error: 'Not found' }, 404)
  return c.json(customer)
})

export const customerRoutes = app
