import { describe, it, expect, beforeEach } from 'vitest'
import { tiger_settings } from '../tiger_settings.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

describe.skip('tiger_settings', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
    storage.set('settings', {
      language: 'en',
      timezone: 'UTC',
      notifications: true,
      followUpDays: 7,
    })
  })

  it('returns current settings when no args given', async () => {
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_settings.execute({}, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('language')
  })

  it('updates a single setting', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_settings.execute({ key: 'language', value: 'es' }, ctx)

    expect(result.ok).toBe(true)
    const settings = storage.get('settings') as Record<string, unknown>
    expect(settings['language']).toBe('es')
  })

  it('updates followUpDays and persists the change', async () => {
    const ctx = makeContext(storage)
    await tiger_settings.execute({ key: 'followUpDays', value: 14 }, ctx)

    const settings = storage.get('settings') as Record<string, unknown>
    expect(settings['followUpDays']).toBe(14)
  })

  it('returns ok:false when setting an unknown key', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_settings.execute({ key: 'nonExistentSetting', value: 'x' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('initializes settings with defaults when storage is empty', async () => {
    const emptyStorage = new Map()
    const ctx = makeContext(emptyStorage)
    const result = await tiger_settings.execute({}, ctx)

    expect(result.ok).toBe(true)
    // Should not crash on empty storage — returns defaults
    expect(result.output).toBeTruthy()
  })

  it('returns ok:false when value type does not match setting type', async () => {
    const ctx = makeContext(storage)
    // followUpDays expects a number, not a string
    const result = await tiger_settings.execute({ key: 'followUpDays', value: 'not-a-number' }, ctx)

    // Either rejects with ok:false or coerces — should not silently store wrong type
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    } else {
      const settings = storage.get('settings') as Record<string, unknown>
      expect(typeof settings['followUpDays']).toBe('number')
    }
  })

  it('reports the updated value in output after change', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_settings.execute({ key: 'timezone', value: 'America/New_York' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('America/New_York')
  })

  it('toggling notifications persists the new boolean', async () => {
    const ctx = makeContext(storage)
    await tiger_settings.execute({ key: 'notifications', value: false }, ctx)

    const settings = storage.get('settings') as Record<string, unknown>
    expect(settings['notifications']).toBe(false)
  })
})
