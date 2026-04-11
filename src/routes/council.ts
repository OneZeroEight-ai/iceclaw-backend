import { Hono } from 'hono'
import { spawn } from 'child_process'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { SUTRA_AGENTS } from '../services/sutra-agents.js'

const app = new Hono()

// POST /customer/:clerkUserId/council/deliberate
app.post('/customer/:clerkUserId/council/deliberate', async (c) => {
  const { clerkUserId } = c.req.param()
  const { query, agents: agentIds } = await c.req.json()

  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
  if (!customer?.containerId) return c.json({ error: 'Stronghold not found' }, 404)

  const containerId = customer.containerId
  const selectedAgents = agentIds
    ? SUTRA_AGENTS.filter(a => agentIds.includes(a.id))
    : SUTRA_AGENTS.filter(a => a.category !== 'synthesis')

  // Collect perspectives from each agent
  const perspectives: { agent: string; name: string; emoji: string; response: string }[] = []

  for (const agent of selectedAgents) {
    try {
      const response = await runAgent(containerId, agent.id, query)
      perspectives.push({ agent: agent.id, name: agent.name, emoji: agent.emoji, response })
    } catch {
      perspectives.push({ agent: agent.id, name: agent.name, emoji: agent.emoji, response: '(no response)' })
    }
  }

  // Synthesize with Sutra agent
  const synthesisPrompt = `You are Sutra, the Synthesis Agent. ${perspectives.length} council members have deliberated on this query:\n\n"${query}"\n\nTheir perspectives:\n\n${perspectives.map(p => `${p.emoji} ${p.name}:\n${p.response}`).join('\n\n---\n\n')}\n\nSynthesize these perspectives into unified, actionable guidance. Identify areas of agreement, tension, and the recommended path forward.`

  let synthesis = ''
  try {
    synthesis = await runAgent(containerId, 'sutra', synthesisPrompt)
  } catch {
    synthesis = 'Synthesis unavailable.'
  }

  return c.json({ query, perspectives, synthesis })
})

function runAgent(containerId: string, agentId: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['exec', containerId, 'openclaw', 'agent', '--agent', agentId, '--message', message])
    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', (code) => {
      const text = output.trim().split('\n').filter(l => !l.startsWith('[')).join('\n').trim()
      if (text) resolve(text)
      else reject(new Error('Empty response'))
    })
    proc.on('error', reject)
  })
}

export const councilRoutes = app
