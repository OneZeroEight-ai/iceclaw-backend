import { readFileSync, writeFileSync } from 'fs'

const POOL_PATH = process.env.PORT_POOL_PATH ?? '/home/sutra/base/data/port_pool.json'

interface PortPool {
  free: number[]
  assigned: Record<string, { port: number; containerName: string }>
}

function load(): PortPool {
  try {
    return JSON.parse(readFileSync(POOL_PATH, 'utf-8'))
  } catch {
    // Initialize with ports 8100-8200
    const free = Array.from({ length: 101 }, (_, i) => 8100 + i)
    return { free, assigned: {} }
  }
}

function save(clerkUserId: string, port: number, containerName: string) {
  const pool = load()
  pool.free = pool.free.filter(p => p !== port)
  pool.assigned[clerkUserId] = { port, containerName }
  writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2))
}

function assignNext(clerkUserId: string): number {
  const pool = load()
  if (pool.assigned[clerkUserId]) return pool.assigned[clerkUserId].port
  if (pool.free.length === 0) throw new Error('No ports available')
  const port = pool.free.shift()!
  writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2))
  return port
}

function release(clerkUserId: string) {
  const pool = load()
  const entry = pool.assigned[clerkUserId]
  if (entry) {
    pool.free.push(entry.port)
    pool.free.sort((a, b) => a - b)
    delete pool.assigned[clerkUserId]
    writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2))
  }
}

export const portPool = { load, save, assignNext, release }
