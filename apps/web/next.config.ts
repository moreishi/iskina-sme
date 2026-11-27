import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true })
loadEnv({ path: resolve(process.cwd(), '../../.env.local'), override: true, quiet: true })

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  transpilePackages: ['@iskina/contracts', '@iskina/core', '@iskina/db'],
  serverExternalPackages: ['pg', 'sharp'],
}

export default nextConfig
