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

  switch (ext) {
    case 'txt':
    case 'md':
      return parseTextFile(buffer, ext)
    case 'docx':
      return parseDocx(buffer)
    case 'xlsx':
      return parseXlsx(buffer)
    case 'csv':
      return parseCsv(buffer)
    case 'pdf':
      return parsePdf(buffer)
    case 'json':
      return parseJson(buffer)
    case 'html':
      return parseHtml(buffer)
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'webp':
    case 'tiff':
      return parseImage(buffer, ext)
    default:
      throw new Error(`Unsupported file format: ${ext}`)
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
  const content = buffer.toString('utf-8')
  return { content, format }
}

/**
 * Handles image files for OCR processing.
 * Returns empty content - actual text extracted by OCR service.
 * @internal
 */
async function parseImage(buffer: Buffer, format: string): Promise<ParsedDocument> {
  // Return the image buffer for OCR processing - content will be filled by OCR
  const contentType = format === 'jpg' ? 'image/jpeg' : `image/${format}`
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
  const result = await mammoth.extractRawText({ buffer })
  const images: ParsedDocument['images'] = []

  // Extract images directly from DOCX zip structure (word/media folder)
  try {
    const zip = await JSZip.loadAsync(buffer)

    // Find all files in word/media folder
    const mediaFiles = Object.keys(zip.files).filter(name =>
      name.startsWith('word/media/') && !zip.files[name].dir
    )

    for (const filePath of mediaFiles) {
      const file = zip.files[filePath]
      const imageBuffer = await file.async('nodebuffer')
      const fileName = filePath.split('/').pop() || ''
      const ext = fileName.split('.').pop()?.toLowerCase() || ''

      // Determine content type
      let contentType = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
      else if (ext === 'gif') contentType = 'image/gif'
      else if (ext === 'webp') contentType = 'image/webp'
      else if (ext === 'bmp') contentType = 'image/bmp'
      else if (ext === 'emf' || ext === 'wmf') continue // Skip Windows metafiles

      const imageId = `img_${images.length + 1}`

      images.push({
        id: imageId,
        data: imageBuffer,
        contentType
      })
    }
  } catch {
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
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheets: string[] = []
  const contentParts: string[] = []

  workbook.eachSheet((worksheet, _sheetId) => {
    sheets.push(worksheet.name)
    contentParts.push(`--- Sheet: ${worksheet.name} ---\n`)

    worksheet.eachRow({ includeEmpty: false }, (row, _rowNumber) => {
      const values = row.values as (string | number | boolean | Date | null | undefined)[]
      // Excel rows are 1-indexed, values array is 1-indexed as well
      const rowValues = values.slice(1).map((cell) => {
        if (cell === null || cell === undefined) return ''
        if (cell instanceof Date) return cell.toISOString()
        return String(cell)
      })
      contentParts.push(rowValues.join('\t'))
    })

    contentParts.push('\n')
  })

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
  const content = buffer.toString('utf-8')
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
  // Use pdfjs-dist for robust PDF text extraction
  try {
    const pdfjsLib = await import('pdfjs-dist')

    // Convert Buffer to Uint8Array for pdfjs
    const uint8Array = new Uint8Array(buffer)

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      // Disable worker for Electron compatibility
      disableFontFace: true,
    })

    const pdfDoc = await loadingTask.promise
    const numPages = pdfDoc.numPages
    const textParts: string[] = []

    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i)
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
      }
    }

    const content = textParts.join('\n\n')

    // Try to get metadata using pdf-lib
    let title: string | undefined
    let author: string | undefined
    try {
      const pdfLibDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      title = pdfLibDoc.getTitle() || undefined
      author = pdfLibDoc.getAuthor() || undefined
    } catch {
      // Ignore metadata extraction errors
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
    console.error('PDF parsing error:', error)

    try {
      const pdfLibDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      const pages = pdfLibDoc.getPages()

      return {
        content: `[PDF document with ${pages.length} pages - text extraction failed]`,
        format: 'pdf',
        metadata: {
          pages: pages.length,
          title: pdfLibDoc.getTitle() || undefined,
          author: pdfLibDoc.getAuthor() || undefined
        }
      }
    } catch {
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
  const content = buffer.toString('utf-8')
  try {
    // Pretty print JSON for better readability
    const parsed = JSON.parse(content)
    return {
      content: JSON.stringify(parsed, null, 2),
      format: 'json'
    }
  } catch {
    return { content, format: 'json' }
  }
}

/**
 * Parses HTML files.
 * Strips all HTML tags, scripts, and styles to extract plain text.
 * @internal
 */
async function parseHtml(buffer: Buffer): Promise<ParsedDocument> {
  const content = buffer.toString('utf-8')

  // Strip HTML tags and scripts for text extraction
  const textContent = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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
  // For now, we'll create a simple text-based docx
  // In future, we could preserve formatting
  const { Document, Packer, Paragraph, TextRun } = await import('docx')

  const paragraphs = maskedContent.split('\n').map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)]
      })
  )

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  })

  return await Packer.toBuffer(doc)
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
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Sanitized')

  const lines = maskedContent.split('\n')

  for (const line of lines) {
    if (line.startsWith('--- Sheet:')) {
      // Skip sheet header lines
      continue
    }

    if (line.trim()) {
      const values = line.split('\t')
      worksheet.addRow(values)
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
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
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

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

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
  let currentY = pageHeight - margin
  let lineCount = 0

  for (const line of lines) {
    if (lineCount >= maxLinesPerPage) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      currentY = pageHeight - margin
      lineCount = 0
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

  return Buffer.from(await pdfDoc.save())
}
