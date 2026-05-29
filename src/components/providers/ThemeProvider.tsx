import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

// 主题 CSS 变量定义
const lightTheme = {
  '--primary-50': '#eff6ff',
  '--primary-100': '#dbeafe',
  '--primary-200': '#bfdbfe',
  '--primary-300': '#93c5fd',
  '--primary-400': '#60a5fa',
  '--primary-500': '#3b82f6',
  '--primary-600': '#2563eb',
  '--primary-700': '#1d4ed8',
  '--primary-800': '#1e40af',
  '--primary-900': '#1e3a8a',
  '--success-50': '#f0fdf4',
  '--success-500': '#22c55e',
  '--success-600': '#16a34a',
  '--warning-50': '#fffbeb',
  '--warning-500': '#f59e0b',
  '--warning-600': '#d97706',
  '--error-50': '#fef2f2',
  '--error-500': '#ef4444',
  '--error-600': '#dc2626',
  '--gray-50': '#f8fafc',
  '--gray-100': '#f1f5f9',
  '--gray-200': '#e2e8f0',
  '--gray-300': '#cbd5e1',
  '--gray-400': '#94a3b8',
  '--gray-500': '#64748b',
  '--gray-600': '#475569',
  '--gray-700': '#334155',
  '--gray-800': '#1e293b',
  '--gray-900': '#0f172a',
  '--bg-primary': '#f8fafc',
  '--bg-secondary': '#ffffff',
  '--bg-tertiary': '#f1f5f9',
  '--text-primary': '#0f172a',
  '--text-secondary': '#475569',
  '--text-tertiary': '#94a3b8',
  '--border-color': '#e2e8f0',
}

const darkTheme = {
  '--primary-50': '#1e3a8a',
  '--primary-100': '#1e40af',
  '--primary-200': '#1d4ed8',
  '--primary-300': '#2563eb',
  '--primary-400': '#3b82f6',
  '--primary-500': '#60a5fa',
  '--primary-600': '#93c5fd',
  '--primary-700': '#bfdbfe',
  '--primary-800': '#dbeafe',
  '--primary-900': '#eff6ff',
  '--success-50': '#14532d',
  '--success-500': '#4ade80',
  '--success-600': '#22c55e',
  '--warning-50': '#78350f',
  '--warning-500': '#fbbf24',
  '--warning-600': '#f59e0b',
  '--error-50': '#7f1d1d',
  '--error-500': '#f87171',
  '--error-600': '#ef4444',
  '--gray-50': '#0f172a',
  '--gray-100': '#1e293b',
  '--gray-200': '#334155',
  '--gray-300': '#475569',
  '--gray-400': '#64748b',
  '--gray-500': '#94a3b8',
  '--gray-600': '#cbd5e1',
  '--gray-700': '#e2e8f0',
  '--gray-800': '#f1f5f9',
  '--gray-900': '#f8fafc',
  '--bg-primary': '#0f172a',
  '--bg-secondary': '#1e293b',
  '--bg-tertiary': '#334155',
  '--text-primary': '#f8fafc',
  '--text-secondary': '#cbd5e1',
  '--text-tertiary': '#64748b',
  '--border-color': '#334155',
}

// 字体大小
const fontSizes = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsStore()
  const { theme, fontSize } = settings

  useEffect(() => {
    const root = document.documentElement
    
    // 检测系统主题
    const getSystemTheme = () => {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    }
    
    // 应用主题
    const activeTheme = theme === 'system' ? getSystemTheme() : theme
    const themeVars = activeTheme === 'dark' ? darkTheme : lightTheme
    
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
    
    // 应用字体大小
    root.style.fontSize = fontSizes[fontSize as keyof typeof fontSizes] || '16px'
    
    // 添加/移除 dark 类名（用于组件级别的样式控制）
    if (activeTheme === 'dark') {
      document.body.classList.add('dark-theme')
      document.body.classList.remove('light-theme')
    } else {
      document.body.classList.add('light-theme')
      document.body.classList.remove('dark-theme')
    }
    
    // 监听系统主题变化
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? darkTheme : lightTheme
        Object.entries(newTheme).forEach(([key, value]) => {
          root.style.setProperty(key, value)
        })
        if (e.matches) {
          document.body.classList.add('dark-theme')
          document.body.classList.remove('light-theme')
        } else {
          document.body.classList.add('light-theme')
          document.body.classList.remove('dark-theme')
        }
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, fontSize])

  return <>{children}</>
}
