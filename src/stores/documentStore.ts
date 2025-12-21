/**
 * @fileoverview Document State Store
 *
 * This Zustand store manages the current document being processed:
 * - File data and content
 * - Detected entities (with approval state)
 * - Masked content output
 * - Undo/redo history for detection changes
 * - Processing state
 *
 * Unlike configStore, this is NOT persisted - it resets on app restart.
 * The pastedText field is preserved during navigation within a session.
 *
 * @module src/stores/documentStore
 */

import { create } from 'zustand'
import type { FileData, Detection, EntityMapping, ScanStats, DetectionCategory } from '../types'

/** Maximum number of undo states to keep */
const MAX_HISTORY_SIZE = 50

/**
 * Document store state and actions.
 */
interface DocumentState {
  // ----- File Data -----
  /** Currently loaded file */
  file: FileData | null
  setFile: (file: FileData | null) => void

  // ----- Pasted Text -----
  /** User-pasted text (preserved during session navigation) */
  pastedText: string
  setPastedText: (text: string) => void

  // ----- Document Content -----
  /** Extracted text content from the document */
  content: string
  setContent: (content: string) => void

  // ----- Detections -----
  /** List of detected sensitive entities */
  detections: Detection[]
  /** Set all detections (triggers history push) */
  setDetections: (detections: Detection[]) => void
  /** Toggle approval state of a single detection */
  toggleDetection: (id: string) => void
  /** Approve all detections for masking */
  approveAll: () => void
  /** Reject all detections (won't be masked) */
  rejectAll: () => void
  /** Approve all detections in a category */
  approveCategory: (category: DetectionCategory) => void
  /** Reject all detections in a category */
  rejectCategory: (category: DetectionCategory) => void
  /** Set approval state for all detections in a category */
  toggleCategoryDetections: (category: DetectionCategory, approved: boolean) => void

  // ----- Undo/Redo History -----
  /** History stack of detection states */
  history: Detection[][]
  /** Current position in history */
  historyIndex: number
  /** Whether undo is available */
  canUndo: boolean
  /** Whether redo is available */
  canRedo: boolean
  /** Undo last detection change */
  undo: () => void
  /** Redo last undone change */
  redo: () => void

  // ----- Masked Content -----
  /** Document content with placeholders applied */
  maskedContent: string
  setMaskedContent: (content: string) => void

  // ----- Entity Mappings -----
  /** Mapping from original text to placeholder */
  mappings: EntityMapping[]
  setMappings: (mappings: EntityMapping[]) => void

  // ----- Statistics -----
  /** Scan statistics by category and confidence */
  stats: ScanStats | null
  setStats: (stats: ScanStats | null) => void

  // ----- Processing State -----
  /** Whether document is being processed */
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void

  // ----- Reset -----
  /** Reset store to initial state */
  reset: () => void
}

/** Initial state for the document store */
const initialState = {
  file: null,
  pastedText: '',
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

/**
 * Helper to push a new detection state to history.
 *
 * Maintains a sliding window of MAX_HISTORY_SIZE states.
 * Clears any redo states when a new change is made.
 *
 * @param state - Current store state
 * @param newDetections - New detection array to push
 * @returns Partial state update with new history
 * @internal
 */
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

/**
 * Document store hook.
 *
 * Usage in React components:
 * ```tsx
 * const { file, detections, toggleDetection } = useDocumentStore()
 * ```
 *
 * All detection changes are tracked in history for undo/redo.
 */
export const useDocumentStore = create<DocumentState>((set) => ({
  ...initialState,

  // ----- Basic Setters -----
  setFile: (file) => set({ file }),

  setPastedText: (pastedText) => set({ pastedText }),

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
