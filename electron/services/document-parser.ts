/**
 * @fileoverview Document Parser Service
 *
 * This module handles parsing various document formats to extract text content.
 * It supports multiple formats with format-specific parsing strategies:
 *
 * - Text: Plain text (txt, md) - UTF-8 decode
 * - Office: Word (docx via mammoth), Excel (xlsx via exceljs), CSV
 * - PDF: Via pdfjs-dist with pdf-lib fallback
 * - Data: JSON (pretty-printed), HTML (tags stripped)
 * - Images: Returns buffer for OCR processing
 *
 * Also provides functions to create masked versions of documents.
 *
 * @module electron/services/document-parser
 */

import mammoth from 'mammoth'
import ExcelJS from 'exceljs'
import { PDFDocument } from 'pdf-lib'
import path from 'path'
import JSZip from 'jszip'
import { logDebug, logInfo, logError, logWarn } from './logger.js'

/**
 * Result of parsing a document.
 */
export interface ParsedDocument {
  /** Extracted text content */
  content: string
  /** Original file format */
  format: string
  /** Document metadata (when available) */
  metadata?: {
    /** Document title */
    title?: string
    /** Document author */
    author?: string
    /** Number of pages (PDF) */
    pages?: number
    /** Sheet names (Excel) */
    sheets?: string[]
  }
  /** Embedded images (for logo detection) */
  images?: {
    /** Unique image identifier */
    id: string
    /** Image data as Buffer */
    data: Buffer
    /** MIME type (e.g., 'image/png') */
    contentType: string
  }[]
}

/**
 * Supported file format extensions.
 */
export type SupportedFormat = 'txt' | 'md' | 'docx' | 'xlsx' | 'csv' | 'pdf' | 'json' | 'html' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'tiff'

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parses a document and extracts text content.
 *
 * Automatically detects format from file extension and uses
 * the appropriate parsing strategy.
 *
 * @param filePath - Original filename (for format detection)
 * @param buffer - Document content as Buffer
 * @returns ParsedDocument with text content and metadata
 * @throws Error if format is unsupported
 *
 * @example
 * const buffer = await fs.readFile('document.pdf')
 * const result = await parseDocument('document.pdf', buffer)
 * console.log(result.content) // Extracted text
 */
export async function parseDocument(filePath: string, buffer: Buffer): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase().slice(1) as SupportedFormat
  logInfo('Parsing document', { filePath, format: ext, bufferSize: buffer.length })

  try {
    let result: ParsedDocument

    switch (ext) {
      case 'txt':
      case 'md':
        result = await parseTextFile(buffer, ext)
        break
      case 'docx':
        result = await parseDocx(buffer)
        break
      case 'xlsx':
        result = await parseXlsx(buffer)
        break
      case 'csv':
        result = await parseCsv(buffer)
        break
      case 'pdf':
        result = await parsePdf(buffer)
        break
      case 'json':
        result = await parseJson(buffer)
        break
      case 'html':
        result = await parseHtml(buffer)
        break
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'tiff':
        result = await parseImage(buffer, ext)
        break
      default:
        logError('Unsupported file format', { format: ext })
        throw new Error(`Unsupported file format: ${ext}`)
    }

    logInfo('Document parsed successfully', {
      format: ext,
      contentLength: result.content.length,
      hasImages: !!(result.images && result.images.length > 0),
      imageCount: result.images?.length || 0,
      metadata: result.metadata
    })

    return result
  } catch (error) {
    logError('Document parsing failed', { filePath, format: ext, error })
    throw error
  }
}

// ============================================================================
// FORMAT-SPECIFIC PARSERS
// ============================================================================

/**
 * Parses plain text files (TXT, MD).
 * Simply decodes UTF-8 content.
 * @internal
 */
async function parseTextFile(buffer: Buffer, format: string): Promise<ParsedDocument> {
  logDebug('Parsing text file', { format, bufferSize: buffer.length })
  const content = buffer.toString('utf-8')
  logDebug('Text file parsed', { format, contentLength: content.length })
  return { content, format }
}

/**
 * Handles image files for OCR processing.
 * Returns empty content - actual text extracted by OCR service.
 * @internal
 */
async function parseImage(buffer: Buffer, format: string): Promise<ParsedDocument> {
  logDebug('Parsing image file for OCR', { format, bufferSize: buffer.length })
  // Return the image buffer for OCR processing - content will be filled by OCR
  const contentType = format === 'jpg' ? 'image/jpeg' : `image/${format}`
  logDebug('Image prepared for OCR', { format, contentType })
  return {
    content: '', // Will be populated by OCR
    format: format,
    images: [
      {
        id: 'img_1',
        data: buffer,
        contentType
      }
    ]
  }
}

/**
 * Parses DOCX files using mammoth library.
 *
 * Extracts:
 * - Raw text content
 * - Embedded images from word/media/ folder (for logo detection)
 *
 * Skips Windows metafiles (EMF, WMF).
 * @internal
 */
async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  logInfo('Parsing DOCX file', { bufferSize: buffer.length })

  logDebug('Extracting text with mammoth')
  const result = await mammoth.extractRawText({ buffer })
  logDebug('Mammoth extraction complete', { textLength: result.value.length })

  const images: ParsedDocument['images'] = []

  // Extract images directly from DOCX zip structure (word/media folder)
  // Safety limits to prevent memory exhaustion
  const MAX_IMAGES = 100
  const MAX_SINGLE_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB per image
  const MAX_TOTAL_IMAGE_SIZE = 50 * 1024 * 1024 // 50MB total
  let totalImageSize = 0

  try {
    logDebug('Extracting embedded images from DOCX')
    const zip = await JSZip.loadAsync(buffer)

    // Find all files in word/media folder
    const mediaFiles = Object.keys(zip.files).filter(name =>
      name.startsWith('word/media/') && !zip.files[name].dir
    )
    logDebug('Found media files in DOCX', { count: mediaFiles.length, files: mediaFiles })

    for (const filePath of mediaFiles) {
      // Safety: limit number of images
      if (images.length >= MAX_IMAGES) {
        logWarn('Maximum image limit reached in DOCX', { limit: MAX_IMAGES })
        break
      }

      const file = zip.files[filePath]

      // Check uncompressed size before extracting (if available)
      const uncompressedSize = file._data?.uncompressedSize
      if (uncompressedSize && uncompressedSize > MAX_SINGLE_IMAGE_SIZE) {
        logWarn('Skipping oversized image in DOCX', { filePath, size: uncompressedSize })
        continue
      }

      const imageBuffer = await file.async('nodebuffer')

      // Validate extracted size
      if (imageBuffer.length > MAX_SINGLE_IMAGE_SIZE) {
        logWarn('Extracted image exceeds size limit', { filePath, size: imageBuffer.length })
        continue
      }

      // Check total size limit
      if (totalImageSize + imageBuffer.length > MAX_TOTAL_IMAGE_SIZE) {
        logWarn('Total image size limit reached', { current: totalImageSize, limit: MAX_TOTAL_IMAGE_SIZE })
        break
      }

      const fileName = filePath.split('/').pop() || ''
      const ext = fileName.split('.').pop()?.toLowerCase() || ''

      // Determine content type
      let contentType = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
      else if (ext === 'gif') contentType = 'image/gif'
      else if (ext === 'webp') contentType = 'image/webp'
      else if (ext === 'bmp') contentType = 'image/bmp'
      else if (ext === 'emf' || ext === 'wmf') {
        logDebug('Skipping Windows metafile', { fileName, ext })
        continue // Skip Windows metafiles
      }

      const imageId = `img_${images.length + 1}`
      logDebug('Extracted image from DOCX', { imageId, fileName, contentType, size: imageBuffer.length })

      images.push({
        id: imageId,
        data: imageBuffer,
        contentType
      })
      totalImageSize += imageBuffer.length
    }
    logInfo('DOCX image extraction complete', { imageCount: images.length, totalSize: totalImageSize })
  } catch (error) {
    logWarn('Image extraction from DOCX failed', { error })
    // Image extraction failed, continue without images
  }

  return {
    content: result.value,
    format: 'docx',
    images: images.length > 0 ? images : undefined
  }
}

/**
 * Parses Excel XLSX files using exceljs library.
 *
 * Output format:
 * - Sheet name headers: "--- Sheet: Name ---"
 * - Tab-separated values for each row
 * - Date values converted to ISO format
 *
 * @internal
 */
async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  logInfo('Parsing XLSX file', { bufferSize: buffer.length })

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  logDebug('XLSX workbook loaded')

  const sheets: string[] = []
  const contentParts: string[] = []
  let totalRows = 0

  workbook.eachSheet((worksheet, _sheetId) => {
    sheets.push(worksheet.name)
    contentParts.push(`--- Sheet: ${worksheet.name} ---\n`)
    let sheetRows = 0

    worksheet.eachRow({ includeEmpty: false }, (row, _rowNumber) => {
      const values = row.values as (string | number | boolean | Date | null | undefined)[]
      // Excel rows are 1-indexed, values array is 1-indexed as well
      const rowValues = values.slice(1).map((cell) => {
        if (cell === null || cell === undefined) return ''
        if (cell instanceof Date) return cell.toISOString()
        return String(cell)
      })
      contentParts.push(rowValues.join('\t'))
      sheetRows++
    })

    contentParts.push('\n')
    totalRows += sheetRows
    logDebug('Parsed XLSX sheet', { sheetName: worksheet.name, rows: sheetRows })
  })

  logInfo('XLSX parsing complete', { sheetCount: sheets.length, totalRows, sheets })

  return {
    content: contentParts.join('\n'),
    format: 'xlsx',
    metadata: { sheets }
  }
}

/**
 * Parses CSV files.
 * Returns raw content for NER processing.
 * @internal
 */
async function parseCsv(buffer: Buffer): Promise<ParsedDocument> {
  logDebug('Parsing CSV file', { bufferSize: buffer.length })
  const content = buffer.toString('utf-8')
  const lineCount = content.split('\n').length
  logDebug('CSV file parsed', { contentLength: content.length, lineCount })
  return { content, format: 'csv' }
}

/**
 * Parses PDF files using pdfjs-dist.
 *
 * Features:
 * - Extracts text from all pages
 * - Retrieves metadata (title, author, page count)
 * - Falls back to pdf-lib if pdfjs fails
 *
 * @internal
 */
async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  logInfo('Parsing PDF file', { bufferSize: buffer.length })

  // Use pdfjs-dist for robust PDF text extraction
  try {
    logDebug('Importing pdfjs-dist module')
    const pdfjsLib = await import('pdfjs-dist')
    logInfo('pdfjs-dist loaded successfully')

    // Set the worker source to the actual worker file
    // Use createRequire to get the path to the worker in node_modules
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs')
    logDebug('Worker path resolved', { workerPath })

    // Convert to file URL for ESM compatibility
    const { pathToFileURL } = await import('url')
    const workerUrl = pathToFileURL(workerPath).href
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    logDebug('PDF worker configured', { workerUrl })

    // Convert Buffer to Uint8Array for pdfjs
    const uint8Array = new Uint8Array(buffer)
    logDebug('Buffer converted to Uint8Array', { length: uint8Array.length })

    // Load the PDF document
    logDebug('Loading PDF document with pdfjs')
    let loadingTask
    try {
      loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
        verbosity: 0, // Suppress console warnings
      })
      logDebug('getDocument called, waiting for promise')
    } catch (initError) {
      logError('getDocument initialization failed', {
        message: initError instanceof Error ? initError.message : String(initError),
        stack: initError instanceof Error ? initError.stack : undefined
      })
      throw initError
    }

    let pdfDoc
    try {
      pdfDoc = await loadingTask.promise
      logDebug('PDF document promise resolved')
    } catch (loadError) {
      logError('PDF document promise rejected', {
        message: loadError instanceof Error ? loadError.message : String(loadError),
        name: loadError instanceof Error ? loadError.name : 'Unknown',
        stack: loadError instanceof Error ? loadError.stack : undefined
      })
      throw loadError
    }
    const numPages = pdfDoc.numPages
    logInfo('PDF document loaded', { numPages })

    const textParts: string[] = []

    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      logDebug('Extracting text from page', { page: i, totalPages: numPages })
      const page = await pdfDoc.getPage(i)

      try {
        const textContent = await page.getTextContent()

        // Safely extract text from items
        const pageText = textContent.items
          .map((item: unknown) => {
            // Type guard for text items
            if (item && typeof item === 'object' && 'str' in item) {
              const str = (item as { str: unknown }).str
              return typeof str === 'string' ? str : String(str || '')
            }
            return ''
          })
          .join(' ')

        if (pageText.trim()) {
          textParts.push(pageText)
          logDebug('Page text extracted', { page: i, textLength: pageText.length })
        } else {
          logDebug('Page has no text content', { page: i })
        }
      } finally {
        // Clean up page object to prevent memory leak
        // Note: cleanup() is available on page objects in pdfjs
        if (typeof page.cleanup === 'function') {
          page.cleanup()
        }
      }
    }

    // Clean up document to release memory
    // destroy() is the proper method for PDFDocumentProxy
    if (typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy()
      logDebug('PDF document destroyed for memory cleanup')
    }

    const content = textParts.join('\n\n')
    logInfo('PDF text extraction complete', { totalTextLength: content.length, pagesWithText: textParts.length })

    // Try to get metadata using pdf-lib
    let title: string | undefined
    let author: string | undefined
    try {
      logDebug('Extracting PDF metadata with pdf-lib')
      const pdfLibDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      title = pdfLibDoc.getTitle() || undefined
      author = pdfLibDoc.getAuthor() || undefined
      logDebug('PDF metadata extracted', { title, author })
    } catch (metaError) {
      logWarn('PDF metadata extraction failed', { error: metaError })
    }

    return {
      content: content || '[PDF document - no text content extracted]',
      format: 'pdf',
      metadata: {
        pages: numPages,
        title,
        author
      }
    }
  } catch (error) {
    // Fallback: try to extract what we can from the PDF using pdf-lib
    // Capture full error details for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      raw: String(error)
    }
    logError('PDF parsing with pdfjs failed, trying pdf-lib fallback', errorDetails)

    try {
      logDebug('Attempting pdf-lib fallback for PDF')
      const pdfLibDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      const pages = pdfLibDoc.getPages()
      logWarn('PDF parsed with pdf-lib fallback (no text extraction)', { pageCount: pages.length })

      return {
        content: `[PDF document with ${pages.length} pages - text extraction failed]`,
        format: 'pdf',
        metadata: {
          pages: pages.length,
          title: pdfLibDoc.getTitle() || undefined,
          author: pdfLibDoc.getAuthor() || undefined
        }
      }
    } catch (fallbackError) {
      logError('PDF parsing completely failed', { originalError: error, fallbackError })
      return {
        content: '[PDF document - text extraction failed]',
        format: 'pdf'
      }
    }
  }
}

/**
 * Parses JSON files.
 * Pretty-prints the JSON for better readability.
 * Returns raw content if JSON parsing fails.
 * @internal
 */
async function parseJson(buffer: Buffer): Promise<ParsedDocument> {
  logDebug('Parsing JSON file', { bufferSize: buffer.length })
  const content = buffer.toString('utf-8')
  try {
    // Pretty print JSON for better readability
    const parsed = JSON.parse(content)
    const prettyContent = JSON.stringify(parsed, null, 2)
    logDebug('JSON file parsed and pretty-printed', { originalLength: content.length, prettyLength: prettyContent.length })
    return {
      content: prettyContent,
      format: 'json'
    }
  } catch (error) {
    logWarn('JSON parsing failed, returning raw content', { error })
    return { content, format: 'json' }
  }
}

/**
 * Parses HTML files.
 * Strips all HTML tags, scripts, and styles to extract plain text.
 * @internal
 */
async function parseHtml(buffer: Buffer): Promise<ParsedDocument> {
  logDebug('Parsing HTML file', { bufferSize: buffer.length })
  const content = buffer.toString('utf-8')

  // Strip HTML tags and scripts for text extraction
  const textContent = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  logDebug('HTML file parsed', { originalLength: content.length, textLength: textContent.length })

  return {
    content: textContent,
    format: 'html'
  }
}

// ============================================================================
// MASKED DOCUMENT CREATION
// ============================================================================

/**
 * Creates a masked DOCX document with placeholder text.
 *
 * Note: Does not preserve original formatting. Creates a new document
 * with simple text paragraphs.
 *
 * @param originalBuffer - Original document (unused, kept for API consistency)
 * @param maskedContent - Text with placeholders replacing sensitive data
 * @returns Buffer containing the new DOCX file
 */
export async function createMaskedDocx(
  originalBuffer: Buffer,
  maskedContent: string
): Promise<Buffer> {
  logInfo('Creating masked DOCX', { contentLength: maskedContent.length })

  // For now, we'll create a simple text-based docx
  // In future, we could preserve formatting
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  logDebug('docx library loaded')

  const paragraphs = maskedContent.split('\n').map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)]
      })
  )
  logDebug('Paragraphs created', { count: paragraphs.length })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  logInfo('Masked DOCX created', { outputSize: buffer.length })
  return buffer
}

/**
 * Creates a masked XLSX document.
 *
 * Parses the masked content (sheet headers and tab-separated rows)
 * and creates a new workbook. Does not preserve original formatting.
 *
 * @param originalBuffer - Original document (unused, kept for API consistency)
 * @param maskedContent - Text with sheet headers and tab-separated values
 * @returns Buffer containing the new XLSX file
 */
export async function createMaskedXlsx(
  originalBuffer: Buffer,
  maskedContent: string
): Promise<Buffer> {
  logInfo('Creating masked XLSX', { contentLength: maskedContent.length })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Sanitized')

  const lines = maskedContent.split('\n')
  let rowCount = 0

  for (const line of lines) {
    if (line.startsWith('--- Sheet:')) {
      // Skip sheet header lines
      continue
    }

    if (line.trim()) {
      const values = line.split('\t')
      worksheet.addRow(values)
      rowCount++
    }
  }

  logDebug('Masked XLSX rows created', { rowCount })

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  logInfo('Masked XLSX created', { outputSize: buffer.length, rowCount })
  return buffer
}

/**
 * Creates a masked PDF document.
 *
 * Creates a new PDF with:
 * - A4 page size (595 x 842 points)
 * - Helvetica font at 10pt
 * - 50pt margins
 * - Automatic page breaks
 *
 * Long lines are truncated to 100 characters.
 *
 * @param originalBuffer - Original document (unused, kept for API consistency)
 * @param maskedContent - Text with placeholders replacing sensitive data
 * @returns Buffer containing the new PDF file
 */
export async function createMaskedPdf(
  originalBuffer: Buffer,
  maskedContent: string
): Promise<Buffer> {
  logInfo('Creating masked PDF', { contentLength: maskedContent.length })

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  logDebug('pdf-lib loaded for creating masked PDF')

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Ensure maskedContent is a valid string
  const safeContent = typeof maskedContent === 'string' ? maskedContent : String(maskedContent || '')
  const lines = safeContent.split('\n')
  const fontSize = 10
  const lineHeight = fontSize * 1.5
  const margin = 50
  const pageWidth = 595 // A4
  const pageHeight = 842 // A4
  const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight)

  logDebug('Masked PDF parameters', { totalLines: lines.length, maxLinesPerPage })

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
  let currentY = pageHeight - margin
  let lineCount = 0
  let pageCount = 1

  for (const line of lines) {
    if (lineCount >= maxLinesPerPage) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      currentY = pageHeight - margin
      lineCount = 0
      pageCount++
    }

    currentPage.drawText(line.slice(0, 100), {
      // Truncate long lines
      x: margin,
      y: currentY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    })

    currentY -= lineHeight
    lineCount++
  }

  const buffer = Buffer.from(await pdfDoc.save())
  logInfo('Masked PDF created', { outputSize: buffer.length, pageCount, totalLines: lines.length })
  return buffer
}
