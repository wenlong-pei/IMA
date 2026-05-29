import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Send,
  AlertCircle,
  Type,
  Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSettingsStore } from '@/store/settingsStore'
import './ApiTestPage.scss'

const api = typeof window !== 'undefined' && (window as any).electronAPI

export default function ApiTestPage() {
  // OCR 测试状态
  const [ocrImage, setOcrImage] = useState<string | null>(null)
  const [ocrImageName, setOcrImageName] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [ocrSuccess, setOcrSuccess] = useState<boolean | null>(null)
  const ocrFileRef = useRef<HTMLInputElement>(null)

  // DeepSeek 测试状态
  const [dsTestPrompt, setDsTestPrompt] = useState('请用一句话介绍你自己')
  const [dsResponse, setDsResponse] = useState('')
  const [dsLoading, setDsLoading] = useState(false)
  const [dsError, setDsError] = useState('')
  const [dsSuccess, setDsSuccess] = useState<boolean | null>(null)
  const [dsTime, setDsTime] = useState(0)

  // OCR 测试
  const handleOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }

    setOcrImageName(file.name)
    setOcrResult('')
    setOcrError('')
    setOcrSuccess(null)

    const reader = new FileReader()
    reader.onload = () => {
      setOcrImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleOcrTest = async () => {
    if (!ocrImage) {
      toast.error('请先上传图片')
      return
    }

    setOcrLoading(true)
    setOcrResult('')
    setOcrError('')
    setOcrSuccess(null)

    try {
      const result = await api.invoke('bot:recognize', ocrImage)
      
      if (result.error) {
        setOcrError(result.error)
        setOcrSuccess(false)
      } else if (result.text) {
        setOcrResult(result.text)
        setOcrSuccess(true)
        toast.success('OCR 识别成功')
      } else {
        setOcrError('未识别到文字内容')
        setOcrSuccess(false)
      }
    } catch (error: any) {
      setOcrError(String(error))
      setOcrSuccess(false)
      toast.error('OCR 测试失败')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleOcrClear = () => {
    setOcrImage(null)
    setOcrImageName('')
    setOcrResult('')
    setOcrError('')
    setOcrSuccess(null)
    if (ocrFileRef.current) ocrFileRef.current.value = ''
  }

  // DeepSeek 测试
  const handleDsTest = async () => {
    if (!dsTestPrompt.trim()) {
      toast.error('请输入测试内容')
      return
    }

    setDsLoading(true)
    setDsResponse('')
    setDsError('')
    setDsSuccess(null)
    setDsTime(0)

    const startTime = Date.now()

    try {
      const settings = useSettingsStore.getState().settings
      const activeProvider = settings.providers.find(p => p.id === settings.activeProviderId) || settings.providers[0]
      
      if (!activeProvider || !activeProvider.apiKey) {
        setDsError('未配置活跃服务商的 API Key，请先在设置中填写')
        setDsSuccess(false)
        setDsLoading(false)
        return
      }

      const endpoint = activeProvider.endpoint || 'https://api.deepseek.com/v1/chat/completions'
      const model = activeProvider.model || 'deepseek-chat'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeProvider.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是一个有帮助的助手。' },
            { role: 'user', content: dsTestPrompt },
          ],
          temperature: settings.temperature || 0.7,
          max_tokens: 200,
        }),
      })

      const elapsed = Date.now() - startTime
      setDsTime(elapsed)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      if (content) {
        setDsResponse(content)
        setDsSuccess(true)
        toast.success(`API 调用成功 (${(elapsed / 1000).toFixed(1)}s)`)
      } else {
        setDsError('API 返回了空内容')
        setDsSuccess(false)
      }
    } catch (error: any) {
      setDsError(String(error))
      setDsSuccess(false)
      setDsTime(Date.now() - startTime)
      toast.error('DeepSeek API 测试失败')
    } finally {
      setDsLoading(false)
    }
  }

  return (
    <div className="api-test-page">
      <div className="page-header">
        <h1>
          <Bot size={28} />
          API 测试
        </h1>
        <p>测试 OCR 和 DeepSeek API 是否正常工作</p>
      </div>

      <div className="test-grid">
        {/* OCR 测试卡片 */}
        <motion.div
          className="test-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="test-card__header">
            <div className="test-card__title">
              <Eye size={20} />
              <h2>OCR 文字识别测试</h2>
            </div>
            <span className="test-card__badge">PaddleOCR-VL-1.5</span>
          </div>

          <div className="test-card__body">
            {/* 上传区域 */}
            <div className="upload-area">
              {ocrImage ? (
                <div className="upload-preview">
                  <img src={ocrImage} alt="preview" />
                  <div className="upload-preview__info">
                    <span>{ocrImageName}</span>
                    <button onClick={handleOcrClear} className="btn-icon" title="清除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="upload-placeholder">
                  <Upload size={32} />
                  <span>点击或拖拽上传图片</span>
                  <small>支持 JPG、PNG、BMP 格式</small>
                  <input
                    ref={ocrFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleOcrUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            {/* 测试按钮 */}
            <button
              className="btn btn-primary btn-block"
              onClick={handleOcrTest}
              disabled={!ocrImage || ocrLoading}
            >
              {ocrLoading ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
              {ocrLoading ? '识别中...' : '开始识别'}
            </button>

            {/* 结果区域 */}
            {(ocrResult || ocrError || ocrSuccess !== null) && (
              <motion.div
                className={`test-result ${ocrSuccess ? 'success' : ocrSuccess === false ? 'error' : ''}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <div className="test-result__header">
                  {ocrSuccess === true && <CheckCircle size={16} />}
                  {ocrSuccess === false && <XCircle size={16} />}
                  <span>{ocrSuccess ? '识别成功' : '识别失败'}</span>
                </div>
                {ocrResult && (
                  <div className="test-result__content">
                    <FileText size={14} />
                    <p>{ocrResult}</p>
                  </div>
                )}
                {ocrError && (
                  <div className="test-result__error">
                    <AlertCircle size={14} />
                    <p>{ocrError}</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* DeepSeek 测试卡片 */}
        <motion.div
          className="test-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="test-card__header">
            <div className="test-card__title">
              <Bot size={20} />
              <h2>DeepSeek API 测试</h2>
            </div>
            <span className="test-card__badge">Chat Completions</span>
          </div>

          <div className="test-card__body">
            {/* 输入区域 */}
            <div className="input-group">
              <label>
                <Type size={14} />
                测试提示词
              </label>
              <textarea
                value={dsTestPrompt}
                onChange={(e) => setDsTestPrompt(e.target.value)}
                placeholder="输入测试内容..."
                rows={3}
                disabled={dsLoading}
              />
            </div>

            {/* 测试按钮 */}
            <button
              className="btn btn-primary btn-block"
              onClick={handleDsTest}
              disabled={!dsTestPrompt.trim() || dsLoading}
            >
              {dsLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              {dsLoading ? '调用中...' : '发送测试'}
            </button>

            {/* 响应时间 */}
            {dsTime > 0 && (
              <div className="response-time">
                响应时间：{(dsTime / 1000).toFixed(2)}s
              </div>
            )}

            {/* 结果区域 */}
            {(dsResponse || dsError || dsSuccess !== null) && (
              <motion.div
                className={`test-result ${dsSuccess ? 'success' : dsSuccess === false ? 'error' : ''}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <div className="test-result__header">
                  {dsSuccess === true && <CheckCircle size={16} />}
                  {dsSuccess === false && <XCircle size={16} />}
                  <span>{dsSuccess ? '调用成功' : '调用失败'}</span>
                </div>
                {dsResponse && (
                  <div className="test-result__content">
                    <Bot size={14} />
                    <p>{dsResponse}</p>
                  </div>
                )}
                {dsError && (
                  <div className="test-result__error">
                    <AlertCircle size={14} />
                    <p>{dsError}</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
