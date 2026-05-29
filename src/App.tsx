import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import MainLayout from '@/components/layouts/MainLayout'
import SimpleGradingPage from '@/pages/SimpleGradingPage'
import StandardsPage from '@/pages/StandardsPage'
import RecordsPage from '@/pages/RecordsPage'
import SettingsPage from '@/pages/SettingsPage'
import { SoundProvider } from '@/hooks/useSound'
import { SettingsProvider } from '@/store/settingsStore'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { useSettingsStore } from '@/store/settingsStore'

// 动态主题 Toaster
function ThemedToaster() {
  const { settings } = useSettingsStore()
  const isDark = settings.theme === 'dark' || 
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  return (
    <Toaster 
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a',
          borderRadius: '12px',
          padding: '12px 16px',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        },
      }}
    />
  )
}

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <SoundProvider>
          <HashRouter>
            <MainLayout>
              <Routes>
                <Route path="/" element={<SimpleGradingPage />} />
                <Route path="/standards" element={<StandardsPage />} />
                <Route path="/records" element={<RecordsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </MainLayout>
            <ThemedToaster />
          </HashRouter>
        </SoundProvider>
      </ThemeProvider>
    </SettingsProvider>
  )
}

export default App
