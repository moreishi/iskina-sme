import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const here = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(here, '../../..')

config({ path: resolve(root, '.env'), quiet: true })
config({ path: resolve(root, '.env.local'), override: true, quiet: true })
