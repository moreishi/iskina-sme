import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

config({ path: resolve(root, '.env'), quiet: true })
config({ path: resolve(root, '.env.local'), override: true, quiet: true })

export const env = {
  // Lazy so `next build` can import server modules without a live database.
  get databaseUrl(): string {
    const value = process.env.DATABASE_URL
    if (!value?.trim()) {
      throw new Error('Missing required environment variable: DATABASE_URL')
    }
    return value
  },
}
