import { Hono } from 'hono'
import { getBrandConfig } from '../middleware/brand.js'

const app = new Hono()

// GET /brand — returns brand config for the requesting domain
app.get('/brand', async (c) => {
  const brandId = c.req.header('x-brand-id') || 'iceclaw'
  const brand = getBrandConfig(brandId)
  return c.json(brand)
})

export const brandRoutes = app
