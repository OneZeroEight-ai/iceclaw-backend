import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { customerRoutes } from './routes/customers.js'
import { agentRoutes } from './routes/agents.js'
import { chatRoutes } from './routes/chat.js'
import { strongholdRoutes } from './routes/stronghold.js'
import { integrationRoutes } from './routes/integrations.js'
import { starterRoutes } from './routes/starters.js'
import { adminRoutes } from './routes/admin.js'
import { webhookRoutes } from './routes/webhooks.js'
import { checkoutRoutes } from './routes/checkout.js'
import { agentSettingsRoutes } from './routes/agent-settings.js'
import { agentConfigRoutes } from './routes/agent-config.js'
import { brandRoutes } from './routes/brand.js'
import { brandMiddleware } from './middleware/brand.js'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors({
  origin: ['https://www.iceclaw.online', 'https://iceclaw.online', 'https://sutra.team', 'https://www.sutra.team', 'http://localhost:3001'],
  credentials: true,
}))

app.use('/api/*', brandMiddleware)

app.get('/health', (c) => c.json({ status: 'healthy', service: 'iceclaw-backend', version: '1.0.0' }))

app.route('/api', brandRoutes)
app.route('/api/iceclaw', customerRoutes)
app.route('/api/iceclaw', agentRoutes)
app.route('/api/iceclaw', chatRoutes)
app.route('/api/iceclaw', strongholdRoutes)
app.route('/api/iceclaw', integrationRoutes)
app.route('/api/iceclaw', starterRoutes)
app.route('/api/iceclaw', adminRoutes)
app.route('/api/iceclaw', webhookRoutes)
app.route('/api/iceclaw', checkoutRoutes)
app.route('/api/iceclaw', agentSettingsRoutes)
app.route('/api/iceclaw', agentConfigRoutes)

const port = parseInt(process.env.PORT ?? '3000')

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[iceclaw] Backend running on port ${info.port}`)
})
