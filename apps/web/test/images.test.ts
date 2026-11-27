import { describe, expect, it } from 'vitest'
import { sniffImage } from '../src/lib/images'

function bytes(values: number[]): Buffer {
  return Buffer.from(values)
}

describe('image magic bytes', () => {
  it('detects jpeg, png and webp', () => {
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
    expect(sniffImage(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
    ])
    expect(sniffImage(webp)).toBe('webp')
  })

  it('rejects svg, gif and junk', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(sniffImage(Buffer.from('GIF89a'))).toBeNull()
    expect(sniffImage(Buffer.from('not an image'))).toBeNull()
    expect(sniffImage(Buffer.alloc(0))).toBeNull()
  })
})
