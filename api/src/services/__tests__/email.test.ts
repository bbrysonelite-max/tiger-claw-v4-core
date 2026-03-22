import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the Resend client used internally by email.ts
// ---------------------------------------------------------------------------
const mockResend = vi.hoisted(() => ({
  emails: {
    send: vi.fn(),
  },
}))

vi.mock('resend', () => ({
  Resend: vi.fn(() => mockResend),
}))

import { sendProvisioningReceipt } from '../../services/email.js'

beforeEach(() => {
  vi.resetAllMocks()
  process.env['RESEND_API_KEY'] = 're_test_key'
  process.env['FROM_EMAIL'] = 'noreply@tigerclaw.io'
})

// Removed hallucinated sendWelcomeEmail and sendProvisioningAlert tests

// Removed hallucinated sendAdminAlert test
