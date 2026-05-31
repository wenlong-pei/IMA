import { contextBridge, ipcRenderer } from 'electron'

// 鍏佽鐨?IPC 閫氶亾鐧藉悕鍗?
const VALID_CHANNELS: Record<string, string[]> = {
  // 绐楀彛鎺у埗
  send: ['window-minimize', 'window-maximize', 'window-close'],
  // 瀵硅瘽妗?
  invoke: ['dialog:openFile', 'dialog:saveFile',
    // Bot ???????????
    'bot:launch', 'bot:connect', 'bot:navigate', 'bot:analyze',
    'bot:capture', 'bot:capture-auto', 'bot:recognize',
    'bot:grade', 'bot:submit', 'bot:next', 'bot:close',
    'bot:analyzeCorrection',
  ],
  // 鏂囦欢鎿嶄綔锛堝彈闄愬埗锛?
  file: ['file:read', 'file:write', 'file:readImage'],
  // 澶栭儴閾炬帴
  shell: ['shell:openExternal'],
  // 搴旂敤璺緞
  app: ['app:getPath'],
  // Bot 鐩稿叧
  bot: ['bot:setApiKey', 'bot:updateBotSettings', 'bot:get-settings', 'bot:configurePaddleOCR'],
  // 瀹夊叏瀛樺偍
  secure: ['secure:get', 'secure:set', 'secure:delete', 'secure:has', 'secure:is-available'],
  // 鑷姩鏇存柊
  update: ['update:check', 'update:download', 'update:install', 'update:status', 'update:set-skip'],
  // 鍙洃鍚殑浜嬩欢
  on: ['update:state-changed', 'update:available', 'update:downloaded', 'window:maximize-change'],
}

// 楠岃瘉閫氶亾鏄惁鍦ㄧ櫧鍚嶅崟涓?
function validateChannel(type: keyof typeof VALID_CHANNELS, channel: string): boolean {
  return VALID_CHANNELS[type]?.includes(channel) ?? false
}

// 鏆撮湶缁欐覆鏌撹繘绋嬬殑API
contextBridge.exposeInMainWorld('electronAPI', {
  // ?? invoke????????????? Bot ?????????
  invoke: (channel: string, ...args: unknown[]) => {
    if (validateChannel('invoke', channel) || validateChannel('bot', channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    throw new Error(`IPC channel "${channel}" is not allowed`)
  },
  // ?? send???????????
  send: (channel: string, ...args: unknown[]) => {
    if (validateChannel('send', channel) || validateChannel('bot', channel)) {
      ipcRenderer.send(channel, ...args)
      return
    }
    throw new Error(`IPC channel "${channel}" is not allowed`)
  },

  // 绐楀彛鎺у埗
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_: any, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window:maximize-change', handler)
    return () => ipcRenderer.removeListener('window:maximize-change', handler)
  },

  // 鏂囦欢瀵硅瘽妗?
  openFile: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:saveFile', options),

  // 鏂囦欢鎿嶄綔锛堝彧鍏佽璁块棶搴旂敤鏁版嵁鐩綍锛?
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => 
    ipcRenderer.invoke('file:write', filePath, content),
  readImage: (filePath: string) => ipcRenderer.invoke('file:readImage', filePath),

  // 澶栭儴閾炬帴
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // 搴旂敤璺緞
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // 璁剧疆 API Key
  setApiKey: (apiKey: string) => ipcRenderer.send('bot:setApiKey', apiKey),
  
  // Bot 璁剧疆鍚屾锛堝鏈嶅姟鍟嗘敮鎸侊級
  updateBotSettings: (settings: any) => ipcRenderer.send('bot:updateBotSettings', settings),
  getBotSettings: () => ipcRenderer.invoke('bot:get-settings'),
  
  // 閰嶇疆 PaddleOCR 鏈嶅姟
  configurePaddleOCR: (config: any) => ipcRenderer.send('bot:configurePaddleOCR', {
    enabled: config.enabled,
    aistudioToken: config.token,
    serverUrl: config.serverUrl,
    model: config.model,
    timeout: config.timeout,
  }),

  // 瀹夊叏瀛樺偍锛圓PI Key 鍔犲瘑锛?
  secureStorage: {
    get: (key: string) => ipcRenderer.invoke('secure:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('secure:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('secure:delete', key),
    has: (key: string) => ipcRenderer.invoke('secure:has', key),
    isAvailable: () => ipcRenderer.invoke('secure:is-available'),
  },

  // 鑷姩鏇存柊
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getStatus: () => ipcRenderer.invoke('update:status'),
    setSkip: (skip: boolean) => ipcRenderer.invoke('update:set-skip', skip),
    onStateChanged: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on('update:state-changed', handler)
      // 杩斿洖鍙栨秷璁㈤槄鍑芥暟
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

// 鏇存柊鐘舵€佺被鍨?
interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  progress: number
  version?: string
  releaseNotes?: string
  error?: string
}

// TypeScript 绫诲瀷澹版槑
export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  send: (channel: string, ...args: unknown[]) => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
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
