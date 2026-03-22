import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_scout } from '../tiger_scout.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

// tiger_scout researches a contact or company via external sources

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('tiger_scout', () => {
  let storage: Storage

  beforeEach(() => {
    vi.resetAllMocks()
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice Johnson', email: 'alice@acme.com', company: 'Acme Corp' },
    ])
  })

  it('returns ok:true and scout data for a valid contactId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ company: 'Acme Corp', employees: 200, industry: 'Software' }),
    })
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_scout.execute({ contactId: 'c1' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('enriches the contact with scouted data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ industry: 'SaaS', employees: 50 }),
    })
    const ctx = makeContext(storage)
    await tiger_scout.execute({ contactId: 'c1' }, ctx)

    const contacts = storage.get('contacts') as Array<{ id: string; industry?: string }>
    const contact = contacts.find((c) => c.id === 'c1')
    expect(contact?.industry).toBe('SaaS')
  })

  it('returns ok:false for unknown contactId', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_scout.execute({ contactId: 'ghost' }, ctx)

    expect(result.ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns ok:false when contactId is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_scout.execute({ contactId: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:true with partial data when external lookup fails gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))
    const ctx = makeContext(storage)

    const result = await tiger_scout.execute({ contactId: 'c1' }, ctx)

    // Scout should degrade gracefully — not crash the tool
    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('also scouts by url when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ company: 'New Corp', employees: 100 }),
    })
    const ctx = makeContext(storage)
    const result = await tiger_scout.execute({ contactId: 'c1', url: 'https://newcorp.com' }, ctx)

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('newcorp.com'),
      expect.anything()
    )
  })
})
