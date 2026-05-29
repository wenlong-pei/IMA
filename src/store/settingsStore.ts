import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { AppSettings, AiProvider } from '@/types'

interface SettingsState {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  updateProvider: (providerId: string, updates: Partial<AiProvider>) => void
  addProvider: (provider: Omit<AiProvider, 'id' | 'isActive'>) => string
  removeProvider: (providerId: string) => void
  setActiveProvider: (providerId: string) => void
  getActiveProvider: () => AiProvider | undefined
  resetSettings: () => void
}

const defaultProviders: AiProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat',
    isActive: true,
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: '',
    model: '',
    isActive: false,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    isActive: false,
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    endpoint: '',
    apiKey: '',
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
  paddleOcrToken: '',
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }))
        
        const currentState = get().settings

        // 同步活跃服务商配置到主进程
        const api = typeof window !== 'undefined' && (window as any).electronAPI
        if (api?.updateBotSettings) {
          api.updateBotSettings({
            providers: currentState.providers,
            activeProviderId: currentState.activeProviderId,
            temperature: currentState.temperature,
            maxTokens: currentState.maxTokens,
          })
        }
        
        // 如果更新了 PaddleOCR 配置，同步到主进程
        if (updates.paddleOcrEnabled !== undefined || 
            updates.paddleOcrToken !== undefined || 
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
        const api = typeof window !== 'undefined' && (window as any).electronAPI
        if (api?.updateBotSettings) {
          api.updateBotSettings({
            providers: currentState.providers,
            activeProviderId: currentState.activeProviderId,
            temperature: currentState.temperature,
            maxTokens: currentState.maxTokens,
          })
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
        const api = typeof window !== 'undefined' && (window as any).electronAPI
        if (api?.updateBotSettings) {
          api.updateBotSettings({
            providers: currentState.providers,
            activeProviderId: currentState.activeProviderId,
            temperature: currentState.temperature,
            maxTokens: currentState.maxTokens,
          })
        }
      },
      getActiveProvider: () => {
        const { settings } = get()
        return settings.providers.find(p => p.id === settings.activeProviderId) || settings.providers[0]
      },
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'grading-settings',
      onRehydrateStorage: () => (state) => {
        // 应用恢复时，同步服务商配置到主进程
        if (state?.settings) {
          const api = typeof window !== 'undefined' && (window as any).electronAPI
          if (api?.updateBotSettings) {
            api.updateBotSettings({
              providers: state.settings.providers,
              activeProviderId: state.settings.activeProviderId,
              temperature: state.settings.temperature,
              maxTokens: state.settings.maxTokens,
            })
          }
        }
        // 同步 PaddleOCR 配置到主进程
        if (state?.settings?.paddleOcrEnabled !== undefined) {
          const api = typeof window !== 'undefined' && (window as any).electronAPI
          if (api?.configurePaddleOCR) {
            api.configurePaddleOCR({
              enabled: state.settings.paddleOcrEnabled,
              token: state.settings.paddleOcrToken,
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
