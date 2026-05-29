import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  ChevronDown,
  ChevronRight,
  Save,
  X,
  BookOpen,
  ListChecks,
  Hash
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useStandardsStore } from '@/store/standardsStore'
import { useSound } from '@/hooks/useSound'
import type { GradingStandard, ScoringRule } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import './StandardsPage.scss'

export default function StandardsPage() {
  const { 
    standards, 
    presetSets,
    currentPresetId,
    addStandard, 
    updateStandard, 
    deleteStandard, 
    duplicateStandard,
    switchPresetSet,
    setCurrentStandard 
  } = useStandardsStore()
  const { playSuccess, playClick, playError } = useSound()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<GradingStandard>>({})

  // 开始创建新标准
  const handleCreate = () => {
    playClick()
    setIsCreating(true)
    setFormData({
      name: '',
      questionNumber: '',
      totalScore: 10,
      referenceAnswer: '',
      keywords: [],
      scoringRules: [],
      examples: [],
    })
  }

  // 保存标准
  const handleSave = () => {
    if (!formData.name || !formData.totalScore) {
      toast.error('请填写完整信息')
      playError()
      return
    }

    if (isCreating) {
      const id = addStandard(formData as Omit<GradingStandard, 'id' | 'createdAt' | 'updatedAt'>)
      setCurrentStandard(id)
      toast.success('评分标准创建成功')
    } else if (editingId) {
      updateStandard(editingId, formData)
      toast.success('评分标准更新成功')
    }

    playSuccess()
    setIsCreating(false)
    setEditingId(null)
    setFormData({})
  }

  // 取消编辑
  const handleCancel = () => {
    playClick()
    setIsCreating(false)
    setEditingId(null)
    setFormData({})
  }

  // 编辑标准
  const handleEdit = (standard: GradingStandard) => {
    playClick()
    setEditingId(standard.id)
    setFormData(standard)
  }

  // 删除标准
  const handleDelete = (id: string) => {
    playClick()
    if (confirm('确定要删除这个评分标准吗？')) {
      deleteStandard(id)
      toast.success('已删除')
      playSuccess()
    }
  }

  // 复制标准
  const handleDuplicate = (id: string) => {
    playClick()
    const newId = duplicateStandard(id)
    if (newId) {
      toast.success('已创建副本')
      playSuccess()
    }
  }

  // 切换预设套
  const handleSwitchPreset = (presetId: string) => {
    playClick()
    switchPresetSet(presetId)
    toast.success('已切换预设套')
    playSuccess()
  }

  // 添加评分规则
  const handleAddRule = () => {
    const newRule: ScoringRule = {
      id: uuidv4(),
      description: '',
      score: 0,
      type: 'positive',
    }
    setFormData(prev => ({
      ...prev,
      scoringRules: [...(prev.scoringRules || []), newRule],
    }))
  }

  return (
    <div className="standards-page">
      <div className="standards-page__header">
        <div>
          <h1 className="standards-page__title">评分标准</h1>
          <p className="standards-page__subtitle">创建和管理评分标准，支持预设套快速切换</p>
        </div>
        <button className="btn btn--primary" onClick={handleCreate}>
          <Plus size={18} />
          新建标准
        </button>
      </div>

      {/* 预设套选择 */}
      {presetSets.length > 0 && (
        <div className="standards-page__presets">
          <h3>预设套</h3>
          <div className="preset-tabs">
            {presetSets.map((preset) => (
              <button
                key={preset.id}
                className={`preset-tab ${preset.id === currentPresetId ? 'preset-tab--active' : ''}`}
                onClick={() => handleSwitchPreset(preset.id)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 编辑/创建表单 */}
      {(isCreating || editingId) && (
        <motion.div 
          className="standards-page__editor"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="editor-header">
            <h3>{isCreating ? '创建新标准' : '编辑标准'}</h3>
            <div className="editor-actions">
              <button className="btn btn--secondary btn--sm" onClick={handleCancel}>
                <X size={16} />
                取消
              </button>
              <button className="btn btn--primary btn--sm" onClick={handleSave}>
                <Save size={16} />
                保存
              </button>
            </div>
          </div>

          <div className="editor-body">
            <div className="editor-row">
              <div className="editor-field editor-field--lg">
                <label>标准名称 *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="如：现代文阅读理解"
                />
              </div>
              <div className="editor-field">
                <label><Hash size={14} /> 题号（选填）</label>
                <input
                  type="text"
                  value={formData.questionNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, questionNumber: e.target.value }))}
                  placeholder="如：第5题"
                />
              </div>
              <div className="editor-field">
                <label>满分 *</label>
                <input
                  type="number"
                  value={formData.totalScore || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalScore: Number(e.target.value) }))}
                  min={1}
                />
              </div>
            </div>

            <div className="editor-field">
              <label><BookOpen size={14} /> 参考答案</label>
              <textarea
                value={formData.referenceAnswer || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, referenceAnswer: e.target.value }))}
                placeholder="输入标准答案..."
                rows={4}
              />
            </div>

            <div className="editor-field">
              <label>关键词（用逗号分隔）</label>
              <input
                type="text"
                value={formData.keywords?.join(', ') || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                }))}
                placeholder="如：比喻, 生动形象, 情感表达"
              />
            </div>

            <div className="editor-field">
              <label><ListChecks size={14} /> 评分细则</label>
              <div className="scoring-rules">
                {(formData.scoringRules || []).map((rule, index) => (
                  <div key={rule.id} className="scoring-rule">
                    <select
                      value={rule.type}
                      onChange={(e) => {
                        const newRules = [...(formData.scoringRules || [])]
                        newRules[index].type = e.target.value as 'positive' | 'negative'
                        setFormData(prev => ({ ...prev, scoringRules: newRules }))
                      }}
                    >
                      <option value="positive">加分</option>
                      <option value="negative">扣分</option>
                    </select>
                    <input
                      type="text"
                      value={rule.description}
                      onChange={(e) => {
                        const newRules = [...(formData.scoringRules || [])]
                        newRules[index].description = e.target.value
                        setFormData(prev => ({ ...prev, scoringRules: newRules }))
                      }}
                      placeholder="评分描述"
                    />
                    <input
                      type="number"
                      value={rule.score}
                      onChange={(e) => {
                        const newRules = [...(formData.scoringRules || [])]
                        newRules[index].score = Number(e.target.value)
                        setFormData(prev => ({ ...prev, scoringRules: newRules }))
                      }}
                      placeholder="分数"
                    />
                    <button 
                      className="btn-icon"
                      onClick={() => {
                        const newRules = formData.scoringRules?.filter((_, i) => i !== index)
                        setFormData(prev => ({ ...prev, scoringRules: newRules }))
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button className="btn btn--secondary btn--sm" onClick={handleAddRule}>
                  <Plus size={14} />
                  添加规则
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 标准列表 */}
      <div className="standards-page__list">
        {standards.length === 0 ? (
          <div className="standards-page__empty">
            <BookOpen size={48} />
            <p>暂无评分标准</p>
            <span>点击上方"新建标准"按钮创建</span>
          </div>
        ) : (
          standards.map((standard) => (
            <motion.div
              key={standard.id}
              className="standard-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div 
                className="standard-card__header"
                onClick={() => setExpandedId(expandedId === standard.id ? null : standard.id)}
              >
                <div className="standard-card__info">
                  <h4>{standard.name}</h4>
                  <div className="standard-card__meta">
                    {standard.questionNumber && (
                      <span className="tag tag--primary">{standard.questionNumber}</span>
                    )}
                    <span className="tag tag--success">满分{standard.totalScore}分</span>
                  </div>
                </div>
                <div className="standard-card__toggle">
                  {expandedId === standard.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </div>

              {expandedId === standard.id && (
                <div className="standard-card__body">
                  <div className="standard-card__section">
                    <h5>参考答案</h5>
                    <p>{standard.referenceAnswer || '未填写'}</p>
                  </div>

                  {standard.keywords.length > 0 && (
                    <div className="standard-card__section">
                      <h5>关键词</h5>
                      <div className="keywords">
                        {standard.keywords.map((keyword, i) => (
                          <span key={i} className="keyword">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {standard.scoringRules.length > 0 && (
                    <div className="standard-card__section">
                      <h5>评分细则</h5>
                      <ul className="rules-list">
                        {standard.scoringRules.map((rule) => (
                          <li key={rule.id}>
                            <span className={rule.type === 'positive' ? 'text-success' : 'text-error'}>
                              {rule.type === 'positive' ? '+' : '-'}{Math.abs(rule.score)}分
                            </span>
                            {rule.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="standard-card__actions">
                <button className="btn-icon" onClick={() => handleEdit(standard)} title="编辑">
                  <Edit3 size={16} />
                </button>
                <button className="btn-icon" onClick={() => handleDuplicate(standard.id)} title="复制">
                  <Copy size={16} />
                </button>
                <button className="btn-icon btn-icon--danger" onClick={() => handleDelete(standard.id)} title="删除">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
