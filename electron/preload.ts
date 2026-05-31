import { contextBridge, ipcRenderer } from 'electron'

// 允许的 IPC 通道白名单
const VALID_CHANNELS: Record<string, string[]> = {
  // 窗口控制
  send: ['window-minimize', 'window-maximize', 'window-close'],
  // 对话框
  invoke: ['dialog:openFile', 'dialog:saveFile',
    // Bot ???????????
    'bot:launch', 'bot:connect', 'bot:navigate', 'bot:analyze',
    'bot:capture', 'bot:capture-auto', 'bot:recognize',
    'bot:grade', 'bot:submit', 'bot:next', 'bot:close',
    'bot:analyzeCorrection',
  ],
  // 文件操作（受限制）
  file: ['file:read', 'file:write', 'file:readImage'],
  // 外部链接
  shell: ['shell:openExternal'],
  // 应用路径
  app: ['app:getPath'],
  // Bot 相关
  bot: ['bot:setApiKey', 'bot:updateBotSettings', 'bot:get-settings', 'bot:configurePaddleOCR'],
  // 安全存储
  secure: ['secure:get', 'secure:set', 'secure:delete', 'secure:has', 'secure:is-available'],
  // 自动更新
  update: ['update:check', 'update:download', 'update:install', 'update:status', 'update:set-skip'],
  // 可监听的事件
  on: ['update:state-changed', 'update:available', 'update:downloaded'],
}

// 验证通道是否在白名单中
function validateChannel(type: keyof typeof VALID_CHANNELS, channel: string): boolean {
  return VALID_CHANNELS[type]?.includes(channel) ?? false
}

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // ?? invoke????????????? Bot ?????????
  invoke: (channel, ...args) => {
    if (validateChannel('invoke', channel) || validateChannel('bot', channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    throw new Error(`IPC channel "${channel}" is not allowed`)
  },
  // ?? send???????????
  send: (channel, ...args) => {
    if (validateChannel('send', channel) || validateChannel('bot', channel)) {
      ipcRenderer.send(channel, ...args)
      return
    }
    throw new Error(`IPC channel "${channel}" is not allowed`)
  },

  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // 文件对话框
  openFile: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:saveFile', options),

  // 文件操作（只允许访问应用数据目录）
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => 
    ipcRenderer.invoke('file:write', filePath, content),
  readImage: (filePath: string) => ipcRenderer.invoke('file:readImage', filePath),

  // 外部链接
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // 应用路径
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // 设置 API Key
  setApiKey: (apiKey: string) => ipcRenderer.send('bot:setApiKey', apiKey),
  
  // Bot 设置同步（多服务商支持）
  updateBotSettings: (settings: any) => ipcRenderer.send('bot:updateBotSettings', settings),
  getBotSettings: () => ipcRenderer.invoke('bot:get-settings'),
  
  // 配置 PaddleOCR 服务
  configurePaddleOCR: (config: any) => ipcRenderer.send('bot:configurePaddleOCR', {
    enabled: config.enabled,
    aistudioToken: config.token,
    serverUrl: config.serverUrl,
    model: config.model,
    timeout: config.timeout,
  }),

  // 安全存储（API Key 加密）
  secureStorage: {
    get: (key: string) => ipcRenderer.invoke('secure:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('secure:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('secure:delete', key),
    has: (key: string) => ipcRenderer.invoke('secure:has', key),
    isAvailable: () => ipcRenderer.invoke('secure:is-available'),
  },

  // 自动更新
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getStatus: () => ipcRenderer.invoke('update:status'),
    setSkip: (skip: boolean) => ipcRenderer.invoke('update:set-skip', skip),
    onStateChanged: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on('update:state-changed', handler)
      // 返回取消订阅函数
      return () => ipcRenderer.removeListener('update:state-changed', handler)
    },
    onAvailable: (callback: (info: any) => void) => {
      const handler = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onDownloaded: (callback: (info: any) => void) => {
      const handler = (_: any, info: any) => callback(info)
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },
  },
})

// 更新状态类型
interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  progress: number
  version?: string
  releaseNotes?: string
  error?: string
}

// TypeScript 类型声明
export interface ElectronAPI {
  invoke: (channel, ...args) => Promise<unknown>
  send: (channel, ...args) => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  openFile: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
  saveFile: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  readImage: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
  openExternal: (url: string) => Promise<void>
  getPath: (name: string) => Promise<string>
  setApiKey: (apiKey: string) => void
  updateBotSettings: (settings: any) => void
  getBotSettings: () => Promise<any>
  configurePaddleOCR: (config: any) => void
  secureStorage: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<boolean>
    delete: (key: string) => Promise<boolean>
    has: (key: string) => Promise<boolean>
    isAvailable: () => Promise<boolean>
  }
  update: {
    check: () => Promise<any>
    download: () => Promise<boolean>
    install: () => Promise<void>
    getStatus: () => Promise<UpdateState>
    setSkip: (skip: boolean) => Promise<void>
    onStateChanged: (callback: (state: UpdateState) => void) => () => void
    onAvailable: (callback: (info: any) => void) => () => void
    onDownloaded: (callback: (info: any) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
