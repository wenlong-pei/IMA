import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, 
  Filter, 
  Download, 
  Trash2,
  Eye,
  Calendar,
  Hash,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  FolderOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useRecordsStore } from '@/store/recordsStore'
import { useSound } from '@/hooks/useSound'
import dayjs from 'dayjs'
import './RecordsPage.scss'

export default function RecordsPage() {
  const { 
    records, 
    filters, 
    setFilters, 
    clearFilters, 
    getFilteredRecords, 
    getStatistics,
    deleteRecords 
  } = useRecordsStore()
  const { playClick, playSuccess } = useSound()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filteredRecords = useMemo(() => {
    let result = getFilteredRecords()
    if (searchText) {
      const search = searchText.toLowerCase()
      result = result.filter(r =>
        (r.studentName?.toLowerCase() ?? '').includes(search) ||
        (r.studentId?.toLowerCase() ?? '').includes(search) ||
        (r.standardName?.toLowerCase() ?? '').includes(search)
      )
    }
    return result
  }, [records, filters, searchText, getFilteredRecords])

  // 按评分标准分组
  const groupedRecords = useMemo(() => {
    const groups: Record<string, typeof filteredRecords> = {}
    filteredRecords.forEach(record => {
      const key = record.standardName || '未分类'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(record)
    })
    // 计算每组的统计信息
    return Object.entries(groups).map(([name, records]) => {
      const scores = records.filter(r => r.status === 'completed').map(r => r.score)
      const avgScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : 0
      return {
        name,
        records,
        count: records.length,
        avgScore,
      }
    })
  }, [filteredRecords])

  const statistics = getStatistics()

  // 获取唯一的题号列表
  const questionNumbers = useMemo(() => {
    const nums = new Set(records.map(r => r.questionNumber).filter(Boolean))
    return Array.from(nums) as string[]
  }, [records])

  // 选择记录
  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // 全选
  const _handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredRecords.map(r => r.id))
    }
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return
    playClick()
    if (confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) {
      deleteRecords(selectedIds)
      setSelectedIds([])
      toast.success('已删除')
      playSuccess()
    }
  }

  // 导出记录
  const handleExport = () => {
    playClick()
    // TODO: 实现导出功能
    toast.info('导出功能开发中...')
  }

  // 状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-success" />
      case 'failed':
        return <XCircle size={16} className="text-error" />
      default:
        return <Clock size={16} className="text-warning" />
    }
  }

  // 评价模式标签
  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'ai':
        return <span className="mode-tag mode-tag--ai">AI批改</span>
      case 'manual':
        return <span className="mode-tag mode-tag--manual">手动评分</span>
      default:
        return <span className="mode-tag mode-tag--hybrid">混合模式</span>
    }
  }

  return (
    <div className="records-page">
      <div className="records-page__header">
        <div>
          <h1 className="records-page__title">批改记录</h1>
          <p className="records-page__subtitle">查看和管理所有批改记录</p>
        </div>
        <div className="records-page__actions">
          <button className="btn btn--secondary" onClick={handleExport}>
            <Download size={18} />
            导出
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="records-page__stats">
        <div className="stat-card">
          <div className="stat-card__value">{statistics.total}</div>
          <div className="stat-card__label">总记录</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__value">{statistics.completed}</div>
          <div className="stat-card__label">已完成</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__value">{statistics.pending}</div>
          <div className="stat-card__label">待处理</div>
        </div>
        <div className="stat-card stat-card--error">
          <div className="stat-card__value">{statistics.failed}</div>
          <div className="stat-card__label">失败</div>
        </div>
        <div className="stat-card stat-card--primary">
          <div className="stat-card__value">{statistics.averageScore.toFixed(1)}</div>
          <div className="stat-card__label">平均分</div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="records-page__toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索学生姓名、学号或标准名称..."
          />
        </div>

        <button 
          className={`btn btn--secondary ${showFilters ? 'btn--active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} />
          筛选
        </button>

        {selectedIds.length > 0 && (
          <button className="btn btn--danger" onClick={handleBatchDelete}>
            <Trash2 size={18} />
            删除 ({selectedIds.length})
          </button>
        )}
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <motion.div 
          className="records-page__filters"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="filter-group">
            <label><Hash size={14} /> 题号</label>
            <select
              value={filters.questionNumber || ''}
              onChange={(e) => setFilters({ questionNumber: e.target.value || undefined })}
            >
              <option value="">全部</option>
              {questionNumbers.map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>评价模式</label>
            <select
              value={filters.evaluationMode || ''}
              onChange={(e) => setFilters({ evaluationMode: e.target.value as any || undefined })}
            >
              <option value="">全部</option>
              <option value="ai">AI批改</option>
              <option value="manual">手动评分</option>
              <option value="hybrid">混合模式</option>
            </select>
          </div>

          <div className="filter-group">
            <label>状态</label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ status: e.target.value as any || undefined })}
            >
              <option value="">全部</option>
              <option value="completed">已完成</option>
              <option value="pending">待处理</option>
              <option value="failed">失败</option>
            </select>
          </div>

          <button className="btn btn--link" onClick={() => { clearFilters(); setSearchText(''); }}>
            清除筛选
          </button>
        </motion.div>
      )}

      {/* 记录列表 - 按评分标准分组 */}
      <div className="records-page__groups">
        {groupedRecords.length === 0 ? (
          <div className="empty-row">
            <FileText size={32} />
            <p>暂无批改记录</p>
          </div>
        ) : (
          groupedRecords.map((group) => (
            <motion.div
              key={group.name}
              className="record-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="record-group__header">
                <div className="record-group__title">
                  <FolderOpen size={18} />
                  <h3>{group.name}</h3>
                </div>
                <div className="record-group__stats">
                  <span className="record-group__count">{group.count} 条记录</span>
                  <span className="record-group__avg">
                    平均分: <strong>{group.avgScore.toFixed(1)}</strong>
                  </span>
                </div>
              </div>
              <div className="record-group__table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input
                          type="checkbox"
                          checked={group.records.length > 0 && group.records.every(r => selectedIds.includes(r.id))}
                          onChange={() => {
                            const allSelected = group.records.every(r => selectedIds.includes(r.id))
                            if (allSelected) {
                              setSelectedIds(prev => prev.filter(id => !group.records.some(r => r.id === id)))
                            } else {
                              setSelectedIds(prev => [...prev, ...group.records.map(r => r.id)])
                            }
                          }}
                        />
                      </th>
                      <th className="col-date">时间</th>
                      <th className="col-num">题号</th>
                      <th>学生</th>
                      <th className="col-score">得分</th>
                      <th className="col-mode">模式</th>
                      <th className="col-status">状态</th>
                      <th className="col-actions">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.records.map((record) => (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={selectedIds.includes(record.id) ? 'selected' : ''}
                      >
                        <td className="col-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(record.id)}
                            onChange={() => handleSelect(record.id)}
                          />
                        </td>
                        <td className="col-date">
                          <Calendar size={14} />
                          {dayjs(record.createdAt).format('MM-DD HH:mm')}
                        </td>
                        <td className="col-num">
                          {record.questionNumber && (
                            <span className="num-tag">{record.questionNumber}</span>
                          )}
                        </td>
                        <td>{record.studentName || record.studentId || '-'}</td>
                        <td className="col-score">
                          <span className={`score ${record.isBlank ? 'score--blank' : ''}`}>
                            {record.score}/{record.maxScore}
                          </span>
                        </td>
                        <td className="col-mode">{getModeLabel(record.evaluationMode)}</td>
                        <td className="col-status">{getStatusIcon(record.status)}</td>
                        <td className="col-actions"></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
