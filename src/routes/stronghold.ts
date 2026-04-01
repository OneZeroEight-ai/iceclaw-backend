import { Hono } from 'hono'
import { execSync } from 'child_process'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const app = new Hono()

// POST /customer/:clerkUserId/stop
app.post('/customer/:clerkUserId/stop', async (c) => {
  const { clerkUserId } = c.req.param()
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Not found' }, 404)

  execSync(`docker stop ${customer.containerId}`, { timeout: 30000 })
  await db.update(schema.customers).set({ containerStatus: 'stopped' }).where(eq(schema.customers.clerkUserId, clerkUserId))
  return c.json({ status: 'stopped' })
})

// POST /customer/:clerkUserId/start
app.post('/customer/:clerkUserId/start', async (c) => {
  const { clerkUserId } = c.req.param()
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Not found' }, 404)

  execSync(`docker start ${customer.containerId}`, { timeout: 30000 })
  await db.update(schema.customers).set({ containerStatus: 'active' }).where(eq(schema.customers.clerkUserId, clerkUserId))
  return c.json({ status: 'active' })
})

// POST /customer/:clerkUserId/heartbeat
app.post('/customer/:clerkUserId/heartbeat', async (c) => {
  const { clerkUserId } = c.req.param()
  const { schedule, prompt } = await c.req.json()
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Not found' }, 404)

  execSync(`docker exec ${customer.containerId} openclaw cron add --schedule "${schedule}" --agent main --prompt "${prompt}" --announce`, { timeout: 30000 })
  return c.json({ status: 'scheduled', schedule })
})

export const strongholdRoutes = app
