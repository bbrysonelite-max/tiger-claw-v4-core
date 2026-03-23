import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_note } from '../tiger_note.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {};
const mockSaveLeads = vi.fn(async (tenantId, leads) => {
  mockLeads = leads;
});

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: (tenantId: string, leads: any) => mockSaveLeads(tenantId, leads),
  getTenantState: vi.fn(async () => ({ language: 'en' })),
}))

describe.skip('tiger_note', () => {
  beforeEach(() => {
    mockLeads = {
      'c1': { id: 'c1', displayName: 'Alice', platform: 'telegram', builderScore: 50, customerScore: 50, qualifyingScore: 50, optedOut: false, notes: [] }
    };
    mockSaveLeads.mockClear();
  })

  it('saves a note and returns ok:true', async () => {
    const ctx = makeContext();
    const result: ToolResult = await tiger_note.execute(
      { name: 'Alice', note: 'Called, left voicemail' },
      ctx
    )

    expect(result.ok).toBe(true)
    expect(mockSaveLeads).toHaveBeenCalledOnce()
  })

  it('returns the saved note text in output', async () => {
    const ctx = makeContext();
    const result = await tiger_note.execute({ name: 'Alice', note: 'Follow up next week' }, ctx)

    expect(result.output).toContain('Alice')
  })

  it('appends a new note to existing notes for the same contact', async () => {
    mockLeads['c1'].notes = [{ text: 'First note', addedAt: '2026-01-01' }];
    const ctx = makeContext();

    await tiger_note.execute({ name: 'Alice', note: 'Second note' }, ctx)

    const saved = mockLeads['c1'].notes;
    expect(saved.length).toBe(2)
    expect(saved[1].text).toBe('Second note')
  })

  it('returns ok:false when name is missing', async () => {
    const ctx = makeContext();
    const result = await tiger_note.execute({ name: '', note: 'Some note' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false when note text is empty', async () => {
    const ctx = makeContext();
    const result = await tiger_note.execute({ name: 'Alice', note: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('includes a timestamp on the saved note', async () => {
    const ctx = makeContext();
    await tiger_note.execute({ name: 'Alice', note: 'Timestamped note' }, ctx)

    const saved = mockLeads['c1'].notes;
    expect(saved[0].addedAt).toBeTruthy()
  })
})
