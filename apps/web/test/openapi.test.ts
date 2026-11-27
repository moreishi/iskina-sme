import { describe, expect, it } from 'vitest'
import { openApiDocument } from '../src/lib/openapi'

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const

describe('openapi document', () => {
  const paths = openApiDocument.paths as Record<string, Record<string, unknown>>
  const operations = Object.entries(paths).flatMap(([path, methods]) =>
    METHODS.filter((method) => methods[method]).map((method) => ({
      path,
      method,
      operation: methods[method] as {
        tags?: readonly string[]
        summary?: string
        responses?: Record<string, unknown>
      },
    })),
  )

  it('documents every route under /api', () => {
    expect(operations.length).toBeGreaterThan(20)
    for (const { path } of operations) {
      expect(path.startsWith('/api/')).toBe(true)
    }
  })

  it('gives every operation a tag, summary and at least one response', () => {
    for (const { path, method, operation } of operations) {
      expect(operation.tags?.length, `${method} ${path} tags`).toBeGreaterThan(0)
      expect(operation.summary, `${method} ${path} summary`).toBeTruthy()
      expect(Object.keys(operation.responses ?? {}).length, `${method} ${path}`).toBeGreaterThan(0)
    }
  })

  it('every tag is declared', () => {
    const declared = new Set<string>(openApiDocument.tags.map((tag) => tag.name))
    for (const { path, method, operation } of operations) {
      for (const tag of operation.tags ?? []) {
        expect(declared.has(tag), `${method} ${path} tag ${tag}`).toBe(true)
      }
    }
  })

  it('declares all security schemes used by operations', () => {
    const schemes = new Set(Object.keys(openApiDocument.components.securitySchemes))
    for (const { path, method, operation } of operations) {
      for (const option of (operation as { security?: Record<string, string[]>[] }).security ??
        []) {
        for (const name of Object.keys(option)) {
          expect(schemes.has(name), `${method} ${path} scheme ${name}`).toBe(true)
        }
      }
    }
  })
})
