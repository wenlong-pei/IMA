// 评分标准类型定义
export interface GradingStandard {
  id: string
  name: string
  questionNumber?: string // 题号（选填）
  totalScore: number
  scoringRules: ScoringRule[]
  referenceAnswer: string
  keywords: string[]
  examples: ExampleAnswer[]
  createdAt: string
  updatedAt: string
}

export interface ScoringRule {
  id: string
  description: string
  score: number
  type: 'positive' | 'negative' // 加分项或扣分项
}

export interface ExampleAnswer {
  id: string
  content: string
  score: number
  comment: string
  image?: string
}

// 批改记录类型
export interface GradingRecord {
  id: string
  studentId?: string
  studentName?: string
  questionNumber?: string
  standardId: string
  standardName: string
  answerImage: string
  ocrText?: string
  score: number
  maxScore: number
  aiScore?: number
  aiComment?: string
  evaluationMode: 'ai' | 'manual' | 'hybrid'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  isBlank?: boolean // 是否为空白答题卡
  createdAt: string
  completedAt?: string
}

// 预设套类型
export interface PresetSet {
  id: string
  name: string
  description: string
  standards: GradingStandard[]
  isDefault: boolean
}

// AI 服务商配置
export interface AiProvider {
  id: string
  name: string
  endpoint: string
  apiKey: string
  model: string
  isActive: boolean
}

// 应用设置
export interface AppSettings {
  // 音效设置
  soundEnabled: boolean
  soundVolume: number // 0-100
  
  // 二次确认设置
  confirmBeforeScore: boolean
  confirmBeforeSubmit: boolean
  
  // 空白答题卡检测
  blankDetectionEnabled: boolean
  blankDetectionThreshold: number // 相似度阈值 0-100
  blankSampleImage?: string // 示例空白卡图片
  
  // AI 设置 - 多服务商支持
  providers: AiProvider[]
  activeProviderId: string
  temperature: number  // 0-2
  maxTokens: number    // 最大 token 数
  
  // PaddleOCR设置
  paddleOcrEnabled: boolean
  paddleOcrToken: string
  paddleOcrUrl: string
  paddleOcrModel: string
  paddleOcrTimeout: number
  
  // 批改设置
  autoSaveInterval: number // 秒
  batchSize: number // 批量处理数量
  retryAttempts: number
  
  // 界面设置
  theme: 'light' | 'dark' | 'system'
  fontSize: 'small' | 'medium' | 'large'
  showScoreOnImage: boolean
}

// 批改进度
export interface GradingProgress {
  total: number
  completed: number
  failed: number
  current: number
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'error'
  currentItem?: GradingRecord
}

// 筛选条件
export interface FilterCondition {
  questionNumber?: string
  evaluationMode?: 'ai' | 'manual' | 'hybrid'
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  dateRange?: {
    start: string
    end: string
  }
  scoreRange?: {
    min: number
    max: number
  }
  searchText?: string
}

// 批改模式
export type GradingMode = 'normal' | 'trial' | 'unattended'
