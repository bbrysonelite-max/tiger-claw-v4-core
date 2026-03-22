import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_onboard } from '../tiger_onboard.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe('tiger_onboard', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
  })

  it('returns ok:true and starts onboarding for a valid contact', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_onboard.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists an onboarding record in storage', async () => {
    const ctx = makeContext(storage)
    await tiger_onboard.execute({ contactId: 'c1', plan: 'pro' }, ctx)

    const record = storage.get('onboarding:c1')
    expect(record).toBeTruthy()
    expect((record as Record<string, unknown>)['plan']).toBe('pro')
  })

  it('sets initial onboarding step to 1 (or "start")', async () => {
    const ctx = makeContext(storage)
    await tiger_onboard.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    const record = storage.get('onboarding:c1') as Record<string, unknown>
    const step = record['step'] ?? record['currentStep']
    expect(step === 1 || step === 'start').toBe(true)
  })

  it('returns ok:false when contactId is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_onboard.execute({ contactId: '', plan: 'starter' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when plan is invalid', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_onboard.execute({ contactId: 'c1', plan: 'ultra-secret-tier' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false if contact is already in onboarding', async () => {
    storage.set('onboarding:c1', { plan: 'starter', step: 2, status: 'in_progress' })
    const ctx = makeContext(storage)

    const result = await tiger_onboard.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    // Should not reset an in-progress onboarding silently
    expect(result.ok).toBe(false)
    expect(result.error).toContain('already')
  })

  it('includes the plan name in the output message', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_onboard.execute({ contactId: 'c2', plan: 'pro' }, ctx)

    expect(result.output).toContain('pro')
  })

  it('accepts optional customMessage and stores it', async () => {
    const ctx = makeContext(storage)
    await tiger_onboard.execute({
      contactId: 'c3',
      plan: 'starter',
      customMessage: 'Welcome to our platform!',
    }, ctx)

    const record = storage.get('onboarding:c3') as Record<string, unknown>
    expect(record?.['customMessage']).toBe('Welcome to our platform!')
  })

  it('does not throw when storage.set fails — returns ok:false with error', async () => {
    const ctx = makeContext(storage)
    ctx.storage.set = async () => { throw new Error('Disk full') }

    const result = await tiger_onboard.execute({ contactId: 'c1', plan: 'starter' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
