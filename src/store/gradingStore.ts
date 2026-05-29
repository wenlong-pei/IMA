import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GradingMode } from '@/types'

interface GradingState {
  // 页面状态
  url: string
  isRunning: boolean
  isPaused: boolean
  gradingMode: GradingMode
  
  // 批改进度
  stats: {
    total: number
    completed: number
    blank: number
    failed: number
    currentScore: number
  }
  
  // 当前批改内容
  previewImage: string | null
  recognizedText: string
  aiComment: string
  
  // 分数纠错
  showCorrection: boolean
  correctionScore: string
  correctionReason: string
  
  // 倒计时
  countdown: number
  
  // 操作方法
  setUrl: (url: string) => void
  setIsRunning: (isRunning: boolean) => void
  setIsPaused: (isPaused: boolean) => void
  setGradingMode: (mode: GradingMode) => void
  updateStats: (updates: Partial<GradingState['stats']>) => void
  resetStats: () => void
  setPreviewImage: (image: string | null) => void
  setRecognizedText: (text: string) => void
  setAiComment: (comment: string) => void
  setShowCorrection: (show: boolean) => void
  setCorrectionScore: (score: string) => void
  setCorrectionReason: (reason: string) => void
  setCountdown: (countdown: number) => void
  resetAll: () => void
}

const defaultStats = {
  total: 0,
  completed: 0,
  blank: 0,
  failed: 0,
  currentScore: 0,
}

export const useGradingStore = create<GradingState>()(
  persist(
    (set) => ({
      // 初始状态
      url: '',
      isRunning: false,
      isPaused: false,
      gradingMode: 'normal',
      stats: { ...defaultStats },
      previewImage: null,
      recognizedText: '',
      aiComment: '',
      showCorrection: false,
      correctionScore: '',
      correctionReason: '',
      countdown: 0,
      
      // 操作方法
      setUrl: (url) => set({ url }),
      setIsRunning: (isRunning) => set({ isRunning }),
      setIsPaused: (isPaused) => set({ isPaused }),
      setGradingMode: (gradingMode) => set({ gradingMode }),
      updateStats: (updates) => set((state) => ({
        stats: { ...state.stats, ...updates }
      })),
      resetStats: () => set({ stats: { ...defaultStats } }),
      setPreviewImage: (previewImage) => set({ previewImage }),
      setRecognizedText: (recognizedText) => set({ recognizedText }),
      setAiComment: (aiComment) => set({ aiComment }),
      setShowCorrection: (showCorrection) => set({ showCorrection }),
      setCorrectionScore: (correctionScore) => set({ correctionScore }),
      setCorrectionReason: (correctionReason) => set({ correctionReason }),
      setCountdown: (countdown) => set({ countdown }),
      resetAll: () => set({
        url: '',
        isRunning: false,
        isPaused: false,
        stats: { ...defaultStats },
        previewImage: null,
        recognizedText: '',
        aiComment: '',
        showCorrection: false,
        correctionScore: '',
        correctionReason: '',
        countdown: 0,
      }),
    }),
    {
      name: 'grading-session',
      // 只持久化这些字段，运行时不持久化
      partialize: (state) => ({
        url: state.url,
        gradingMode: state.gradingMode,
        stats: state.stats,
      }),
    }
  )
)
