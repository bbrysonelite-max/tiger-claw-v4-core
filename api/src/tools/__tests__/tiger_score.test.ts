import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_score } from '../tiger_score.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_score', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      {
        id: 'c1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        score: null,
        interactions: 5,
        lastContact: '2026-03-01',
      },
    ])
  })

  it('assigns a score to a contact and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_score.execute({ contactId: 'c1', score: 85 }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists the score to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_score.execute({ contactId: 'c1', score: 75 }, ctx)

    const contacts = storage.get('contacts') as Array<{ id: string; score: number }>
    const contact = contacts.find((c) => c.id === 'c1')
    expect(contact?.score).toBe(75)
  })

  it('returns the score in output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: 'c1', score: 90 }, ctx)

    expect(result.output).toContain('90')
  })

  it('returns ok:false for score below 0', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: 'c1', score: -1 }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for score above 100', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: 'c1', score: 101 }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for unknown contactId', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: 'nonexistent', score: 50 }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false when contactId is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: '', score: 50 }, ctx)

    expect(result.ok).toBe(false)
  })

  it('accepts score of exactly 0 (valid boundary)', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: 'c1', score: 0 }, ctx)

    expect(result.ok).toBe(true)
  })

  it('accepts score of exactly 100 (valid boundary)', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({ contactId: 'c1', score: 100 }, ctx)

    expect(result.ok).toBe(true)
  })

  it('optionally accepts a reason and includes it in output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_score.execute({
      contactId: 'c1',
      score: 80,
      reason: 'High engagement rate',
    }, ctx)

    expect(result.ok).toBe(true)
    if (result.output) {
      expect(result.output).toContain('engagement')
    }
  })
})
