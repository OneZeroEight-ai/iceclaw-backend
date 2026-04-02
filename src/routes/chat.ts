import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getWorkspaceDir } from '../services/openclaw.js'
import { DEFAULT_AGENTS } from '../services/provisioner.js'

const app = new Hono()

function readSoulMd(clerkUserId: string, agentId: string): string | null {
  try {
    const wsDir = getWorkspaceDir(clerkUserId, agentId)
    return readFileSync(`${wsDir}/SOUL.md`, 'utf-8').trim()
  } catch {
    return null
  }
}

function buildAgentMessage(agentId: string, message: string, soulContent: string | null): string {
  if (agentId === 'main' || !soulContent) return message
  const agentName = DEFAULT_AGENTS.find(a => a.id === agentId)?.name ?? agentId
  return `[ACTING AS: ${agentName}]\n[SOUL]\n${soulContent}\n[/SOUL]\n\nUser message: ${message}`
}

// POST /customer/:clerkUserId/agents/:agentId/chat
app.post('/customer/:clerkUserId/agents/:agentId/chat', async (c) => {
  const { clerkUserId, agentId } = c.req.param()
  const { message } = await c.req.json()

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Stronghold not found' }, 404)

  const containerId = customer.containerId
  const soulContent = readSoulMd(clerkUserId, agentId)
  const fullMessage = buildAgentMessage(agentId, message, soulContent)

  return streamSSE(c, async (stream) => {
    try {
      const proc = spawn('docker', ['exec', containerId, 'openclaw', 'agent', '--agent', 'main', '--message', fullMessage])
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
