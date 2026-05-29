// Playwright 自动化服务代理
// 渲染进程通过 IPC 调用主进程，开发模式使用模拟数据

interface OCRResult {
  text: string
  isBlank: boolean
}

interface PageElements {
  found: boolean
  answerArea?: string
  scoreInput?: string
  submitButton?: string
  nextButton?: string
  isOldUI?: boolean
  isNewUI?: boolean
  error?: string
}

interface BrowserLaunchResult {
  success: boolean
  method?: string
  error?: string
  details?: string[]
}

interface GradeResult {
  score: number
  comment: string
}

interface BotProxy {
  // 浏览器控制
  launchBrowser: (headless: boolean) => Promise<BrowserLaunchResult>
  navigateToUrl: (url: string) => Promise<void>
  analyzePage: () => Promise<PageElements & { questionContent?: string; pageTitle?: string }>
  
  // 批改流程
  captureAnswer: () => Promise<string | null>
  captureAnswerAuto: () => Promise<string | null> // 自动获取图片
  recognizeText: (imageBase64: string) => Promise<OCRResult>
  gradeWithAI: (text: string) => Promise<GradeResult>
  submitScore: (score: number) => Promise<void>
  nextPaper: () => Promise<boolean>
  
  // 配置
  setGradingStandard: (standard: any) => void
  start: () => void
  stop: () => void
}

// 模拟 OCR 识别
function mockRecognize(_imageBase64: string): OCRResult {
  // 模拟：随机生成文本或空白
  const isBlank = Math.random() < 0.1
  if (isBlank) {
    return { text: '', isBlank: true }
  }
  
  const sampleTexts = [
    '这篇文章运用了比喻的修辞手法，将春天的景色描绘得生动形象。',
    '作者通过细腻的描写，表达了对故乡的深深思念之情。',
    '文中主人公勇敢坚强，面对困难从不退缩，值得我们学习。',
    '这段文字语言优美，意境深远，给人以美的享受。',
  ]
  return {
    text: sampleTexts[Math.floor(Math.random() * sampleTexts.length)],
    isBlank: false
  }
}

// 模拟 AI 评分
function mockGrade(text: string, standard: any): GradeResult {
  if (!standard) {
    const s = Math.floor(Math.random() * 10)
    return { score: s, comment: '模拟评语：答案基本正确' }
  }
  // 根据文本长度和关键词简单评分
  const baseScore = Math.min(standard.totalScore, Math.floor(text.length / 5))
  const s = Math.max(0, Math.min(standard.totalScore, baseScore + Math.floor(Math.random() * 3)))
  const ratio = s / (standard.totalScore || 10)
  let comment = '模拟评语：'
  if (ratio >= 0.9) comment += '回答非常优秀'
  else if (ratio >= 0.7) comment += '回答基本正确'
  else if (ratio >= 0.5) comment += '回答有一定内容'
  else comment += '回答不够完整'
  return { score: s, comment }
}

function createBotProxy(): BotProxy {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI
  
  // 当前状态
  let currentStandard: any = null
  let mockConsecutiveCount = 0

  if (isElectron) {
    const electronAPI = (window as any).electronAPI
    
    return {
      launchBrowser: async (headless: boolean): Promise<BrowserLaunchResult> => {
        return await electronAPI.invoke('bot:launch', headless)
      },
      navigateToUrl: async (url: string) => {
        await electronAPI.invoke('bot:navigate', url)
      },
      analyzePage: async () => {
        return await electronAPI.invoke('bot:analyze')
      },
      captureAnswer: async () => {
        return await electronAPI.invoke('bot:capture')
      },
      captureAnswerAuto: async () => {
        return await electronAPI.invoke('bot:capture-auto')
      },
      recognizeText: async (imageBase64: string) => {
        return await electronAPI.invoke('bot:recognize', imageBase64)
      },
      gradeWithAI: async (text: string) => {
        return await electronAPI.invoke('bot:grade', text, currentStandard)
      },
      submitScore: async (score: number) => {
        await electronAPI.invoke('bot:submit', score)
      },
      nextPaper: async () => {
        return await electronAPI.invoke('bot:next')
      },
      setGradingStandard: (standard: any) => {
        currentStandard = standard
        electronAPI.send('bot:setStandard', standard)
      },
      start: () => {
        electronAPI.send('bot:start')
      },
      stop: () => {
        electronAPI.send('bot:stop') 
      },
    }
  }

  // 开发模式模拟
  return {
    launchBrowser: async (_headless: boolean): Promise<BrowserLaunchResult> => {
      console.log('[Mock] 启动浏览器')
      await new Promise(r => setTimeout(r, 1000))
      return { success: true, method: 'mock' }
    },
    navigateToUrl: async (url: string) => {
      console.log('[Mock] 导航到:', url)
      await new Promise(r => setTimeout(r, 800))
    },
    analyzePage: async () => {
      console.log('[Mock] 分析页面元素')
      await new Promise(r => setTimeout(r, 600))
      return {
        found: true,
        answerArea: '.answer-content',
        scoreInput: 'input[type="number"]',
        submitButton: 'button.submit',
        nextButton: '.next-btn'
      }
    },
    captureAnswer: async () => {
      console.log('[Mock] 截图')
      await new Promise(r => setTimeout(r, 500))
      // 返回一个空白图片 data URL
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    },
    captureAnswerAuto: async () => {
      console.log('[Mock] 自动获取图片')
      await new Promise(r => setTimeout(r, 600))
      // 模拟自动获取图片
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    },
    recognizeText: async (imageBase64: string) => {
      console.log('[Mock] OCR识别')
      await new Promise(r => setTimeout(r, 800))
      return mockRecognize(imageBase64)
    },
    gradeWithAI: async (text: string) => {
      console.log('[Mock] AI评分:', text.substring(0, 20) + '...')
      await new Promise(r => setTimeout(r, 1000))
      return mockGrade(text, currentStandard)
    },
    submitScore: async (score: number) => {
      console.log('[Mock] 提交分数:', score)
      await new Promise(r => setTimeout(r, 500))
    },
    nextPaper: async () => {
      console.log('[Mock] 切换下一张')
      await new Promise(r => setTimeout(r, 600))
      mockConsecutiveCount++
      // 模拟20张后结束
      return mockConsecutiveCount < 20
    },
    setGradingStandard: (standard: any) => {
      currentStandard = standard
      console.log('[Mock] 设置评分标准:', standard?.name)
    },
    start: () => {
      mockConsecutiveCount = 0
      console.log('[Mock] 开始')
    },
    stop: () => {
      console.log('[Mock] 停止') 
    },
  }
}

export const gradingBotProxy = createBotProxy()
