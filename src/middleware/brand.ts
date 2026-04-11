import { createMiddleware } from 'hono/factory'
import { readFileSync } from 'fs'
import { join } from 'path'

const BRANDS_DIR = join(process.cwd(), 'config', 'brands')

function loadBrand(brandId: string): Record<string, any> | null {
  try {
    const path = join(BRANDS_DIR, `${brandId}.json`)
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

const defaultBrand = loadBrand('iceclaw')

export const brandMiddleware = createMiddleware(async (c, next) => {
  const brandId = c.req.header('x-brand-id') || 'iceclaw'
  const brand = loadBrand(brandId) || defaultBrand
  c.set('brand', brand)
  await next()
})

export function getBrandConfig(brandId: string): Record<string, any> {
  return loadBrand(brandId) || defaultBrand || {}
}
