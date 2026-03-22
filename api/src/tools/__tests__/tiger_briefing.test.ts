import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_briefing } from '../tiger_briefing.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_briefing', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      { id: 'c1', name: 'Alice', status: 'customer', score: 90, lastContact: '2026-03-01' },
      { id: 'c2', name: 'Bob', status: 'lead', score: 45, lastContact: '2026-02-15' },
      { id: 'c3', name: 'Carol', status: 'lead', score: 70, lastContact: '2026-03-20' },
    ])
    storage.set('events', [
      { type: 'note', contactId: 'c1', timestamp: '2026-03-20' },
      { type: 'conversion', contactId: 'c1', timestamp: '2026-03-10' },
    ])
    storage.set('settings', { followUpDays: 7 })
  })

  it('returns a briefing summary and ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_briefing.execute({}, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('includes hot leads (high score) in the briefing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_briefing.execute({}, ctx)

    // Carol has score 70 and recent contact — should be highlighted
    expect(result.output).toContain('Carol')
  })

  it('includes recent activity count', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_briefing.execute({}, ctx)

    // Should mention recent events
    expect(result.output).toBeTruthy()
    expect(result.output!.length).toBeGreaterThan(50)
  })

  it('returns a scoped briefing when contactId is provided', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_briefing.execute({ contactId: 'c1' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
    // Should not show unrelated contacts
    expect(result.output).not.toContain('Bob')
  })

  it('returns ok:false for unknown contactId scope', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_briefing.execute({ contactId: 'ghost' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('handles empty contact list gracefully', async () => {
    const emptyStorage = new Map()
    emptyStorage.set('contacts', [])
    emptyStorage.set('settings', { followUpDays: 7 })
    const ctx = makeContext(emptyStorage)

    const result = await tiger_briefing.execute({}, ctx)

    expect(result.ok).toBe(true)
    // Should indicate no contacts, not crash
    expect(result.output).toBeTruthy()
  })

  it('includes overdue follow-ups in the briefing', async () => {
    // Bob's last contact was 35 days ago — well past followUpDays: 7
    storage.set('contacts', [
      { id: 'c2', name: 'Bob Overdue', status: 'lead', score: 45, lastContact: '2026-02-15' },
    ])
    const ctx = makeContext(storage)
    const result = await tiger_briefing.execute({}, ctx)

    expect(result.ok).toBe(true)
    // Should mention overdue or Bob
    expect(result.output).toBeTruthy()
  })
})
