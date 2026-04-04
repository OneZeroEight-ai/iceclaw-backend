import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getWorkspaceDir, readOpenClawJson, writeOpenClawJson } from '../services/openclaw.js'

const app = new Hono()

// PATCH /customer/:clerkUserId/agents/:agentId/identity
app.patch('/customer/:clerkUserId/agents/:agentId/identity', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { emoji, name } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    const content = `# IDENTITY.md\n**Name:** ${name}\n**Emoji:** ${emoji}\n**Location:** Reykjavik, Iceland\n**Nature:** AI assistant on a sovereign Stronghold\n`
    writeFileSync(join(wsDir, 'IDENTITY.md'), content)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update identity', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/model
app.patch('/customer/:clerkUserId/agents/:agentId/model', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { model } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, `${agentId}.model`), model)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update model', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/heartbeat
app.patch('/customer/:clerkUserId/agents/:agentId/heartbeat', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { schedule } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'heartbeat.json'), JSON.stringify({ schedule, updatedAt: new Date().toISOString() }, null, 2))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update heartbeat', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/byok
app.patch('/customer/:clerkUserId/byok', async (c) => {
  const { clerkUserId } = c.req.param()
  try {
    const { anthropicKey, openaiKey, customUrl } = await c.req.json()
    const config = readOpenClawJson(clerkUserId)
    if (!config.providers) config.providers = {}
    if (anthropicKey) {
      config.providers.anthropic = { apiKey: anthropicKey }
    }
    if (openaiKey) {
      config.providers.openai = { apiKey: openaiKey }
    }
    if (customUrl) {
      config.providers.custom = { url: customUrl }
    }
    writeOpenClawJson(clerkUserId, config)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update BYOK', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/schedule
app.patch('/customer/:clerkUserId/agents/:agentId/schedule', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { schedule, timezone } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'schedule.json'), JSON.stringify({ schedule, timezone }, null, 2))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update schedule', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/notifications
app.patch('/customer/:clerkUserId/agents/:agentId/notifications', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { channel, botToken } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'notifications.json'), JSON.stringify({ channel, botToken }, null, 2))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update notifications', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/style
app.patch('/customer/:clerkUserId/agents/:agentId/style', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { length, language } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'style.json'), JSON.stringify({ length, language }, null, 2))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update style', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/context
app.patch('/customer/:clerkUserId/agents/:agentId/context', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { contextMessages } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'context.json'), JSON.stringify({ contextMessages }, null, 2))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update context', detail: String(err) }, 500)
  }
})

// PATCH /customer/:clerkUserId/agents/:agentId/budget
app.patch('/customer/:clerkUserId/agents/:agentId/budget', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const { monthlyLimit } = await c.req.json()
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'budget.json'), JSON.stringify({ monthlyLimit }, null, 2))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to update budget', detail: String(err) }, 500)
  }
})

export const agentConfigRoutes = app
