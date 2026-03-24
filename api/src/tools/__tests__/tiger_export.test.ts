import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_export } from '../tiger_export.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {}
let mockNurture: Record<string, any> = {}
let mockContacts: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  getNurture: vi.fn(async () => mockNurture),
  getContacts: vi.fn(async () => mockContacts),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
}))

const makeLeadRecord = (id: string, displayName: string, manualStatus?: string) => ({
  id,
  platform: 'telegram',
  displayName,
  profileFit: 70,
  builderScore: 65,
  customerScore: 60,
  qualifyingScore: 65,
  oar: 'builder',
  primaryOar: 'builder',
  optedOut: false,
  discoveredAt: '2026-01-01T00:00:00Z',
  manualStatus,
  notes: [],
  language: 'en',
  involvementLevel: 0,
})

describe('tiger_export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {
      'lead-001': makeLeadRecord('lead-001', 'Alice Johnson', 'converted'),
      'lead-002': makeLeadRecord('lead-002', 'Bob Smith'),
      'lead-003': makeLeadRecord('lead-003', 'Carol White', 'nurture'),
    }
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {}
  })

  it('exports all leads and returns ok:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_export.execute({}, ctx)

    expect(result.ok).toBe(true)
  })

  it('returns row count in data', async () => {
    const ctx = makeContext()
    const result = await tiger_export.execute({}, ctx)

    expect((result.data as any)?.rowCount).toBe(3)
  })

  it('filter=converted returns only converted leads', async () => {
    const ctx = makeContext()
    const result = await tiger_export.execute({ filter: 'converted' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.rowCount).toBe(1)
  })

  it('includes Alice in exported CSV content', async () => {
    const ctx = makeContext()
    const result = await tiger_export.execute({}, ctx)

    const file = (result as any).file
    expect(file?.content).toContain('Alice Johnson')
  })

  it('returns ok:true with 0 rows when leads store is empty', async () => {
    mockLeads = {}
    const ctx = makeContext()
    const result = await tiger_export.execute({}, ctx)

    expect(result.ok).toBe(true)
    // Empty export: either rowCount=0 or output message about no contacts
    const rowCount = (result.data as any)?.rowCount ?? 0
    expect(rowCount).toBe(0)
  })

  it('output message includes contact count', async () => {
    const ctx = makeContext()
    const result = await tiger_export.execute({}, ctx)

    expect(result.output).toMatch(/3/)
  })

  it('filter=nurture returns only nurture leads', async () => {
    const ctx = makeContext()
    const result = await tiger_export.execute({ filter: 'nurture' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.rowCount).toBe(1)
  })

  it('invalid filter is treated as no-filter (exports all)', async () => {
    const ctx = makeContext()
    const result = await tiger_export.execute({ filter: 'xlsx' }, ctx)

    // Invalid filter defaults to showing all
    expect(result.ok).toBe(true)
    expect((result.data as any)?.rowCount).toBe(3)
  })
})
