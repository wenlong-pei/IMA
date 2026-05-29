import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { GradingStandard, PresetSet } from '@/types'

interface StandardsState {
  standards: GradingStandard[]
  presetSets: PresetSet[]
  currentPresetId: string | null
  currentStandardId: string | null
  
  // 标准操作
  addStandard: (standard: Omit<GradingStandard, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateStandard: (id: string, updates: Partial<GradingStandard>) => void
  deleteStandard: (id: string) => void
  duplicateStandard: (id: string) => string | null
  
  // 预设套操作
  addPresetSet: (preset: Omit<PresetSet, 'id'>) => string
  updatePresetSet: (id: string, updates: Partial<PresetSet>) => void
  deletePresetSet: (id: string) => void
  switchPresetSet: (id: string) => void
  
  // 当前选择
  setCurrentStandard: (id: string | null) => void
  getCurrentStandard: () => GradingStandard | null
}

export const useStandardsStore = create<StandardsState>()(
  persist(
    (set, get) => ({
      standards: [],
      presetSets: [],
      currentPresetId: null,
      currentStandardId: null,

      addStandard: (standard) => {
        const id = uuidv4()
        const now = new Date().toISOString()
        set((state) => ({
          standards: [
            ...state.standards,
            { ...standard, id, createdAt: now, updatedAt: now },
          ],
        }))
        return id
      },

      updateStandard: (id, updates) => {
        set((state) => ({
          standards: state.standards.map((s) =>
            s.id === id
              ? { ...s, ...updates, updatedAt: new Date().toISOString() }
              : s
          ),
        }))
      },

      deleteStandard: (id) => {
        set((state) => ({
          standards: state.standards.filter((s) => s.id !== id),
        }))
      },

      duplicateStandard: (id) => {
        const standard = get().standards.find((s) => s.id === id)
        if (!standard) return null
        const newId = uuidv4()
        const now = new Date().toISOString()
        set((state) => ({
          standards: [
            ...state.standards,
            {
              ...standard,
              id: newId,
              name: `${standard.name} (副本)`,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }))
        return newId
      },

      addPresetSet: (preset) => {
        const id = uuidv4()
        set((state) => ({
          presetSets: [...state.presetSets, { ...preset, id }],
        }))
        return id
      },

      updatePresetSet: (id, updates) => {
        set((state) => ({
          presetSets: state.presetSets.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }))
      },

      deletePresetSet: (id) => {
        set((state) => ({
          presetSets: state.presetSets.filter((p) => p.id !== id),
        }))
      },

      switchPresetSet: (id) => {
        const preset = get().presetSets.find((p) => p.id === id)
        if (preset) {
          set({
            currentPresetId: id,
            standards: preset.standards,
          })
        }
      },

      setCurrentStandard: (id) => {
        set({ currentStandardId: id })
      },

      getCurrentStandard: () => {
        const { standards, currentStandardId } = get()
        return standards.find((s) => s.id === currentStandardId) || null
      },
    }),
    {
      name: 'grading-standards',
    }
  )
)
