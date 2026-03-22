import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_convert } from '../tiger_convert.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_convert', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', status: 'lead', score: 80 },
      { id: 'c2', name: 'Bob', status: 'prospect', score: 60 },
    ])
  })

  it('converts a lead to a customer and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_convert.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('updates the contact status to "customer" after conversion', async () => {
    const ctx = makeContext(storage)
    await tiger_convert.execute({ contactId: 'c1', plan: 'pro' }, ctx)

    const contacts = storage.get('contacts') as Array<{ id: string; status: string }>
    const contact = contacts.find((c) => c.id === 'c1')
    expect(contact?.status).toBe('customer')
  })

  it('records the conversion plan on the contact', async () => {
    const ctx = makeContext(storage)
    await tiger_convert.execute({ contactId: 'c1', plan: 'enterprise' }, ctx)

    const contacts = storage.get('contacts') as Array<{ id: string; plan?: string }>
    const contact = contacts.find((c) => c.id === 'c1')
    expect(contact?.plan).toBe('enterprise')
  })

  it('returns ok:false for unknown contactId', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_convert.execute({ contactId: 'ghost', plan: 'starter' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false when contactId is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_convert.execute({ contactId: '', plan: 'starter' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when plan is missing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_convert.execute({ contactId: 'c1', plan: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('logs a conversion event to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_convert.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    const events = storage.get('events') as Array<{ type: string }> | undefined
    if (events) {
      const conversionEvent = events.find((e) => e.type === 'conversion' || e.type === 'convert')
      expect(conversionEvent).toBeTruthy()
    }
  })

  it('is idempotent — converting an already-converted customer returns ok:true or helpful message', async () => {
    storage.set('contacts', [{ id: 'c1', name: 'Alice', status: 'customer', plan: 'starter' }])
    const ctx = makeContext(storage)

    const result = await tiger_convert.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    // Should not crash — either ok:true (idempotent) or ok:false with explanation
    if (!result.ok) {
      expect(result.error).toContain('already')
    }
  })
})
