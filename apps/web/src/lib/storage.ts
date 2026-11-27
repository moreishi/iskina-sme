import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<string>
  delete(url: string): Promise<void>
  isOwnUrl(url: string): boolean
}

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

function env(name: string): string | null {
  return process.env[name]?.trim() || null
}

class LocalStorage implements StorageAdapter {
  private readonly root = resolve(process.cwd(), 'public/uploads')

  async put(key: string, data: Buffer): Promise<string> {
    const path = resolve(this.root, key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data)
    return `/uploads/${key}`
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return
    try {
      await unlink(resolve(this.root, url.slice('/uploads/'.length)))
    } catch {
      // Missing files are fine.
    }
  }

  isOwnUrl(url: string): boolean {
    return url.startsWith('/uploads/') && !url.includes('..')
  }
}

class S3Storage implements StorageAdapter {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly baseUrl: string

  constructor() {
    const bucket = env('S3_BUCKET')
    const baseUrl = env('S3_PUBLIC_BASE_URL')
    if (!bucket || !baseUrl) {
      throw new StorageUnavailableError('S3_BUCKET and S3_PUBLIC_BASE_URL are required')
    }
    const endpoint = env('S3_ENDPOINT')
    this.bucket = bucket
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.client = new S3Client({
      region: env('S3_REGION') ?? 'auto',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: env('S3_ACCESS_KEY_ID') ?? '',
        secretAccessKey: env('S3_SECRET_ACCESS_KEY') ?? '',
      },
    })
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return `${this.baseUrl}/${key}`
  }

  async delete(url: string): Promise<void> {
    if (!this.isOwnUrl(url)) return
    const key = url.slice(this.baseUrl.length + 1)
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch {
      // Deletion is best effort; the DB is the source of truth.
    }
  }

  isOwnUrl(url: string): boolean {
    return url.startsWith(`${this.baseUrl}/`)
  }
}

let cached: StorageAdapter | null = null

export function storage(): StorageAdapter {
  if (cached) return cached
  if (env('S3_BUCKET') && env('S3_PUBLIC_BASE_URL')) {
    cached = new S3Storage()
    return cached
  }
  if (process.env.NODE_ENV === 'production') {
    throw new StorageUnavailableError(
      'Image storage is not configured. Set S3_BUCKET and S3_PUBLIC_BASE_URL.',
    )
  }
  cached = new LocalStorage()
  return cached
}

export function itemImageKey(businessId: string, extension = 'webp'): string {
  return `businesses/${businessId}/items/${randomUUID()}.${extension}`
}

/** Guard for any URL a merchant tries to store directly. */
export function isOwnedImageUrl(url: string): boolean {
  try {
    return storage().isOwnUrl(url)
  } catch {
    return false
  }
}
