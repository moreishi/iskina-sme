import sharp from 'sharp'

export const MAX_IMAGE_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024)
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type ImageKind = 'jpeg' | 'png' | 'webp'

/** Magic bytes only — never trust the client's Content-Type. */
export function sniffImage(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

export interface ProcessedImage {
  buffer: Buffer
  contentType: 'image/webp'
  extension: 'webp'
  width: number
  height: number
}

/** Auto-rotate, bound the long edge, strip metadata, encode WebP. */
export async function processItemImage(input: Buffer): Promise<ProcessedImage> {
  const image = sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })

  const { data, info } = await image.toBuffer({ resolveWithObject: true })
  return {
    buffer: data,
    contentType: 'image/webp',
    extension: 'webp',
    width: info.width,
    height: info.height,
  }
}
