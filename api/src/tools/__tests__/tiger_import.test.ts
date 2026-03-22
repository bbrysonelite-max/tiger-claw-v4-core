import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_import } from '../tiger_import.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_import', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
  })

  const validCsvContacts = [
    { name: 'Alice Smith', email: 'alice@example.com', phone: '+1-555-0001' },
    { name: 'Bob Jones', email: 'bob@example.com', phone: '+1-555-0002' },
    { name: 'Carol White', email: 'carol@example.com', phone: '' },
  ]

  it('imports a list of contacts and returns ok:true', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_import.execute({ contacts: validCsvContacts }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists all imported contacts to storage', async () => {
    const ctx = makeContext(storage)
    await tiger_import.execute({ contacts: validCsvContacts }, ctx)

    const contacts = storage.get('contacts') as Array<{ email: string }>
    expect(contacts.length).toBe(3)
    expect(contacts.map((c) => c.email)).toContain('alice@example.com')
  })

  it('reports import count in output', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_import.execute({ contacts: validCsvContacts }, ctx)

    expect(result.output).toContain('3')
  })

  it('skips rows with missing email and reports them', async () => {
    const ctx = makeContext(storage)
    const withBadRow = [
      ...validCsvContacts,
      { name: 'No Email', email: '', phone: '' },
    ]

    const result = await tiger_import.execute({ contacts: withBadRow }, ctx)

    expect(result.ok).toBe(true)
    const contacts = storage.get('contacts') as Array<{ email: string }>
    expect(contacts.every((c) => c.email !== '')).toBe(true)
    // Should note the skipped row
    expect(result.output).toMatch(/skip|invalid|error/i)
  })

  it('deduplicates contacts by email when merging with existing', async () => {
    storage.set('contacts', [{ id: 'c-existing', name: 'Alice Smith', email: 'alice@example.com' }])
    const ctx = makeContext(storage)

    await tiger_import.execute({ contacts: validCsvContacts }, ctx)

    const contacts = storage.get('contacts') as Array<{ email: string }>
    const aliceEntries = contacts.filter((c) => c.email === 'alice@example.com')
    expect(aliceEntries.length).toBe(1)
  })

  it('returns ok:false when contacts array is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_import.execute({ contacts: [] }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when contacts argument is missing', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_import.execute({} as never, ctx)

    expect(result.ok).toBe(false)
  })

  it('assigns "lead" status to all imported contacts by default', async () => {
    const ctx = makeContext(storage)
    await tiger_import.execute({ contacts: validCsvContacts }, ctx)

    const contacts = storage.get('contacts') as Array<{ status?: string; tags?: string[] }>
    for (const contact of contacts) {
      expect(contact.status === 'lead' || contact.tags?.includes('lead')).toBe(true)
    }
  })

  it('handles large imports without error', async () => {
    const bigList = Array.from({ length: 500 }, (_, i) => ({
      name: `Person ${i}`,
      email: `person${i}@example.com`,
      phone: '',
    }))
    const ctx = makeContext(storage)
    const result = await tiger_import.execute({ contacts: bigList }, ctx)

    expect(result.ok).toBe(true)
    const contacts = storage.get('contacts') as unknown[]
    expect(contacts.length).toBe(500)
  })
})
