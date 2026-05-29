import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsStore()
  const { theme } = settings

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
    
    // 添加/移除 dark 类名
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
  }, [theme])

  return <>{children}</>
}
