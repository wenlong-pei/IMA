import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  Square,
  Link,
  FileText,
  CheckCircle,
  Clock,
  Award,
  Image,
  Zap,
  UserCheck,
  Bot,
  X,
  Send,
  Pencil,
  RotateCcw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useStandardsStore } from '@/store/standardsStore'
import { useGradingStore } from '@/store/gradingStore'
import { useSound } from '@/hooks/useSound'
import { gradingBotProxy } from '@/services/playwrightProxy'
import './SimpleGradingPage.scss'
import type { GradingMode } from '@/types'

export default function SimpleGradingPage() {
  const { standards, currentStandardId, setCurrentStandard } = useStandardsStore()
  const { playSuccess, playError, playClick } = useSound()

  // 从 gradingStore 获取持久化状态
  const gradingStore = useGradingStore()
  const {
    url,
    isRunning,
    isPaused,
    gradingMode,
    stats,
    previewImage,
    recognizedText,
    aiComment,
    showCorrection,
    correctionScore,
    correctionReason,
    countdown,
    setUrl,
    setIsRunning,
    setIsPaused,
    setGradingMode,
    updateStats,
    resetStats,
    setPreviewImage,
    setRecognizedText,
    setAiComment,
    setShowCorrection,
    setCorrectionScore,
    setCorrectionReason,
    setCountdown,
  } = gradingStore

  // 不持久化的本地状态
  const [browserConnected, setBrowserConnected] = useState(false)
  const [isZhixuePage, setIsZhixuePage] = useState(false)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)

  // 分数纠错
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 倒计时
  const countdownRef = useRef(0)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 试改模式等待确认
  const [waitingConfirm, setWaitingConfirm] = useState(false)
  const confirmResolveRef = useRef<((score: number) => void) | null>(null)

  // 日志
  const [logs, setLogs] = useState<string[]>([])

  // 提醒间隔
  const [reminderInterval] = useState(10)

  const logsEndRef = useRef<HTMLDivElement>(null)
  const currentStandard = standards.find(s => s.id === currentStandardId)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 清理倒计时
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'success' ? '[OK]' : type === 'error' ? '[ERR]' : type === 'warning' ? '[WARN]' : '[INFO]'
    setLogs(prev => [...prev, `[${timestamp}] ${prefix} ${message}`])
  }

  // 组件挂载时检查是否有保存的状态
  useEffect(() => {
    if (url && !browserConnected) {
      // 有保存的 URL 但未连接，提示用户
      toast('检测到上次未完成的会话，点击连接继续', { icon: 'ℹ️' })
    }
  }, [])

  // 连接浏览器并打开链接
  const handleConnect = async () => {
    if (!url.trim()) {
      toast.error('请输入智学网链接')
      return
    }
    if (!currentStandard) {
      toast.error('请先选择评分标准')
      return
    }

    if (!url.includes('zhixue.com') && !url.includes('zhixueyun.com')) {
      toast.error('本工具仅支持智学网平台')
      return
    }

    playClick()
    addLog('正在启动浏览器...')

    try {
      const result = await gradingBotProxy.launchBrowser(false)
      if (!result.success) {
        throw new Error(result.error || '启动浏览器失败')
      }

      addLog(`正在打开: ${url}`)
      await gradingBotProxy.navigateToUrl(url)

      addLog('正在分析智学网页面...')
      const elements = await gradingBotProxy.analyzePage()

      if (elements.found) {
        setBrowserConnected(true)
        setIsZhixuePage(true)
        addLog('已连接到智学网', 'success')
        if (elements.isOldUI) {
          addLog('检测到旧版UI', 'success')
        }
        if (elements.isNewUI) {
          addLog('检测到新版UI', 'success')
        }
        addLog('找到答题图片区域', 'success')
        addLog('找到分数输入框', 'success')
        if (elements.questionContent) {
          addLog(`获取到题目内容: ${elements.questionContent.substring(0, 50)}...`, 'info')
        }
        playSuccess()
        toast.success('智学网页面分析完成，可以开始批改')
      } else {
        if (elements.error) {
          throw new Error(elements.error)
        }
        throw new Error('未能识别智学网页面元素，请检查链接是否正确')
      }
    } catch (error) {
      addLog(`连接失败: ${error}`, 'error')
      playError()
      toast.error('连接失败')
    }
  }

  // 倒计时控制
  const startCountdown = useCallback((seconds: number): Promise<boolean> => {
    return new Promise((resolve) => {
      countdownRef.current = seconds
      setCountdown(seconds)

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }

      countdownTimerRef.current = setInterval(() => {
        if (pausedRef.current) return

        countdownRef.current--
        setCountdown(countdownRef.current)

        if (countdownRef.current <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          setCountdown(0)
          resolve(true)
        }
      }, 1000)
    })
  }, [])

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    countdownRef.current = 0
    setCountdown(0)
  }, [])

  // 分数纠错处理
  const handleCorrection = useCallback(async (_aiScore: number): Promise<number> => {
    setShowCorrection(true)
    setCorrectionScore('')
    setCorrectionReason('')
    setIsAnalyzing(false)

    return new Promise((resolve) => {
      confirmResolveRef.current = (finalScore: number) => {
        setShowCorrection(false)
        confirmResolveRef.current = null
        resolve(finalScore)
      }
    })
  }, [])

  const submitCorrection = useCallback(async () => {
    const score = parseInt(correctionScore, 10)
    if (isNaN(score) || score < 0) {
      toast.error('请输入有效的分数')
      return
    }

    setIsAnalyzing(true)
    addLog(`正在分析纠错原因... AI评分与教师评分不一致`, 'warning')

    try {
      // 调用 DeepSeek 分析纠错原因
      const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI
      if (isElectron) {
        const electronAPI = (window as any).electronAPI
        try {
          const response = await electronAPI.invoke('bot:analyzeCorrection', {
            aiScore: stats.currentScore,
            teacherScore: score,
            reason: correctionReason,
            standard: currentStandard,
            recognizedText
          })
          if (response?.optimizedKeywords) {
            addLog(`AI 已优化评分标准: ${response.optimizedKeywords.join('、')}`, 'success')
          }
          if (response?.analysis) {
            addLog(`纠错分析: ${response.analysis}`, 'info')
          }
        } catch {
          // 分析失败不影响提交
          addLog('纠错分析请求失败，直接提交教师评分', 'warning')
        }
      }
    } finally {
      setIsAnalyzing(false)
    }

    addLog(`提交纠错分数: ${score}分`, 'success')
    playSuccess()
    confirmResolveRef.current?.(score)
  }, [correctionScore, correctionReason, stats.currentScore, currentStandard, recognizedText])

  const cancelCorrection = useCallback(() => {
    addLog('取消纠错，使用AI评分', 'info')
    confirmResolveRef.current?.(stats.currentScore || 0)
  }, [stats.currentScore])

  // 确认提交（试改模式）
  const confirmTrialSubmit = useCallback(() => {
    addLog('教师确认，提交AI评分', 'success')
    playSuccess()
    confirmResolveRef.current?.(stats.currentScore || 0)
  }, [stats.currentScore])

  // 开始自动批改
  const handleCapture = async () => {
    if (!browserConnected) {
      toast.error('请先连接浏览器')
      return
    }

    playClick()
    runningRef.current = true
    pausedRef.current = false
    setIsRunning(true)
    setIsPaused(false)
    resetStats()
    // 重置临时状态
    setPreviewImage(null)
    setRecognizedText('')
    setAiComment('')
    setShowCorrection(false)
    setCorrectionScore('')
    setCorrectionReason('')
    setCountdown(0)
    setWaitingConfirm(false)

    gradingBotProxy.setGradingStandard(currentStandard)
    gradingBotProxy.start()

    const modeLabel = gradingMode === 'normal' ? '普通' : gradingMode === 'trial' ? '试改' : '无人值守'
    addLog(`开始${modeLabel}模式自动批改...`)

    try {
      let consecutiveCount = 0

      while (true) {
        if (!runningRef.current) break
        if (pausedRef.current) {
          await new Promise(r => setTimeout(r, 500))
          continue
        }

        // 每 N 次提醒
        if (consecutiveCount > 0 && consecutiveCount % reminderInterval === 0) {
          addLog(`已批改 ${consecutiveCount} 份，请检查...`, 'warning')
        }

        updateStats((prev) => ({ total: prev.total + 1 }))

        // 1. 获取图片
        addLog('正在获取答题图片...')
        const image = await gradingBotProxy.captureAnswer()

        if (!image) {
          addLog('获取图片失败，可能已批改完毕', 'warning')
          break
        }
        setPreviewImage(image)

        // 2. OCR识别
        addLog('正在识别文字...')
        const ocrResult = await gradingBotProxy.recognizeText(image)
        setRecognizedText(ocrResult.text)

        const displayText = ocrResult.text.length > 100 ? ocrResult.text.substring(0, 100) + '...' : ocrResult.text
        addLog(`获取答题内容：${displayText || '(无文字)'}`, 'info')

        // 3. 空白卷检测
        if (ocrResult.isBlank) {
          addLog('检测到空白卷，直接打0分', 'warning')
          setAiComment('空白卷')
          await gradingBotProxy.submitScore(0)
          updateStats((prev) => ({ blank: prev.blank + 1, completed: prev.completed + 1, currentScore: 0 }))
          consecutiveCount++
          playClick()
          // 下一张
          const hasNext = await gradingBotProxy.nextPaper()
          if (!hasNext) {
            addLog('没有更多试卷了', 'success')
            break
          }
          await new Promise(r => setTimeout(r, 500))
          continue
        }

        // 4. AI评分（返回 { score, comment }）
        addLog('正在AI评分...')
        let gradeResult: { score: number; comment: string } = { score: 0, comment: '评分失败' }
        let retryCount = 0
        const maxRetries = gradingMode === 'unattended' ? 3 : 1

        while (retryCount < maxRetries) {
          try {
            gradeResult = await gradingBotProxy.gradeWithAI(ocrResult.text)
            break
          } catch (err) {
            retryCount++
            if (retryCount >= maxRetries) {
              addLog(`AI评分失败（已重试${maxRetries}次）: ${err}`, 'error')
              updateStats((prev) => ({ failed: prev.failed + 1 }))
              gradeResult = { score: 0, comment: '评分失败' }
              break
            }
            addLog(`AI评分失败，正在重试(${retryCount}/${maxRetries})...`, 'warning')
            await new Promise(r => setTimeout(r, 1000))
          }
        }

        const finalScore = gradeResult.score
        updateStats({ currentScore: finalScore })
        setAiComment(gradeResult.comment)
        addLog(`AI评分: ${finalScore}分`, 'success')
        if (gradeResult.comment) {
          addLog(`AI评语: ${gradeResult.comment}`, 'info')
        }

        // 5. 根据模式处理提交
        let submitScore = finalScore

        if (gradingMode === 'normal') {
          // 普通模式：5秒倒计时，期间可暂停/取消
          addLog('普通模式：5秒后自动提交...')
          const shouldSubmit = await startCountdown(5)
          if (!shouldSubmit || !runningRef.current) {
            addLog('倒计时被取消', 'warning')
            continue
          }
          submitScore = finalScore
        } else if (gradingMode === 'trial') {
          // 试改模式：等待教师确认，支持分数纠错
          addLog('试改模式：等待教师确认...', 'warning')
          setWaitingConfirm(true)
          submitScore = await handleCorrection(finalScore)
          setWaitingConfirm(false)
          if (!runningRef.current) continue
        } else if (gradingMode === 'unattended') {
          // 无人值守模式：1秒自动提交
          await new Promise(r => setTimeout(r, 1000))
          submitScore = finalScore
        }

        // 6. 提交
        await gradingBotProxy.submitScore(submitScore)
        addLog(`已提交 ${submitScore}分`, 'success')
        updateStats((prev) => ({ completed: prev.completed + 1 }))
        consecutiveCount++
        playClick()

        // 7. 下一张
        const hasNext = await gradingBotProxy.nextPaper()
        if (!hasNext) {
          addLog('没有更多试卷了', 'success')
          break
        }

        await new Promise(r => setTimeout(r, 800))
      }

      addLog(`批改完成！共${consecutiveCount}份`, 'success')
      playSuccess()
      toast.success(`批改完成！共${consecutiveCount}份`)
    } catch (error) {
      addLog(`批改中断: ${error}`, 'error')
      playError()
      toast.error('批改中断')
    } finally {
      runningRef.current = false
      pausedRef.current = false
      cancelCountdown()
      gradingBotProxy.stop()
      setIsRunning(false)
      setIsPaused(false)
      setWaitingConfirm(false)
      setShowCorrection(false)
    }
  }

  const handlePause = () => {
    playClick()
    // 切换暂停状态
    const newPausedState = !pausedRef.current
    pausedRef.current = newPausedState
    setIsPaused(newPausedState)
    
    // 根据新状态执行操作
    if (newPausedState) {
      // 新状态是暂停 -> 停止批改
      gradingBotProxy.stop()
      addLog('已暂停')
    } else {
      // 新状态是继续 -> 恢复批改
      gradingBotProxy.start()
      addLog('继续批改')
    }
  }

  const handleStop = () => {
    playClick()
    runningRef.current = false
    pausedRef.current = false
    cancelCountdown()
    gradingBotProxy.stop()
    setIsRunning(false)
    setIsPaused(false)
    setWaitingConfirm(false)
    setShowCorrection(false)
    addLog('已停止')
  }

  const modeConfigs = [
    {
      key: 'normal' as GradingMode,
      icon: <Zap size={18} />,
      name: '普通模式',
      desc: 'AI评分后5秒自动提交，期间可暂停或取消'
    },
    {
      key: 'trial' as GradingMode,
      icon: <UserCheck size={18} />,
      name: '试改模式',
      desc: 'AI评分后等待教师确认，支持分数纠错和标准优化'
    },
    {
      key: 'unattended' as GradingMode,
      icon: <Bot size={18} />,
      name: '无人值守',
      desc: '全自动批改，1秒提交，错误自动重试（最多3次）'
    }
  ]

  return (
    <div className="simple-grading-page">
      {/* 顶部标题区 */}
      <div className="page-header">
        <h1>
          <Award size={26} />
          智学网自动批改助手
        </h1>
        <p>智学网专用 · DOM选择器获取图片 · OCR识别 · AI评分 · 自动提交</p>
      </div>

      <div className="page-content">
        {/* 左侧面板 - 配置区 */}
        <div className="config-panel">
          {/* 链接输入 */}
          <div className="card">
            <div className="card-header">
              <Link size={16} />
              <h3>智学网链接</h3>
            </div>
            <div className="card-body">
              <div className="url-input-wrapper">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.zhixue.com/..."
                  disabled={isRunning}
                />
              </div>
              <button
                className={`btn ${browserConnected ? 'btn-success' : 'btn-primary'}`}
                onClick={handleConnect}
                disabled={isRunning || !url || !currentStandard}
                style={{ width: '100%', marginTop: 10 }}
              >
                {browserConnected ? <CheckCircle size={16} /> : <Link size={16} />}
                {browserConnected ? '已连接' : '打开链接'}
              </button>
            </div>
            {isZhixuePage && (
              <div className="card-footer">
                <span className="badge badge-success">智学网页面已识别</span>
              </div>
            )}
          </div>

          {/* 评分标准 */}
          <div className="card">
            <div className="card-header">
              <FileText size={16} />
              <h3>评分标准</h3>
            </div>
            <div className="card-body">
              {standards.length === 0 ? (
                <div className="empty-tip">
                  <p>暂无评分标准</p>
                  <a href="#/standards">去创建</a>
                </div>
              ) : (
                <div className="standards-list">
                  {standards.map(s => (
                    <div
                      key={s.id}
                      className={`standard-item ${s.id === currentStandardId ? 'active' : ''}`}
                      onClick={() => !isRunning && setCurrentStandard(s.id)}
                    >
                      <div className="standard-name">{s.name}</div>
                      <div className="standard-meta">
                        {s.questionNumber && <span className="tag">{s.questionNumber}</span>}
                        <span>满分{s.totalScore}分</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 批改模式选择 */}
          <div className="card">
            <div className="card-header">
              <Zap size={16} />
              <h3>批改模式</h3>
            </div>
            <div className="card-body">
              <div className="mode-selector">
                {modeConfigs.map(mode => (
                  <div
                    key={mode.key}
                    className={`mode-card ${gradingMode === mode.key ? 'active' : ''}`}
                    onClick={() => !isRunning && setGradingMode(mode.key)}
                  >
                    <div className="mode-header">
                      <span className="mode-icon">{mode.icon}</span>
                      <span className="mode-name">{mode.name}</span>
                    </div>
                    <div className="mode-desc">{mode.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="action-area">
            {!isRunning ? (
              <button
                className="btn btn-primary btn-large"
                onClick={handleCapture}
                disabled={!browserConnected}
                style={{ width: '100%' }}
              >
                <Play size={20} />
                开始自动批改
              </button>
            ) : (
              <div className="btn-group">
                <button className="btn btn-secondary" onClick={handlePause}>
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  {isPaused ? '继续' : '暂停'}
                </button>
                <button className="btn btn-danger" onClick={handleStop}>
                  <Square size={16} />
                  停止
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 中间区域 - 主操作区 */}
        <div className="main-panel">
          {/* 答题图片预览 */}
          <div className="card preview-card">
            <div className="card-header">
              <Image size={16} />
              <h3>答题图片预览</h3>
            </div>
            <div className="card-body">
              {previewImage ? (
                <img src={previewImage} alt="答题预览" className="preview-img" />
              ) : (
                <div className="preview-placeholder">
                  <Image size={48} />
                  <p>答题图片将显示在这里</p>
                </div>
              )}
            </div>
          </div>

          {/* AI 评分结果展示 */}
          {isRunning && stats.currentScore > 0 && (
            <div className="ai-result">
              <div className="score-display">
                <div className="score-number">{stats.currentScore}</div>
                <div className="score-label">AI 评分</div>
              </div>
              {aiComment && (
                <div className="ai-comment">{aiComment}</div>
              )}
            </div>
          )}

          {/* 倒计时进度条（普通模式） */}
          {isRunning && gradingMode === 'normal' && countdown > 0 && (
            <div className="countdown-wrapper">
              <div className="countdown-header">
                <span className="countdown-text">
                  <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  自动提交倒计时
                </span>
                <span className="countdown-seconds">{countdown}s</span>
              </div>
              <div className="countdown-bar-bg">
                <div
                  className="countdown-bar"
                  style={{ width: `${(countdown / 5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 分数纠错面板（试改模式） */}
          {showCorrection && (
            <div className="correction-panel">
              <div className="correction-header">
                <h4>
                  <Pencil size={16} />
                  分数纠错
                </h4>
                <button className="btn-close" onClick={cancelCorrection}>
                  <X size={16} />
                </button>
              </div>
              {isAnalyzing ? (
                <div className="correction-analyzing">
                  <div className="spinner" />
                  <span>AI 正在分析评分差异原因，优化评分标准...</span>
                </div>
              ) : (
                <div className="correction-body">
                  <div className="correction-row">
                    <label>AI 评分</label>
                    <input
                      type="text"
                      value={`${stats.currentScore} 分`}
                      disabled
                    />
                  </div>
                  <div className="correction-row">
                    <label>正确分数</label>
                    <input
                      type="number"
                      value={correctionScore}
                      onChange={(e) => setCorrectionScore(e.target.value)}
                      placeholder="输入你认为正确的分数"
                      min={0}
                      max={currentStandard?.totalScore || 100}
                    />
                  </div>
                  <div className="correction-row">
                    <label>纠错原因</label>
                    <textarea
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="描述AI评分错误的原因（可选）"
                    />
                  </div>
                  <div className="correction-actions">
                    <button className="btn btn-secondary" onClick={cancelCorrection}>
                      <RotateCcw size={14} />
                      使用AI评分
                    </button>
                    <button className="btn btn-primary" onClick={submitCorrection}>
                      <Send size={14} />
                      提交纠错
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 试改模式确认按钮 */}
          {waitingConfirm && !showCorrection && (
            <div className="correction-panel">
              <div className="correction-header">
                <h4>
                  <UserCheck size={16} />
                  请确认AI评分
                </h4>
              </div>
              <div className="correction-body">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  AI 评分为 <strong style={{ color: '#60a5fa', fontSize: 18 }}>{stats.currentScore}</strong> 分，
                  请确认是否提交，或点击纠错修改分数。
                </div>
                <div className="correction-actions">
                  <button className="btn btn-secondary" onClick={() => setShowCorrection(true)}>
                    <Pencil size={14} />
                    分数纠错
                  </button>
                  <button className="btn btn-primary" onClick={confirmTrialSubmit}>
                    <CheckCircle size={14} />
                    确认提交
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 识别内容 */}
          {recognizedText && (
            <div className="card">
              <div className="card-header">
                <FileText size={16} />
                <h3>识别内容</h3>
              </div>
              <div className="card-body">
                <pre className="recognized-text">{recognizedText}</pre>
              </div>
            </div>
          )}
        </div>

        {/* 右侧面板 - 信息区 */}
        <div className="info-panel">
          {/* 统计数据 */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">已批改</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-value">{stats.blank}</div>
              <div className="stat-label">空白卷</div>
            </div>
            <div className="stat-card error">
              <div className="stat-value">{stats.failed}</div>
              <div className="stat-label">失败</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">已处理</div>
            </div>
          </div>

          {/* 当前分数 */}
          {stats.currentScore > 0 && (
            <div className="current-score">
              <span>当前得分</span>
              <strong>{stats.currentScore}</strong>
            </div>
          )}

          {/* 运行日志 */}
          <div className="card logs-card">
            <div className="card-header">
              <Clock size={14} />
              <h3>运行日志</h3>
              <button className="btn-clear" onClick={() => setLogs([])}>清空</button>
            </div>
            <div className="card-body">
              <div className="logs-list">
                {logs.length === 0 ? (
                  <div className="logs-empty">等待开始...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="log-item">{log}</div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
