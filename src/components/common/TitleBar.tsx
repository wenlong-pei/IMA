import { Minus, Square, X, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import './TitleBar.scss'

const APP_VERSION = '2.1.1'

const api = typeof window !== 'undefined' && (window as any).electronAPI

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  const handleMinimize = () => {
    api?.minimizeWindow()
  }

  const handleMaximize = () => {
    api?.maximizeWindow()
    setIsMaximized(!isMaximized)
  }

  const handleClose = () => {
    api?.closeWindow()
  }

  return (
    <header className="title-bar">
      <div className="title-bar__left">
        <div className="title-bar__logo">
          <svg viewBox="0 0 32 32" className="title-bar__icon">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00c9b0" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14" fill="url(#logoGradient)" />
            <path d="M10 12h12M10 16h12M10 20h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="title-bar__title">皮老板智能阅卷工具</span>
        <span className="title-bar__version">v{APP_VERSION}</span>
      </div>
      
      <div className="title-bar__right">
        <button 
          className="title-bar__btn" 
          onClick={handleMinimize}
          title="最小化"
        >
          <Minus size={16} />
        </button>
        <button 
          className="title-bar__btn" 
          onClick={handleMaximize}
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? <Maximize2 size={14} /> : <Square size={14} />}
        </button>
        <button 
          className="title-bar__btn title-bar__btn--close" 
          onClick={handleClose}
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}
