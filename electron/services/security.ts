/**
 * @fileoverview Security Utilities
 *
 * This module provides input validation and path safety functions
 * to protect against common security vulnerabilities:
 *
 * - Path traversal attacks (../)
 * - Access to system directories
 * - Buffer overflow via large files
 * - Malicious file extensions
 * - Profile ID injection
 *
 * All IPC handlers should validate inputs using these utilities
 * before processing user-provided data.
 *
 * @module electron/services/security
 */

import path from 'path'
import { app } from 'electron'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Allowed document file extensions */
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  'txt', 'md', 'docx', 'xlsx', 'pdf', 'csv', 'json', 'html'
])

/** Allowed image file extensions (for OCR) */
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff'
])

/** Combined set of all allowed extensions */
const ALL_ALLOWED_EXTENSIONS = new Set([
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  ...ALLOWED_IMAGE_EXTENSIONS
])

/** Maximum file size: 50MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/** Maximum text input length: 10MB */
const MAX_TEXT_LENGTH = 10 * 1024 * 1024

/**
 * System directories that should never be accessed.
 * Includes both Unix and Windows paths.
 */
const FORBIDDEN_PATHS = [
  '/etc',
  '/System',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/private/etc',
  '/private/var',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\ProgramData'
]

// ============================================================================
// VALIDATION RESULT TYPE
// ============================================================================

/**
 * Result of a validation check.
 */
interface ValidationResult {
  /** Whether the input passed validation */
  valid: boolean
  /** Error message if validation failed */
  error?: string
}

// ============================================================================
// FILE PATH VALIDATION
// ============================================================================

/**
 * Validates that a file path is safe to access.
 *
 * Security checks:
 * 1. Path must be provided and be a string
 * 2. No path traversal attempts (..)
 * 3. Path must be absolute
 * 4. File extension must be in allowed list
 * 5. Path must not be in forbidden system directories
 *
 * @param filePath - The file path to validate
 * @returns ValidationResult indicating if path is safe
 *
 * @example
 * validateFilePath('/Users/john/Documents/file.pdf')
 * // Returns: { valid: true }
 *
 * validateFilePath('../../../etc/passwd')
 * // Returns: { valid: false, error: 'Path traversal detected' }
 */
export function validateFilePath(filePath: string): ValidationResult {
  // Check if path is provided
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'File path is required' }
  }

  // Normalize the path to resolve any ../ or ./ segments
  const normalizedPath = path.normalize(filePath)

  // Check for path traversal attempts
  if (normalizedPath !== filePath && filePath.includes('..')) {
    return { valid: false, error: 'Path traversal detected' }
  }

  // Must be absolute path
  if (!path.isAbsolute(normalizedPath)) {
    return { valid: false, error: 'Path must be absolute' }
  }

  // Check extension
  const ext = path.extname(normalizedPath).toLowerCase().slice(1)
  if (!ext || !ALL_ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension '${ext}' is not allowed. Allowed: ${[...ALL_ALLOWED_EXTENSIONS].join(', ')}`
    }
  }

  // Check forbidden paths
  const normalizedLower = normalizedPath.toLowerCase()
  for (const forbidden of FORBIDDEN_PATHS) {
    if (normalizedLower.startsWith(forbidden.toLowerCase())) {
      return { valid: false, error: 'Access to system directories is not allowed' }
    }
  }

  return { valid: true }
}

/**
 * Validates file extension only (when buffer is already provided).
 *
 * Used for IPC handlers that receive file content directly,
 * where we only need to verify the format is allowed.
 *
 * @param fileName - Filename to check extension
 * @returns ValidationResult indicating if extension is allowed
 *
 * @example
 * validateFileExtension('document.pdf')  // { valid: true }
 * validateFileExtension('script.exe')    // { valid: false, error: '...' }
 */
export function validateFileExtension(fileName: string): ValidationResult {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'File name is required' }
  }

  // Check for path traversal in filename
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'Invalid file name' }
  }

  // Check extension
  const ext = path.extname(fileName).toLowerCase().slice(1)
  if (!ext || !ALL_ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension '${ext}' is not allowed. Allowed: ${[...ALL_ALLOWED_EXTENSIONS].join(', ')}`
    }
  }

  return { valid: true }
}

/**
 * Validates file path for drag-and-drop operations.
 *
 * In addition to standard path validation, ensures the file
 * is within user-accessible directories:
 * - Home directory
 * - Temp directory
 * - Downloads
 * - Documents
 * - Desktop
 *
 * This prevents drag-and-drop from system locations.
 *
 * @param filePath - The file path to validate
 * @returns ValidationResult indicating if path is safe for drag-and-drop
 */
export function validateDragDropPath(filePath: string): ValidationResult {
  const baseValidation = validateFilePath(filePath)
  if (!baseValidation.valid) {
    return baseValidation
  }

  const normalizedPath = path.normalize(filePath)
  const homeDir = app.getPath('home')
  const tempDir = app.getPath('temp')
  const downloadsDir = app.getPath('downloads')
  const documentsDir = app.getPath('documents')
  const desktopDir = app.getPath('desktop')

  // Must be within user-accessible directories
  const allowedBasePaths = [homeDir, tempDir, downloadsDir, documentsDir, desktopDir]
  const isInAllowedPath = allowedBasePaths.some(base =>
    normalizedPath.startsWith(base)
  )

  if (!isInAllowedPath) {
    return { valid: false, error: 'File must be in a user-accessible directory' }
  }

  return { valid: true }
}

// ============================================================================
// DATA SIZE VALIDATION
// ============================================================================

/**
 * Validates that a base64-encoded buffer doesn't exceed size limit.
 *
 * Estimates actual binary size (base64 is ~33% larger than binary).
 * Maximum allowed size: 50MB
 *
 * @param base64Data - Base64-encoded data string
 * @returns ValidationResult indicating if size is acceptable
 */
export function validateBufferSize(base64Data: string): ValidationResult {
  if (!base64Data || typeof base64Data !== 'string') {
    return { valid: false, error: 'Buffer data is required' }
  }

  // Estimate actual size (base64 is ~33% larger than binary)
  const estimatedSize = Math.ceil(base64Data.length * 0.75)

  if (estimatedSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${Math.round(estimatedSize / 1024 / 1024)}MB) exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`
    }
  }

  return { valid: true }
}

/**
 * Validates that text input doesn't exceed size limit.
 *
 * Maximum allowed length: 10MB of text (~10 million characters)
 *
 * @param text - Text content to validate
 * @returns ValidationResult indicating if text length is acceptable
 */
export function validateTextInput(text: string): ValidationResult {
  if (typeof text !== 'string') {
    return { valid: false, error: 'Text must be a string' }
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Text length exceeds maximum allowed (${MAX_TEXT_LENGTH / 1024 / 1024}MB)`
    }
  }

  return { valid: true }
}

// ============================================================================
// PROFILE VALIDATION
// ============================================================================

/**
 * Validates a profile ID for safe storage.
 *
 * Allowed characters: a-z, A-Z, 0-9, hyphen (-)
 * Maximum length: 100 characters
 *
 * This prevents injection attacks when profile IDs are used
 * as storage keys or file names.
 *
 * @param id - Profile ID to validate
 * @returns ValidationResult indicating if ID is safe
 */
export function validateProfileId(id: string): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Profile ID is required' }
  }

  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return { valid: false, error: 'Profile ID contains invalid characters' }
  }

  if (id.length > 100) {
    return { valid: false, error: 'Profile ID is too long' }
  }

  return { valid: true }
}

// ============================================================================
// NUMERIC VALIDATION
// ============================================================================

/**
 * Validates that a threshold value is within acceptable range.
 *
 * Used for logo detection similarity threshold.
 * Must be a number between 0 and 100 (inclusive).
 *
 * @param threshold - Threshold value to validate
 * @returns ValidationResult indicating if threshold is valid
 */
export function validateThreshold(threshold: number): ValidationResult {
  if (typeof threshold !== 'number' || isNaN(threshold)) {
    return { valid: false, error: 'Threshold must be a number' }
  }

  if (threshold < 0 || threshold > 100) {
    return { valid: false, error: 'Threshold must be between 0 and 100' }
  }

  return { valid: true }
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

/**
 * Sanitizes a filename for safe export.
 *
 * Removes characters that could cause issues:
 * - Path separators (/ and \)
 * - Windows reserved characters (:*?"<>|)
 * - Null bytes
 *
 * Also truncates to 255 characters (filesystem limit).
 *
 * @param filename - Filename to sanitize
 * @returns Sanitized filename safe for saving
 *
 * @example
 * sanitizeFilename('report<2023>.pdf')  // 'report_2023_.pdf'
 * sanitizeFilename('../../../etc/passwd')  // '______etc_passwd'
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'document'
  }

  // Remove path separators and null bytes
  return filename
    .replace(/[/\\:*?"<>|\x00]/g, '_')
    .slice(0, 255)
}
