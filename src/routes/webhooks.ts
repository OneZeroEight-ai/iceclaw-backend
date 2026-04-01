import { Hono } from 'hono'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { provision } from '../services/provisioner.js'
import { sendWelcomeEmail, sendWaitlistEmail, sendCapacityAlert } from '../services/email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

const app = new Hono()

app.post('/webhook/stripe', async (c) => {
  const body = await c.req.text()
  const sig = c.req.header('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch {
    return c.json({ error: 'Invalid signature' }, 400)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const clerkUserId = session.metadata?.clerk_user_id ?? ''
    const email = session.customer_email ?? ''
    if (!clerkUserId || !email) return c.json({ status: 'ignored' })

    // Upsert customer
    const [existing] = await db.select().from(schema.customers).where(eq(schema.customers.clerkUserId, clerkUserId))
    if (existing) {
      await db.update(schema.customers).set({
        status: 'active',
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
      }).where(eq(schema.customers.clerkUserId, clerkUserId))
    } else {
      await db.insert(schema.customers).values({
        clerkUserId,
        email,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        status: 'provisioning',
        containerStatus: 'pending',
      })
    }

    // Provision
    try {
      const result = await provision(clerkUserId)
      await db.update(schema.customers).set({
        containerId: result.containerId,
        containerStatus: 'active',
        openclawPort: result.port,
        status: 'active',
      }).where(eq(schema.customers.clerkUserId, clerkUserId))
      await sendWelcomeEmail(email, result.port, '')
    } catch (err: any) {
      if (err.message?.includes('No ports available')) {
        const waitlistCount = (await db.select().from(schema.customers).where(eq(schema.customers.containerStatus, 'waitlisted'))).length
        await db.update(schema.customers).set({
          containerStatus: 'waitlisted',
          waitlistedAt: new Date(),
        }).where(eq(schema.customers.clerkUserId, clerkUserId))
        await sendWaitlistEmail(email, waitlistCount + 1)
        await sendCapacityAlert(email, 20, 20)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await db.update(schema.customers).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(schema.customers.stripeSubscriptionId, sub.id))
  }

  return c.json({ status: 'ok' })
})

export const webhookRoutes = app
