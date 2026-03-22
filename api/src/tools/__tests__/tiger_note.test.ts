import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_note } from '../tiger_note.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_note', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
  })

  it('saves a note and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_note.execute(
      { contactId: 'c1', note: 'Called, left voicemail' },
      ctx
    )

    expect(result.ok).toBe(true)
    expect(ctx.storage.set).toHaveBeenCalledOnce()
  })

  it('returns the saved note text in output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_note.execute({ contactId: 'c1', note: 'Follow up next week' }, ctx)

    expect(result.output).toContain('Follow up next week')
  })

  it('appends a new note to existing notes for the same contact', async () => {
    storage.set('notes:c1', [{ text: 'First note', timestamp: '2026-01-01' }])
    const ctx = makeContext(storage)

    await tiger_note.execute({ contactId: 'c1', note: 'Second note' }, ctx)

    const saved = storage.get('notes:c1') as Array<{ text: string }>
    expect(saved.length).toBe(2)
    expect(saved[1].text).toBe('Second note')
  })

  it('returns ok:false when contactId is missing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_note.execute({ contactId: '', note: 'Some note' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false when note text is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_note.execute({ contactId: 'c1', note: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('includes a timestamp on the saved note', async () => {
    const ctx = makeContext(storage)
    await tiger_note.execute({ contactId: 'c1', note: 'Timestamped note' }, ctx)

    const saved = storage.get('notes:c1') as Array<{ timestamp: string }>
    expect(saved[0].timestamp).toBeTruthy()
  })
})
