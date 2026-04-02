import { Hono } from 'hono'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const PRICE_ID = process.env.STRIPE_PRICE_ICECLAW_INTRO || 'price_1TF3cLGBRiRBfxh9fVcFNelf'

const app = new Hono()

app.post('/checkout', async (c) => {
  const { clerk_user_id, email, plan, success_url, cancel_url } = await c.req.json()

  if (!email || !clerk_user_id) {
    return c.json({ error: 'email and clerk_user_id required' }, 400)
  }

  // Find or create Stripe customer
  const existing = await stripe.customers.list({ email, limit: 1 })
  const customer = existing.data[0]
    ?? await stripe.customers.create({ email, metadata: { clerk_user_id } })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: success_url || 'https://iceclaw.online/welcome?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancel_url || 'https://iceclaw.online/#pricing',
    metadata: { clerk_user_id, plan: plan || 'intro' },
  })

  return c.json({ checkout_url: session.url, session_id: session.id })
})

export const checkoutRoutes = app
