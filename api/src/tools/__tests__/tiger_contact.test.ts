import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_contact } from '../tiger_contact.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe.skip('tiger_contact', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('contacts', [
      {
        id: 'c1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '+1-555-0100',
        status: 'lead',
        tags: ['vip'],
      },
    ])
  })

  // ---------------------------------------------------------------------------
  // Read / lookup
  // ---------------------------------------------------------------------------
  it('returns contact details for a known id', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_contact.execute({ contactId: 'c1', action: 'get' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
  })

  it('returns ok:false for an unknown contactId', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_contact.execute({ contactId: 'ghost', action: 'get' }, ctx)

    expect(result.ok).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  it('updates a contact field and persists the change', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_contact.execute({
      contactId: 'c1',
      action: 'update',
      fields: { phone: '+1-555-9999' },
    }, ctx)

    expect(result.ok).toBe(true)
    const contacts = storage.get('contacts') as Array<{ id: string; phone: string }>
    expect(contacts.find((c) => c.id === 'c1')?.phone).toBe('+1-555-9999')
  })

  it('does not overwrite unrelated fields during update', async () => {
    const ctx = makeContext(storage)
    await tiger_contact.execute({
      contactId: 'c1',
      action: 'update',
      fields: { phone: '+1-555-0200' },
    }, ctx)

    const contacts = storage.get('contacts') as Array<{ id: string; email: string }>
    expect(contacts.find((c) => c.id === 'c1')?.email).toBe('alice@example.com')
  })

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  it('removes a contact from storage when action is "delete"', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_contact.execute({ contactId: 'c1', action: 'delete' }, ctx)

    expect(result.ok).toBe(true)
    const contacts = storage.get('contacts') as Array<{ id: string }>
    expect(contacts.find((c) => c.id === 'c1')).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  it('returns ok:false when contactId is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_contact.execute({ contactId: '', action: 'get' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for an unknown action', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_contact.execute({ contactId: 'c1', action: 'warp' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------
  it('adds a tag to a contact', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_contact.execute({
      contactId: 'c1',
      action: 'update',
      fields: { tags: ['vip', 'lead'] },
    }, ctx)

    expect(result.ok).toBe(true)
    const contacts = storage.get('contacts') as Array<{ id: string; tags: string[] }>
    expect(contacts.find((c) => c.id === 'c1')?.tags).toContain('lead')
  })
})
