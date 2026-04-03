import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getWorkspaceDir } from '../services/openclaw.js'
import { DEFAULT_AGENTS } from '../services/provisioner.js'

const app = new Hono()

// GET /customer/:clerkUserId/agents/:agentId/memory
app.get('/customer/:clerkUserId/agents/:agentId/memory', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const filePath = join(wsDir, 'USER.md')
    const content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
    return c.json({ content })
  } catch (err) {
    return c.json({ error: 'Failed to read memory', detail: String(err) }, 500)
  }
})

// DELETE /customer/:clerkUserId/agents/:agentId/history
app.delete('/customer/:clerkUserId/agents/:agentId/history', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const sessionsDir = join(wsDir, 'sessions')
    if (existsSync(sessionsDir)) {
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
      for (const file of files) {
        unlinkSync(join(sessionsDir, file))
      }
    }
    return c.json({ cleared: true })
  } catch (err) {
    return c.json({ error: 'Failed to clear history', detail: String(err) }, 500)
  }
})

// POST /customer/:clerkUserId/agents/:agentId/reset
app.post('/customer/:clerkUserId/agents/:agentId/reset', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const defaultAgent = DEFAULT_AGENTS.find(a => a.id === agentId)
    if (!defaultAgent) {
      return c.json({ error: 'Unknown agent' }, 404)
    }

    // Overwrite SOUL.md with default
    writeFileSync(join(wsDir, 'SOUL.md'), defaultAgent.soul)

    // Clear USER.md
    writeFileSync(join(wsDir, 'USER.md'), '# USER.md\n_Not yet configured._\n')

    // Delete session files
    const sessionsDir = join(wsDir, 'sessions')
    if (existsSync(sessionsDir)) {
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
      for (const file of files) {
        unlinkSync(join(sessionsDir, file))
      }
    }

    return c.json({ reset: true })
  } catch (err) {
    return c.json({ error: 'Failed to reset agent', detail: String(err) }, 500)
  }
})

// GET /customer/:clerkUserId/agents/:agentId/export
app.get('/customer/:clerkUserId/agents/:agentId/export', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const userMd = existsSync(join(wsDir, 'USER.md'))
      ? readFileSync(join(wsDir, 'USER.md'), 'utf-8')
      : ''
    const soulMd = existsSync(join(wsDir, 'SOUL.md'))
      ? readFileSync(join(wsDir, 'SOUL.md'), 'utf-8')
      : ''
    const combined = `--- SOUL.md ---\n${soulMd}\n\n--- USER.md ---\n${userMd}`
    return c.text(combined)
  } catch (err) {
    return c.json({ error: 'Failed to export agent', detail: String(err) }, 500)
  }
})

// POST /customer/:clerkUserId/agents/:agentId/pause
app.post('/customer/:clerkUserId/agents/:agentId/pause', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true })
    writeFileSync(join(wsDir, 'PAUSED'), 'true')
    return c.json({ paused: true })
  } catch (err) {
    return c.json({ error: 'Failed to pause agent', detail: String(err) }, 500)
  }
})

// POST /customer/:clerkUserId/agents/:agentId/resume
app.post('/customer/:clerkUserId/agents/:agentId/resume', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const pausedPath = join(wsDir, 'PAUSED')
    if (existsSync(pausedPath)) unlinkSync(pausedPath)
    return c.json({ paused: false })
  } catch (err) {
    return c.json({ error: 'Failed to resume agent', detail: String(err) }, 500)
  }
})

// GET /customer/:clerkUserId/agents/:agentId/status
app.get('/customer/:clerkUserId/agents/:agentId/status', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const paused = existsSync(join(wsDir, 'PAUSED'))
    return c.json({ paused })
  } catch (err) {
    return c.json({ error: 'Failed to get status', detail: String(err) }, 500)
  }
})

export const agentSettingsRoutes = app
