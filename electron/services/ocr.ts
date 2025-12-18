import Tesseract from 'tesseract.js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Sharp is optional - native module may not be available on all platforms
let sharp: typeof import('sharp') | null = null
try {
  sharp = require('sharp')
} catch (err) {
  console.log('Sharp not available - image preprocessing disabled', err)
}

export interface OCRResult {
  text: string
  confidence: number
  imageIndex: number
  words?: Array<{
    text: string
    confidence: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }>
}

export interface ProcessedImage {
  buffer: Buffer
  width: number
  height: number
  format: string
}

// Preprocess image for better OCR results
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  if (!sharp) {
    return imageBuffer
  }

  try {
    // Convert to grayscale, increase contrast, and normalize
    const processed = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen()
      .toBuffer()

    return processed
  } catch {
    // If preprocessing fails, return original
    return imageBuffer
  }
}

// Extract text from a single image
export async function extractTextFromImage(
  imageBuffer: Buffer,
  language: string = 'eng'
): Promise<OCRResult> {
  const processedBuffer = await preprocessImage(imageBuffer)

  const result = await Tesseract.recognize(processedBuffer, language, {
    logger: () => {} // Suppress logging
  })

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    imageIndex: 0,
    words: result.data.words?.map(word => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox
    }))
  }
}

// Extract text from multiple images
export async function extractTextFromImages(
  imageBuffers: Buffer[],
  language: string = 'eng',
  onProgress?: (current: number, total: number) => void
): Promise<OCRResult[]> {
  const results: OCRResult[] = []

  for (let i = 0; i < imageBuffers.length; i++) {
    if (onProgress) {
      onProgress(i + 1, imageBuffers.length)
    }

    try {
      const result = await extractTextFromImage(imageBuffers[i], language)
      result.imageIndex = i
      results.push(result)
    } catch (error) {
      console.error(`OCR error for image ${i}:`, error)
      results.push({
        text: '',
        confidence: 0,
        imageIndex: i
      })
    }
  }

  return results
}

// Combine OCR results into a single text block
export function combineOCRResults(results: OCRResult[]): string {
  return results
    .filter(r => r.text.trim().length > 0)
    .map((r, i) => `[Image ${i + 1}]\n${r.text.trim()}`)
    .join('\n\n')
}

// Get image info from buffer
export async function getImageInfo(buffer: Buffer): Promise<ProcessedImage | null> {
  if (!sharp) {
    // Without sharp, we can't get metadata but assume it's valid
    return {
      buffer,
      width: 0,
      height: 0,
      format: 'unknown'
    }
  }

  try {
    const metadata = await sharp(buffer).metadata()
    return {
      buffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown'
    }
  } catch {
    return null
  }
}

// Check if buffer is a valid image
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  if (!sharp) {
    // Without sharp, check for common image magic bytes
    if (buffer.length < 4) return false

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true
    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true
    // GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true
    // BMP
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) return true
    // WebP
    if (buffer.length >= 12 && buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return true

    return false
  }

  try {
    await sharp(buffer).metadata()
    return true
  } catch {
    return false
  }
}
