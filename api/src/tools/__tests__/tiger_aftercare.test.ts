import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_aftercare } from '../tiger_aftercare.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

// tiger_aftercare handles post-conversion follow-up for existing customers

describe('tiger_aftercare', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', status: 'customer', plan: 'pro', convertedAt: '2026-02-01' },
      { id: 'c2', name: 'Bob', status: 'lead' }, // not a customer
    ])
  })

  it('schedules aftercare for a customer and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_aftercare.execute({
      contactId: 'c1',
      type: 'check-in',
    }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists the aftercare record to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_aftercare.execute({ contactId: 'c1', type: 'check-in' }, ctx)

    const record = storage.get('aftercare:c1')
    expect(record).toBeTruthy()
  })

  it('returns ok:false for a non-customer contact', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_aftercare.execute({ contactId: 'c2', type: 'check-in' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/customer|not converted/i)
  })

  it('returns ok:false for unknown contactId', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_aftercare.execute({ contactId: 'ghost', type: 'check-in' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for unknown aftercare type', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_aftercare.execute({ contactId: 'c1', type: 'quantum-touch' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('includes the scheduled type in the output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_aftercare.execute({ contactId: 'c1', type: 'check-in' }, ctx)

    expect(result.output).toContain('check-in')
  })

  it('accepts "upsell" type and stores it', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_aftercare.execute({ contactId: 'c1', type: 'upsell' }, ctx)

    expect(result.ok).toBe(true)
    const record = storage.get('aftercare:c1') as Record<string, unknown>
    expect(record?.['type']).toBe('upsell')
  })

  it('handles contactId empty gracefully', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_aftercare.execute({ contactId: '', type: 'check-in' }, ctx)

    expect(result.ok).toBe(false)
  })
})
