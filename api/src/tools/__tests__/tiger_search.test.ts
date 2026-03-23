import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_search } from '../tiger_search.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe.skip('tiger_search', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    // Seed some contacts for searching
    storage.set('contacts', [
      { id: 'c1', name: 'Alice Johnson', email: 'alice@example.com', tags: ['vip'] },
      { id: 'c2', name: 'Bob Smith', email: 'bob@example.com', tags: ['lead'] },
      { id: 'c3', name: 'Carol White', email: 'carol@example.com', tags: ['vip', 'lead'] },
    ])
  })

  it('returns matching contacts for a name query', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_search.execute({ query: 'Alice' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
  })

  it('returns ok:false with empty query', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_search.execute({ query: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:true with empty results when no match', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_search.execute({ query: 'nonexistent-contact-xyz' }, ctx)

    expect(result.ok).toBe(true)
    // Should indicate no results, not error
    expect(result.error).toBeUndefined()
  })

  it('matches contacts by email', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_search.execute({ query: 'bob@example.com' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Bob')
  })

  it('matches contacts by tag when tag filter is provided', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_search.execute({ query: 'vip', searchType: 'tag' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
    expect(result.output).toContain('Carol')
  })

  it('limits results when a limit is specified', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_search.execute({ query: 'e', limit: 1 }, ctx)

    expect(result.ok).toBe(true)
    const data = result.data as { results: unknown[] }
    if (data?.results) {
      expect(data.results.length).toBeLessThanOrEqual(1)
    }
  })

  it('returns ok:false when storage get throws', async () => {
    const ctx = makeContext(storage)
    ctx.storage.get = async () => { throw new Error('Storage error') }

    const result = await tiger_search.execute({ query: 'Alice' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
