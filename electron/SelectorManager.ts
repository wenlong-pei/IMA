/**
 * DOM 闁瀚ㄩ崳銊ь吀閻炲棗娅?
 * 閸旂姾娴囬崪宀€顓搁悶鍡楊樆闁劑鍘ょ純顔炬畱闁瀚ㄩ崳?
 */

import * as fs from 'fs'
import * as fsp from 'fs/promises'
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
  allModern?: string
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
  private currentPlatform: string = 'zhixue' // 姒涙顓婚獮鍐插酱
  private configPath: string = ''

  constructor() {
    this.initConfigPath()
  }

  /**
   * 閸掓繂顫愰崠鏍帳缂冾喛鐭惧?
   */
  private initConfigPath(): void {
    try {
      // 瀵偓閸欐垹骞嗘晶鍐跨窗妞ゅ湱娲伴弽鍦窗瑜?
      const devPath = path.join(process.cwd(), 'config', 'selectors.json')
      // 閻㈢喍楠囬悳顖氼暔閿涙氨鏁ら幋閿嬫殶閹诡喚娲拌ぐ?
      const prodPath = path.join(app.getPath('userData'), 'selectors.json')

      // 娴兼ê鍘涙担璺ㄦ暏閻劍鍩涢弫鐗堝祦閻╊喖缍嶉敍鍫濐洤閺嬫粌鐡ㄩ崷顭掔礆
      if (fs.existsSync(prodPath)) {
        this.configPath = prodPath
      } else if (fs.existsSync(devPath)) {
        this.configPath = devPath
      } else {
        // 娴ｈ法鏁ゆ妯款吇闁板秶鐤?
        this.configPath = ''
      }
    } catch (error) {
      console.error('[SelectorManager] Failed to init config path:', error)
    }
  }

  /**
   * 异步初始化（替代构造函数中的同步加载）
   */
  async init(): Promise<void> {
    await this.load()
  }

  /**
   * 异步加载配置
   */
  async load(): Promise<boolean> {
    if (!this.configPath) {
      console.warn('[SelectorManager] No config path found, using defaults')
      return false
    }

    try {
      const content = await fsp.readFile(this.configPath, 'utf-8')
      this.config = JSON.parse(content)
      console.log(`[SelectorManager] Loaded config from: ${this.configPath}`)
      return true
    } catch (error) {
      console.error('[SelectorManager] Failed to load config:', error)
      return false
    }
  }

  /**
   * 异步保存配置
   */
  async save(): Promise<boolean> {
    if (!this.config) {
      console.error('[SelectorManager] No config to save')
      return false
    }

    try {
      const prodPath = path.join(app.getPath('userData'), 'selectors.json')
      await fsp.writeFile(prodPath, JSON.stringify(this.config, null, 2), 'utf-8')
      this.configPath = prodPath
      console.log(`[SelectorManager] Saved config to: ${prodPath}`)
      return true
    } catch (error) {
      console.error('[SelectorManager] Failed to save config:', error)
      return false
    }
  }

  /**
   * 鐠佸墽鐤嗚ぐ鎾冲楠炲啿褰?
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
   * 閼惧嘲褰囪ぐ鎾冲楠炲啿褰撮柊宥囩枂
   */
  getCurrentPlatform(): PlatformSelectors | null {
    return this.config?.platforms[this.currentPlatform] || null
  }

  /**
   * 閺嶈宓侀崺鐔锋倳閼奉亜濮╁Λ鈧ù瀣挬閸?
   */
  detectPlatform(url: string): string | null {
    if (!this.config) return null

    try {
      const hostname = new URL(url).hostname
      for (const [key, platform] of Object.entries(this.config.platforms)) {
        for (const domain of platform.domains) {
          if (hostname.includes(domain)) {
            this.currentPlatform = key
            return key
          }
        }
      }
    } catch {
      console.warn('[SelectorManager] Invalid URL provided to detectPlatform:', url)
    }
    
    return null
  }

  /**
   * 閼惧嘲褰囬幍鈧張澶婂讲閻劎娈戦柅澶嬪閸ｎ煉绱欓幐澶夌喘閸忓牏楠囬幒鎺戠碍閿?
   */
  getAnswerImageSelectors(): string[] {
    const selectors = this.getCurrentPlatform()?.selectors.answerImages
    if (!selectors) return ['img'] // 姒涙顓婚崶鐐衡偓鈧?

    const result: string[] = []
    
    if (selectors.modern) result.push(selectors.modern)
    if (selectors.legacy) result.push(selectors.legacy)
    if (selectors.fallback) result.push(...selectors.fallback)
    
    return result.length > 0 ? result : ['img']
  }

  /**
   * 閼惧嘲褰囬崚鍡樻殶鏉堟挸鍙嗗鍡涒偓澶嬪閸?
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
   * 閼惧嘲褰囬幓鎰唉閹稿鎸抽柅澶嬪閸?
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
   * 閼惧嘲褰囨稉瀣╃妫版ɑ瀵滈柦顕€鈧瀚ㄩ崳?
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
   * 閼惧嘲褰囨０妯兼窗閺嶅洭顣介柅澶嬪閸?
   */
  getQuestionTitleSelectors(): string[] {
    const selectors = this.getCurrentPlatform()?.selectors.questionTitle
    if (!selectors?.selectors) return ['h3', 'h4']

    return selectors.selectors
  }

  /**
   * 閼惧嘲褰囩€瑰本鏆ｉ柊宥囩枂
   */
  getConfig(): SelectorsConfig | null {
    return this.config
  }

  /**
   * 閺囧瓨鏌婇獮鍐插酱闁板秶鐤?
   */
  async updatePlatformConfig(platform: string, updates: Partial<PlatformSelectors>): Promise<boolean> {
    if (!this.config?.platforms[platform]) {
      // 閸掓稑缂撻弬鏉块挬閸欎即鍘ょ純?
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

    // 閸氬牆鑻熼弴瀛樻煀
    this.config.platforms[platform] = {
      ...this.config.platforms[platform],
      ...updates,
    }

    return this.save()
  }
}

// 閸楁洑绶ョ€圭偘绶?
let selectorManagerInstance: SelectorManager | null = null

export function getSelectorManager(): SelectorManager {
  if (!selectorManagerInstance) {
    selectorManagerInstance = new SelectorManager()
  }
  return selectorManagerInstance
}

/**
 * 异步获取并初始化 SelectorManager（推荐使用）
 * 应在 app.whenReady() 后调用
 */
export async function getSelectorManagerAsync(): Promise<SelectorManager> {
  const manager = getSelectorManager()
  await manager.init()
  return manager
}

export { SelectorManager }
