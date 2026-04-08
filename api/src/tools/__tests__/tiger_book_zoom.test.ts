import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_book_zoom } from '../tiger_book_zoom.js'
import { makeContext } from './helpers.js'

const mockGetTenantState = vi.hoisted(() => vi.fn())
const mockSendAdminAlert = vi.hoisted(() => vi.fn())

vi.mock('../../services/tenant_data.js', () => ({
  getTenantState: mockGetTenantState,
}))

vi.mock('../../services/admin_shared.js', () => ({
  sendAdminAlert: mockSendAdminAlert,
}))

describe('tiger_book_zoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendAdminAlert.mockResolvedValue(undefined)
  })

  it('returns a pre-filled booking link when calcomBookingUrl is configured', async () => {
    mockGetTenantState.mockResolvedValue({
      calcomBookingUrl: 'https://cal.com/brent/zoom-call',
    })
    const ctx = makeContext()
    const result = await tiger_book_zoom.execute({ prospect_name: 'John Smith' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.output).toBe('https://cal.com/brent/zoom-call?name=John%20Smith')
    expect((result.data as any).bookingLink).toBe('https://cal.com/brent/zoom-call?name=John%20Smith')
  })

  it('appends with & when base URL already has query params', async () => {
    mockGetTenantState.mockResolvedValue({
      calcomBookingUrl: 'https://cal.com/brent/zoom-call?month=2026-04',
    })
    const ctx = makeContext()
    const result = await tiger_book_zoom.execute({ prospect_name: 'Ana García' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('&name=Ana%20Garc%C3%ADa')
  })

  it('fails with clear error when calcomBookingUrl is not set', async () => {
    mockGetTenantState.mockResolvedValue({})
    const ctx = makeContext()
    const result = await tiger_book_zoom.execute({ prospect_name: 'Jane Doe' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('calcomBookingUrl')
  })

  it('fails when settings.json does not exist', async () => {
    mockGetTenantState.mockResolvedValue(null)
    const ctx = makeContext()
    const result = await tiger_book_zoom.execute({ prospect_name: 'Jane Doe' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('calcomBookingUrl')
  })

  it('fires admin alert after generating a link', async () => {
    mockGetTenantState.mockResolvedValue({
      calcomBookingUrl: 'https://cal.com/brent/zoom-call',
    })
    const ctx = makeContext()
    await tiger_book_zoom.execute({ prospect_name: 'Test Prospect' }, ctx)
    expect(mockSendAdminAlert).toHaveBeenCalledOnce()
    expect(mockSendAdminAlert.mock.calls[0][0]).toContain('Test Prospect')
  })
})
