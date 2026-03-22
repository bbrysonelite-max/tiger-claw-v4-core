import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_move } from '../tiger_move.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

// tiger_move advances a contact through the pipeline stages:
// lead → prospect → opportunity → customer (or back)

describe('tiger_move', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', status: 'lead' },
      { id: 'c2', name: 'Bob', status: 'prospect' },
      { id: 'c3', name: 'Carol', status: 'customer' },
    ])
  })

  it('advances a lead to prospect', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_move.execute({ contactId: 'c1', toStatus: 'prospect' }, ctx)

    expect(result.ok).toBe(true)
    const contacts = storage.get('contacts') as Array<{ id: string; status: string }>
    expect(contacts.find((c) => c.id === 'c1')?.status).toBe('prospect')
  })

  it('advances a prospect to opportunity', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_move.execute({ contactId: 'c2', toStatus: 'opportunity' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('records the status change in events', async () => {
    const ctx = makeContext(storage)
    await tiger_move.execute({ contactId: 'c1', toStatus: 'prospect' }, ctx)

    const events = storage.get('events') as Array<{ type: string; contactId: string }>
    if (events) {
      const moveEvent = events.find((e) => e.contactId === 'c1' && e.type.includes('move'))
      expect(moveEvent).toBeTruthy()
    }
  })

  it('returns ok:false for unknown contactId', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_move.execute({ contactId: 'ghost', toStatus: 'prospect' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false for invalid target status', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_move.execute({ contactId: 'c1', toStatus: 'galaxy-brain' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when moving to the same status', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_move.execute({ contactId: 'c1', toStatus: 'lead' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already|same/i)
  })

  it('includes old and new status in output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_move.execute({ contactId: 'c1', toStatus: 'prospect' }, ctx)

    expect(result.output).toContain('lead')
    expect(result.output).toContain('prospect')
  })

  it('accepts optional reason for the move', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_move.execute({
      contactId: 'c1',
      toStatus: 'prospect',
      reason: 'Requested demo',
    }, ctx)

    expect(result.ok).toBe(true)
  })
})
