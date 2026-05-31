import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Brain,
  Palette,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Key,
  Globe,
  Sliders,
  Scan,
  Zap,
  Trash2,
  Plus,
  Server,
  Thermometer,
  Hash,
  HelpCircle,
  BookOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSettingsStore } from '@/store/settingsStore'
import { useSound } from '@/hooks/useSound'
import type { AiProvider } from '@/types'
import UpdateChecker from '@/components/common/UpdateChecker'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { startIntroGuide, resetIntroGuide } from '@/components/common/IntroGuide'
import './SettingsPage.scss'

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, updateProvider, setActiveProvider, addProvider, removeProvider } = useSettingsStore()
  const { playSuccess, playClick } = useSound()

  const [activeTab, setActiveTab] = useState('general')
  const [hasChanges, setHasChanges] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ providerId: string; success: boolean; message: string } | null>(null)
  const providers = Array.isArray(settings.providers) ? settings.providers : []

  // 字体大小设置生效：将对应的 CSS 类应用到 documentElement
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large')
    const sizeClass = settings.fontSize === 'small' ? 'font-size-small'
      : settings.fontSize === 'large' ? 'font-size-large'
      : 'font-size-medium'
    root.classList.add(sizeClass)
    return () => {
      root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large')
    }
  }, [settings.fontSize])

  // 保存设置
  const handleSave = () => {
    playSuccess()
    toast.success('设置已保存')
    setHasChanges(false)
  }

  // 重置设置
  const handleReset = () => {
    playClick()
    if (confirm('确定要重置所有设置为默认值吗？')) {
      resetSettings()
      toast.success('设置已重置')
      playSuccess()
    }
  }

  // 更新设置
  const handleChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSettings({ [key]: value })
    setHasChanges(true)
  }

  // 测试服务商连接
  const handleTestConnection = async (provider: AiProvider) => {
    if (!provider.endpoint) {
      toast.error('请先填写 API 端点地址')
      return
    }
    if (!provider.apiKey) {
      toast.error('请先填写 API Key')
      return
    }

    setTestingProviderId(provider.id)
    setTestResult(null)

    try {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: '你好，这是一条测试消息' }],
          max_tokens: 5,
        }),
      })

      if (response.ok) {
        setTestResult({ providerId: provider.id, success: true, message: '连接成功' })
        toast.success(`${provider.name} 连接成功`)
        playSuccess()
      } else {
        const errorData = await response.json().catch(() => ({}))
        setTestResult({ 
          providerId: provider.id, 
          success: false, 
          message: `HTTP ${response.status}: ${errorData?.error?.message || response.statusText}` 
        })
        toast.error(`${provider.name} 连接失败`)
      }
    } catch (error: any) {
      setTestResult({ providerId: provider.id, success: false, message: error.message || '网络错误' })
      toast.error(`${provider.name} 连接失败`)
    } finally {
      setTestingProviderId(null)
    }
  }

  // 添加预设服务商
  const handleAddPresetProvider = (presetId: string) => {
    const presets: Record<string, Omit<AiProvider, 'id' | 'isActive'>> = {
      deepseek: {
        name: 'DeepSeek',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: '',
        model: 'deepseek-chat',
      },
      volcengine: {
        name: '火山引擎',
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiKey: '',
        model: '',
      },
      siliconflow: {
        name: '硅基流动',
        endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        apiKey: '',
        model: 'Qwen/Qwen2.5-7B-Instruct',
      },
    }

    const preset = presets[presetId]
    if (preset) {
      addProvider(preset)
      toast.success(`已添加 ${preset.name}`)
      playSuccess()
    }
  }

  // 添加自定义服务商
  const handleAddCustomProvider = () => {
    addProvider({
      name: '自定义服务商',
      endpoint: '',
      apiKey: '',
      model: '',
    })
    toast.success('已添加自定义服务商')
    playSuccess()
  }

  const tabs = [
    { id: 'general', label: '常规设置', icon: Sliders },
    { id: 'ocr', label: 'OCR设置', icon: Scan },
    { id: 'confirm', label: '二次确认', icon: Shield },
    { id: 'ai', label: 'AI设置', icon: Brain },
    { id: 'ui', label: '界面设置', icon: Palette },
    { id: 'help', label: '帮助', icon: HelpCircle },
  ]

  // 开始新手引导
  const handleStartIntro = () => {
    resetIntroGuide()
    setTimeout(() => {
      startIntroGuide()
    }, 100)
  }

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <div>
          <h1 className="settings-page__title">系统设置</h1>
          <p className="settings-page__subtitle">配置应用行为和偏好设置</p>
        </div>
        <div className="settings-page__actions">
          <button className="btn btn--secondary" onClick={handleReset}>
            <RotateCcw size={16} />
            重置
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!hasChanges}>
            <Save size={16} />
            保存
          </button>
        </div>
      </div>

      <div className="settings-page__body">
        {/* 侧边导航 */}
        <nav className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-nav__item ${activeTab === tab.id ? 'settings-nav__item--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* 设置内容 */}
        <ErrorBoundary fallback={
          <div className="settings-content">
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              <p>⚠️ 内容加载失败</p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                刷新页面
              </button>
            </div>
          </div>
        }>
        <div className="settings-content">
          {/* 常规设置 */}
          {activeTab === 'general' && (
            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2>常规设置</h2>
              
              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>自动保存间隔</h4>
                  <p>批改过程中自动保存的间隔时间（秒）</p>
                </div>
                <div className="setting-item__control">
                  <input
                    type="number"
                    value={settings.autoSaveInterval}
                    onChange={(e) => handleChange('autoSaveInterval', Number(e.target.value))}
                    min={10}
                    max={300}
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>批量处理数量</h4>
                  <p>单次批量批改的最大数量</p>
                </div>
                <div className="setting-item__control">
                  <input
                    type="number"
                    value={settings.batchSize}
                    onChange={(e) => handleChange('batchSize', Number(e.target.value))}
                    min={1}
                    max={50}
                  />
                </div>
              </div>

              {/* 软件更新 */}
              <UpdateChecker />

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>重试次数</h4>
                  <p>批改失败时的自动重试次数</p>
                </div>
                <div className="setting-item__control">
                  <input
                    type="number"
                    value={settings.retryAttempts}
                    onChange={(e) => handleChange('retryAttempts', Number(e.target.value))}
                    min={0}
                    max={10}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* OCR设置 */}
          {activeTab === 'ocr' && (
            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2>OCR文字识别设置</h2>
              <p className="section-desc">
                配置 PaddleOCR-VL-1.5 服务以识别答题内容。
              </p>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4><Scan size={14} /> 启用 PaddleOCR</h4>
                  <p>使用 PaddleOCR-VL-1.5 进行文字识别</p>
                </div>
                <div className="setting-item__control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.paddleOcrEnabled}
                      onChange={(e) => handleChange('paddleOcrEnabled', e.target.checked)}
                    />
                    <span className="toggle__slider">
                      {settings.paddleOcrEnabled ? <Check size={14} /> : null}
                    </span>
                  </label>
                </div>
              </div>

              {settings.paddleOcrEnabled && (
                <>
                  <div className="setting-item">
                    <div className="setting-item__info">
                      <h4><Key size={14} /> Access Token</h4>
                      <p>输入 PaddleOCR AI Studio 的 Access Token</p>
                    </div>
                    <div className="setting-item__control setting-item__control--wide">
                      <input
                        type="password"
                        value={settings.paddleOcrToken}
                        onChange={(e) => handleChange('paddleOcrToken', e.target.value)}
                        placeholder="输入 Access Token"
                        className="input-api"
                      />
                    </div>
                  </div>

                  <div className="setting-item">
                    <div className="setting-item__info">
                      <h4><Globe size={14} /> API 地址</h4>
                      <p>PaddleOCR 服务端点（默认已配置）</p>
                    </div>
                    <div className="setting-item__control setting-item__control--wide">
                      <input
                        type="text"
                        value={settings.paddleOcrUrl}
                        onChange={(e) => handleChange('paddleOcrUrl', e.target.value)}
                        placeholder="https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
                      />
                    </div>
                  </div>

                  <div className="setting-item">
                    <div className="setting-item__info">
                      <h4>OCR 模型</h4>
                      <p>选择 OCR 识别模型</p>
                    </div>
                    <div className="setting-item__control">
                      <select
                        value={settings.paddleOcrModel}
                        onChange={(e) => handleChange('paddleOcrModel', e.target.value)}
                      >
                        <option value="PaddleOCR-VL-1.5">PaddleOCR-VL-1.5（推荐）</option>
                        <option value="PaddleOCR-VL">PaddleOCR-VL</option>
                        <option value="OCR">PP-OCRv5</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-item">
                    <div className="setting-item__info">
                      <h4>任务超时时间</h4>
                      <p>OCR 任务最长等待时间（秒）</p>
                    </div>
                    <div className="setting-item__control">
                      <input
                        type="number"
                        value={settings.paddleOcrTimeout}
                        onChange={(e) => handleChange('paddleOcrTimeout', Number(e.target.value))}
                        min={30}
                        max={300}
                      />
                    </div>
                  </div>
                </>
              )}

              {!settings.paddleOcrToken && settings.paddleOcrEnabled && (
                <div className="api-warning">
                  <AlertCircle size={18} />
                  <p>请配置 Access Token 以启用 PaddleOCR 功能</p>
                </div>
              )}
            </motion.div>
          )}

          {/* 二次确认设置 */}
          {activeTab === 'confirm' && (
            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2>二次确认</h2>
              <p className="section-desc">
                部分改卷平台打分时需要二次确认，启用后可避免误操作。
              </p>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>打分前确认</h4>
                  <p>每次打分前弹出确认框，确认后才会提交</p>
                </div>
                <div className="setting-item__control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.confirmBeforeScore}
                      onChange={(e) => handleChange('confirmBeforeScore', e.target.checked)}
                    />
                    <span className="toggle__slider">
                      {settings.confirmBeforeScore ? <Check size={14} /> : null}
                    </span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>提交前确认</h4>
                  <p>批量提交前弹出确认框</p>
                </div>
                <div className="setting-item__control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.confirmBeforeSubmit}
                      onChange={(e) => handleChange('confirmBeforeSubmit', e.target.checked)}
                    />
                    <span className="toggle__slider">
                      {settings.confirmBeforeSubmit ? <Check size={14} /> : null}
                    </span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* AI设置 - 多服务商管理 */}
          {activeTab === 'ai' && (
            <div className="settings-section">
              <h2>AI 服务商设置</h2>
              <p className="section-desc">
                配置多个 AI 服务商，支持快速切换。点击服务商卡片可设为当前活跃服务商。
              </p>

              {/* 全局参数 */}
              <div className="ai-global-params">
                <div className="ai-global-param">
                  <div className="ai-global-param__info">
                    <Thermometer size={16} />
                    <span>温度</span>
                  </div>
                  <div className="ai-global-param__control">
                    <input
                      type="range"
                      value={settings.temperature}
                      onChange={(e) => handleChange('temperature', Number(e.target.value))}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                    <span className="param-value">{settings.temperature}</span>
                  </div>
                </div>
                <div className="ai-global-param">
                  <div className="ai-global-param__info">
                    <Hash size={16} />
                    <span>最大 Token</span>
                  </div>
                  <div className="ai-global-param__control">
                    <input
                      type="number"
                      value={settings.maxTokens}
                      onChange={(e) => handleChange('maxTokens', Number(e.target.value))}
                      min={50}
                      max={8000}
                    />
                  </div>
                </div>
              </div>

              {/* 服务商列表 */}
              <div className="provider-list">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className={`provider-card ${provider.isActive ? 'provider-card--active' : ''}`}
                    onClick={() => {
                      if (!provider.isActive) {
                        setActiveProvider(provider.id)
                        setHasChanges(true)
                        playClick()
                      }
                    }}
                  >
                    <div className="provider-card__header">
                      <div className="provider-card__title">
                        <Server size={18} />
                        <h4>{provider.name}</h4>
                        {provider.isActive && (
                          <span className="provider-card__badge">
                            <Zap size={12} />
                            当前使用
                          </span>
                        )}
                      </div>
                      <div className="provider-card__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={() => handleTestConnection(provider)}
                          disabled={testingProviderId === provider.id}
                        >
                          {testingProviderId === provider.id ? (
                            <span className="animate-spin">...</span>
                          ) : (
                            <Zap size={14} />
                          )}
                          测试连接
                        </button>
                        {provider.id !== 'deepseek' && provider.id !== 'volcengine' && provider.id !== 'siliconflow' && provider.id !== 'custom' && (
                          <button
                            className="btn-icon btn-icon--danger"
                            onClick={() => {
                              if (confirm(`确定要删除 ${provider.name} 吗？`)) {
                                removeProvider(provider.id)
                                toast.success('已删除')
                                playSuccess()
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 测试结果 */}
                    {testResult && testResult.providerId === provider.id && (
                      <div className={`provider-card__test-result ${testResult.success ? 'success' : 'error'}`}>
                        {testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                        <span>{testResult.message}</span>
                      </div>
                    )}

                    <div className="provider-card__body" onClick={(e) => e.stopPropagation()}>
                      <div className="provider-field">
                        <label><Globe size={14} /> API 端点</label>
                        <input
                          type="text"
                          value={provider.endpoint}
                          onChange={(e) => {
                            updateProvider(provider.id, { endpoint: e.target.value })
                            setHasChanges(true)
                          }}
                          placeholder="https://api.example.com/v1/chat/completions"
                          className="input-api"
                        />
                      </div>
                      <div className="provider-field">
                        <label><Key size={14} /> API Key</label>
                        <input
                          type="password"
                          value={provider.apiKey}
                          onChange={(e) => {
                            updateProvider(provider.id, { apiKey: e.target.value })
                            setHasChanges(true)
                          }}
                          placeholder="sk-..."
                          className="input-api"
                        />
                      </div>
                      <div className="provider-field">
                        <label><Brain size={14} /> 模型</label>
                        <input
                          type="text"
                          value={provider.model}
                          onChange={(e) => {
                            updateProvider(provider.id, { model: e.target.value })
                            setHasChanges(true)
                          }}
                          placeholder="模型名称"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 新增服务商 */}
              <div className="provider-add">
                <span className="provider-add__label">添加服务商：</span>
                <div className="provider-add__buttons">
                  <button className="btn btn--sm btn--secondary" onClick={() => handleAddPresetProvider('deepseek')}>
                    <Plus size={14} />
                    DeepSeek
                  </button>
                  <button className="btn btn--sm btn--secondary" onClick={() => handleAddPresetProvider('volcengine')}>
                    <Plus size={14} />
                    火山引擎
                  </button>
                  <button className="btn btn--sm btn--secondary" onClick={() => handleAddPresetProvider('siliconflow')}>
                    <Plus size={14} />
                    硅基流动
                  </button>
                  <button className="btn btn--sm btn--primary" onClick={handleAddCustomProvider}>
                    <Plus size={14} />
                    自定义
                  </button>
                </div>
              </div>

              {/* 警告 */}
              {providers.length === 0 && (
                <div className="api-warning">
                  <AlertCircle size={18} />
                  <p>AI 服务商配置缺失，请添加一个服务商后继续使用 AI 批改功能</p>
                </div>
              )}

              {providers.length > 0 && !providers.some(p => p.isActive && p.apiKey) && (
                <div className="api-warning">
                  <AlertCircle size={18} />
                  <p>请为当前活跃服务商配置 API Key 以启用 AI 批改功能</p>
                </div>
              )}
            </div>
          )}

          {/* 界面设置 */}
          {activeTab === 'ui' && (
            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2>界面设置</h2>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>主题</h4>
                  <p>选择应用主题外观</p>
                </div>
                <div className="setting-item__control">
                  <select
                    value={settings.theme}
                    onChange={(e) => handleChange('theme', e.target.value as any)}
                  >
                    <option value="light">浅色模式</option>
                    <option value="dark">深色模式</option>
                    <option value="system">跟随系统</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>字体大小</h4>
                  <p>调整界面字体大小</p>
                </div>
                <div className="setting-item__control">
                  <select
                    value={settings.fontSize}
                    onChange={(e) => handleChange('fontSize', e.target.value as any)}
                  >
                    <option value="small">小</option>
                    <option value="medium">中</option>
                    <option value="large">大</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4>在图片上显示分数</h4>
                  <p>批改后在图片上直接标注分数</p>
                </div>
                <div className="setting-item__control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.showScoreOnImage}
                      onChange={(e) => handleChange('showScoreOnImage', e.target.checked)}
                    />
                    <span className="toggle__slider">
                      {settings.showScoreOnImage ? <Check size={14} /> : null}
                    </span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* 帮助 */}
          {activeTab === 'help' && (
            <motion.div
              className="settings-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2>帮助与教程</h2>
              <p className="section-desc">
                了解如何使用皮老板智能阅卷工具。
              </p>

              <div className="setting-item">
                <div className="setting-item__info">
                  <h4><BookOpen size={14} /> 新手引导</h4>
                  <p>重新观看功能介绍和操作指南</p>
                </div>
                <div className="setting-item__control">
                  <button className="btn btn--primary" onClick={handleStartIntro}>
                    开始引导
                  </button>
                </div>
              </div>

              <div className="help-cards">
                <div className="help-card">
                  <h4>快速开始</h4>
                  <ol>
                    <li>在"评分标准"页面创建或导入评分标准</li>
                    <li>返回自动批改页面，输入智学网链接</li>
                    <li>选择一个评分标准和批改模式</li>
                    <li>点击"开始自动批改"</li>
                  </ol>
                </div>

                <div className="help-card">
                  <h4>批改模式说明</h4>
                  <ul>
                    <li><strong>普通模式：</strong>AI评分后等待5秒，期间可暂停或取消</li>
                    <li><strong>试改模式：</strong>AI评分后等待确认，支持分数纠错</li>
                    <li><strong>无人值守：</strong>全自动批改，适合大量作业</li>
                  </ul>
                </div>

                <div className="help-card">
                  <h4>OCR与AI</h4>
                  <ul>
                    <li>PaddleOCR用于识别答题图片中的文字</li>
                    <li>DeepSeek/火山引擎等AI用于智能评分</li>
                    <li>请在AI设置中配置API Key以启用AI评分</li>
                  </ul>
                </div>

                <div className="help-card">
                  <h4>常见问题</h4>
                  <details>
                    <summary>提示"未找到可用的浏览器"怎么办？</summary>
                    <p>请确保已安装Chrome或Edge浏览器，或运行 <code>npx playwright install chromium</code></p>
                  </details>
                  <details>
                    <summary>OCR识别失败？</summary>
                    <p>请在设置中配置PaddleOCR的Access Token，或使用AI Studio服务</p>
                  </details>
                  <details>
                    <summary>AI评分不准确？</summary>
                    <p>使用试改模式进行纠错，AI会自动优化评分标准</p>
                  </details>
                </div>
              </div>
            </motion.div>
          )}
        </div>
        </ErrorBoundary>
      </div>
    </div>
  )
}
