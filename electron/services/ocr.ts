import Tesseract from 'tesseract.js'
import sharp from 'sharp'

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
  try {
    await sharp(buffer).metadata()
    return true
  } catch {
    return false
  }
}
