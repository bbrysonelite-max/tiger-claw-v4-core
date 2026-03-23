import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_export } from '../tiger_export.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe.skip('tiger_export', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', email: 'alice@example.com', status: 'customer', tags: ['vip'] },
      { id: 'c2', name: 'Bob', email: 'bob@example.com', status: 'lead', tags: ['lead'] },
      { id: 'c3', name: 'Carol', email: 'carol@example.com', status: 'customer', tags: [] },
    ])
  })

  it('exports all contacts and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_export.execute({ format: 'json' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('returns all contacts in data when format is json', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_export.execute({ format: 'json' }, ctx)

    const data = result.data as { contacts: unknown[] }
    expect(data?.contacts?.length).toBe(3)
  })

  it('filters by status when filter is provided', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_export.execute({ format: 'json', filter: { status: 'customer' } }, ctx)

    const data = result.data as { contacts: Array<{ status: string }> }
    expect(data.contacts.every((c) => c.status === 'customer')).toBe(true)
    expect(data.contacts.length).toBe(2)
  })

  it('filters by tag when tag filter is provided', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_export.execute({ format: 'json', filter: { tag: 'vip' } }, ctx)

    const data = result.data as { contacts: Array<{ tags: string[] }> }
    expect(data.contacts.every((c) => c.tags.includes('vip'))).toBe(true)
  })

  it('returns csv-formatted output when format is csv', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_export.execute({ format: 'csv' }, ctx)

    expect(result.ok).toBe(true)
    // CSV should contain header row
    expect(result.output).toMatch(/name|email/i)
    // Each contact email should appear
    expect(result.output).toContain('alice@example.com')
  })

  it('returns ok:false for unknown format', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_export.execute({ format: 'xlsx' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:true with empty contacts list when storage is empty', async () => {
    const emptyStorage = new Map()
    const ctx = makeContext(emptyStorage)
    const result = await tiger_export.execute({ format: 'json' }, ctx)

    expect(result.ok).toBe(true)
    const data = result.data as { contacts: unknown[] }
    expect(data.contacts?.length ?? 0).toBe(0)
  })

  it('includes export count in output message', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_export.execute({ format: 'json' }, ctx)

    expect(result.output).toMatch(/3|three/i)
  })
})
