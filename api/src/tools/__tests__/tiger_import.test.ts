import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_import } from '../tiger_import.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(async (_tid: string, data: unknown) => { mockLeads = data as any }),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
  saveTenantState: vi.fn(async (_tid: string, file: string, data: unknown) => {
    mockTenantState[file] = data
  }),
}))

// Minimal valid CSV with header row
const VALID_CSV = `name,phone,email
Alice Smith,+1-555-0001,alice@example.com
Bob Jones,+1-555-0002,bob@example.com
Carol White,,carol@example.com`

describe('tiger_import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {}
    mockTenantState = {}
  })

  it('imports CSV contacts and returns ok:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_import.execute({ action: 'import', csv: VALID_CSV }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists all imported contacts as lead records', async () => {
    const ctx = makeContext()
    await tiger_import.execute({ action: 'import', csv: VALID_CSV }, ctx)

    const saved = Object.values(mockLeads)
    expect(saved.length).toBe(3)
    const names = saved.map((l: any) => l.displayName)
    expect(names).toContain('Alice Smith')
  })

  it('reports import count in output', async () => {
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'import', csv: VALID_CSV }, ctx)

    expect(result.output).toContain('3')
  })

  it('preview action returns ok:true without saving', async () => {
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'preview', csv: VALID_CSV }, ctx)

    expect(result.ok).toBe(true)
    // Preview should not save anything
    expect(Object.keys(mockLeads).length).toBe(0)
  })

  it('returns ok:false when csv is empty', async () => {
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'import', csv: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when csv is missing', async () => {
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'import' } as never, ctx)

    expect(result.ok).toBe(false)
  })

  it('deduplicates contacts by displayName when merging with existing leads', async () => {
    mockLeads = {
      'existing-1': { id: 'existing-1', displayName: 'Alice Smith', platform: 'import' },
    }
    const ctx = makeContext()
    await tiger_import.execute({ action: 'import', csv: VALID_CSV }, ctx)

    const aliceEntries = Object.values(mockLeads).filter((l: any) => l.displayName === 'Alice Smith')
    expect(aliceEntries.length).toBe(1)
  })

  it('status action returns ok:true', async () => {
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'unknown' } as never, ctx)

    expect(result.ok).toBe(false)
  })

  it('handles large CSV imports without error', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => `Person ${i},,person${i}@example.com`)
    const bigCsv = `name,phone,email\n${rows.join('\n')}`
    const ctx = makeContext()
    const result = await tiger_import.execute({ action: 'import', csv: bigCsv }, ctx)

    expect(result.ok).toBe(true)
    expect(Object.keys(mockLeads).length).toBe(100)
  })
})
