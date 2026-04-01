import { createMiddleware } from 'hono/factory'
import { verifyToken } from '@clerk/backend'

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? ''

export const clerkAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const token = authHeader.slice(7)
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    c.set('clerkUserId', payload.sub)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
