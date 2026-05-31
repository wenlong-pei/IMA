/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}


// Electron API type (mirrors electron/preload.ts)
interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  send: (channel: string, ...args: unknown[]) => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  openFile: (options: any) => Promise<any>
  saveFile: (options: any) => Promise<any>
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
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
    getStatus: () => Promise<any>
    setSkip: (skip: boolean) => Promise<void>
    onStateChanged: (callback: (state: any) => void) => () => void
    onAvailable: (callback: (info: any) => void) => () => void
    onDownloaded: (callback: (info: any) => void) => () => void
  }
}

interface Window {
  electronAPI?: ElectronAPI
}
