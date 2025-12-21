/**
 * @fileoverview Electron Preload Script
 *
 * This script runs in a sandboxed context and bridges the main process
 * (Node.js) with the renderer process (browser). It exposes a safe API
 * to the renderer via contextBridge.
 *
 * Security:
 * - Context isolation is enabled
 * - Only whitelisted IPC channels are exposed
 * - Menu event listeners are validated
 *
 * The exposed API is available as `window.api` in the renderer.
 *
 * @module electron/preload
 */

import { contextBridge, ipcRenderer } from 'electron'

/**
 * File data structure returned from file operations.
 */
export interface FileData {
  /** Full file path */
  filePath: string
  /** File name only */
  fileName: string
  /** File extension (e.g., '.pdf') */
  extension: string
  /** File content as base64 string */
  buffer: string
  /** File size in bytes */
  size: number
}

/**
 * Result of document parsing operation.
 */
export interface ParsedDocument {
  /** Whether parsing succeeded */
  success: boolean
  /** Extracted text content */
  content?: string
  /** Detected file format */
  format?: string
  /** Document metadata */
  metadata?: {
    title?: string
    author?: string
    pages?: number
    sheets?: string[]
  }
  /** Whether document contains embedded images */
  hasImages?: boolean
  /** Error message if parsing failed */
  error?: string
}

/**
 * Result of Named Entity Recognition.
 */
export interface NERResult {
  success: boolean
  entities?: Array<{
    text: string
    type: string
    start: number
    end: number
  }>
  persons?: Array<{ text: string; start: number; end: number }>
  organizations?: Array<{ text: string; start: number; end: number }>
  error?: string
}

export interface MaskedDocumentResult {
  success: boolean
  buffer?: string // base64 encoded
  error?: string
}

export interface OCRResult {
  success: boolean
  text?: string
  confidence?: number
  words?: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }>
  error?: string
}

export interface OCRBatchResult {
  success: boolean
  results?: Array<{
    text: string
    confidence: number
    imageIndex: number
  }>
  combinedText?: string
  error?: string
}

export interface ConfigProfile {
  id: string
  name: string
  config: {
    companyName?: string
    aliases?: string[]
    customKeywords?: string[]
    enabledCategories: string[]
    maskingStyle: 'brackets' | 'redacted' | 'custom'
    customMaskTemplate?: string
    confidenceThreshold: number
    detectNames: boolean
    detectOrganizations: boolean
  }
}

export interface LogoHashResult {
  success: boolean
  hash?: string
  thumbnail?: string  // base64 PNG
  width?: number
  height?: number
  error?: string
}

export interface LogoScanResult {
  success: boolean
  matchedImageIds?: string[]
  scannedCount?: number
  similarities?: Array<{ id: string; similarity: number }>
  error?: string
}

// ============================================================================
// API OBJECT
// ============================================================================

/**
 * The API object exposed to the renderer process via contextBridge.
 * Available as `window.api` in React components.
 */
const api = {
  // ----- File Operations -----
  /** Opens a file dialog and returns the selected file data */
  openFile: (): Promise<FileData | null> => ipcRenderer.invoke('dialog:openFile'),
  /** Opens a save dialog and writes data to disk */
  saveFile: (data: string, defaultName: string, format?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', data, defaultName, format),
  /** Reads a file from disk (used for drag-and-drop) */
  readFile: (filePath: string): Promise<FileData | null> =>
    ipcRenderer.invoke('file:read', filePath),

  // ----- Document Processing -----
  /** Parses a document and extracts text content */
  parseDocument: (filePath: string, bufferBase64: string): Promise<ParsedDocument> =>
    ipcRenderer.invoke('document:parse', filePath, bufferBase64),
  createMaskedDocument: (
    originalBufferBase64: string,
    maskedContent: string,
    format: string
  ): Promise<MaskedDocumentResult> =>
    ipcRenderer.invoke('document:createMasked', originalBufferBase64, maskedContent, format),

  // NER extraction
  extractEntities: (text: string, customNames?: string[]): Promise<NERResult> =>
    ipcRenderer.invoke('ner:extract', text, customNames),

  // OCR
  ocrExtractText: (imageBufferBase64: string, language?: string): Promise<OCRResult> =>
    ipcRenderer.invoke('ocr:extractText', imageBufferBase64, language),
  ocrExtractTextBatch: (imageBuffersBase64: string[], language?: string): Promise<OCRBatchResult> =>
    ipcRenderer.invoke('ocr:extractTextBatch', imageBuffersBase64, language),

  // Profile management
  profilesGetAll: (): Promise<ConfigProfile[]> => ipcRenderer.invoke('profiles:getAll'),
  profilesGet: (id: string): Promise<ConfigProfile | undefined> => ipcRenderer.invoke('profiles:get', id),
  profilesGetActive: (): Promise<ConfigProfile> => ipcRenderer.invoke('profiles:getActive'),
  profilesSetActive: (id: string): Promise<boolean> => ipcRenderer.invoke('profiles:setActive', id),
  profilesSave: (profile: ConfigProfile): Promise<boolean> => ipcRenderer.invoke('profiles:save', profile),
  profilesDelete: (id: string): Promise<boolean> => ipcRenderer.invoke('profiles:delete', id),
  profilesCreate: (name: string, config: ConfigProfile['config']): Promise<ConfigProfile> =>
    ipcRenderer.invoke('profiles:create', name, config),

  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  // Logo detection
  logoIsAvailable: (): Promise<boolean> => ipcRenderer.invoke('logo:isAvailable'),
  logoComputeHash: (imageBufferBase64: string): Promise<LogoHashResult> =>
    ipcRenderer.invoke('logo:computeHash', imageBufferBase64),
  logoScanDocument: (
    filePath: string,
    bufferBase64: string,
    logoHash: string,
    threshold: number
  ): Promise<LogoScanResult> =>
    ipcRenderer.invoke('logo:scanDocument', filePath, bufferBase64, logoHash, threshold),

  // Platform info
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:getPlatform'),

  // Menu event listeners
  onMenuEvent: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'menu:openFile',
      'menu:export',
      'menu:exportAnnotated',
      'menu:preferences',
      'menu:selectAllDetections',
      'menu:deselectAllDetections',
      'menu:showOriginal',
      'menu:showSanitized',
      'menu:sideBySide',
      'menu:loadProfile',
      'menu:saveProfile',
      'menu:manageProfiles'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  removeMenuListener: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', api)

// Type definitions for renderer
declare global {
  interface Window {
    api: typeof api
  }
}
