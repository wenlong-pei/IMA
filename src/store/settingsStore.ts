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

// 默认服务商（API Key 不存储在此）
const defaultProviders: AiProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '__SECURED__', // 标记为安全存储
    model: 'deepseek-chat',
    isActive: true,
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: '__SECURED__',
    model: '',
    isActive: false,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '__SECURED__',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    isActive: false,
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    endpoint: '',
    apiKey: '__SECURED__',
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
  providers: defaultProviders,
  activeProviderId: 'deepseek',
  temperature: 0.3,
  maxTokens: 500,
  paddleOcrEnabled: true,
  paddleOcrToken: '__SECURED__', // 标记为安全存储
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
    const decryptedProviders = await Promise.all(providers.map(async (p) => ({
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      model: p.model,
      isActive: p.id === activeProviderId,
      apiKey: api.secureStorage 
        ? (await api.secureStorage.get(`${API_KEY_PREFIX}${p.id}`) || '')
        : '',
    })))
    
    api.updateBotSettings({
      providers: decryptedProviders,
      activeProviderId,
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
      settings: defaultSettings,
      apiKeysLoaded: false,

      // 从安全存储加载 API Key
      loadApiKeys: async () => {
        const api = getElectronAPI()
        if (!api?.secureStorage) return

        set((state) => {
          const updatedProviders = state.settings.providers.map(p => ({
            ...p,
            apiKey: api.secureStorage.has(`${API_KEY_PREFIX}${p.id}`) ? '__SECURED__' : '',
          }))
          return {
            settings: { ...state.settings, providers: updatedProviders },
            apiKeysLoaded: true,
          }
        })
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
            p.id === providerId ? { ...p, apiKey: '__SECURED__' } : p
          )
          return {
            settings: { ...state.settings, providers: newProviders },
          }
        })

        // 同步活跃服务商配置到主进程
        const currentState = get().settings
        if (api?.updateBotSettings) {
          syncProvidersToMain(api, currentState.providers, currentState.activeProviderId, currentState.temperature, currentState.maxTokens)
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
            settings: { ...state.settings, providers: newProviders },
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
          settings: { ...state.settings, ...updates },
        }))
        
        const currentState = get().settings
        const api = getElectronAPI()

        // 同步活跃服务商配置到主进程
        if (api?.updateBotSettings) {
          // 获取所有解密后的 API Keys
          syncProvidersToMain(api, currentState.providers, currentState.activeProviderId, currentState.temperature, currentState.maxTokens)
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
            settings: { ...state.settings, providers: newProviders },
          }
        })
        
        // 同步到主进程
        const currentState = get().settings
        const api = getElectronAPI()
        if (api?.updateBotSettings) {
          syncProvidersToMain(api, currentState.providers, currentState.activeProviderId, currentState.temperature, currentState.maxTokens)
        }
      },

      addProvider: (provider) => {
        const id = uuidv4()
        set((state) => ({
          settings: {
            ...state.settings,
            providers: [...state.settings.providers, { ...provider, id, isActive: false }],
          },
        }))
        return id
      },

      removeProvider: (providerId) => {
        // 删除存储的 API Key
        const api = getElectronAPI()
        if (api?.secureStorage) {
          api.secureStorage.delete(`${API_KEY_PREFIX}${providerId}`)
        }
        
        set((state) => ({
          settings: {
            ...state.settings,
            providers: state.settings.providers.filter(p => p.id !== providerId),
            activeProviderId: state.settings.activeProviderId === providerId
              ? state.settings.providers[0]?.id || ''
              : state.settings.activeProviderId,
          },
        }))
      },

      setActiveProvider: (providerId) => {
        set((state) => ({
          settings: {
            ...state.settings,
            activeProviderId: providerId,
            providers: state.settings.providers.map(p => ({
              ...p,
              isActive: p.id === providerId,
            })),
          },
        }))
        
        // 同步到主进程
        const currentState = get().settings
        const api = getElectronAPI()
        if (api?.updateBotSettings) {
          syncProvidersToMain(api, currentState.providers, providerId, currentState.temperature, currentState.maxTokens)
        }
      },

      getActiveProvider: () => {
        const { settings } = get()
        return settings.providers.find(p => p.id === settings.activeProviderId) || settings.providers[0]
      },

      resetSettings: () => {
        // 清除所有安全存储的 API Keys
        const api = getElectronAPI()
        if (api?.secureStorage) {
          const currentProviders = get().settings.providers
          currentProviders.forEach(p => {
            api.secureStorage.delete(`${API_KEY_PREFIX}${p.id}`)
          })
          api.secureStorage.delete(PADDLE_OCR_KEY)
        }
        set({ settings: defaultSettings, apiKeysLoaded: false })
      },
    }),
    {
      name: 'grading-settings',
      onRehydrateStorage: () => (state) => {
        // 应用恢复时加载安全存储的 API Keys
        const api = getElectronAPI()
        if (api?.secureStorage && state?.settings) {
          // 标记为需要加载
          state.apiKeysLoaded = false
          
          // 同步服务商配置到主进程（不包含敏感信息）
          if (api.updateBotSettings) {
            syncProvidersToMain(api, state.settings.providers, state.settings.activeProviderId, state.settings.temperature, state.settings.maxTokens)
          }
        }
        // 同步 PaddleOCR 配置到主进程
        if (state?.settings?.paddleOcrEnabled !== undefined) {
          const api = getElectronAPI()
          if (api?.configurePaddleOCR) {
            api.configurePaddleOCR({
              enabled: state.settings.paddleOcrEnabled,
              token: '__SECURED__',
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
