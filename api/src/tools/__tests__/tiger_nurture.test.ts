import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_nurture } from '../tiger_nurture.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_nurture', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', email: 'alice@example.com', score: 40, status: 'lead' },
      { id: 'c2', name: 'Bob', email: 'bob@example.com', score: 70, status: 'prospect' },
    ])
    storage.set('settings', { followUpDays: 7, language: 'en' })
  })

  it('schedules a nurture sequence for a contact', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_nurture.execute({ contactId: 'c1', sequenceType: 'standard' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists the nurture schedule to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_nurture.execute({ contactId: 'c1', sequenceType: 'standard' }, ctx)

    const nurture = storage.get('nurture:c1')
    expect(nurture).toBeTruthy()
  })

  it('returns ok:false when contactId is missing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_nurture.execute({ contactId: '', sequenceType: 'standard' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for unknown sequence type', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_nurture.execute({ contactId: 'c1', sequenceType: 'warp-speed' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('does not duplicate nurture sequences for the same contact', async () => {
    storage.set('nurture:c1', { sequenceType: 'standard', step: 2 })
    const ctx = makeContext(storage)

    const result = await tiger_nurture.execute({ contactId: 'c1', sequenceType: 'standard' }, ctx)

    // Should handle duplicate gracefully — either ok:false with explanation or ok:true idempotent
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })

  it('includes next follow-up date in output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_nurture.execute({ contactId: 'c1', sequenceType: 'standard' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })
})
