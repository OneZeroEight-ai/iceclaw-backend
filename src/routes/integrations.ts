import { Hono } from 'hono'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { readOpenClawJson } from '../services/openclaw.js'

const BASE_DIR = process.env.BASE_DATA_DIR ?? '/home/sutra/base/data/users'
const app = new Hono()

// POST /customer/:clerkUserId/agents/:agentId/telegram
app.post('/customer/:clerkUserId/agents/:agentId/telegram', async (c) => {
  const { clerkUserId } = c.req.param()
  const { bot_token } = await c.req.json()
  if (!bot_token || bot_token.length < 20 || !bot_token.includes(':'))
    return c.json({ error: 'Invalid bot token' }, 400)

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Not found' }, 404)

  const configPath = join(BASE_DIR, clerkUserId, 'openclaw.json')
  const config = readOpenClawJson(clerkUserId)
  if (!config.channels) config.channels = {}
  config.channels.telegram = { botToken: bot_token, dmPolicy: 'open', allowFrom: ['*'] }
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  execSync(`chown -R 1000:1000 ${join(BASE_DIR, clerkUserId)}`, { stdio: 'ignore' })
  execSync(`docker restart ${customer.containerId}`, { timeout: 30000 })

  return c.json({ status: 'configured' })
})

// POST /customer/:clerkUserId/agents/:agentId/gmail
app.post('/customer/:clerkUserId/agents/:agentId/gmail', async (c) => {
  const { clerkUserId } = c.req.param()
  const { email, app_password } = await c.req.json()
  if (!email || !app_password) return c.json({ error: 'email and app_password required' }, 400)

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Not found' }, 404)

  const wsDir = join(BASE_DIR, clerkUserId, 'workspace')
  mkdirSync(wsDir, { recursive: true })
  const toml = `[accounts.gmail]\nemail = "${email}"\ndisplay-name = "IceClaw"\ndefault = true\n\n[accounts.gmail.incoming]\ntype = "imap"\nhost = "imap.gmail.com"\nport = 993\nencryption = "tls"\nlogin = "${email}"\nauth.type = "password"\nauth.raw = "${app_password}"\n\n[accounts.gmail.outgoing]\ntype = "smtp"\nhost = "smtp.gmail.com"\nport = 465\nencryption = "tls"\nlogin = "${email}"\nauth.type = "password"\nauth.raw = "${app_password}"\n`
  writeFileSync(join(wsDir, 'himalaya.toml'), toml)
  execSync(`chown -R 1000:1000 ${wsDir}`, { stdio: 'ignore' })
  execSync(`docker restart ${customer.containerId}`, { timeout: 30000 })

  return c.json({ status: 'connected', email })
})

// GET /customer/:clerkUserId/agents/:agentId/gmail
app.get('/customer/:clerkUserId/agents/:agentId/gmail', async (c) => {
  const { clerkUserId } = c.req.param()
  const tomlPath = join(BASE_DIR, clerkUserId, 'workspace', 'himalaya.toml')
  try {
    const content = readFileSync(tomlPath, 'utf-8')
    const match = content.match(/email\s*=\s*"(.+)"/)
    return c.json({ connected: true, email: match?.[1] ?? '' })
  } catch {
    return c.json({ connected: false })
  }
})

// POST /customer/:clerkUserId/agents/:agentId/byok
app.post('/customer/:clerkUserId/agents/:agentId/byok', async (c) => {
  const { clerkUserId } = c.req.param()
  const { anthropic_key, openai_key } = await c.req.json()
  if (!anthropic_key && !openai_key) return c.json({ error: 'At least one key required' }, 400)

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Not found' }, 404)

  const configPath = join(BASE_DIR, clerkUserId, 'openclaw.json')
  const config = readOpenClawJson(clerkUserId)
  if (!config.models) config.models = { providers: {} }
  if (!config.models.providers) config.models.providers = {}

  if (anthropic_key) {
    config.models.providers.anthropic = { apiKey: anthropic_key, api: 'anthropic-messages' }
    if (!config.agents) config.agents = { defaults: { model: {} } }
    config.agents.defaults.model.primary = 'anthropic/claude-sonnet-4-5'
  }
  if (openai_key) {
    config.models.providers.openai = { apiKey: openai_key, api: 'openai-completions', baseUrl: 'https://api.openai.com/v1' }
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2))
  execSync(`chown -R 1000:1000 ${join(BASE_DIR, clerkUserId)}`, { stdio: 'ignore' })
  execSync(`docker restart ${customer.containerId}`, { timeout: 30000 })

  return c.json({ status: 'saved' })
})

// GET /customer/:clerkUserId/agents/:agentId/settings
app.get('/customer/:clerkUserId/agents/:agentId/settings', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  const config = readOpenClawJson(clerkUserId)
  const hasTelegram = !!config.channels?.telegram?.botToken
  const wsDir = join(BASE_DIR, clerkUserId, 'workspace')
  let gmailConnected = false
  let gmailEmail = ''
  try {
    const toml = readFileSync(join(wsDir, 'himalaya.toml'), 'utf-8')
    gmailConnected = true
    gmailEmail = toml.match(/email\s*=\s*"(.+)"/)?.[1] ?? ''
  } catch {}

  return c.json({
    telegram: { connected: hasTelegram },
    gmail: { connected: gmailConnected, email: gmailEmail },
    byok: {
      hasAnthropic: !!config.models?.providers?.anthropic,
      hasOpenai: !!config.models?.providers?.openai,
    },
  })
})

export const integrationRoutes = app
