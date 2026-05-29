import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // 文件对话框
  openFile: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:saveFile', options),

  // 文件操作
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => 
    ipcRenderer.invoke('file:write', filePath, content),
  readImage: (filePath: string) => ipcRenderer.invoke('file:readImage', filePath),

  // 外部链接
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // 应用路径
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // 通用 IPC 方法（供 Playwright 自动化使用）
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),

  // 事件监听
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args))
  },
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

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
})

// TypeScript 类型声明
export interface ElectronAPI {
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
  invoke: (channel: string, ...args: any[]) => Promise<any>
  send: (channel: string, ...args: any[]) => void
  on: (channel: string, callback: (...args: any[]) => void) => void
  off: (channel: string) => void
  secureStorage: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<boolean>
    delete: (key: string) => Promise<boolean>
    has: (key: string) => Promise<boolean>
    isAvailable: () => Promise<boolean>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
