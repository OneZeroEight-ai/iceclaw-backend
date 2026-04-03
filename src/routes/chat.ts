import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getWorkspaceDir } from '../services/openclaw.js'

const app = new Hono()

// POST /customer/:clerkUserId/agents/:agentId/chat
app.post('/customer/:clerkUserId/agents/:agentId/chat', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  const { message } = await c.req.json()
  const sid = `${clerkUserId}-${agentId}`

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Stronghold not found' }, 404)

  // Check if agent is paused
  const pausedPath = `${getWorkspaceDir(clerkUserId, agentId)}/PAUSED`
  if (existsSync(pausedPath)) {
    return c.json({ error: 'Agent paused by user' }, 403)
  }

  const containerId = customer.containerId

  return streamSSE(c, async (stream) => {
    try {
      const args = ['exec', containerId, 'openclaw', 'agent', '--agent', agentId, '--session-id', sid, '--message', message]
      const proc = spawn('docker', args)
      let output = ''

      proc.stdout.on('data', (data: Buffer) => { output += data.toString() })

      await new Promise<void>((resolve, reject) => {
        proc.on('close', async (code) => {
          const text = output.trim()
            .split('\n')
            .filter(line => !line.startsWith('['))
            .join('\n')
            .trim()
          if (text) {
            await stream.writeSSE({ data: JSON.stringify({ type: 'chunk', text }) })
          }
          await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) })
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
  // TODO: read session .jsonl files
  return c.json({ messages: [] })
})

export const chatRoutes = app
