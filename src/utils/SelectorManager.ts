/**
 * DOM 选择器管理器
 * 加载和管理外部配置的选择器
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface SelectorConfig {
  description?: string
  legacy?: string
  modern?: string
  fallback?: string[]
  placeholder?: string
  text?: string
  selectors?: string[]
}

export interface PlatformSelectors {
  name: string
  domains: string[]
  selectors: {
    answerImages: SelectorConfig
    scoreInput: SelectorConfig
    submitButton: SelectorConfig
    nextButton: SelectorConfig
    questionTitle: SelectorConfig
  }
}

export interface SelectorsConfig {
  name: string
  version: string
  description?: string
  platforms: {
    [key: string]: PlatformSelectors
  }
  metadata?: {
    lastUpdated?: string
    author?: string
    usage?: string
  }
}

class SelectorManager {
  private config: SelectorsConfig | null = null
  private currentPlatform: string = 'zhixue' // 默认平台
  private configPath: string = ''

  constructor() {
    this.initConfigPath()
  }

  /**
   * 初始化配置路径
   */
  private initConfigPath(): void {
    try {
      // 开发环境：项目根目录
      const devPath = path.join(process.cwd(), 'config', 'selectors.json')
      // 生产环境：用户数据目录
      const prodPath = path.join(app.getPath('userData'), 'selectors.json')

      // 优先使用用户数据目录（如果存在）
      if (fs.existsSync(prodPath)) {
        this.configPath = prodPath
      } else if (fs.existsSync(devPath)) {
        this.configPath = devPath
      } else {
        // 使用默认配置
        this.configPath = ''
      }
    } catch (error) {
      console.error('[SelectorManager] Failed to init config path:', error)
    }
  }

  /**
   * 加载配置
   */
  load(): boolean {
    if (!this.configPath) {
      console.warn('[SelectorManager] No config path found, using defaults')
      return false
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8')
      this.config = JSON.parse(content)
      console.log(`[SelectorManager] Loaded config from: ${this.configPath}`)
      return true
    } catch (error) {
      console.error('[SelectorManager] Failed to load config:', error)
      return false
    }
  }

  /**
   * 保存配置到用户数据目录
   */
  save(): boolean {
    if (!this.config) {
      console.error('[SelectorManager] No config to save')
      return false
    }

    try {
      const prodPath = path.join(app.getPath('userData'), 'selectors.json')
      fs.writeFileSync(prodPath, JSON.stringify(this.config, null, 2), 'utf-8')
      this.configPath = prodPath
      console.log(`[SelectorManager] Saved config to: ${prodPath}`)
      return true
    } catch (error) {
      console.error('[SelectorManager] Failed to save config:', error)
      return false
    }
  }

  /**
   * 设置当前平台
   */
  setPlatform(platform: string): void {
    if (this.config?.platforms[platform]) {
      this.currentPlatform = platform
      console.log(`[SelectorManager] Platform set to: ${platform}`)
    } else {
      console.warn(`[SelectorManager] Unknown platform: ${platform}, using default`)
    }
  }

  /**
   * 获取当前平台配置
   */
  getCurrentPlatform(): PlatformSelectors | null {
    return this.config?.platforms[this.currentPlatform] || null
  }

  /**
   * 根据域名自动检测平台
   */
  detectPlatform(url: string): string | null {
    if (!this.config) return null

    const hostname = new URL(url).hostname
    
    for (const [key, platform] of Object.entries(this.config.platforms)) {
      for (const domain of platform.domains) {
        if (hostname.includes(domain)) {
          this.currentPlatform = key
          return key
        }
      }
    }
    
    return null
  }

  /**
   * 获取所有可用的选择器（按优先级排序）
   */
  getAnswerImageSelectors(): string[] {
    const selectors = this.getCurrentPlatform()?.selectors.answerImages
    if (!selectors) return ['img'] // 默认回退

    const result: string[] = []
    
    if (selectors.modern) result.push(selectors.modern)
    if (selectors.legacy) result.push(selectors.legacy)
    if (selectors.fallback) result.push(...selectors.fallback)
    
    return result.length > 0 ? result : ['img']
  }

  /**
   * 获取分数输入框选择器
   */
  getScoreInputSelectors(): string[] {
    const selectors = this.getCurrentPlatform()?.selectors.scoreInput
    if (!selectors) return ['input[type="number"]']

    const result: string[] = []
    
    if (selectors.allModern) result.push(selectors.allModern)
    if (selectors.modern) result.push(selectors.modern)
    if (selectors.placeholder) result.push(selectors.placeholder)
    if (selectors.legacy) result.push(selectors.legacy)
    
    return result.length > 0 ? result : ['input[type="number"]']
  }

  /**
   * 获取提交按钮选择器
   */
  getSubmitButtonSelectors(): { text?: string; selectors: string[] } {
    const selectors = this.getCurrentPlatform()?.selectors.submitButton
    if (!selectors) return { selectors: ['button'] }

    const result: string[] = []
    
    if (selectors.modern) result.push(selectors.modern)
    if (selectors.fallback) result.push(...selectors.fallback)
    
    return {
      text: selectors.text,
      selectors: result.length > 0 ? result : ['button'],
    }
  }

  /**
   * 获取下一题按钮选择器
   */
  getNextButtonSelectors(): { text?: string; selectors: string[] } {
    const selectors = this.getCurrentPlatform()?.selectors.nextButton
    if (!selectors) return { selectors: ['button'] }

    const result: string[] = []
    
    if (selectors.fallback) result.push(...selectors.fallback)
    
    return {
      text: selectors.text,
      selectors: result.length > 0 ? result : ['button'],
    }
  }

  /**
   * 获取题目标题选择器
   */
  getQuestionTitleSelectors(): string[] {
    const selectors = this.getCurrentPlatform()?.selectors.questionTitle
    if (!selectors?.selectors) return ['h3', 'h4']

    return selectors.selectors
  }

  /**
   * 获取完整配置
   */
  getConfig(): SelectorsConfig | null {
    return this.config
  }

  /**
   * 更新平台配置
   */
  updatePlatformConfig(platform: string, updates: Partial<PlatformSelectors>): boolean {
    if (!this.config?.platforms[platform]) {
      // 创建新平台配置
      if (!this.config) {
        this.config = {
          name: 'Custom Config',
          version: '1.0.0',
          platforms: {},
        }
      }
      this.config.platforms[platform] = {
        name: platform,
        domains: [],
        selectors: {
          answerImages: {},
          scoreInput: {},
          submitButton: {},
          nextButton: {},
          questionTitle: {},
        },
      }
    }

    // 合并更新
    this.config.platforms[platform] = {
      ...this.config.platforms[platform],
      ...updates,
    }

    return this.save()
  }
}

// 单例实例
let selectorManagerInstance: SelectorManager | null = null

export function getSelectorManager(): SelectorManager {
  if (!selectorManagerInstance) {
    selectorManagerInstance = new SelectorManager()
    selectorManagerInstance.load()
  }
  return selectorManagerInstance
}

export { SelectorManager }
