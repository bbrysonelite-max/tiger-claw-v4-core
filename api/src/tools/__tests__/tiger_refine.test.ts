import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_refine } from '../tiger_refine.js'
import { makeContext } from './helpers.js'

const mockSaveMarketFact = vi.hoisted(() => vi.fn())
const mockGenerateContent = vi.hoisted(() => vi.fn())

vi.mock('../../services/market_intel.js', () => ({
  saveMarketFact: mockSaveMarketFact,
}))

vi.mock('../../services/geminiGateway.js', () => ({
  callGemini: (fn: () => Promise<unknown>) => fn(),
  sanitizeGeminiJSON: (s: string) => s,
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent }
    }
  },
}))

const VALID_FACTS = JSON.stringify([
  {
    type: 'intent_signal',
    verbatim: 'I need more income fast',
    purifiedFact: 'Prospect is actively seeking additional income streams.',
    confidenceScore: 88,
    metadata: { category: 'income', intensity: 'high', demographic: 'parent' },
  },
])

const GATE_PASS = JSON.stringify({ '0': true })
const GATE_FAIL = JSON.stringify({ '0': false })

describe('tiger_refine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_API_KEY = 'test-gemini-key'
    mockSaveMarketFact.mockResolvedValue(undefined)
  })

  it('extracts facts, passes gate, and saves to moat', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => VALID_FACTS } })   // extraction
      .mockResolvedValueOnce({ response: { text: () => GATE_PASS } })     // gate
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'I need more income fast. Struggling to make ends meet.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(result.output).toContain('1 facts purified')
    expect(mockSaveMarketFact).toHaveBeenCalledOnce()
  })

  it('rejects facts that fail the relevance gate', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => VALID_FACTS } })
      .mockResolvedValueOnce({ response: { text: () => GATE_FAIL } })
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'Some gaming content that is not relevant to business.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).not.toHaveBeenCalled()
    expect((result.data as any).rejectedCount).toBe(1)
  })

  it('returns ok:false when content is too short', async () => {
    const ctx = makeContext()
    const result = await tiger_refine.execute({ rawContent: 'short' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('too short')
  })

  it('returns ok:false when GOOGLE_API_KEY is missing', async () => {
    delete process.env.GOOGLE_API_KEY
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'This is long enough content to pass the length check.' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('GOOGLE_API_KEY')
  })

  it('returns ok:true with 0 facts when Gemini returns malformed JSON', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => 'not valid json at all {{' } })
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'This is long enough content to pass the length check.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).not.toHaveBeenCalled()
  })

  it('returns ok:true with 0 facts when Gemini returns empty array', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => '[]' } })
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'This is long enough content to pass the length check.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).not.toHaveBeenCalled()
  })

  it('rejects facts with missing or empty verbatim quote', async () => {
    const noVerbatimFacts = JSON.stringify([
      {
        type: 'intent_signal',
        verbatim: '',
        purifiedFact: 'Prospect wants more income.',
        confidenceScore: 85,
        metadata: { category: 'income', intensity: 'high' },
      },
      {
        type: 'intent_signal',
        purifiedFact: 'Another fact with no verbatim field at all.',
        confidenceScore: 80,
        metadata: { category: 'income', intensity: 'medium' },
      },
    ])
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => noVerbatimFacts } })
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'This is long enough content to pass the length check and has useful info.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).not.toHaveBeenCalled()
  })

  it('falls back to all facts when relevance gate call fails', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => VALID_FACTS } })
      .mockRejectedValueOnce(new Error('Gate Gemini quota exceeded'))
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'I need more income fast. Struggling to make ends meet.' },
      ctx
    )
    expect(result.ok).toBe(true)
    // Falls back to all extracted facts — 1 fact should be saved
    expect(mockSaveMarketFact).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // IPP relevance gate (new, fail-closed) — exercised when the caller supplies
  // a structured idealProspectProfile. Different response shape than legacy:
  // {"0": {keep: bool, score: number, reason: string}}
  // -------------------------------------------------------------------------

  const SAMPLE_IPP = {
    summary: 'Person in active career transition seeking a realistic path forward',
    traits: [
      {
        name: 'Active Transition',
        description: 'Actively leaving or considering leaving current work',
        language: ['hate my job', 'burned out', 'need a way out'],
      },
    ],
    disqualifiers: [
      { name: 'Serial Opportunity Seeker', signal: 'Mentions multiple MLMs or get-rich-quick schemes' },
    ],
    rejectExamples: ['Job listings', 'Student housing ads', 'Salary stats articles'],
  }

  it('IPP gate: keeps facts classified as relevant with score + reason in metadata', async () => {
    const IPP_KEEP = JSON.stringify({
      '0': { keep: true, score: 85, reason: 'clear burnout + transition signal' },
    })
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => VALID_FACTS } })
      .mockResolvedValueOnce({ response: { text: () => IPP_KEEP } })
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      {
        rawContent: 'I need more income fast. Struggling to make ends meet.',
        prospectProfile: SAMPLE_IPP,
      },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).toHaveBeenCalledOnce()
    const savedFact = mockSaveMarketFact.mock.calls[0]![0]
    expect(savedFact.metadata.relevance_score).toBe(85)
    expect(savedFact.metadata.relevance_reason).toBe('clear burnout + transition signal')
  })

  it('IPP gate: rejects facts classified as not relevant', async () => {
    const IPP_REJECT = JSON.stringify({
      '0': { keep: false, score: 10, reason: 'no prospect signal' },
    })
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => VALID_FACTS } })
      .mockResolvedValueOnce({ response: { text: () => IPP_REJECT } })
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      {
        rawContent: 'I need more income fast. Struggling to make ends meet.',
        prospectProfile: SAMPLE_IPP,
      },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).not.toHaveBeenCalled()
    expect((result.data as any).rejectedCount).toBe(1)
  })

  it('IPP gate: FAIL-CLOSED — rejects all facts when gate call throws', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => VALID_FACTS } })
      .mockRejectedValueOnce(new Error('Gate Gemini quota exceeded'))
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      {
        rawContent: 'I need more income fast. Struggling to make ends meet.',
        prospectProfile: SAMPLE_IPP,
      },
      ctx,
    )
    expect(result.ok).toBe(true)
    // Fail-closed: no facts saved even though extraction succeeded
    expect(mockSaveMarketFact).not.toHaveBeenCalled()
    expect((result.data as any).rejectedCount).toBe(1)
  })

  it('continues saving remaining facts if one DB write fails', async () => {
    const twoFacts = JSON.stringify([
      { type: 'intent_signal', verbatim: 'Fact 1 exact quote here', purifiedFact: 'Insight 1.', confidenceScore: 80, metadata: {} },
      { type: 'intent_signal', verbatim: 'Fact 2 exact quote here', purifiedFact: 'Insight 2.', confidenceScore: 75, metadata: {} },
    ])
    const gatePassBoth = JSON.stringify({ '0': true, '1': true })
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => twoFacts } })
      .mockResolvedValueOnce({ response: { text: () => gatePassBoth } })
    mockSaveMarketFact
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockResolvedValueOnce(undefined)
    const ctx = makeContext()
    const result = await tiger_refine.execute(
      { rawContent: 'This is long enough content to pass the length check and has useful info.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(mockSaveMarketFact).toHaveBeenCalledTimes(2)
    // Only 1 actually saved — output reflects this
    expect(result.output).toContain('1 facts purified')
  })
})
