import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE_DIR = process.env.BASE_DATA_DIR ?? '/home/sutra/base/data/users'

export function readOpenClawJson(clerkUserId: string): Record<string, any> {
  try {
    const path = join(BASE_DIR, clerkUserId, 'openclaw.json')
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return {}
  }
}

export function writeOpenClawJson(clerkUserId: string, config: Record<string, any>) {
  const path = join(BASE_DIR, clerkUserId, 'openclaw.json')
  writeFileSync(path, JSON.stringify(config, null, 2))
}

export function parseIdentityMd(path: string): { name: string | null; emoji: string | null } {
  try {
    const content = readFileSync(path, 'utf-8')
    const name = content.match(/\*\*Name:\*\*\s*(.+)/)?.[1]?.trim() ?? null
    const emoji = content.match(/\*\*Emoji:\*\*\s*(.+)/)?.[1]?.trim() ?? null
    return { name, emoji }
  } catch {
    return { name: null, emoji: null }
  }
}

export async function getTelegramUsername(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json() as any
    return data.ok ? `@${data.result.username}` : null
  } catch {
    return null
  }
}

export function getWorkspaceDir(clerkUserId: string, agentId: string): string {
  if (agentId === 'main') return join(BASE_DIR, clerkUserId, 'workspace')
  return join(BASE_DIR, clerkUserId, `workspace-${agentId}`)
}
