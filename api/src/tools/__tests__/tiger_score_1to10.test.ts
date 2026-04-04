import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_score_1to10 } from '../tiger_score_1to10.js'
import { makeContext } from './helpers.js'

let mockSessionStore: Record<string, any> = {}
let mockOnboardState: Record<string, any> | null = null

vi.mock('../../services/db.js', () => ({
  getBotState: vi.fn(async (_tid: string, file: string) => {
    if (file === 'score_1to10_sessions.json') return mockSessionStore
    if (file === 'onboard_state.json') return mockOnboardState
    return null
  }),
  setBotState: vi.fn(async (_tid: string, _file: string, data: any) => {
    mockSessionStore = data
  }),
}))

const BASE_ONBOARD = {
  phase: 'complete',
  flavor: 'network-marketer',
  botName: 'Teddy',
  identity: {
    name: 'Brent',
    productOrOpportunity: 'this opportunity',
    biggestWin: 'built a 6-figure team',
    yearsInProfession: '5 years',
  },
}

describe('tiger_score_1to10', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStore = {}
    mockOnboardState = BASE_ONBOARD
  })

  it('starts a new session and returns Part 1 question', async () => {
    const ctx = makeContext()
    const result = await tiger_score_1to10.execute(
      { action: 'start', context: 'the opportunity', leadId: 'lead-1' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(result.output).toContain('1-10')
    expect(result.output).toContain('the opportunity')
    // session should be stored
    const sessions = Object.values(mockSessionStore)
    expect(sessions).toHaveLength(1)
    expect((sessions[0] as any).status).toBe('awaiting_part1')
  })

  it('returns ok:false when onboard state is missing', async () => {
    mockOnboardState = null
    const ctx = makeContext()
    const result = await tiger_score_1to10.execute(
      { action: 'start', context: 'the product' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('nboarding')
  })

  it('handles 8-10 score → triggers conversion outcome', async () => {
    // Start session first
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]

    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId, prospectText: '9' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSessionStore[sessionId].outcome).toBe('conversion')
    expect(mockSessionStore[sessionId].status).toBe('complete')
  })

  it('handles ≤5 score → immediate takeaway', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]

    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId, prospectText: '3' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSessionStore[sessionId].outcome).toBe('takeaway_immediate')
    expect(mockSessionStore[sessionId].status).toBe('complete')
  })

  it('handles 6-7 score → asks Part 2 question', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]

    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId, prospectText: '7' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(result.output).toContain('what would you need to know')
    expect(mockSessionStore[sessionId].status).toBe('awaiting_part2')
  })

  it('handles Part 2 → gap close → re-asks Part 1', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]

    // Part 1: 7
    await tiger_score_1to10.execute({ action: 'respond', sessionId, prospectText: '7' }, ctx)
    // Part 2: objection about money
    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId, prospectText: 'I need to know about the income and compensation' },
      ctx
    )
    expect(result.ok).toBe(true)
    // Should get gap-closing + re-ask
    expect(result.output).toContain('1-10')
    expect(mockSessionStore[sessionId].status).toBe('awaiting_reask')
    expect(mockSessionStore[sessionId].lastBucket).toBe('compensation')
  })

  it('triggers takeaway after 2 rounds of gap-closing at 6-7', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]

    // Round 1
    await tiger_score_1to10.execute({ action: 'respond', sessionId, prospectText: '6' }, ctx)
    await tiger_score_1to10.execute({ action: 'respond', sessionId, prospectText: 'I am worried about time' }, ctx)
    // Re-ask: still 6
    await tiger_score_1to10.execute({ action: 'respond', sessionId, prospectText: '6' }, ctx)
    // Round 2: Part 2 again
    await tiger_score_1to10.execute({ action: 'respond', sessionId, prospectText: 'still worried about time' }, ctx)
    // Re-ask: still 6 → should trigger takeaway
    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId, prospectText: '6' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSessionStore[sessionId].outcome).toBe('takeaway_rounds')
    expect(mockSessionStore[sessionId].status).toBe('complete')
  })

  it('returns ok:false when responding to unknown session', async () => {
    const ctx = makeContext()
    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId: 'does-not-exist', prospectText: '8' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns ok:false when responding to a completed session', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]
    // Complete it
    await tiger_score_1to10.execute({ action: 'respond', sessionId, prospectText: '10' }, ctx)
    // Try again
    const result = await tiger_score_1to10.execute(
      { action: 'respond', sessionId, prospectText: '8' },
      ctx
    )
    expect(result.ok).toBe(false)
  })

  it('retrieves a session via get action', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    const sessionId = Object.keys(mockSessionStore)[0]

    const result = await tiger_score_1to10.execute({ action: 'get', sessionId }, ctx)
    expect(result.ok).toBe(true)
    expect((result.data as any).id).toBe(sessionId)
  })

  it('lists recent sessions via list action', async () => {
    const ctx = makeContext()
    await tiger_score_1to10.execute({ action: 'start', context: 'the opportunity' }, ctx)
    await tiger_score_1to10.execute({ action: 'start', context: 'the product' }, ctx)

    const result = await tiger_score_1to10.execute({ action: 'list' }, ctx)
    expect(result.ok).toBe(true)
    expect((result.data as any).sessions).toHaveLength(2)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_score_1to10.execute({ action: 'nuke' as any }, ctx)
    expect(result.ok).toBe(false)
  })
})
