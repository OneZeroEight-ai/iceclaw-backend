import { Hono } from 'hono'
import { eq, sql, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { adminAuth } from '../middleware/admin.js'
import { sendVersionNotification } from '../services/email.js'
import { execSync } from 'child_process'

const app = new Hono()
app.use('/admin/*', adminAuth)

// GET /admin/overview
app.get('/admin/overview', async (c) => {
  const total = (await db.select().from(schema.customers)).length
  const active = (await db.select().from(schema.customers).where(eq(schema.customers.status, 'active'))).length
  const cancelled = (await db.select().from(schema.customers).where(eq(schema.customers.status, 'cancelled'))).length
  return c.json({ total, active, cancelled, mrr: active * 19 })
})

// GET /admin/subscribers
app.get('/admin/subscribers', async (c) => {
  const subs = await db.select().from(schema.customers).orderBy(desc(schema.customers.createdAt))
  return c.json({ subscribers: subs, total: subs.length })
})

// POST /admin/subscribers/:id/note
app.post('/admin/subscribers/:id/note', async (c) => {
  const { id } = c.req.param()
  const { note } = await c.req.json()
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id))
  if (!customer) return c.json({ error: 'Not found' }, 404)
  const existing = customer.adminNotes ?? ''
  const timestamp = new Date().toISOString().slice(0, 16)
  await db.update(schema.customers).set({ adminNotes: `${existing}\n[${timestamp}] ${note}`.trim() }).where(eq(schema.customers.id, id))
  return c.json({ ok: true })
})

// GET /admin/openclaw-version
app.get('/admin/openclaw-version', async (c) => {
  const [current] = await db.select().from(schema.openclawVersions).where(eq(schema.openclawVersions.isCurrent, true))
  return c.json({
    current_version: current?.version ?? 'unknown',
    image_tag: current?.imageTag ?? 'unknown',
    is_stable: current?.isStable ?? false,
  })
})

// POST /admin/openclaw-version/notify
app.post('/admin/openclaw-version/notify', async (c) => {
  const { new_version, release_notes, scheduled_date } = await c.req.json()
  const customers = await db.select().from(schema.customers).where(eq(schema.customers.status, 'active'))
  let sent = 0
  for (const cust of customers) {
    try {
      await sendVersionNotification(cust.email, cust.name ?? cust.email.split('@')[0], new_version, release_notes, scheduled_date)
      sent++
    } catch {}
  }
  return c.json({ status: 'notified', sent, total: customers.length })
})

// POST /admin/openclaw-version/rollout
app.post('/admin/openclaw-version/rollout', async (c) => {
  const { version, image_tag } = await c.req.json()
  const tag = image_tag ?? `ghcr.io/openclaw/openclaw:${version}`
  const customers = await db.select().from(schema.customers).where(eq(schema.customers.containerStatus, 'active'))

  // Pull image first
  execSync(`docker pull ${tag}`, { timeout: 120000 })

  let updated = 0, failed = 0
  for (const cust of customers) {
    try {
      if (!cust.containerId) continue
      execSync(`docker stop ${cust.containerId}`, { timeout: 30000 })
      execSync(`docker rm ${cust.containerId}`, { timeout: 15000 })
      execSync(`docker run -d --name ${cust.containerId} --restart unless-stopped -p ${cust.openclawPort}:18789 -v /home/sutra/base/data/users/${cust.clerkUserId}:/home/node/.openclaw --user 1000:1000 --memory 3g --cpus 1.0 --network base-network ${tag} node openclaw.mjs gateway --allow-unconfigured --bind lan`, { timeout: 60000 })
      await db.update(schema.customers).set({ openclawVersion: version }).where(eq(schema.customers.id, cust.id))
      updated++
    } catch { failed++ }
  }

  // Mark version as current
  await db.update(schema.openclawVersions).set({ isCurrent: false }).where(eq(schema.openclawVersions.isCurrent, true))
  await db.insert(schema.openclawVersions).values({ version, imageTag: tag, isCurrent: true, isStable: true, rolledOutAt: new Date() })

  return c.json({ status: 'complete', updated, failed, total: customers.length })
})

export const adminRoutes = app
