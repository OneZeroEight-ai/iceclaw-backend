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
  const all = await db.select().from(schema.customers)
  const active = all.filter(c => c.status === 'active').length
  const cancelled = all.filter(c => c.status === 'cancelled').length
  const pastDue = all.filter(c => c.status === 'past_due').length
  const pending = all.filter(c => c.containerStatus === 'pending').length
  const introCount = all.filter(c => c.status === 'active' && c.plan === 'intro').length
  const standardCount = all.filter(c => c.status === 'active' && c.plan === 'standard').length
  const totalExchanges = all.reduce((sum, c) => sum + (c.exchangesUsed ?? 0), 0)
  return c.json({
    total_subscribers: all.length,
    active,
    past_due: pastDue,
    cancelled,
    containers_pending: pending,
    mrr_usd: active * 19,
    intro_count: introCount,
    standard_count: standardCount,
    total_exchanges_this_month: totalExchanges,
  })
})

// GET /admin/subscribers
app.get('/admin/subscribers', async (c) => {
  const status = c.req.query('status')
  let query = db.select().from(schema.customers).orderBy(desc(schema.customers.createdAt))
  const all = await query
  const filtered = status ? all.filter(r => r.status === status || r.containerStatus === status) : all
  const subscribers = filtered.map(s => ({
    id: s.id,
    clerk_user_id: s.clerkUserId,
    email: s.email,
    name: s.name,
    plan: s.plan,
    status: s.status,
    container_status: s.containerStatus,
    container_id: s.containerId,
    openclaw_port: s.openclawPort,
    exchanges_used: s.exchangesUsed ?? 0,
    exchanges_limit: s.exchangesLimit ?? 2000,
    created_at: s.createdAt?.toISOString() ?? null,
    cancelled_at: s.cancelledAt?.toISOString() ?? null,
    admin_notes: s.adminNotes,
    stripe_subscription_id: s.stripeSubscriptionId,
    governance: {
      bodhi: s.bodhiEnforced ?? true,
      nirvana: s.nirvanaEnforced ?? true,
      sila: s.silaEnforced ?? true,
      dharma: s.dharmaEnforced ?? true,
    },
  }))
  return c.json({ subscribers, total: subscribers.length })
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
