import { describe, expect, it } from 'vitest'
import { normalizeSettings } from '@/store/settingsStore'

describe('normalizeSettings', () => {
  it('fills AI provider defaults for settings saved by older versions', () => {
    const settings = normalizeSettings({
      soundEnabled: false,
      soundVolume: 20,
      temperature: 0.8,
      maxTokens: 1000,
    })

    expect(settings.soundEnabled).toBe(false)
    expect(settings.providers.length).toBeGreaterThan(0)
    expect(settings.activeProviderId).toBe('deepseek')
    expect(settings.providers.some(provider => provider.isActive)).toBe(true)
    expect(settings.temperature).toBe(0.8)
    expect(settings.maxTokens).toBe(1000)
  })

  it('recovers from malformed provider data without throwing', () => {
    const settings = normalizeSettings({
      providers: null,
      activeProviderId: 'missing-provider',
    })

    expect(settings.providers[0].id).toBe('deepseek')
    expect(settings.providers[0].isActive).toBe(true)
    expect(settings.activeProviderId).toBe('deepseek')
  })
})
