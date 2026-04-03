import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { spawn } from 'child_process'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { eq, and, asc, desc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getWorkspaceDir } from '../services/openclaw.js'

const MAX_MESSAGES = 200

const app = new Hono()

// POST /customer/:clerkUserId/agents/:agentId/chat
app.post('/customer/:clerkUserId/agents/:agentId/chat', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  const { message } = await c.req.json()
  const sid = `${clerkUserId}-${agentId}`

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Stronghold not found' }, 404)

  const pausedPath = `${getWorkspaceDir(clerkUserId, agentId)}/PAUSED`
  if (existsSync(pausedPath)) {
    return c.json({ error: 'Agent paused by user' }, 403)
  }

  // Save user message to DB
  await db.insert(schema.chatMessages).values({ clerkUserId, agentId, role: 'user', content: message })

  const containerId = customer.containerId

  return streamSSE(c, async (stream) => {
    try {
      const args = ['exec', containerId, 'openclaw', 'agent', '--agent', agentId, '--session-id', sid, '--message', message]
      const proc = spawn('docker', args)
      let output = ''

      proc.stdout.on('data', (data: Buffer) => { output += data.toString() })

      await new Promise<void>((resolve) => {
        proc.on('close', async () => {
          const text = output.trim()
            .split('\n')
            .filter(line => !line.startsWith('['))
            .join('\n')
            .trim()
          if (text) {
            // Save assistant message to DB
            await db.insert(schema.chatMessages).values({ clerkUserId, agentId, role: 'assistant', content: text })
            await stream.writeSSE({ data: JSON.stringify({ type: 'chunk', text }) })
          }
          await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) })

          // Trim to MAX_MESSAGES
          trimMessages(clerkUserId, agentId).catch(() => {})

          resolve()
        })
        proc.on('error', async (err) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'error', text: err.message }) })
          resolve()
        })
      })
    } catch (err) {
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', text: String(err) }) })
    }
  })
})

// GET /customer/:clerkUserId/agents/:agentId/history
app.get('/customer/:clerkUserId/agents/:agentId/history', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  const rows = await db.select({
    id: schema.chatMessages.id,
    role: schema.chatMessages.role,
    content: schema.chatMessages.content,
    createdAt: schema.chatMessages.createdAt,
  })
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.clerkUserId, clerkUserId), eq(schema.chatMessages.agentId, agentId)))
    .orderBy(desc(schema.chatMessages.createdAt))
    .limit(50)

  return c.json({ messages: rows.reverse() })
})

// DELETE /customer/:clerkUserId/agents/:agentId/history
app.delete('/customer/:clerkUserId/agents/:agentId/history', async (c) => {
  const { clerkUserId, agentId } = c.req.param()

  // Delete from DB
  await db.delete(schema.chatMessages)
    .where(and(eq(schema.chatMessages.clerkUserId, clerkUserId), eq(schema.chatMessages.agentId, agentId)))

  // Delete OpenClaw session files
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    const sessionsDir = join(wsDir, 'sessions')
    if (existsSync(sessionsDir)) {
      for (const f of readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))) {
        unlinkSync(join(sessionsDir, f))
      }
    }
  } catch {}

  return c.json({ cleared: true })
})

async function trimMessages(clerkUserId: string, agentId: string) {
  const count = await db.select({ id: schema.chatMessages.id })
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.clerkUserId, clerkUserId), eq(schema.chatMessages.agentId, agentId)))

  if (count.length > MAX_MESSAGES) {
    const oldest = await db.select({ id: schema.chatMessages.id })
      .from(schema.chatMessages)
      .where(and(eq(schema.chatMessages.clerkUserId, clerkUserId), eq(schema.chatMessages.agentId, agentId)))
      .orderBy(asc(schema.chatMessages.createdAt))
      .limit(count.length - MAX_MESSAGES)

    for (const row of oldest) {
      await db.delete(schema.chatMessages).where(eq(schema.chatMessages.id, row.id))
    }
  }
}

export const chatRoutes = app
