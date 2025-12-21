/**
 * @fileoverview Electron Main Process
 *
 * This is the main entry point for the maskr Electron application.
 * It handles:
 * - Window creation and lifecycle management
 * - IPC (Inter-Process Communication) handlers for renderer communication
 * - File dialogs and system interactions
 * - Coordination between services (parsing, detection, OCR, etc.)
 *
 * Security: All IPC handlers validate inputs before processing.
 * The renderer process cannot access Node.js APIs directly.
 *
 * @module electron/main
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'
import {
  parseDocument,
  createMaskedDocx,
  createMaskedXlsx,
  createMaskedPdf
} from './services/document-parser.js'
import { extractEntities, detectPersonNames } from './services/detector.js'
import {
  extractTextFromImage,
  extractTextFromImages,
  combineOCRResults,
  isValidImage
} from './services/ocr.js'
import {
  computePerceptualHash,
  calculateSimilarity,
  createThumbnail,
  isSharpAvailable
} from './services/image-hash.js'
import { createApplicationMenu } from './menu.js'
import {
  getAllProfiles,
  getProfile,
  getActiveProfile,
  setActiveProfile,
  saveProfile,
  deleteProfile,
  createProfile
} from './services/profiles.js'
import type { ConfigProfile } from './services/profiles.js'
import {
  validateFilePath,
  validateFileExtension,
  validateDragDropPath,
  validateBufferSize,
  validateTextInput,
  validateProfileId,
  validateThreshold
} from './services/security.js'

/** Current directory path (ESM equivalent of __dirname) */
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Reference to the main application window */
let mainWindow: BrowserWindow | null = null

/** Vite dev server URL (only set in development mode) */
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

/**
 * Creates the main application window with security-focused configuration.
 *
 * Window features:
 * - Context isolation enabled (renderer cannot access Node.js)
 * - Node integration disabled
 * - Sandbox mode enabled
 * - Preload script for safe IPC bridge
 *
 * In development: Loads from Vite dev server and opens DevTools
 * In production: Loads from built dist/index.html
 */
function createWindow() {
  // Icon path for development mode (in production, electron-builder handles this)
  const iconPath = path.join(__dirname, '..', 'resources', 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Set up application menu
  createApplicationMenu(mainWindow)

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Open DevTools only in development
  if (VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, '..', 'resources', 'icon.png')
    app.dock.setIcon(iconPath)
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// ============================================================================
// IPC HANDLERS
// ============================================================================
// All handlers follow a consistent pattern:
// 1. Validate inputs using security utilities
// 2. Process the request
// 3. Return { success: true, ...data } or { success: false, error: string }
// ============================================================================

/**
 * Opens a native file dialog for selecting documents.
 *
 * @returns FileData object with file contents as base64, or null if cancelled
 *
 * Supported formats:
 * - Documents: txt, md, docx, xlsx, pdf, csv, json, html
 * - Images (OCR): png, jpg, jpeg, gif, bmp, webp, tiff
 */
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'All Supported', extensions: ['txt', 'md', 'docx', 'xlsx', 'pdf', 'csv', 'json', 'html', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'] },
      { name: 'Documents', extensions: ['txt', 'md', 'docx', 'xlsx', 'pdf', 'csv', 'json', 'html'] },
      { name: 'Images (OCR)', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
      { name: 'Word Documents', extensions: ['docx'] },
      { name: 'Excel Files', extensions: ['xlsx', 'csv'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  const buffer = await fs.readFile(filePath)
  const fileName = path.basename(filePath)
  const extension = path.extname(filePath).toLowerCase().slice(1)

  return {
    filePath,
    fileName,
    extension,
    buffer: buffer.toString('base64'),
    size: buffer.length
  }
})

/**
 * Opens a native save dialog and writes file to disk.
 *
 * @param data - Base64-encoded file content
 * @param defaultName - Suggested filename for the save dialog
 * @param format - Optional file format override (docx, xlsx, pdf, txt, etc.)
 * @returns The saved file path, or null if cancelled
 */
ipcMain.handle(
  'dialog:saveFile',
  async (_event, data: string, defaultName: string, format?: string) => {
    const ext = format || path.extname(defaultName).slice(1) || 'txt'

    const filters = []
    switch (ext) {
      case 'docx':
        filters.push({ name: 'Word Document', extensions: ['docx'] })
        break
      case 'xlsx':
        filters.push({ name: 'Excel File', extensions: ['xlsx'] })
        break
      case 'pdf':
        filters.push({ name: 'PDF Document', extensions: ['pdf'] })
        break
      default:
        filters.push({ name: 'Text Files', extensions: ['txt', 'md'] })
    }
    filters.push({ name: 'All Files', extensions: ['*'] })

    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const buffer = Buffer.from(data, 'base64')
    await fs.writeFile(result.filePath, buffer)
    return result.filePath
  }
)

/**
 * Reads file content from disk (used for drag-and-drop).
 *
 * Security validations:
 * - Path must be absolute and within user-accessible directories
 * - No path traversal allowed
 * - File extension must be in allowed list
 * - Maximum file size: 50MB
 *
 * @param filePath - Absolute path to the file
 * @returns FileData object with base64 content, or null if validation fails
 */
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    // Validate file path for security
    const pathValidation = validateDragDropPath(filePath)
    if (!pathValidation.valid) {
      console.error('File read blocked:', pathValidation.error)
      return null
    }

    const buffer = await fs.readFile(filePath)

    // Validate file size (50MB limit)
    if (buffer.length > 50 * 1024 * 1024) {
      console.error('File too large:', buffer.length)
      return null
    }

    const fileName = path.basename(filePath)
    const extension = path.extname(filePath).toLowerCase().slice(1)

    return {
      filePath,
      fileName,
      extension,
      buffer: buffer.toString('base64'),
      size: buffer.length
    }
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
})

/**
 * Parses a document and extracts text content.
 *
 * Supports multiple formats with format-specific parsing:
 * - Text: txt, md (UTF-8 decode)
 * - Office: docx (mammoth), xlsx (exceljs), csv
 * - PDF: pdfjs-dist with pdf-lib fallback
 * - Data: json (pretty-printed), html (tags stripped)
 * - Images: Returns buffer for OCR processing
 *
 * For DOCX files, also extracts embedded images for logo detection.
 *
 * @param fileName - Original filename (used to determine format)
 * @param bufferBase64 - File content as base64 string
 * @returns ParsedDocument with content, format, metadata, and images
 */
ipcMain.handle('document:parse', async (_event, fileName: string, bufferBase64: string) => {
  try {
    // Validate file extension (buffer already provided, just need format check)
    const extValidation = validateFileExtension(fileName)
    if (!extValidation.valid) {
      return {
        success: false,
        error: extValidation.error
      }
    }

    // Validate buffer size
    const bufferValidation = validateBufferSize(bufferBase64)
    if (!bufferValidation.valid) {
      return {
        success: false,
        error: bufferValidation.error
      }
    }

    const buffer = Buffer.from(bufferBase64, 'base64')
    const parsed = await parseDocument(fileName, buffer)

    return {
      success: true,
      content: parsed.content,
      format: parsed.format,
      metadata: parsed.metadata,
      hasImages: parsed.images && parsed.images.length > 0
    }
  } catch (error) {
    console.error('Document parsing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    }
  }
})

/**
 * Extracts named entities from text using NER (Named Entity Recognition).
 *
 * Detection types (in order of processing):
 * 1. Custom names (user-defined, 100% confidence)
 * 2. Full names (NLP via compromise, 85% confidence)
 * 3. Financial amounts (currency symbols required)
 * 4. Credit cards (Luhn validation)
 * 5. IBANs (Mod97 checksum validation)
 * 6. IP addresses (IPv4/IPv6)
 * 7. Phone numbers (international formats)
 * 8. Email addresses
 * 9. URLs
 * 10. Domain names
 * 11. Saudi IDs (National ID/Iqama)
 *
 * @param text - Text content to analyze
 * @param customNames - Optional array of user-defined names to detect
 * @returns NERResult with entities array containing text, type, position, confidence
 */
ipcMain.handle('ner:extract', async (_event, text: string, customNames?: string[]) => {
  try {
    // Validate text input
    const textValidation = validateTextInput(text)
    if (!textValidation.valid) {
      return {
        success: false,
        error: textValidation.error
      }
    }

    // Validate customNames if provided
    if (customNames) {
      if (!Array.isArray(customNames)) {
        return { success: false, error: 'customNames must be an array' }
      }
      if (customNames.length > 1000) {
        return { success: false, error: 'Too many custom names (max 1000)' }
      }
      for (const name of customNames) {
        if (typeof name !== 'string' || name.length > 200) {
          return { success: false, error: 'Invalid custom name' }
        }
      }
    }

    const entities = extractEntities(text, customNames)
    const persons = detectPersonNames(text)

    return {
      success: true,
      entities,
      persons,
      organizations: [] // Organizations are only detected via user configuration now
    }
  } catch (error) {
    console.error('NER extraction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown NER error'
    }
  }
})

/**
 * Creates a masked version of a document with sensitive data replaced.
 *
 * Format-specific handling:
 * - DOCX: Creates new document with masked text (formatting not preserved)
 * - XLSX: Creates new workbook with masked content
 * - PDF: Creates new PDF with masked text (A4 format)
 * - Text formats: Returns masked text as UTF-8
 *
 * @param originalBufferBase64 - Original document as base64 (for format reference)
 * @param maskedContent - Text with placeholders replacing sensitive data
 * @param format - Output format (docx, xlsx, pdf, txt, md, json, csv, html)
 * @returns MaskedDocumentResult with base64-encoded output buffer
 */
ipcMain.handle(
  'document:createMasked',
  async (_event, originalBufferBase64: string, maskedContent: string, format: string) => {
    try {
      // Validate buffer size
      const bufferValidation = validateBufferSize(originalBufferBase64)
      if (!bufferValidation.valid) {
        return { success: false, error: bufferValidation.error }
      }

      // Validate masked content
      const textValidation = validateTextInput(maskedContent)
      if (!textValidation.valid) {
        return { success: false, error: textValidation.error }
      }

      // Validate format
      const allowedFormats = ['docx', 'xlsx', 'pdf', 'txt', 'md', 'json', 'csv', 'html']
      if (!allowedFormats.includes(format)) {
        return { success: false, error: 'Invalid document format' }
      }

      const originalBuffer = Buffer.from(originalBufferBase64, 'base64')
      let resultBuffer: Buffer

      switch (format) {
        case 'docx':
          resultBuffer = await createMaskedDocx(originalBuffer, maskedContent)
          break
        case 'xlsx':
          resultBuffer = await createMaskedXlsx(originalBuffer, maskedContent)
          break
        case 'pdf':
          resultBuffer = await createMaskedPdf(originalBuffer, maskedContent)
          break
        default:
          // For text formats, just encode the content
          resultBuffer = Buffer.from(maskedContent, 'utf-8')
      }

      return {
        success: true,
        buffer: resultBuffer.toString('base64')
      }
    } catch (error) {
      console.error('Create masked document error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
)

// Get app version
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

// Get platform
ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

/**
 * Extracts text from an image using OCR (Tesseract.js).
 *
 * Preprocessing (if Sharp available):
 * - Grayscale conversion
 * - Contrast enhancement
 * - Normalization
 *
 * @param imageBufferBase64 - Image data as base64 string
 * @param language - OCR language code (default: 'eng'). Must be 3 lowercase letters.
 * @returns OCRResult with extracted text, confidence score, and word bounding boxes
 */
ipcMain.handle('ocr:extractText', async (_event, imageBufferBase64: string, language?: string) => {
  try {
    // Validate buffer size
    const bufferValidation = validateBufferSize(imageBufferBase64)
    if (!bufferValidation.valid) {
      return { success: false, error: bufferValidation.error }
    }

    // Validate language code (simple alphanumeric check)
    if (language && (typeof language !== 'string' || !/^[a-z]{3}$/.test(language))) {
      return { success: false, error: 'Invalid language code' }
    }

    const imageBuffer = Buffer.from(imageBufferBase64, 'base64')

    // Validate image
    const valid = await isValidImage(imageBuffer)
    if (!valid) {
      return {
        success: false,
        error: 'Invalid image format'
      }
    }

    const result = await extractTextFromImage(imageBuffer, language || 'eng')

    return {
      success: true,
      text: result.text,
      confidence: result.confidence,
      words: result.words
    }
  } catch (error) {
    console.error('OCR extraction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown OCR error'
    }
  }
})

/**
 * Extracts text from multiple images using batch OCR processing.
 *
 * Used for documents with multiple embedded images (e.g., DOCX with figures).
 * Maximum batch size: 50 images.
 *
 * @param imageBuffersBase64 - Array of image buffers as base64 strings
 * @param language - OCR language code (default: 'eng')
 * @returns OCRBatchResult with individual results and combined text
 */
ipcMain.handle(
  'ocr:extractTextBatch',
  async (_event, imageBuffersBase64: string[], language?: string) => {
    try {
      // Validate input array
      if (!Array.isArray(imageBuffersBase64)) {
        return { success: false, error: 'Input must be an array' }
      }

      // Limit batch size
      if (imageBuffersBase64.length > 50) {
        return { success: false, error: 'Too many images (max 50)' }
      }

      // Validate each buffer
      for (const bufferBase64 of imageBuffersBase64) {
        const bufferValidation = validateBufferSize(bufferBase64)
        if (!bufferValidation.valid) {
          return { success: false, error: bufferValidation.error }
        }
      }

      // Validate language code
      if (language && (typeof language !== 'string' || !/^[a-z]{3}$/.test(language))) {
        return { success: false, error: 'Invalid language code' }
      }

      const imageBuffers = imageBuffersBase64.map((b) => Buffer.from(b, 'base64'))
      const results = await extractTextFromImages(imageBuffers, language || 'eng')
      const combinedText = combineOCRResults(results)

      return {
        success: true,
        results: results.map((r) => ({
          text: r.text,
          confidence: r.confidence,
          imageIndex: r.imageIndex
        })),
        combinedText
      }
    } catch (error) {
      console.error('Batch OCR extraction error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error'
      }
    }
  }
)

// ============================================================================
// PROFILE MANAGEMENT HANDLERS
// ============================================================================
// Profiles allow users to save and switch between detection configurations.
// Default profiles: 'default', 'strict', 'minimal'
// ============================================================================

/** Returns all available configuration profiles */
ipcMain.handle('profiles:getAll', () => {
  return getAllProfiles()
})

ipcMain.handle('profiles:get', (_event, id: string) => {
  const validation = validateProfileId(id)
  if (!validation.valid) {
    return undefined
  }
  return getProfile(id)
})

ipcMain.handle('profiles:getActive', () => {
  return getActiveProfile()
})

ipcMain.handle('profiles:setActive', (_event, id: string) => {
  const validation = validateProfileId(id)
  if (!validation.valid) {
    return false
  }
  return setActiveProfile(id)
})

ipcMain.handle('profiles:save', (_event, profile: ConfigProfile) => {
  if (!profile || typeof profile !== 'object') {
    return false
  }
  const validation = validateProfileId(profile.id)
  if (!validation.valid) {
    return false
  }
  if (typeof profile.name !== 'string' || profile.name.length > 100) {
    return false
  }
  saveProfile(profile)
  return true
})

ipcMain.handle('profiles:delete', (_event, id: string) => {
  const validation = validateProfileId(id)
  if (!validation.valid) {
    return false
  }
  return deleteProfile(id)
})

ipcMain.handle('profiles:create', (_event, name: string, config: ConfigProfile['config']) => {
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    return null
  }
  if (!config || typeof config !== 'object') {
    return null
  }
  return createProfile(name, config)
})

// ============================================================================
// LOGO DETECTION HANDLERS
// ============================================================================
// Logo detection uses perceptual hashing (aHash algorithm) to find similar
// images in documents. Requires Sharp library for image processing.
// ============================================================================

/**
 * Checks if Sharp library is available for logo detection.
 * Sharp is an optional dependency - logo detection gracefully degrades if missing.
 * @returns true if Sharp is available, false otherwise
 */
ipcMain.handle('logo:isAvailable', () => {
  return isSharpAvailable()
})

/**
 * Computes perceptual hash for a logo image.
 *
 * Algorithm: Average Hash (aHash)
 * 1. Resize image to 8x8 pixels
 * 2. Convert to grayscale
 * 3. Compute average luminance
 * 4. Generate 64-bit binary hash based on pixel vs average comparison
 *
 * Also creates a thumbnail preview (128px) for the UI.
 *
 * @param imageBufferBase64 - Logo image as base64 string
 * @returns LogoHashResult with hash, thumbnail, and dimensions
 */
ipcMain.handle('logo:computeHash', async (_event, imageBufferBase64: string) => {
  try {
    // Validate buffer size
    const bufferValidation = validateBufferSize(imageBufferBase64)
    if (!bufferValidation.valid) {
      return { success: false, error: bufferValidation.error }
    }

    if (!isSharpAvailable()) {
      return {
        success: false,
        error: 'Sharp is not available - logo detection is disabled'
      }
    }

    const buffer = Buffer.from(imageBufferBase64, 'base64')
    const hashResult = await computePerceptualHash(buffer)

    if (!hashResult) {
      return {
        success: false,
        error: 'Failed to compute image hash'
      }
    }

    // Create thumbnail for preview (always converts to PNG)
    const thumbnail = await createThumbnail(buffer, 128)

    if (!thumbnail) {
      return {
        success: false,
        error: 'Failed to create thumbnail preview'
      }
    }

    return {
      success: true,
      hash: hashResult.hash,
      thumbnail,
      width: hashResult.width,
      height: hashResult.height
    }
  } catch (error) {
    console.error('Logo hash computation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

/**
 * Scans a document for images matching the configured logo.
 *
 * Process:
 * 1. Parse document to extract embedded images
 * 2. Compute perceptual hash for each image
 * 3. Calculate similarity (Hamming distance) against logo hash
 * 4. Return images exceeding similarity threshold
 *
 * Currently only supports DOCX files (images in word/media/).
 *
 * @param fileName - Document filename (for format detection)
 * @param bufferBase64 - Document content as base64
 * @param logoHash - Reference logo hash (from logo:computeHash)
 * @param threshold - Minimum similarity percentage (0-100)
 * @returns LogoScanResult with matched image IDs and similarity scores
 */
ipcMain.handle(
  'logo:scanDocument',
  async (
    _event,
    fileName: string,
    bufferBase64: string,
    logoHash: string,
    threshold: number
  ) => {
    try {
      // Validate file extension (buffer already provided)
      const extValidation = validateFileExtension(fileName)
      if (!extValidation.valid) {
        return { success: false, error: extValidation.error }
      }

      // Validate buffer size
      const bufferValidation = validateBufferSize(bufferBase64)
      if (!bufferValidation.valid) {
        return { success: false, error: bufferValidation.error }
      }

      // Validate logo hash (should be hex string)
      if (!logoHash || typeof logoHash !== 'string' || !/^[0-9a-fA-F]+$/.test(logoHash)) {
        return { success: false, error: 'Invalid logo hash' }
      }

      // Validate threshold
      const thresholdValidation = validateThreshold(threshold)
      if (!thresholdValidation.valid) {
        return { success: false, error: thresholdValidation.error }
      }

      if (!isSharpAvailable()) {
        return {
          success: false,
          error: 'Sharp is not available - logo detection is disabled'
        }
      }

      const buffer = Buffer.from(bufferBase64, 'base64')
      const parsed = await parseDocument(fileName, buffer)

      if (!parsed.images || parsed.images.length === 0) {
        return {
          success: true,
          matchedImageIds: [],
          scannedCount: 0
        }
      }

      const matchedImageIds: string[] = []
      const similarities: { id: string; similarity: number }[] = []

      for (const image of parsed.images) {
        try {
          const imageHashResult = await computePerceptualHash(image.data)
          if (imageHashResult) {
            const similarity = calculateSimilarity(imageHashResult.hash, logoHash)
            similarities.push({ id: image.id, similarity })

            if (similarity >= threshold) {
              matchedImageIds.push(image.id)
            }
          }
        } catch {
          // Skip images that fail to hash
        }
      }

      return {
        success: true,
        matchedImageIds,
        scannedCount: parsed.images.length,
        similarities
      }
    } catch (error) {
      console.error('Logo scan error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
)
