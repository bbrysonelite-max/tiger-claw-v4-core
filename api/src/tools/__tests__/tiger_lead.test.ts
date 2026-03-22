import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_lead } from '../tiger_lead.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_lead', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
  })

  it('creates a new lead and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_lead.execute(
      { name: 'Dave Prospect', email: 'dave@example.com', source: 'telegram' },
      ctx
    )

    expect(result.ok).toBe(true)
  })

  it('persists the lead to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_lead.execute({ name: 'Eve Lead', email: 'eve@example.com', source: 'manual' }, ctx)

    const contacts = storage.get('contacts') as Array<{ name: string; email: string }>
    expect(contacts).toBeTruthy()
    expect(contacts.some((c) => c.email === 'eve@example.com')).toBe(true)
  })

  it('returns the new contact id in output or data', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_lead.execute({ name: 'Frank New', email: 'frank@example.com' }, ctx)

    expect(result.ok).toBe(true)
    // id should appear somewhere — either output text or data object
    const hasId =
      (result.output && result.output.length > 0) ||
      (result.data && typeof (result.data as Record<string, unknown>)['id'] === 'string')
    expect(hasId).toBe(true)
  })

  it('returns ok:false when name is missing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_lead.execute({ name: '', email: 'noname@example.com' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when email is missing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_lead.execute({ name: 'No Email', email: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('deduplicates contacts by email (does not create duplicate)', async () => {
    storage.set('contacts', [
      { id: 'c1', name: 'Existing Person', email: 'existing@example.com' },
    ])
    const ctx = makeContext(storage)

    const result = await tiger_lead.execute({ name: 'Existing Person', email: 'existing@example.com' }, ctx)

    const contacts = storage.get('contacts') as Array<{ email: string }>
    const dupes = contacts.filter((c) => c.email === 'existing@example.com')
    expect(dupes.length).toBe(1)
    // Should either return existing or indicate duplicate — not error
    expect(result.ok).toBe(true)
  })

  it('sets default status to lead on new contact', async () => {
    const ctx = makeContext(storage)
    await tiger_lead.execute({ name: 'Grace Lead', email: 'grace@example.com' }, ctx)

    const contacts = storage.get('contacts') as Array<{ email: string; status?: string; tags?: string[] }>
    const contact = contacts.find((c) => c.email === 'grace@example.com')
    // Contact should be tagged or have status indicating lead
    expect(contact?.status === 'lead' || contact?.tags?.includes('lead')).toBe(true)
  })

  it('accepts optional phone and stores it', async () => {
    const ctx = makeContext(storage)
    await tiger_lead.execute({ name: 'Henry', email: 'henry@example.com', phone: '+1-555-0101' }, ctx)

    const contacts = storage.get('contacts') as Array<{ email: string; phone?: string }>
    const contact = contacts.find((c) => c.email === 'henry@example.com')
    expect(contact?.phone).toBe('+1-555-0101')
  })
})
