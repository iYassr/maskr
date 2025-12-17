import { contextBridge, ipcRenderer } from 'electron'

export interface FileData {
  filePath: string
  fileName: string
  extension: string
  buffer: string // base64 encoded
  size: number
}

export interface ParsedDocument {
  success: boolean
  content?: string
  format?: string
  metadata?: {
    title?: string
    author?: string
    pages?: number
    sheets?: string[]
  }
  hasImages?: boolean
  error?: string
}

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

const api = {
  // File operations
  openFile: (): Promise<FileData | null> => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data: string, defaultName: string, format?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', data, defaultName, format),
  readFile: (filePath: string): Promise<FileData | null> =>
    ipcRenderer.invoke('file:read', filePath),

  // Document processing
  parseDocument: (filePath: string, bufferBase64: string): Promise<ParsedDocument> =>
    ipcRenderer.invoke('document:parse', filePath, bufferBase64),
  createMaskedDocument: (
    originalBufferBase64: string,
    maskedContent: string,
    format: string
  ): Promise<MaskedDocumentResult> =>
    ipcRenderer.invoke('document:createMasked', originalBufferBase64, maskedContent, format),

  // NER extraction
  extractEntities: (text: string): Promise<NERResult> =>
    ipcRenderer.invoke('ner:extract', text),

  // OCR
  ocrExtractText: (imageBufferBase64: string, language?: string): Promise<OCRResult> =>
    ipcRenderer.invoke('ocr:extractText', imageBufferBase64, language),
  ocrExtractTextBatch: (imageBuffersBase64: string[], language?: string): Promise<OCRBatchResult> =>
    ipcRenderer.invoke('ocr:extractTextBatch', imageBuffersBase64, language),

  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  // Platform info
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)

// Type definitions for renderer
declare global {
  interface Window {
    api: typeof api
  }
}
