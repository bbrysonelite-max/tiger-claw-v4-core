import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_email } from '../tiger_email.js'
import { makeContext } from './helpers.js'

const mockSend = vi.hoisted(() => vi.fn())
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

describe('tiger_email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.EMAIL_SENDER = 'agents@tigerclaw.io'
  })

  it('sends email successfully', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null })
    const ctx = makeContext()
    const result = await tiger_email.execute(
      { to: 'lead@example.com', subject: 'Hey there', text: 'Check this out.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(result.output).toContain('lead@example.com')
    expect(result.output).toContain('msg-123')
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'lead@example.com', subject: 'Hey there' })
    )
  })

  it('returns ok:false when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const ctx = makeContext()
    const result = await tiger_email.execute(
      { to: 'lead@example.com', subject: 'Hi', text: 'Body' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('RESEND_API_KEY')
  })

  it('returns ok:false when Resend returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid email address' } })
    const ctx = makeContext()
    const result = await tiger_email.execute(
      { to: 'not-an-email', subject: 'Hi', text: 'Body' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid email address')
  })

  it('returns ok:false on network error', async () => {
    mockSend.mockRejectedValue(new Error('Network timeout'))
    const ctx = makeContext()
    const result = await tiger_email.execute(
      { to: 'lead@example.com', subject: 'Hi', text: 'Body' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Network timeout')
  })
})
