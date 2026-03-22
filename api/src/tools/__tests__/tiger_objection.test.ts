import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_objection } from '../tiger_objection.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

// tiger_objection logs and helps handle sales objections from contacts

describe('tiger_objection', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', status: 'prospect' },
    ])
  })

  it('logs an objection and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_objection.execute({
      contactId: 'c1',
      objection: 'Price is too high',
    }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists the objection to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_objection.execute({ contactId: 'c1', objection: 'Not ready to buy' }, ctx)

    const objections = storage.get('objections:c1') as Array<{ text: string }>
    expect(objections).toBeTruthy()
    expect(objections.some((o) => o.text === 'Not ready to buy')).toBe(true)
  })

  it('provides a suggested response in the output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_objection.execute({
      contactId: 'c1',
      objection: 'We already have a solution',
    }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
    expect(result.output!.length).toBeGreaterThan(20)
  })

  it('returns ok:false when objection text is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_objection.execute({ contactId: 'c1', objection: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when contactId is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_objection.execute({ contactId: '', objection: 'Too expensive' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('appends to existing objections list', async () => {
    storage.set('objections:c1', [{ text: 'First objection', timestamp: '2026-01-01' }])
    const ctx = makeContext(storage)

    await tiger_objection.execute({ contactId: 'c1', objection: 'Second objection' }, ctx)

    const objections = storage.get('objections:c1') as Array<{ text: string }>
    expect(objections.length).toBe(2)
  })

  it('includes a timestamp on the logged objection', async () => {
    const ctx = makeContext(storage)
    await tiger_objection.execute({ contactId: 'c1', objection: 'Too risky' }, ctx)

    const objections = storage.get('objections:c1') as Array<{ timestamp: string }>
    expect(objections[0].timestamp).toBeTruthy()
  })
})
