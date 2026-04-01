import { spawn } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, chownSync } from 'fs'
import { join } from 'path'
import { portPool } from './portPool.js'

const BASE_DIR = process.env.BASE_DATA_DIR ?? '/home/sutra/base/data/users'
const OPENCLAW_IMAGE = 'ghcr.io/openclaw/openclaw:latest'
const MEMORY_LIMIT = '3g'
const CPU_LIMIT = '1.0'
const NODE_OPTIONS = '--max-old-space-size=2560'
const GEMINI_KEY = process.env.ICECLAW_GEMINI_API_KEY ?? ''
const MISTRAL_KEY = process.env.ICECLAW_MISTRAL_API_KEY ?? ''

export const DEFAULT_AGENTS = [
  { id: 'main', name: 'IceClaw Assistant', emoji: '🤴', soul: 'You are a private AI assistant on a sovereign Stronghold in Iceland. Direct, capable, privacy-first. You work for your human, not for any corporation.' },
  { id: 'executive-assistant', name: 'Executive Assistant', emoji: '👔', soul: 'Sharp, efficient executive assistant. Manage inboxes, draft communications, schedule intelligently. Formal. Concise. No filler.' },
  { id: 'research-analyst', name: 'Research Analyst', emoji: '🔍', soul: 'Rigorous research analyst. Dig deep, cite sources, surface contradictions. Analytical tone. Structured output. Never guess — search.' },
  { id: 'wisdom-judge', name: 'Wisdom Judge', emoji: '⚖️', soul: 'Reason through decisions using the Noble Eightfold Path. Right View, Right Intention, Right Action. Weigh consequences, surface hidden assumptions.' },
  { id: 'morning-briefer', name: 'Morning Briefer', emoji: '☀️', soul: 'Deliver sharp daily briefings. News that matters, priorities for the day. Brief by design. Signal only. No fluff.' },
  { id: 'inbox-manager', name: 'Inbox Manager', emoji: '📬', soul: 'Triage email intelligently. Categorize by urgency and sender, draft responses, flag what needs action, archive what does not.' },
  { id: 'competitive-intel', name: 'Competitive Intel', emoji: '🕵️', soul: 'Monitor markets and competitors. Surface insights, track movements, flag threats and opportunities. Data-driven. Always sourced.' },
  { id: 'growth-strategist', name: 'Growth Strategist', emoji: '📈', soul: 'Think about growth. GTM strategy, market positioning, pricing, channels. Challenge assumptions. Bold recommendations.' },
  { id: 'legal-analyst', name: 'Legal Analyst', emoji: '📋', soul: 'Review contracts, spot risks, research regulations. Flag what matters, explain plainly. Not a lawyer — but thorough.' },
]

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

function buildOpenClawConfig(authToken: string) {
  return {
    models: {
      providers: {
        ...(GEMINI_KEY ? {
          google: {
            apiKey: GEMINI_KEY,
            api: 'google-generative-ai',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, maxTokens: 8192 }],
          },
        } : {}),
        ...(MISTRAL_KEY ? {
          mistral: {
            apiKey: MISTRAL_KEY,
            api: 'openai-completions',
            baseUrl: 'https://api.mistral.ai/v1',
            models: [{ id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 128000, maxTokens: 4096 }],
          },
        } : {}),
      },
    },
    agents: {
      defaults: {
        model: {
          primary: GEMINI_KEY ? 'google/gemini-2.5-flash' : 'mistral/mistral-small-latest',
          fallbacks: GEMINI_KEY && MISTRAL_KEY ? ['mistral/mistral-small-latest'] : [],
        },
      },
      list: DEFAULT_AGENTS.map(a => ({
        id: a.id,
        name: a.name,
        default: a.id === 'main',
        workspace: a.id === 'main' ? '/home/node/.openclaw/workspace' : `/home/node/.openclaw/workspace-${a.id}`,
      })),
    },
    commands: { native: 'auto', nativeSkills: 'auto', restart: true, ownerDisplay: 'raw' },
    gateway: {
      bind: 'lan',
      controlUi: { dangerouslyAllowHostHeaderOriginFallback: true },
      auth: { mode: 'token', token: authToken },
    },
    meta: { lastTouchedVersion: '2026.3.28' },
  }
}

function writeAgentWorkspaces(userDir: string) {
  for (const agent of DEFAULT_AGENTS) {
    const wsDir = agent.id === 'main' ? join(userDir, 'workspace') : join(userDir, `workspace-${agent.id}`)
    mkdirSync(wsDir, { recursive: true })

    const soulPath = join(wsDir, 'SOUL.md')
    const identityPath = join(wsDir, 'IDENTITY.md')
    const userMdPath = join(wsDir, 'USER.md')
    const bootstrapPath = join(wsDir, 'BOOTSTRAP.md')

    try { readFileSync(soulPath) } catch {
      writeFileSync(soulPath, `# SOUL.md — ${agent.name}\n${agent.soul}\n`)
    }
    try { readFileSync(identityPath) } catch {
      writeFileSync(identityPath, `# IDENTITY.md\n**Name:** ${agent.name}\n**Emoji:** ${agent.emoji}\n**Location:** Reykjavik, Iceland\n**Nature:** AI assistant on a sovereign Stronghold\n`)
    }
    try { readFileSync(userMdPath) } catch {
      writeFileSync(userMdPath, '# USER.md\n_Not yet configured._\n')
    }

    if (agent.id === 'main') {
      try { readFileSync(bootstrapPath) } catch {
        writeFileSync(bootstrapPath, `# BOOTSTRAP.md — IceClaw Stronghold\n\n## First Message\nSend exactly this:\n\n> 👑🦞 Your Stronghold is live.\n> I am your AI assistant — private, persistent, and ready to work.\n> What would you like to work on?\n\nThen ask their name and write it to USER.md.\nDelete this file when done.\n`)
      }
    } else {
      try { readFileSync(bootstrapPath) } catch {
        writeFileSync(bootstrapPath, `# BOOTSTRAP.md — ${agent.name}\n\n## First Message\nSend exactly this:\n\n> ${agent.emoji} ${agent.name} online.\n> I'm ready to work. What do you need?\n\nThen ask their name and write it to USER.md.\nDelete this file when done.\n`)
      }
    }
  }
}

function dockerRun(params: { containerName: string; port: number; userDir: string; clerkUserId: string }): Promise<string> {
  const args = [
    'run', '-d',
    '--name', params.containerName,
    '--restart', 'unless-stopped',
    '-p', `${params.port}:18789`,
    '-v', `${params.userDir}:/home/node/.openclaw`,
    '--user', '1000:1000',
    '--memory', MEMORY_LIMIT,
    '--cpus', CPU_LIMIT,
    '-e', `NODE_OPTIONS=${NODE_OPTIONS}`,
    ...(GEMINI_KEY ? ['-e', `GEMINI_API_KEY=${GEMINI_KEY}`] : []),
    ...(MISTRAL_KEY ? ['-e', `MISTRAL_API_KEY=${MISTRAL_KEY}`] : []),
    '--network', 'base-network',
    '--label', `base.user_id=${params.clerkUserId}`,
    OPENCLAW_IMAGE,
    'node', 'openclaw.mjs', 'gateway', '--allow-unconfigured', '--bind', 'lan',
  ]

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args)
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d })
    proc.stderr.on('data', d => { stderr += d })
    proc.on('close', code => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`docker run failed: ${stderr}`))
    })
  })
}

export async function provision(clerkUserId: string): Promise<{ port: number; containerId: string; status: 'created' | 'existing' }> {
  const pool = portPool.load()
  const existing = pool.assigned[clerkUserId]
  if (existing) return { port: existing.port, containerId: existing.containerName, status: 'existing' }

  const port = portPool.assignNext(clerkUserId)
  const shortId = clerkUserId.replace('user_', '').slice(0, 7)
  const containerName = `base-user_${shortId}`
  const userDir = join(BASE_DIR, clerkUserId)

  mkdirSync(userDir, { recursive: true })

  const authToken = generateToken()
  const config = buildOpenClawConfig(authToken)
  writeFileSync(join(userDir, 'openclaw.json'), JSON.stringify(config, null, 2))
  writeAgentWorkspaces(userDir)

  // Fix ownership
  try {
    const { execSync } = await import('child_process')
    execSync(`chown -R 1000:1000 ${userDir}`, { stdio: 'ignore' })
  } catch {}

  const containerId = await dockerRun({ containerName, port, userDir, clerkUserId })
  portPool.save(clerkUserId, port, containerName)

  return { port, containerId: containerName, status: 'created' }
}
