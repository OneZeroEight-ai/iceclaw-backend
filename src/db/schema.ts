import { pgTable, uuid, varchar, boolean, integer, timestamp, text } from 'drizzle-orm/pg-core'

export const customers = pgTable('iceclaw_customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),

  // Stripe
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),

  // BTCPay
  btcpayInvoiceId: varchar('btcpay_invoice_id', { length: 255 }),

  // Plan
  plan: varchar('plan', { length: 50 }).default('intro'),
  status: varchar('status', { length: 50 }).default('pending'),

  // Stronghold
  containerId: varchar('container_id', { length: 255 }),
  containerStatus: varchar('container_status', { length: 50 }).default('pending'),
  openclawPort: integer('openclaw_port'),
  openclawVersion: varchar('openclaw_version', { length: 50 }).default('2026.3.28'),

  // Usage
  exchangesUsed: integer('exchanges_used').default(0),
  exchangesLimit: integer('exchanges_limit').default(2000),
  lastExchangeAt: timestamp('last_exchange_at'),

  // Governance flags
  bodhiEnforced: boolean('bodhi_enforced').default(true),
  nirvanaEnforced: boolean('nirvana_enforced').default(true),
  silaEnforced: boolean('sila_enforced').default(true),
  dharmaEnforced: boolean('dharma_enforced').default(true),

  // Admin
  adminNotes: text('admin_notes'),
  waitlistedAt: timestamp('waitlisted_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const openclawVersions = pgTable('openclaw_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  version: varchar('version', { length: 50 }).notNull(),
  imageTag: varchar('image_tag', { length: 200 }).notNull(),
  releaseNotes: text('release_notes'),
  isCurrent: boolean('is_current').default(false),
  isStable: boolean('is_stable').default(false),
  memoryGb: integer('memory_gb').default(3),
  testedAt: timestamp('tested_at'),
  rolledOutAt: timestamp('rolled_out_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type OpenClawVersion = typeof openclawVersions.$inferSelect
