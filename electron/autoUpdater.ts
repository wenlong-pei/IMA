/**
 * 自动更新服务
 * 使用 electron-updater 实现应用自动更新
 */

import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import { logger } from './logger'

// 更新状态
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

interface UpdateState {
  status: UpdateStatus
  progress: number
  version?: string
  releaseNotes?: string
  error?: string
}

class AutoUpdateService {
  private mainWindow: BrowserWindow | null = null
  private state: UpdateState = {
    status: 'idle',
    progress: 0,
  }
  private updateAvailable = false
  private updateDownloaded = false

  constructor() {
    this.setupAutoUpdater()
  }

  /**
   * 设置主窗口
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 配置 autoUpdater
   */
  private setupAutoUpdater(): void {
    // 配置日志
    autoUpdater.logger = {
      info: (message: any) => logger.info('[AutoUpdater]', message),
      warn: (message: any) => logger.warn('[AutoUpdater]', message),
      error: (message: any) => logger.error('[AutoUpdater]', message),
      debug: (message: any) => logger.debug('[AutoUpdater]', message),
    }

    // 自动下载
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    // 事件监听
    autoUpdater.on('checking-for-update', () => {
      this.updateState({ status: 'checking' })
      logger.info('检查更新中...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateAvailable = true
      this.updateState({
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      })
      logger.info(`发现新版本: ${info.version}`)
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.updateState({ status: 'idle', version: info.version })
      logger.info(`当前已是最新版本: ${info.version}`)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.updateState({
        status: 'downloading',
        progress: progress.percent,
      })
      logger.debug(`下载进度: ${progress.percent.toFixed(1)}%`)
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateDownloaded = true
      this.updateState({
        status: 'ready',
        version: info.version,
      })
      logger.info(`新版本下载完成: ${info.version}`)
    })

    autoUpdater.on('error', (error) => {
      this.updateState({
        status: 'error',
        error: error.message,
      })
      logger.error('自动更新出错:', error)
    })

    // 设置 IPC 处理程序
    this.setupIpcHandlers()
  }

  /**
   * 设置 IPC 处理程序
   */
  private setupIpcHandlers(): void {
    ipcMain.removeHandler('update:check')
    ipcMain.handle('update:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates()
        return result?.updateInfo || null
      } catch (error: any) {
        logger.error('检查更新失败:', error)
        return null
      }
    })

    ipcMain.removeHandler('update:download')
    ipcMain.handle('update:download', async () => {
      try {
        await autoUpdater.downloadUpdate()
        return true
      } catch (error: any) {
        logger.error('下载更新失败:', error)
        return false
      }
    })

    ipcMain.removeHandler('update:install')
    ipcMain.handle('update:install', () => {
      autoUpdater.quitAndInstall()
    })

    ipcMain.removeHandler('update:status')
    ipcMain.handle('update:status', () => {
      return this.state
    })

    ipcMain.removeHandler('update:set-skip')
    ipcMain.handle('update:set-skip', (_, skip: boolean) => {
      // electron-updater 不支持运行时跳过更新，这里仅记录状态
      logger.info(`Update skip setting: ${skip}`)
    })
  }

  /**
   * 更新状态
   */
  private updateState(updates: Partial<UpdateState>): void {
    this.state = { ...this.state, ...updates }
    
    // 通知渲染进程
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:state-changed', this.state)
    }
  }

  /**
   * 检查更新
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const result = await autoUpdater.checkForUpdates()
      return result?.updateInfo || null
    } catch (error: any) {
      // 忽略网络错误
      if (error.message?.includes('net::ERR') || error.code === 'ECONNREFUSED') {
        logger.warn('无法检查更新，网络不可用')
        return null
      }
      throw error
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<void> {
    if (!this.updateAvailable) {
      throw new Error('没有可用的更新')
    }
    await autoUpdater.downloadUpdate()
  }

  /**
   * 安装更新并重启
   */
  installUpdate(): void {
    if (!this.updateDownloaded) {
      throw new Error('更新尚未下载完成')
    }
    autoUpdater.quitAndInstall()
  }

  /**
   * 获取当前状态
   */
  getState(): UpdateState {
    return { ...this.state }
  }
}

// 单例实例
let autoUpdateServiceInstance: AutoUpdateService | null = null

export function getAutoUpdateService(): AutoUpdateService {
  if (!autoUpdateServiceInstance) {
    autoUpdateServiceInstance = new AutoUpdateService()
  }
  return autoUpdateServiceInstance
}

export { AutoUpdateService }
