import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_nurture } from '../tiger_nurture.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {};
let mockNurtureStore: Record<string, any> = {};

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(async (tenantId, leads) => { mockLeads = leads; }),
  getNurture: vi.fn(async () => mockNurtureStore),
  saveNurture: vi.fn(async (tenantId, store) => { mockNurtureStore = store; }),
  getTenantState: vi.fn(async (tenantId, file) => {
    if (file === "onboard_state.json") return {
      phase: "complete",
      identity: {}, icpProspect: {}, icpProduct: {}, icpSingle: {}, flavor: 'network-marketer'
    };
    if (file === "settings.json") return { language: 'en' };
    return null;
  }),
}))

describe('tiger_nurture', () => {
  beforeEach(() => {
    mockLeads = {
      'c1': { id: 'c1', displayName: 'Alice', platform: 'telegram', optedOut: false },
      'c2': { id: 'c2', displayName: 'Bob', platform: 'telegram', optedOut: true },
    };
    mockNurtureStore = {};
  })

  it('enrolls a lead in the nurture sequence', async () => {
    const ctx = makeContext();
    const result: ToolResult = await tiger_nurture.execute({ action: 'enroll', leadId: 'c1' }, ctx)

    expect(result.ok).toBe(true)
    expect(Object.keys(mockNurtureStore).length).toBe(1)
  })

  it('returns ok:false when leadId is missing for enroll', async () => {
    const ctx = makeContext();
    const result = await tiger_nurture.execute({ action: 'enroll', leadId: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext();
    const result = await tiger_nurture.execute({ action: 'warp-speed', leadId: 'c1' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('prevents enrolling opted-out leads', async () => {
    const ctx = makeContext();
    const result = await tiger_nurture.execute({ action: 'enroll', leadId: 'c2' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('opted out')
  })

  it('handles duplicate enrollment gracefully', async () => {
    const ctx = makeContext();
    await tiger_nurture.execute({ action: 'enroll', leadId: 'c1' }, ctx)
    const result = await tiger_nurture.execute({ action: 'enroll', leadId: 'c1' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('already in an active nurture sequence')
  })

  it('surfaces due touches via the check action', async () => {
    const ctx = makeContext();
    // First enroll
    await tiger_nurture.execute({ action: 'enroll', leadId: 'c1' }, ctx)
    
    // Now check
    const result = await tiger_nurture.execute({ action: 'check' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('nurture touch(es) due')
  })
})
