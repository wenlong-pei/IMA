import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import axios from 'axios'

// 安全存储
let secureStorage: { get: (key: string) => string | null; set: (key: string, value: string) => void; delete: (key: string) => void; has: (key: string) => boolean; isAvailable: () => boolean } | null = null

// 选择器管理器
interface SelectorConfig {
  description?: string
  legacy?: string
  modern?: string
  fallback?: string[]
  placeholder?: string
  text?: string
  selectors?: string[]
  allModern?: string  // 全部分数输入框（新版本）
}

interface SelectorsConfig {
  name: string
  version: string
  platforms: {
    [key: string]: {
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
  }
}

let selectorsConfig: SelectorsConfig | null = null

// 加载选择器配置
function loadSelectorsConfig(): boolean {
  try {
    // 开发环境
    const devPath = path.join(process.cwd(), 'config', 'selectors.json')
    // 生产环境
    const prodPath = path.join(app.getPath('userData'), 'selectors.json')

    const configPath = fs.existsSync(prodPath) ? prodPath : 
                       fs.existsSync(devPath) ? devPath : null

    if (configPath) {
      const content = fs.readFileSync(configPath, 'utf-8')
      selectorsConfig = JSON.parse(content)
      console.log(`[Selectors] Loaded from: ${configPath}`)
      return true
    }
  } catch (error) {
    console.error('[Selectors] Load failed:', error)
  }
  return false
}

// 获取选择器
function getSelector(platform: string, key: string): string[] {
  if (!selectorsConfig?.platforms[platform]?.selectors) {
    return [] // 返回空数组会使用默认选择器
  }
  const selector = (selectorsConfig.platforms[platform].selectors as any)[key]
  if (!selector) return []

  const result: string[] = []
  if (selector.modern) result.push(selector.modern)
  if (selector.legacy) result.push(selector.legacy)
  if (selector.placeholder) result.push(selector.placeholder)
  if (selector.fallback) result.push(...selector.fallback)
  return result
}

// 初始化安全存储
function initSecureStorage() {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const storagePath = path.join(app.getPath('userData'), 'secure-store.json')
      let storageData: Record<string, string> = {}
      
      if (fs.existsSync(storagePath)) {
        storageData = JSON.parse(fs.readFileSync(storagePath, 'utf-8'))
      }
      
      secureStorage = {
        isAvailable: () => safeStorage.isEncryptionAvailable(),
        get: (key: string) => {
          const encrypted = storageData[key]
          if (!encrypted) return null
          try {
            const buffer = Buffer.from(encrypted, 'base64')
            return safeStorage.decryptString(buffer)
          } catch {
            return null
          }
        },
        set: (key: string, value: string) => {
          const encrypted = safeStorage.encryptString(value).toString('base64')
          storageData[key] = encrypted
          fs.writeFileSync(storagePath, JSON.stringify(storageData, null, 2))
        },
        delete: (key: string) => {
          delete storageData[key]
          fs.writeFileSync(storagePath, JSON.stringify(storageData, null, 2))
        },
        has: (key: string) => key in storageData,
      }
      console.log('[SecureStorage] Initialized successfully')
    } else {
      console.warn('[SecureStorage] Encryption not available')
    }
  } catch (error) {
    console.error('[SecureStorage] Init failed:', error)
  }
}

// 动态导入 Playwright（避免主进程加载过慢）
let chromium: any = null

let mainWindow: BrowserWindow | null = null
let gradingBrowser: any = null
let gradingContext: any = null
let gradingPage: any = null
let isRunning = false
let currentStandard: any = null
let currentApiKey: string = ''

// Bot 设置（从渲染进程同步）
interface BotSettings {
  providers: Array<{
    id: string
    name: string
    endpoint: string
    apiKey: string
    model: string
    isActive: boolean
  }>
  activeProviderId: string
  temperature: number
  maxTokens: number
}

let currentBotSettings: BotSettings = {
  providers: [],
  activeProviderId: '',
  temperature: 0.3,
  maxTokens: 500,
}

// PaddleOCR 服务配置
let paddleOcrConfig = {
  enabled: true,
  serverUrl: 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs',
  pipeline: 'PaddleOCR-VL-1.5',
  source: 'aistudio',
  aistudioToken: '',
  qianfanApiKey: '',
}

// 选择器配置
const selectors = {
  answerArea: '.answer-content, .student-answer, [class*="answer"]',
  scoreInput: 'input[type="number"], .score-input, [placeholder*="分数"], [placeholder*="得分"]',
  submitButton: 'button[type="submit"], .submit-btn, .btn-submit, [class*="submit"]',
  nextButton: '.next-btn, .btn-next, [class*="next"]',
}

// 通用选择器
const COMMON_SELECTORS = {
  answerImage: 'img[src*="answer"], img[src*="student"], img[class*="answer"]',
  scoreInput: 'input[type="number"], input[placeholder*="分"]',
  submitButton: 'button:contains("提交"), button:contains("保存"), button[type="submit"]',
  nextButton: '.next-btn, .btn-next, [class*="next"]',
}

// 智学网专用选择器（参考 AI-Marker-Suite）
interface ZhixueSelectors {
  ANSWER_IMAGE: string
  SCORE_INPUT: string
  SCORE_INPUT_PLACEHOLDER: string
  SUBMIT_BUTTON_TEXT: string
  ANSWER_IMAGE_NEW: string
  SCORE_INPUT_NEW: string
  SCORE_INPUT_ALL_NEW: string
  SUBMIT_BUTTON_NEW: string
}

// 获取智学网选择器（优先从配置文件读取）
function getZhixueSelectors(): ZhixueSelectors {
  const selectors = selectorsConfig?.platforms?.zhixue?.selectors
  
  return {
    // 旧版UI
    ANSWER_IMAGE: selectors?.answerImages?.legacy || 'div[name="topicImg"] img',
    SCORE_INPUT: selectors?.scoreInput?.legacy || 'input[type="number"]',
    SCORE_INPUT_PLACEHOLDER: selectors?.scoreInput?.placeholder || 'input[placeholder*="分"]',
    SUBMIT_BUTTON_TEXT: selectors?.submitButton?.text || '提交分数',
    // 新版UI (2025年5月改版)
    ANSWER_IMAGE_NEW: selectors?.answerImages?.modern || '.enhance-definition-bright',
    SCORE_INPUT_NEW: selectors?.scoreInput?.modern || '#txt_marking_17',
    SCORE_INPUT_ALL_NEW: selectors?.scoreInput?.allModern || '#txt_marking_all',
    SUBMIT_BUTTON_NEW: selectors?.submitButton?.modern || '#bnt_save',
  }
}

// 默认选择器（用于兼容）
const ZHIXUE_SELECTORS: ZhixueSelectors = {
  // 旧版UI
  ANSWER_IMAGE: 'div[name="topicImg"] img',
  SCORE_INPUT: 'input[type="number"]',
  SCORE_INPUT_PLACEHOLDER: 'input[placeholder*="分"]',
  SUBMIT_BUTTON_TEXT: '提交分数',
  // 新版UI (2025年5月改版)
  ANSWER_IMAGE_NEW: '.enhance-definition-bright',
  SCORE_INPUT_NEW: '#txt_marking_17',
  SCORE_INPUT_ALL_NEW: '#txt_marking_all',
  SUBMIT_BUTTON_NEW: '#bnt_save',
}

// 判断是否为开发模式
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    backgroundColor: '#f8fafc',
    title: '皮老板智能阅卷工具 v2.1.1',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html')
    if (!fs.existsSync(indexPath)) {
      const altPath = path.join(process.resourcesPath, 'app/dist/renderer/index.html')
      mainWindow.loadFile(altPath)
    } else {
      mainWindow.loadFile(indexPath)
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!isDev) {
    mainWindow.webContents.on('did-fail-load', (_, errorCode: number, errorDescription: string) => {
      console.error('Page load failed:', errorCode, errorDescription)
    })
  }
}

// ============ 窗口控制 ============
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// ============ 文件对话框 ============
ipcMain.handle('dialog:openFile', async (_, options: any) => dialog.showOpenDialog(mainWindow!, options))
ipcMain.handle('dialog:saveFile', async (_, options: any) => dialog.showSaveDialog(mainWindow!, options))

// ============ 文件操作 ============
ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { success: true, data: content }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('file:readImage', async (_, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath)
    const base64 = buffer.toString('base64')
    const ext = path.extname(filePath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 
                     ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                     ext === '.gif' ? 'image/gif' : 'image/png'
    return { success: true, data: `data:${mimeType};base64,${base64}` }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// ============ 外部链接 ============
ipcMain.handle('shell:openExternal', async (_, url: string) => shell.openExternal(url))

// ============ 应用路径 ============
ipcMain.handle('app:getPath', async (_, name: string) => app.getPath(name as any))

// ============ 设置 API Key ============
ipcMain.on('bot:setApiKey', (_, apiKey: string) => {
  currentApiKey = apiKey
})

// ============ Bot 设置同步（多服务商支持）============
ipcMain.on('bot:updateBotSettings', (_, settings: BotSettings) => {
  currentBotSettings = settings
  // 兼容旧逻辑：同步活跃服务商的 API Key
  if (currentBotSettings.providers && currentBotSettings.providers.length > 0) {
    const activeProvider = currentBotSettings.providers.find(p => p.id === currentBotSettings.activeProviderId) || currentBotSettings.providers[0]
    if (activeProvider) {
      currentApiKey = activeProvider.apiKey
    }
    console.log('Bot 设置已更新，活跃服务商:', activeProvider?.name || '未设置')
  }
})

ipcMain.handle('bot:get-settings', () => {
  return currentBotSettings
})

// ============ 安全存储 ============
ipcMain.handle('secure:get', (_, key: string) => {
  if (!secureStorage) return null
  return secureStorage.get(key)
})

ipcMain.handle('secure:set', (_, key: string, value: string) => {
  if (!secureStorage) return false
  secureStorage.set(key, value)
  return true
})

ipcMain.handle('secure:delete', (_, key: string) => {
  if (!secureStorage) return false
  secureStorage.delete(key)
  return true
})

ipcMain.handle('secure:has', (_, key: string) => {
  if (!secureStorage) return false
  return secureStorage.has(key)
})

ipcMain.handle('secure:is-available', () => {
  return safeStorage.isEncryptionAvailable()
})

// ============ PaddleOCR 服务配置 ============
ipcMain.on('bot:configurePaddleOCR', (_, config: any) => {
  paddleOcrConfig = {
    enabled: config.enabled ?? false,
    serverUrl: config.serverUrl ?? '',
    pipeline: config.pipeline ?? 'PaddleOCR-VL-1.5',
    source: config.source ?? 'aistudio',
    aistudioToken: config.aistudioToken ?? '',
    qianfanApiKey: config.qianfanApiKey ?? '',
  }
  console.log('PaddleOCR 配置已更新:', paddleOcrConfig)
})

// ============ 浏览器自动化 Bot ============

// 启动浏览器
ipcMain.handle('bot:launch', async (_, headless = false) => {
  // 延迟加载 Playwright
  if (!chromium) {
    try {
      const { chromium: chromiumModule } = await import('playwright')
      chromium = chromiumModule
    } catch (error) {
      return { 
        success: false, 
        error: 'Playwright 模块加载失败，请重新安装依赖',
      }
    }
  }
  
  const errors: string[] = []
  
  // 尝试 1: 使用 Playwright 内置 Chromium
  try {
    gradingBrowser = await chromium.launch({
      headless,
      args: ['--disable-blink-features=AutomationControlled'],
    })
    gradingContext = await gradingBrowser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    gradingPage = await gradingContext.newPage()
    await gradingPage.evaluate(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    return { success: true, method: 'playwright-chromium' }
  } catch (error: any) {
    errors.push(`Playwright Chromium: ${error.message}`)
  }

  // 尝试 2: 使用系统 Chrome
  try {
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    ]
    
    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        gradingBrowser = await chromium.launch({
          headless,
          executablePath: chromePath,
          args: ['--disable-blink-features=AutomationControlled'],
        })
        gradingContext = await gradingBrowser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        })
        gradingPage = await gradingContext.newPage()
        await gradingPage.evaluate(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
        })
        return { success: true, method: 'system-chrome' }
      }
    }
    errors.push('System Chrome: 未找到 Chrome 安装')
  } catch (error: any) {
    errors.push(`System Chrome: ${error.message}`)
  }

  // 尝试 3: 使用系统 Edge
  try {
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.PROGRAMFILES + '\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
    
    for (const edgePath of edgePaths) {
      if (fs.existsSync(edgePath)) {
        gradingBrowser = await chromium.launch({
          headless,
          executablePath: edgePath,
          args: ['--disable-blink-features=AutomationControlled'],
        })
        gradingContext = await gradingBrowser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        })
        gradingPage = await gradingContext.newPage()
        await gradingPage.evaluate(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
        })
        return { success: true, method: 'system-edge' }
      }
    }
    errors.push('System Edge: 未找到 Edge 安装')
  } catch (error: any) {
    errors.push(`System Edge: ${error.message}`)
  }

  // 所有尝试都失败
  console.error('启动浏览器失败:', errors.join('\n'))
  return { 
    success: false, 
    error: '未能找到可用的浏览器\n\n请确保已安装以下之一:\n1. Google Chrome\n2. Microsoft Edge\n\n或运行: npx playwright install chromium',
    details: errors
  }
})

// 连接已有浏览器
ipcMain.handle('bot:connect', async () => {
  try {
    if (!chromium) {
      const { chromium: chromiumModule } = await import('playwright')
      chromium = chromiumModule
    }
    gradingBrowser = await chromium.connectOverCDP('http://localhost:9222')
    const contexts = gradingBrowser.contexts()
    if (contexts.length > 0) {
      gradingContext = contexts[0]
      const pages = gradingContext.pages()
      if (pages.length > 0) {
        gradingPage = pages[0]
        return true
      }
    }
    return false
  } catch (error) {
    console.error('连接浏览器失败:', error)
    return false
  }
})

// 导航到URL
ipcMain.handle('bot:navigate', async (_, url: string) => {
  if (!gradingPage) throw new Error('浏览器未启动')
  await gradingPage.goto(url)
  await gradingPage.waitForLoadState('networkidle')
})

// 分析页面元素
ipcMain.handle('bot:analyze', async () => {
  if (!gradingPage) return { found: false }
  try {
    // 检测是否为智学网页面
    const pageInfo = await gradingPage.evaluate((zhixueSelectors: ZhixueSelectors) => {
      const url = window.location.href
      const isZhixue = url.includes('zhixue.com') || url.includes('zhixueyun.com')
      
      if (!isZhixue) {
        return { isZhixue: false, isOldUI: false, isNewUI: false }
      }

      // 检测新旧版UI
      const hasOldUI = document.querySelector(zhixueSelectors.ANSWER_IMAGE) !== null
      const hasNewUI = document.querySelector(zhixueSelectors.ANSWER_IMAGE_NEW) !== null

      // 获取题目内容（从页面中提取）
      let questionContent = ''
      // 尝试多种选择器获取题目内容
      const questionSelectors = [
        '.question-content', '.topic-content', '.stem-content',
        '.question-stem', '[class*="question"] [class*="content"]',
        '.paper-question', '.exam-question', '.topic-title',
        '[class*="stem"]', '[class*="topic"] p', '.question-text'
      ]
      for (const sel of questionSelectors) {
        const el = document.querySelector(sel)
        if (el && el.textContent?.trim()) {
          questionContent = el.textContent.trim().substring(0, 500)
          break
        }
      }

      // 获取页面标题作为备用题目信息
      const pageTitle = document.title || ''

      return {
        isZhixue: true,
        isOldUI: hasOldUI,
        isNewUI: hasNewUI,
        url: url,
        questionContent,
        pageTitle
      }
    }, getZhixueSelectors())

    // 如果不是智学网页面，返回不支持
    if (!pageInfo.isZhixue) {
      return { 
        found: false, 
        error: '本工具仅支持智学网平台，请打开智学网阅卷页面' 
      }
    }

    // 检测智学网特定元素
    const hasAnswerImage = pageInfo.isOldUI || pageInfo.isNewUI
    const scoreInput = await gradingPage.evaluate((selectors: ZhixueSelectors) => {
      return !!(document.querySelector(selectors.SCORE_INPUT_PLACEHOLDER) ||
                document.querySelector(selectors.SCORE_INPUT_ALL_NEW) ||
                document.querySelector(selectors.SCORE_INPUT))
    }, getZhixueSelectors())

    const submitButton = await gradingPage.evaluate((selectors: ZhixueSelectors) => {
      return !!(document.querySelector(selectors.SUBMIT_BUTTON_NEW) ||
                Array.from(document.querySelectorAll('button')).some(btn =>
                  btn.textContent?.includes(selectors.SUBMIT_BUTTON_TEXT)))
    }, getZhixueSelectors())

    return {
      found: hasAnswerImage && scoreInput,
      isZhixue: true,
      isOldUI: pageInfo.isOldUI,
      isNewUI: pageInfo.isNewUI,
      hasAnswerImage,
      hasScoreInput: scoreInput,
      hasSubmitButton: submitButton,
      questionContent: pageInfo.questionContent || '',
      pageTitle: pageInfo.pageTitle || '',
    }
  } catch (error) {
    console.error('分析页面失败:', error)
    return { found: false, error: String(error) }
  }
})

// 设置评分标准
ipcMain.on('bot:setStandard', (_, standard) => {
  currentStandard = standard
})

// 更新选择器
ipcMain.on('bot:updateSelectors', (_, newSelectors) => {
  Object.assign(selectors, newSelectors)
})

// 辅助函数：获取图片并转为 base64
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    // 如果是 data URL，直接返回
    if (imageUrl.startsWith('data:')) {
      return imageUrl
    }
    
    // 使用 axios 获取图片
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    
    const contentType = response.headers['content-type'] || 'image/png'
    const base64 = Buffer.from(response.data, 'binary').toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error('获取图片失败:', error)
    return null
  }
}

// 截图 - 智学网专用：通过 DOM 选择器获取图片 URL
ipcMain.handle('bot:capture', async () => {
  if (!gradingPage) return null
  try {
    // 使用智学网专用选择器获取图片 URL
    const imageUrls = await gradingPage.evaluate((selectors: ZhixueSelectors) => {
      // 先尝试旧版选择器
      let imgs = document.querySelectorAll(selectors.ANSWER_IMAGE)
      if (imgs.length === 0) {
        // 尝试新版选择器
        imgs = document.querySelectorAll(selectors.ANSWER_IMAGE_NEW)
      }
      return Array.from(imgs).map(img => (img as HTMLImageElement).src).filter(src => src)
    }, getZhixueSelectors())

    if (imageUrls.length === 0) {
      console.error('未找到智学网答题图片')
      return null
    }

    // 获取第一张图片并转为 base64
    const base64Image = await fetchImageAsBase64(imageUrls[0])
    if (base64Image) {
      console.log(`成功获取智学网图片: ${imageUrls[0].substring(0, 100)}...`)
    }
    return base64Image
  } catch (error) {
    console.error('获取图片失败:', error)
    return null
  }
})

// 自动获取图片 - 智学网专用
ipcMain.handle('bot:capture-auto', async () => {
  // 智学网专用版本，与 capture 相同
  return ipcMain.emit('bot:capture') 
})

// ============ OCR识别（支持 PaddleOCR-VL-1.5 服务）============
// PaddleOCR-VL-1.5 模型大小约 1-1.5GB，如需本地部署请参考官方文档
// https://www.paddleocr.ai/latest/en/version3.x/deployment/mcp_server.html

// 本地 PaddleOCR 实例（降级方案）
let paddleOcrService: any = null

async function initPaddleOCR() {
  if (paddleOcrService) return paddleOcrService
  
  try {
    // 尝试加载本地 paddleocr
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PaddleOcr = require('paddleocr')
    const ort = await import('onnxruntime-web')
    
    // 模型文件路径
    const modelDir = path.join(app.getPath('userData'), 'paddleocr-models')
    
    // 如果模型文件存在，使用本地模型
    const detModelPath = path.join(modelDir, 'ch_PP-OCRv4_det_infer.onnx')
    const recModelPath = path.join(modelDir, 'ch_PP-OCRv4_rec_infer.onnx')
    
    if (fs.existsSync(detModelPath) && fs.existsSync(recModelPath)) {
      const detectOnnx = fs.readFileSync(detModelPath)
      const recOnnx = fs.readFileSync(recModelPath)
      
      // @ts-ignore
      const PaddleOcrService = PaddleOcr.PaddleOcrService
      paddleOcrService = await PaddleOcrService.createInstance({
        ort,
        detection: { modelBuffer: detectOnnx.buffer },
        recognition: { modelBuffer: recOnnx.buffer },
      })
      
      console.log('本地 PaddleOCR 初始化成功')
      return paddleOcrService
    }
  } catch (error) {
    console.log('本地 PaddleOCR 不可用:', error)
  }
  
  return null
}

async function callPaddleOCRService(imageBase64: string): Promise<{text: string, isBlank: boolean, error?: string}> {
  try {
    // 如果未启用 PaddleOCR 服务，使用降级方案
    if (!paddleOcrConfig.enabled || !paddleOcrConfig.serverUrl) {
      return {
        text: '',
        isBlank: false,
        error: 'PaddleOCR-VL-1.5 服务未配置。请在设置中配置 PaddleOCR 服务地址。'
      }
    }

    // 只设置 Authorization，不设置 Content-Type（让 form-data 自动设置）
    const headers: Record<string, string> = {
      'Authorization': `bearer ${paddleOcrConfig.aistudioToken}`,
    }

    const optionalPayload = {
      useDocOrientationClassify: false,
      useDocUnwarping: false,
      useChartRecognition: false,
    }

    // 提交 OCR 任务（使用 multipart/form-data 格式）
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // 推断图片 MIME 类型和扩展名
    const mimeTypeMatch = imageBase64.match(/^data:(image\/\w+);base64,/)
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png'
    const ext = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'png')

    // 使用 form-data 库构建 multipart 请求（与 Python requests 的 files 参数等价）
    const FormData = require('form-data')
    const form = new FormData()
    
    // 文件字段 - 与 Python: files = {"file": f} 等价
    form.append('file', imageBuffer, {
      filename: `image.${ext}`,
      contentType: mimeType,
      knownLength: imageBuffer.length,
    })
    
    // 其他字段 - 与 Python: data = {"model": MODEL, "optionalPayload": json.dumps(optional_payload)} 等价
    form.append('model', 'PaddleOCR-VL-1.5')
    form.append('optionalPayload', JSON.stringify(optionalPayload))

    console.log('发送 PaddleOCR 请求...')
    console.log('URL:', paddleOcrConfig.serverUrl)
    console.log('Token:', paddleOcrConfig.aistudioToken.substring(0, 10) + '...')
    console.log('Buffer size:', imageBuffer.length)

    const submitResponse = await axios.post(
      paddleOcrConfig.serverUrl,
      form,
      {
        headers: {
          ...headers,
          ...form.getHeaders(),  // 自动包含 Content-Type: multipart/form-data; boundary=...
        },
        timeout: 60000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    )

    if (submitResponse.status !== 200) {
      throw new Error(`提交任务失败: ${submitResponse.status} ${submitResponse.statusText}`)
    }

    const jobId = submitResponse.data?.data?.jobId
    if (!jobId) {
      throw new Error('未获取到 jobId')
    }

    console.log('PaddleOCR 任务已提交, jobId:', jobId)

    // 轮询等待结果
    const maxRetries = 60 // 最多等待 5 分钟 (60 * 5秒)
    let retries = 0
    
    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // 等待 5 秒
      
      const statusResponse = await axios.get(
        `${paddleOcrConfig.serverUrl}/${jobId}`,
        { headers, timeout: 30000 }
      )

      const state = statusResponse.data?.data?.state
      
      if (state === 'done') {
        console.log('PaddleOCR 任务完成')
        
        // 获取结果
        const resultUrl = statusResponse.data?.data?.resultUrl?.jsonUrl
        if (!resultUrl) {
          throw new Error('未获取到结果URL')
        }

        const jsonlResponse = await axios.get(resultUrl, { timeout: 60000 })
        const lines = jsonlResponse.data.trim().split('\n')
        
        // 提取文本
        let text = ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const result = JSON.parse(line)
            const layoutResults = result?.result?.layoutParsingResults
            if (layoutResults && Array.isArray(layoutResults)) {
              for (const res of layoutResults) {
                if (res?.markdown?.text) {
                  text += res.markdown.text + '\n'
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
        
        text = text.trim()
        const isBlank = text.replace(/\s/g, '').length < 10
        return { text, isBlank }
        
      } else if (state === 'failed') {
        const errorMsg = statusResponse.data?.data?.errorMsg || '未知错误'
        throw new Error(`PaddleOCR 任务失败: ${errorMsg}`)
      } else if (state === 'pending') {
        console.log('PaddleOCR 任务等待中...')
      } else if (state === 'running') {
        try {
          const progress = statusResponse.data?.data?.extractProgress
          if (progress) {
            console.log(`PaddleOCR 任务进行中: ${progress.extractedPages}/${progress.totalPages}`)
          }
        } catch (e) {
          console.log('PaddleOCR 任务运行中...')
        }
      }
      
      retries++
    }
    
    throw new Error('PaddleOCR 任务超时')

  } catch (error: any) {
    console.error('PaddleOCR 服务调用失败:', error.message)
    return {
      text: '',
      isBlank: false,
      error: `PaddleOCR 服务调用失败: ${error.message}`
    }
  }
}

ipcMain.handle('bot:recognize', async (_, imageBase64: string) => {
  // 如果配置了 PaddleOCR 服务，优先使用
  if (paddleOcrConfig.enabled && paddleOcrConfig.serverUrl) {
    const result = await callPaddleOCRService(imageBase64)
    if (result.text || !result.error) {
      return result
    }
    // 如果服务调用失败，记录错误但继续执行
    console.log('PaddleOCR 服务不可用:', result.error)
  }
  
  // 降级方案：尝试使用本地 PaddleOCR
  try {
    const ocrService = await initPaddleOCR()
    
    if (ocrService) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const imageBuffer = Buffer.from(base64Data, 'base64')
      
      const sharp = require('sharp')
      const image = await sharp(imageBuffer).removeAlpha().raw().toBuffer({
        resolveWithObject: true
      })
      
      const input = {
        data: new Uint8Array(image.data),
        width: image.info.width,
        height: image.info.height,
      }
      
      const result = await ocrService.recognize(input)
      
      let text = ''
      if (result && result.length > 0) {
        for (const item of result) {
          if (item && item.box) {
            text += (item.text || '') + ' '
          }
        }
      }
      
      text = text.trim()
      const isBlank = text.replace(/\s/g, '').length < 10
      
      return { text, isBlank }
    }
  } catch (error) {
    console.error('本地 PaddleOCR 识别失败:', error)
  }
  
  // 所有方案都失败
  return {
    text: '',
    isBlank: false,
    error: 'OCR 识别不可用。请配置 PaddleOCR 服务或确保模型文件已下载。'
  }
})

// ============ AI评分（使用活跃服务商）============
// 返回格式：{ score: number, comment: string }
ipcMain.handle('bot:grade', async (_, text: string, standard: any) => {
  try {
    // 获取活跃服务商配置
    let activeProvider = null
    if (currentBotSettings.providers && currentBotSettings.providers.length > 0) {
      activeProvider = currentBotSettings.providers.find(p => p.id === currentBotSettings.activeProviderId) || currentBotSettings.providers[0]
    }

    // 如果没有配置活跃服务商或 API Key，使用本地评分
    if (!activeProvider || !activeProvider.apiKey) {
      console.log('未配置活跃服务商或 API Key，使用本地评分')
      const localScore = Math.floor(gradeLocally(text, standard))
      return { score: localScore, comment: generateLocalComment(text, standard, localScore) }
    }

    // 构建评分提示词
    const prompt = buildGradingPrompt(text, standard)
    
    // 调用活跃服务商 API
    const response = await axios.post(
      activeProvider.endpoint,
      {
        model: activeProvider.model || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的语文老师，负责批改学生的作答。你需要根据题目要求和学生作答内容给出公平的分数和评语。
回答格式：必须返回 JSON 格式 {"score": 分数, "comment": "评语理由"}
例如：{"score": 8, "comment": "答案基本正确，但缺少第二点的论述"}
注意：score 必须是整数（0到满分之间），comment 是简短的评语（不超过50字）。只返回 JSON，不要返回其他内容。`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: currentBotSettings.temperature || 0.3,
        max_tokens: currentBotSettings.maxTokens || 500,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeProvider.apiKey}`
        },
        timeout: 30000
      }
    )

    // 解析评分结果（JSON 格式：{ score, comment }）
    const result = response.data.choices?.[0]?.message?.content?.trim() || '{}'
    let parsed: { score?: number; comment?: string } = {}
    try {
      parsed = JSON.parse(result)
    } catch {
      // 尝试从文本中提取 JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch {
          // JSON 解析完全失败，降级提取分数
          const score = parseScore(result, standard?.totalScore || 10)
          return { score, comment: 'AI 评语生成失败，已自动评分' }
        }
      }
    }
    
    const score = parsed?.score ? parseScore(String(parsed.score), standard?.totalScore || 10) : 0
    const comment = parsed?.comment || ''
    
    return { score, comment }
  } catch (error: any) {
    console.error('AI API 调用失败:', error.message)
    // 降级到本地评分
    const localScore = Math.floor(gradeLocally(text, standard))
    return { score: localScore, comment: generateLocalComment(text, standard, localScore) }
  }
})

// 生成本地评语（降级方案）
function generateLocalComment(text: string, standard: any, score: number): string {
  if (!standard) return '已使用本地评分标准完成评分'
  const maxScore = standard.totalScore || 10
  const ratio = score / maxScore
  if (ratio >= 0.9) return '回答非常优秀，要点齐全，表述清晰'
  if (ratio >= 0.7) return '回答基本正确，但部分要点不够完整'
  if (ratio >= 0.5) return '回答有一定内容，但缺少关键要点'
  if (ratio > 0) return '回答不够完整，建议补充更多内容'
  return '未检测到有效作答内容'
}

// 构建评分提示词
function buildGradingPrompt(text: string, standard: any): string {
  if (!standard) {
    return `请批改以下学生作答，满分10分：
    
学生作答：${text}

请直接输出分数。`
  }

  return `题目要求：${standard.name || '阅读理解'}
满分：${standard.totalScore}分
参考答案/评分标准：${standard.keywords?.join('、') || '按内容质量评分'}

学生作答：
${text}

请根据评分标准批改学生作答，只输出一个数字分数。`
}

// 解析评分结果
function parseScore(result: string, maxScore: number): number {
  // 提取数字
  const match = result.match(/(\d+)/)
  if (match) {
    const score = parseInt(match[1], 10)
    // 确保返回整数，且在有效范围内
    return Math.min(maxScore, Math.max(0, Math.floor(score)))
  }
  return 0
}

// 本地评分（降级方案）
function gradeLocally(text: string, standard: any): number {
  if (!standard) return 0
  
  const keywords = standard.keywords || []
  const maxScore = standard.totalScore || 10
  let score = 0

  // 关键词匹配
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 2
    }
  }

  // 内容长度加分
  if (text.length > 10) score += 3
  if (text.length > 50) score += 2

  return Math.min(maxScore, Math.max(0, score))
}

// 提交分数 - 智学网专用
ipcMain.handle('bot:submit', async (_, score: number) => {
  if (!gradingPage) throw new Error('浏览器未启动')
  try {
    // 使用智学网特定方式填入分数
    await gradingPage.evaluate((scoreValue: number, selectors: ZhixueSelectors) => {
      // 查找输入框 - 优先顺序：新版全部输入框 > 新版输入框 > 旧版输入框
      let input = document.querySelector(selectors.SCORE_INPUT_ALL_NEW) as HTMLInputElement ||
                  document.querySelector(selectors.SCORE_INPUT_NEW) as HTMLInputElement ||
                  document.querySelector(selectors.SCORE_INPUT_PLACEHOLDER) as HTMLInputElement ||
                  document.querySelector(selectors.SCORE_INPUT) as HTMLInputElement
      
      if (input) {
        // 使用原生 setter 设置值（绕过 React/Vue 等框架的受控组件）
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (setter) {
          setter.call(input, String(scoreValue))
        } else {
          input.value = String(scoreValue)
        }
        
        // 触发必要的事件
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.dispatchEvent(new Event('blur', { bubbles: true }))
        
        return true
      }
      return false
    }, score, getZhixueSelectors())
    
    await gradingPage.waitForTimeout(300)

    // 点击提交按钮
    const submitSuccess = await gradingPage.evaluate((selectors: ZhixueSelectors) => {
      // 优先尝试新版提交按钮
      let submitBtn = document.querySelector(selectors.SUBMIT_BUTTON_NEW) as HTMLButtonElement
      
      // 如果没有找到，尝试查找包含"提交分数"文本的按钮
      if (!submitBtn) {
        const buttons = document.querySelectorAll('button')
        for (const btn of buttons) {
          if (btn.textContent?.includes(selectors.SUBMIT_BUTTON_TEXT)) {
            submitBtn = btn
            break
          }
        }
      }
      
      if (submitBtn) {
        submitBtn.click()
        return true
      }
      return false
    }, getZhixueSelectors())
    
    if (!submitSuccess) {
      // 降级：尝试按 Enter 键
      await gradingPage.keyboard.press('Enter')
    }
    
    await gradingPage.waitForTimeout(1000)
    return true
  } catch (error) {
    console.error('提交失败:', error)
    return false
  }
})

// 下一张 - 智学网专用
ipcMain.handle('bot:next', async () => {
  if (!gradingPage) return false
  try {
    // 智学网通常自动加载下一题，或者通过页面内导航
    // 这里尝试多种方式切换到下一题
    const hasNext = await gradingPage.evaluate(() => {
      // 方式1: 查找"下一题"按钮
      const nextButtons = document.querySelectorAll('button')
      for (const btn of nextButtons) {
        if (btn.textContent?.includes('下一题') || btn.textContent?.includes('下一个')) {
          btn.click()
          return true
        }
      }
      
      // 方式2: 查找右箭头按钮
      const arrowButtons = document.querySelectorAll('.next-btn, .btn-next, [class*="next"]')
      if (arrowButtons.length > 0) {
        (arrowButtons[0] as HTMLElement).click()
        return true
      }
      
      // 方式3: 尝试按右箭头键
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      
      return false
    })
    
    await gradingPage.waitForTimeout(1500)
    return hasNext
  } catch (error) {
    console.error('切换下一张失败:', error)
    return false
  }
})

// 开始/停止
ipcMain.on('bot:start', () => { isRunning = true })
ipcMain.on('bot:stop', () => { isRunning = false })

// 关闭浏览器
ipcMain.handle('bot:close', async () => {
  isRunning = false
  await gradingBrowser?.close()
  gradingBrowser = null
  gradingContext = null
  gradingPage = null
})

// ============ 应用生命周期 ============
app.whenReady().then(() => {
  initSecureStorage() // 初始化安全存储
  loadSelectorsConfig() // 加载选择器配置
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
