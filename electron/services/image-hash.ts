/**
 * Image hashing service for logo detection
 * Uses perceptual hashing (Average Hash - aHash) to compare images
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Conditionally import Sharp (optional dependency)
let sharp: typeof import('sharp') | null = null
try {
  sharp = require('sharp')
} catch (err) {
  console.log('Sharp not available - logo detection disabled', err)
}

export interface ImageHashResult {
  hash: string
  width: number
  height: number
}

/**
 * Check if Sharp is available for image processing
 */
export function isSharpAvailable(): boolean {
  return sharp !== null
}

/**
 * Compute perceptual hash (Average Hash) for an image
 *
 * Algorithm:
 * 1. Resize image to 8x8
 * 2. Convert to grayscale
 * 3. Calculate average pixel value
 * 4. Generate 64-bit hash: 1 if pixel > average, 0 otherwise
 * 5. Return as hex string
 */
export async function computePerceptualHash(
  imageBuffer: Buffer
): Promise<ImageHashResult | null> {
  if (!sharp) {
    console.warn('Sharp not available - cannot compute image hash')
    return null
  }

  try {
    // Get original image dimensions
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    // Resize to 8x8 and convert to grayscale
    const resizedBuffer = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer()

    // Calculate average pixel value
    let sum = 0
    for (let i = 0; i < resizedBuffer.length; i++) {
      sum += resizedBuffer[i]
    }
    const average = sum / resizedBuffer.length

    // Generate hash: 1 if pixel > average, 0 otherwise
    let hashBits = ''
    for (let i = 0; i < resizedBuffer.length; i++) {
      hashBits += resizedBuffer[i] > average ? '1' : '0'
    }

    // Convert binary string to hex
    const hash = binaryToHex(hashBits)

    return { hash, width, height }
  } catch (error) {
    console.error('Failed to compute perceptual hash:', error)
    return null
  }
}

/**
 * Convert binary string to hex string
 */
function binaryToHex(binary: string): string {
  let hex = ''
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4)
    hex += parseInt(chunk, 2).toString(16)
  }
  return hex
}

/**
 * Convert hex string back to binary string
 */
function hexToBinary(hex: string): string {
  let binary = ''
  for (let i = 0; i < hex.length; i++) {
    const bits = parseInt(hex[i], 16).toString(2).padStart(4, '0')
    binary += bits
  }
  return binary
}

/**
 * Calculate Hamming distance between two hashes
 * (number of differing bits)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const binary1 = hexToBinary(hash1)
  const binary2 = hexToBinary(hash2)

  if (binary1.length !== binary2.length) {
    // Hashes should be same length, but handle gracefully
    return Math.max(binary1.length, binary2.length)
  }

  let distance = 0
  for (let i = 0; i < binary1.length; i++) {
    if (binary1[i] !== binary2[i]) {
      distance++
    }
  }

  return distance
}

/**
 * Calculate similarity percentage between two hashes
 * Returns 0-100 where 100 is identical
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const binary1 = hexToBinary(hash1)
  const binary2 = hexToBinary(hash2)

  if (binary1.length !== binary2.length) {
    return 0
  }

  const distance = hammingDistance(hash1, hash2)
  const maxDistance = binary1.length // 64 bits for 8x8 hash
  const similarity = ((maxDistance - distance) / maxDistance) * 100

  return Math.round(similarity * 100) / 100 // Round to 2 decimal places
}

/**
 * Compare two images and determine if they match based on threshold
 */
export async function compareImages(
  img1Buffer: Buffer,
  img2Buffer: Buffer,
  threshold: number = 85
): Promise<{ isMatch: boolean; similarity: number }> {
  const hash1 = await computePerceptualHash(img1Buffer)
  const hash2 = await computePerceptualHash(img2Buffer)

  if (!hash1 || !hash2) {
    return { isMatch: false, similarity: 0 }
  }

  const similarity = calculateSimilarity(hash1.hash, hash2.hash)
  return {
    isMatch: similarity >= threshold,
    similarity
  }
}

/**
 * Compare an image against a pre-computed hash
 */
export async function compareImageToHash(
  imageBuffer: Buffer,
  targetHash: string,
  threshold: number = 85
): Promise<{ isMatch: boolean; similarity: number }> {
  const imageHashResult = await computePerceptualHash(imageBuffer)

  if (!imageHashResult) {
    return { isMatch: false, similarity: 0 }
  }

  const similarity = calculateSimilarity(imageHashResult.hash, targetHash)
  return {
    isMatch: similarity >= threshold,
    similarity
  }
}

/**
 * Create a thumbnail of an image for storage/preview
 * Returns base64 encoded PNG, max 256x256
 */
export async function createThumbnail(
  imageBuffer: Buffer,
  maxSize: number = 256
): Promise<string | null> {
  if (!sharp) {
    return null
  }

  try {
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()

    return thumbnailBuffer.toString('base64')
  } catch (error) {
    console.error('Failed to create thumbnail:', error)
    return null
  }
}
