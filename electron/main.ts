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
import { extractEntities, detectPersonNames, detectOrganizations } from './services/ner.js'
import {
  extractTextFromImage,
  extractTextFromImages,
  combineOCRResults,
  isValidImage
} from './services/ocr.js'
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Disabled for document processing
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
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

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

// IPC Handlers

// Open file dialog
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

// Save file dialog
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

// Read file content (for drag and drop)
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
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
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
})

// Parse document - extract text content from various formats
ipcMain.handle('document:parse', async (_event, filePath: string, bufferBase64: string) => {
  try {
    const buffer = Buffer.from(bufferBase64, 'base64')
    const parsed = await parseDocument(filePath, buffer)

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

// NER - Extract named entities
ipcMain.handle('ner:extract', async (_event, text: string) => {
  try {
    const entities = extractEntities(text)
    const persons = detectPersonNames(text)
    const organizations = detectOrganizations(text)

    return {
      success: true,
      entities,
      persons,
      organizations
    }
  } catch (error) {
    console.error('NER extraction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown NER error'
    }
  }
})

// Create masked document
ipcMain.handle(
  'document:createMasked',
  async (_event, originalBufferBase64: string, maskedContent: string, format: string) => {
    try {
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

// OCR - Extract text from image
ipcMain.handle('ocr:extractText', async (_event, imageBufferBase64: string, language?: string) => {
  try {
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

// OCR - Extract text from multiple images
ipcMain.handle(
  'ocr:extractTextBatch',
  async (_event, imageBuffersBase64: string[], language?: string) => {
    try {
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

// Profile management
ipcMain.handle('profiles:getAll', () => {
  return getAllProfiles()
})

ipcMain.handle('profiles:get', (_event, id: string) => {
  return getProfile(id)
})

ipcMain.handle('profiles:getActive', () => {
  return getActiveProfile()
})

ipcMain.handle('profiles:setActive', (_event, id: string) => {
  return setActiveProfile(id)
})

ipcMain.handle('profiles:save', (_event, profile: ConfigProfile) => {
  saveProfile(profile)
  return true
})

ipcMain.handle('profiles:delete', (_event, id: string) => {
  return deleteProfile(id)
})

ipcMain.handle('profiles:create', (_event, name: string, config: ConfigProfile['config']) => {
  return createProfile(name, config)
})
