import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_contact } from '../tiger_contact.js'
import { makeContext, type ToolResult } from './helpers.js'

// Mutable stores — mutate per-test to control returns
let mockLeads: Record<string, any> = {}
let mockContacts: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(),
  getContacts: vi.fn(async () => mockContacts),
  saveContacts: vi.fn(async (_tid: string, data: Record<string, any>) => { mockContacts = data }),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
  saveTenantState: vi.fn(),
  importContacts: vi.fn(),
}))

const QUALIFIED_LEAD = {
  id: 'lead-001',
  displayName: 'Alice Johnson',
  platform: 'telegram',
  platformId: 'alice-tg',
  profileFit: 85,
  intentScore: 82,
  oar: 'builder',
  primaryOar: 'builder',
  qualified: true,
  optedOut: false,
  intentSignalHistory: [{ type: 'career_transition', excerpt: 'looking for a side hustle' }],
}

const COMPLETE_ONBOARD = {
  phase: 'complete',
  identity: {
    name: 'Brent',
    productOrOpportunity: 'health supplements',
    yearsInProfession: '5',
    biggestWin: 'hit Diamond rank',
    differentiator: 'real results',
  },
  icpBuilder: { idealPerson: 'side hustle seekers' },
  icpCustomer: { idealPerson: 'health-conscious parents' },
  icpSingle: { idealPerson: 'entrepreneurs' },
  botName: 'Scout',
  flavor: 'network-marketer',
}

describe('tiger_contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {}
    mockContacts = {}
    mockTenantState = {
      'onboard_state.json': COMPLETE_ONBOARD,
      'settings.json': { manualApproval: false },
    }
  })

  it('queues a contact for a qualified lead', async () => {
    mockLeads = { 'lead-001': QUALIFIED_LEAD }

    const ctx = makeContext()
    const result: ToolResult = await tiger_contact.execute({ action: 'queue', leadId: 'lead-001' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice Johnson')
    expect(Object.keys(mockContacts).length).toBe(1)
  })

  it('skips queue if lead already has an active contact', async () => {
    mockLeads = { 'lead-001': QUALIFIED_LEAD }
    mockContacts = {
      'contact-existing': {
        id: 'contact-existing',
        leadId: 'lead-001',
        leadDisplayName: 'Alice Johnson',
        status: 'scheduled',
        platform: 'telegram',
        strategy: 'direct',
        oar: 'builder',
        messageText: 'Hi!',
        scheduledFor: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    }

    const ctx = makeContext()
    const result: ToolResult = await tiger_contact.execute({ action: 'queue', leadId: 'lead-001' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ skipped: true })
  })

  it('returns ok:false for unknown lead', async () => {
    mockLeads = {}

    const ctx = makeContext()
    const result = await tiger_contact.execute({ action: 'queue', leadId: 'ghost-lead' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns ok:false for opted-out lead', async () => {
    mockLeads = { 'lead-001': { ...QUALIFIED_LEAD, optedOut: true } }

    const ctx = makeContext()
    const result = await tiger_contact.execute({ action: 'queue', leadId: 'lead-001' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('opted out')
  })

  it('returns ok:false for unqualified lead', async () => {
    mockLeads = { 'lead-001': { ...QUALIFIED_LEAD, qualified: false } }

    const ctx = makeContext()
    const result = await tiger_contact.execute({ action: 'queue', leadId: 'lead-001' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('qualified')
  })

  it('marks a contact as sent', async () => {
    mockContacts = {
      'contact-001': {
        id: 'contact-001',
        leadId: 'lead-001',
        leadDisplayName: 'Alice Johnson',
        status: 'scheduled',
        platform: 'telegram',
        strategy: 'direct',
        oar: 'builder',
        messageText: 'Hi Alice!',
        scheduledFor: new Date().toISOString(),
        queuedAt: new Date().toISOString(),
      },
    }

    const ctx = makeContext()
    const result = await tiger_contact.execute({ action: 'mark_sent', contactId: 'contact-001' }, ctx)

    expect(result.ok).toBe(true)
    expect(mockContacts['contact-001'].status).toBe('sent')
  })

  it('lists all contacts', async () => {
    mockContacts = {
      'c1': {
        id: 'c1', leadId: 'l1', leadDisplayName: 'Bob', status: 'sent',
        platform: 'telegram', strategy: 'direct', oar: 'builder',
        messageText: 'Hi Bob', scheduledFor: new Date().toISOString(), queuedAt: new Date().toISOString(),
      },
    }

    const ctx = makeContext()
    const result = await tiger_contact.execute({ action: 'list' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Bob')
    expect(result.output).toContain('1 total')
  })

  it('returns ok:false for an unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_contact.execute({ action: 'warp' as never }, ctx)

    expect(result.ok).toBe(false)
  })
})
