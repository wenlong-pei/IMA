import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { AppSettings, AiProvider } from '@/types'

interface SettingsState {
  settings: AppSettings
  apiKeysLoaded: boolean
  updateSettings: (updates: Partial<AppSettings>) => void
  updateProvider: (providerId: string, updates: Partial<AiProvider>) => void
  addProvider: (provider: Omit<AiProvider, 'id' | 'isActive'>) => string
  removeProvider: (providerId: string) => void
  setActiveProvider: (providerId: string) => void
  getActiveProvider: () => AiProvider | undefined
  resetSettings: () => void
  loadApiKeys: () => Promise<void>
  setApiKey: (providerId: string, apiKey: string) => Promise<void>
  getApiKey: (providerId: string) => Promise<string | null>
  deleteApiKey: (providerId: string) => Promise<void>
  hasApiKey: (providerId: string) => Promise<boolean>
}

// 安全存储的键名前缀
const API_KEY_PREFIX = 'api_key_'
const PADDLE_OCR_KEY = 'paddle_ocr_token'
const SECURED_API_KEY = '__SECURED__'

// 默认服务商（API Key 不存储在此）
const defaultProviders: AiProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: SECURED_API_KEY, // 标记为安全存储
    model: 'deepseek-chat',
    isActive: true,
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: SECURED_API_KEY,
    model: '',
    isActive: false,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: SECURED_API_KEY,
    model: 'Qwen/Qwen2.5-7B-Instruct',
    isActive: false,
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    endpoint: '',
    apiKey: SECURED_API_KEY,
    model: '',
    isActive: false,
  },
]

const defaultSettings: AppSettings = {
  soundEnabled: true,
  soundVolume: 70,
  confirmBeforeScore: false,
  confirmBeforeSubmit: false,
  blankDetectionEnabled: false,
  blankDetectionThreshold: 85,
  providers: defaultProviders.map(provider => ({ ...provider })),
  activeProviderId: 'deepseek',
  temperature: 0.3,
  maxTokens: 500,
  paddleOcrEnabled: true,
  paddleOcrToken: SECURED_API_KEY, // 标记为安全存储
  paddleOcrUrl: 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs',
  paddleOcrModel: 'PaddleOCR-VL-1.5',
  paddleOcrTimeout: 300,
  autoSaveInterval: 30,
  batchSize: 10,
  retryAttempts: 3,
  theme: 'light',
  fontSize: 'medium',
  showScoreOnImage: true,
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function cloneDefaultProviders(): AiProvider[] {
  return defaultProviders.map(provider => ({ ...provider }))
}

function normalizeProviders(value: unknown, activeProviderId: string): AiProvider[] {
  const source = Array.isArray(value) && value.length > 0 ? value : cloneDefaultProviders()
  const providers = source.map((item, index) => {
    const candidate = (item && typeof item === 'object') ? item as Partial<AiProvider> : {}
    const fallback = defaultProviders.find(provider => provider.id === candidate.id) || defaultProviders[index] || defaultProviders[0]
    return {
      id: normalizeString(candidate.id, fallback.id || uuidv4()),
      name: normalizeString(candidate.name, fallback.name || 'AI 服务商'),
      endpoint: normalizeString(candidate.endpoint, fallback.endpoint || ''),
      apiKey: normalizeString(candidate.apiKey, ''),
      model: normalizeString(candidate.model, fallback.model || ''),
      isActive: false,
    }
  })

  const hasActiveProvider = providers.some(provider => provider.id === activeProviderId)
  const normalizedActiveId = hasActiveProvider ? activeProviderId : providers[0]?.id || ''
  return providers.map((provider, index) => ({
    ...provider,
    isActive: normalizedActiveId ? provider.id === normalizedActiveId : index === 0,
  }))
}

export function normalizeSettings(value: unknown): AppSettings {
  const raw = (value && typeof value === 'object') ? value as Partial<AppSettings> : {}
  const activeProviderId = normalizeString(raw.activeProviderId, defaultSettings.activeProviderId)
  const providers = normalizeProviders(raw.providers, activeProviderId)
  const normalizedActiveId = providers.find(provider => provider.isActive)?.id || defaultSettings.activeProviderId

  return {
    ...defaultSettings,
    ...raw,
    soundEnabled: normalizeBoolean(raw.soundEnabled, defaultSettings.soundEnabled),
    soundVolume: normalizeNumber(raw.soundVolume, defaultSettings.soundVolume),
    confirmBeforeScore: normalizeBoolean(raw.confirmBeforeScore, defaultSettings.confirmBeforeScore),
    confirmBeforeSubmit: normalizeBoolean(raw.confirmBeforeSubmit, defaultSettings.confirmBeforeSubmit),
    blankDetectionEnabled: normalizeBoolean(raw.blankDetectionEnabled, defaultSettings.blankDetectionEnabled),
    blankDetectionThreshold: normalizeNumber(raw.blankDetectionThreshold, defaultSettings.blankDetectionThreshold),
    providers,
    activeProviderId: normalizedActiveId,
    temperature: normalizeNumber(raw.temperature, defaultSettings.temperature),
    maxTokens: normalizeNumber(raw.maxTokens, defaultSettings.maxTokens),
    paddleOcrEnabled: normalizeBoolean(raw.paddleOcrEnabled, defaultSettings.paddleOcrEnabled),
    paddleOcrToken: normalizeString(raw.paddleOcrToken, defaultSettings.paddleOcrToken),
    paddleOcrUrl: normalizeString(raw.paddleOcrUrl, defaultSettings.paddleOcrUrl),
    paddleOcrModel: normalizeString(raw.paddleOcrModel, defaultSettings.paddleOcrModel),
    paddleOcrTimeout: normalizeNumber(raw.paddleOcrTimeout, defaultSettings.paddleOcrTimeout),
    autoSaveInterval: normalizeNumber(raw.autoSaveInterval, defaultSettings.autoSaveInterval),
    batchSize: normalizeNumber(raw.batchSize, defaultSettings.batchSize),
    retryAttempts: normalizeNumber(raw.retryAttempts, defaultSettings.retryAttempts),
    theme: raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : defaultSettings.theme,
    fontSize: raw.fontSize === 'small' || raw.fontSize === 'large' ? raw.fontSize : defaultSettings.fontSize,
    showScoreOnImage: normalizeBoolean(raw.showScoreOnImage, defaultSettings.showScoreOnImage),
  }
}

// 获取 Electron API（仅在 Electron 环境中可用）
function getElectronAPI() {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI
  }
  return null
}

// 同步服务商配置到主进程（包含解密后的 API Keys）
async function syncProvidersToMain(
  api: any, 
  providers: AiProvider[], 
  activeProviderId: string, 
  temperature: number, 
  maxTokens: number
) {
  try {
    const safeProviders = normalizeProviders(providers, activeProviderId)
    const safeActiveProviderId = safeProviders.find(provider => provider.isActive)?.id || activeProviderId
    const decryptedProviders = await Promise.all(safeProviders.map(async (p) => ({
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      model: p.model,
      isActive: p.id === safeActiveProviderId,
      apiKey: api.secureStorage 
        ? (await api.secureStorage.get(`${API_KEY_PREFIX}${p.id}`) || '')
        : '',
    })))
    
    api.updateBotSettings({
      providers: decryptedProviders,
      activeProviderId: safeActiveProviderId,
      temperature,
      maxTokens,
    })
  } catch (error) {
    console.error('Failed to sync providers:', error)
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: normalizeSettings(defaultSettings),
      apiKeysLoaded: false,

      // 从安全存储加载 API Key
      loadApiKeys: async () => {
        const api = getElectronAPI()
        if (!api?.secureStorage) return

        const currentSettings = normalizeSettings(get().settings)
        const updatedProviders = await Promise.all(currentSettings.providers.map(async (p) => ({
          ...p,
          apiKey: await api.secureStorage.has(`${API_KEY_PREFIX}${p.id}`) ? SECURED_API_KEY : '',
        })))

        set((state) => ({
          settings: normalizeSettings({ ...state.settings, providers: updatedProviders }),
          apiKeysLoaded: true,
        }))
      },

      // 设置 API Key（加密存储）
      setApiKey: async (providerId: string, apiKey: string) => {
        const api = getElectronAPI()
        
        // 存储到安全存储
        if (api?.secureStorage) {
          await api.secureStorage.set(`${API_KEY_PREFIX}${providerId}`, apiKey)
        }
        
        // 更新状态
        set((state) => {
          const newProviders = state.settings.providers.map(p =>
            p.id === providerId ? { ...p, apiKey: SECURED_API_KEY } : p
          )
          return {
            settings: normalizeSettings({ ...state.settings, providers: newProviders }),
          }
        })

        // 同步活跃服务商配置到主进程
        const currentState = get().settings
        if (api?.updateBotSettings) {
          syncProvidersToMain(api, currentState.providers, currentState.activeProviderId, currentState.temperature, currentState.maxTokens).catch(err => {
            console.error('Failed to sync providers in loadApiKeys:', err)
          })
        }
      },

      // 获取 API Key
      getApiKey: async (providerId: string) => {
        const api = getElectronAPI()
        if (!api?.secureStorage) return null
        return await api.secureStorage.get(`${API_KEY_PREFIX}${providerId}`)
      },

      // 删除 API Key
      deleteApiKey: async (providerId: string) => {
        const api = getElectronAPI()
        
        if (api?.secureStorage) {
          await api.secureStorage.delete(`${API_KEY_PREFIX}${providerId}`)
        }
        
        set((state) => {
          const newProviders = state.settings.providers.map(p =>
            p.id === providerId ? { ...p, apiKey: '' } : p
          )
          return {
            settings: normalizeSettings({ ...state.settings, providers: newProviders }),
          }
        })
      },

      // 检查 API Key 是否存在
      hasApiKey: async (providerId: string) => {
        const api = getElectronAPI()
        if (!api?.secureStorage) return false
        return await api.secureStorage.has(`${API_KEY_PREFIX}${providerId}`)
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: normalizeSettings({ ...state.settings, ...updates }),
        }))
        
        const currentState = get().settings
        const api = getElectronAPI()

        // 同步活跃服务商配置到主进程
        if (api?.updateBotSettings) {
          // 获取所有解密后的 API Keys
          syncProvidersToMain(api, currentState.providers, currentState.activeProviderId, currentState.temperature, currentState.maxTokens).catch(err => {
            console.error('Failed to sync providers in updateSettings:', err)
          })
        }
        
        // 如果更新了 PaddleOCR 配置
        if (updates.paddleOcrEnabled !== undefined || 
            updates.paddleOcrUrl !== undefined ||
            updates.paddleOcrModel !== undefined ||
            updates.paddleOcrTimeout !== undefined) {
          if (api?.configurePaddleOCR) {
            api.configurePaddleOCR({
              enabled: currentState.paddleOcrEnabled,
              token: currentState.paddleOcrToken,
              serverUrl: currentState.paddleOcrUrl,
              model: currentState.paddleOcrModel,
              timeout: currentState.paddleOcrTimeout,
            })
          }
        }
      },

      updateProvider: (providerId, updates) => {
        set((state) => {
          const newProviders = state.settings.providers.map(p =>
            p.id === providerId ? { ...p, ...updates } : p
          )
          return {
            settings: normalizeSettings({ ...state.settings, providers: newProviders }),
          }
        })
        
        // 同步到主进程
        const currentState = get().settings
        const api = getElectronAPI()
        if (api?.updateBotSettings) {
          syncProvidersToMain(api, currentState.providers, currentState.activeProviderId, currentState.temperature, currentState.maxTokens).catch(err => {
            console.error('Failed to sync providers in updateProvider:', err)
          })
        }
      },

      addProvider: (provider) => {
        const id = uuidv4()
        set((state) => ({
          settings: normalizeSettings({
            ...state.settings,
            providers: [...state.settings.providers, { ...provider, id, isActive: false }],
          }),
        }))
        return id
      },

      removeProvider: (providerId) => {
        // 删除存储的 API Key
        const api = getElectronAPI()
        if (api?.secureStorage) {
          api.secureStorage.delete(`${API_KEY_PREFIX}${providerId}`).catch((err: any) => {
            console.error('Failed to delete API key:', err)
          })
        }
        
        set((state) => ({
          settings: normalizeSettings({
            ...state.settings,
            providers: state.settings.providers.filter(p => p.id !== providerId),
            activeProviderId: state.settings.activeProviderId === providerId
              ? state.settings.providers[0]?.id || ''
              : state.settings.activeProviderId,
          }),
        }))
      },

      setActiveProvider: (providerId) => {
        set((state) => ({
          settings: normalizeSettings({
            ...state.settings,
            activeProviderId: providerId,
            providers: state.settings.providers.map(p => ({
              ...p,
              isActive: p.id === providerId,
            })),
          }),
        }))
        
        // 同步到主进程
        const currentState = get().settings
        const api = getElectronAPI()
        if (api?.updateBotSettings) {
          syncProvidersToMain(api, currentState.providers, providerId, currentState.temperature, currentState.maxTokens).catch(err => {
            console.error('Failed to sync providers in setActiveProvider:', err)
          })
        }
      },

      getActiveProvider: () => {
        const { settings } = get()
        const normalizedSettings = normalizeSettings(settings)
        return normalizedSettings.providers.find(p => p.id === normalizedSettings.activeProviderId) || normalizedSettings.providers[0]
      },

      resetSettings: () => {
        // 清除所有安全存储的 API Keys
        const api = getElectronAPI()
        if (api?.secureStorage) {
          const currentProviders = normalizeSettings(get().settings).providers
          Promise.all([
            ...currentProviders.map(p => 
              api.secureStorage.delete(`${API_KEY_PREFIX}${p.id}`).catch((err: any) => {
                console.error('Failed to delete API key:', err)
              })
            ),
            api.secureStorage.delete(PADDLE_OCR_KEY).catch((err: any) => {
              console.error('Failed to delete PaddleOCR key:', err)
            })
          ]).catch(err => {
            console.error('Failed to reset settings:', err)
          })
        }
        set({ settings: normalizeSettings(defaultSettings), apiKeysLoaded: false })
      },
    }),
    {
      name: 'grading-settings',
      merge: (persistedState, currentState) => {
        const persisted = (persistedState && typeof persistedState === 'object')
          ? persistedState as Partial<SettingsState>
          : {}
        return {
          ...currentState,
          ...persisted,
          settings: normalizeSettings(persisted.settings),
          apiKeysLoaded: false,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.settings) {
          state.settings = normalizeSettings(state.settings)
        }

        // 应用恢复时加载安全存储的 API Keys
        const api = getElectronAPI()
        if (api?.secureStorage && state?.settings) {
          // 标记为需要加载
          state.apiKeysLoaded = false
          
          // 同步服务商配置到主进程（不包含敏感信息）
          if (api.updateBotSettings) {
            syncProvidersToMain(
              api,
              state.settings.providers,
              state.settings.activeProviderId,
              state.settings.temperature,
              state.settings.maxTokens
            ).catch(err => {
              console.error('Failed to sync providers during rehydrate:', err)
            })
          }
        }
        // 同步 PaddleOCR 配置到主进程
        if (state?.settings?.paddleOcrEnabled !== undefined) {
          const api = getElectronAPI()
          if (api?.configurePaddleOCR) {
            api.configurePaddleOCR({
              enabled: state.settings.paddleOcrEnabled,
              token: SECURED_API_KEY,
              serverUrl: state.settings.paddleOcrUrl,
              model: state.settings.paddleOcrModel,
              timeout: state.settings.paddleOcrTimeout,
            })
          }
        }
      }
    }
  )
)

// Provider组件 - 直接透传children
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  return children as JSX.Element
}
