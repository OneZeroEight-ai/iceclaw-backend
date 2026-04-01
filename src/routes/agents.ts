import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { readOpenClawJson, parseIdentityMd, getTelegramUsername, getWorkspaceDir } from '../services/openclaw.js'
import { DEFAULT_AGENTS } from '../services/provisioner.js'

const app = new Hono()

// GET /customer/:clerkUserId/agents — list all agents
app.get('/customer/:clerkUserId/agents', async (c) => {
  const { clerkUserId } = c.req.param()
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer) return c.json({ error: 'Not found' }, 404)

  const config = readOpenClawJson(clerkUserId)
  const agentList = config.agents?.list ?? DEFAULT_AGENTS.map(a => ({ id: a.id, name: a.name }))
  const model = config.agents?.defaults?.model?.primary ?? 'google/gemini-2.5-flash'

  // Get telegram username for main agent only
  const botToken = config.channels?.telegram?.botToken
  const telegramBot = botToken ? await getTelegramUsername(botToken) : null

  const agents = agentList.map((a: any) => {
    const wsDir = getWorkspaceDir(clerkUserId, a.id)
    const identity = parseIdentityMd(`${wsDir}/IDENTITY.md`)
    const defaultAgent = DEFAULT_AGENTS.find(d => d.id === a.id)
    return {
      id: a.id,
      name: identity.name ?? a.name ?? defaultAgent?.name ?? 'Agent',
      emoji: identity.emoji ?? defaultAgent?.emoji ?? '🤖',
      telegramBot: a.id === 'main' ? telegramBot : null,
      model,
      status: customer.containerStatus === 'active' ? 'active' : 'stopped',
    }
  })

  return c.json({ agents })
})

// POST /customer/:clerkUserId/agents — create custom agent
app.post('/customer/:clerkUserId/agents', async (c) => {
  const { clerkUserId } = c.req.param()
  const body = await c.req.json()
  const { pmf_id, name } = body
  // TODO: fetch PMF from GitHub and create workspace
  return c.json({ status: 'created', agent_id: pmf_id })
})

export const agentRoutes = app
