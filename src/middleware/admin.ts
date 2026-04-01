import { createMiddleware } from 'hono/factory'

const ADMIN_KEY = process.env.ICECLAW_ADMIN_KEY ?? ''
const ADMIN_CLERK_IDS = new Set(['user_3ANI0IDAUjLClgCnrurCg3z1HPn'])

export const adminAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('authorization')
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === ADMIN_KEY) {
    await next()
    return
  }
  const clerkId = c.req.header('x-clerk-user-id')
  if (clerkId && ADMIN_CLERK_IDS.has(clerkId)) {
    await next()
    return
  }
  return c.json({ error: 'Admin access required' }, 403)
})
