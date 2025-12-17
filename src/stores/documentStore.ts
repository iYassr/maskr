import { create } from 'zustand'
import type { FileData, Detection, EntityMapping, ScanStats, DetectionCategory } from '../types'

// Maximum history size for undo/redo
const MAX_HISTORY_SIZE = 50

interface DocumentState {
  // File data
  file: FileData | null
  setFile: (file: FileData | null) => void

  // Document content
  content: string
  setContent: (content: string) => void

  // Detections
  detections: Detection[]
  setDetections: (detections: Detection[]) => void
  toggleDetection: (id: string) => void
  approveAll: () => void
  rejectAll: () => void
  approveCategory: (category: DetectionCategory) => void
  rejectCategory: (category: DetectionCategory) => void
  toggleCategoryDetections: (category: DetectionCategory, approved: boolean) => void

  // Undo/Redo history
  history: Detection[][]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  // Masked content
  maskedContent: string
  setMaskedContent: (content: string) => void

  // Entity mappings
  mappings: EntityMapping[]
  setMappings: (mappings: EntityMapping[]) => void

  // Stats
  stats: ScanStats | null
  setStats: (stats: ScanStats | null) => void

  // Processing state
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void

  // Reset
  reset: () => void
}

const initialState = {
  file: null,
  content: '',
  detections: [] as Detection[],
  maskedContent: '',
  mappings: [] as EntityMapping[],
  stats: null as ScanStats | null,
  isProcessing: false,
  history: [] as Detection[][],
  historyIndex: -1,
  canUndo: false,
  canRedo: false
}

// Helper to push state to history
function pushToHistory(state: DocumentState, newDetections: Detection[]) {
  try {
    // Ensure state.history is an array
    const currentHistory = Array.isArray(state.history) ? state.history : []
    // Ensure historyIndex is a valid number
    const currentIndex = typeof state.historyIndex === 'number' && Number.isFinite(state.historyIndex)
      ? Math.max(-1, state.historyIndex)
      : -1

    // Calculate safe slice end
    const sliceEnd = Math.max(0, currentIndex + 1)
    const newHistory = currentHistory.slice(0, sliceEnd)

    // Ensure newDetections is an array
    const safeDetections = Array.isArray(newDetections) ? newDetections : []
    newHistory.push(safeDetections)

    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift()
    }

    return {
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: newHistory.length > 1,
      canRedo: false
    }
  } catch (err) {
    console.error('pushToHistory error:', err)
    return {
      history: [Array.isArray(newDetections) ? newDetections : []],
      historyIndex: 0,
      canUndo: false,
      canRedo: false
    }
  }
}

export const useDocumentStore = create<DocumentState>((set) => ({
  ...initialState,

  setFile: (file) => set({ file }),

  setContent: (content) => set({ content }),

  setDetections: (detections) => set((state) => ({
    detections,
    ...pushToHistory(state, detections)
  })),

  toggleDetection: (id) =>
    set((state) => {
      const newDetections = state.detections.map((d) =>
        d.id === id ? { ...d, approved: !d.approved } : d
      )
      return {
        detections: newDetections,
        ...pushToHistory(state, newDetections)
      }
    }),

  approveAll: () =>
    set((state) => {
      const newDetections = state.detections.map((d) => ({ ...d, approved: true }))
      return {
        detections: newDetections,
        ...pushToHistory(state, newDetections)
      }
    }),

  rejectAll: () =>
    set((state) => {
      const newDetections = state.detections.map((d) => ({ ...d, approved: false }))
      return {
        detections: newDetections,
        ...pushToHistory(state, newDetections)
      }
    }),

  approveCategory: (category) =>
    set((state) => {
      const newDetections = state.detections.map((d) =>
        d.category === category ? { ...d, approved: true } : d
      )
      return {
        detections: newDetections,
        ...pushToHistory(state, newDetections)
      }
    }),

  rejectCategory: (category) =>
    set((state) => {
      const newDetections = state.detections.map((d) =>
        d.category === category ? { ...d, approved: false } : d
      )
      return {
        detections: newDetections,
        ...pushToHistory(state, newDetections)
      }
    }),

  toggleCategoryDetections: (category, approved) =>
    set((state) => {
      const newDetections = state.detections.map((d) =>
        d.category === category ? { ...d, approved } : d
      )
      return {
        detections: newDetections,
        ...pushToHistory(state, newDetections)
      }
    }),

  undo: () =>
    set((state) => {
      if (!state.canUndo || state.historyIndex <= 0) return state
      const newIndex = state.historyIndex - 1
      return {
        detections: state.history[newIndex],
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: true
      }
    }),

  redo: () =>
    set((state) => {
      if (!state.canRedo || state.historyIndex >= state.history.length - 1) return state
      const newIndex = state.historyIndex + 1
      return {
        detections: state.history[newIndex],
        historyIndex: newIndex,
        canUndo: true,
        canRedo: newIndex < state.history.length - 1
      }
    }),

  setMaskedContent: (maskedContent) => set({ maskedContent }),

  setMappings: (mappings) => set({ mappings }),

  setStats: (stats) => set({ stats }),

  setIsProcessing: (isProcessing) => set({ isProcessing }),

  reset: () => set(initialState)
}))
