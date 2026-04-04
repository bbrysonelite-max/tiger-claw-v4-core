import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_gmail_send, tiger_drive_list } from '../tiger_google_workspace.js'
import { makeContext } from './helpers.js'

const mockMessagesSend = vi.hoisted(() => vi.fn())
const mockFilesList = vi.hoisted(() => vi.fn())

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: class MockJWT {
        constructor(_opts: any) {}
      },
    },
    gmail: () => ({
      users: { messages: { send: mockMessagesSend } },
    }),
    drive: () => ({
      files: { list: mockFilesList },
    }),
  },
}))

const VALID_SA_JSON = JSON.stringify({
  client_email: 'service@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIItest\n-----END RSA PRIVATE KEY-----',
})

describe('tiger_gmail_send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = VALID_SA_JSON
  })

  it('sends email successfully via Gmail API', async () => {
    mockMessagesSend.mockResolvedValue({ data: { id: 'gmail-msg-456' } })
    const ctx = makeContext()
    const result = await tiger_gmail_send.execute(
      { to: 'prospect@example.com', subject: 'Hello', bodyText: 'Great opportunity.' },
      ctx
    )
    expect(result.ok).toBe(true)
    expect(result.output).toContain('prospect@example.com')
    expect(mockMessagesSend).toHaveBeenCalledOnce()
  })

  it('returns ok:false when GOOGLE_SERVICE_ACCOUNT_JSON is missing', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const ctx = makeContext()
    const result = await tiger_gmail_send.execute(
      { to: 'prospect@example.com', subject: 'Hello', bodyText: 'Body' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('GOOGLE_SERVICE_ACCOUNT_JSON')
  })

  it('returns ok:false when Gmail API throws', async () => {
    mockMessagesSend.mockRejectedValue(new Error('403 Forbidden'))
    const ctx = makeContext()
    const result = await tiger_gmail_send.execute(
      { to: 'prospect@example.com', subject: 'Hello', bodyText: 'Body' },
      ctx
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('403 Forbidden')
  })
})

describe('tiger_drive_list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = VALID_SA_JSON
  })

  it('lists files successfully', async () => {
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          { id: 'file-1', name: 'Tiger Claw Deck.pdf', mimeType: 'application/pdf', modifiedTime: '2026-04-01T00:00:00Z' },
          { id: 'file-2', name: 'ICP Notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', modifiedTime: '2026-03-28T00:00:00Z' },
        ],
      },
    })
    const ctx = makeContext()
    const result = await tiger_drive_list.execute({}, ctx)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('Tiger Claw Deck.pdf')
    expect(result.output).toContain('ICP Notes.docx')
  })

  it('returns ok:true with no-files message when Drive is empty', async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } })
    const ctx = makeContext()
    const result = await tiger_drive_list.execute({}, ctx)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('No files found')
  })

  it('returns ok:false when GOOGLE_SERVICE_ACCOUNT_JSON is missing', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const ctx = makeContext()
    const result = await tiger_drive_list.execute({}, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('GOOGLE_SERVICE_ACCOUNT_JSON')
  })

  it('returns helpful error when Drive API is not enabled', async () => {
    mockFilesList.mockRejectedValue(new Error('accessNotConfigured: Drive API not enabled'))
    const ctx = makeContext()
    const result = await tiger_drive_list.execute({}, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Domain-Wide Delegation')
  })

  it('passes optional query and limit to Drive API', async () => {
    mockFilesList.mockResolvedValue({
      data: { files: [{ id: 'f1', name: 'Match.pdf', mimeType: 'application/pdf', modifiedTime: '2026-04-01T00:00:00Z' }] },
    })
    const ctx = makeContext()
    await tiger_drive_list.execute({ query: "name contains 'Tiger'", limit: 10 }, ctx)
    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({ q: "name contains 'Tiger'", pageSize: 10 })
    )
  })
})
