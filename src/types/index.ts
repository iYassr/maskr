/**
 * @fileoverview TypeScript Type Definitions
 *
 * This module contains all shared type definitions used across
 * the maskr application, including:
 * - File data structures
 * - Detection and entity types
 * - Configuration interfaces
 * - Scan results and statistics
 *
 * @module src/types
 */

/**
 * Represents a file loaded into the application.
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
  /** Decoded text content (optional) */
  content?: string
}

/**
 * A detected sensitive entity in a document.
 */
export interface Detection {
  /** Unique detection identifier */
  id: string
  /** The detected text content */
  text: string
  /** High-level category (pii, financial, etc.) */
  category: DetectionCategory
  /** Specific entity type (Person, Email, etc.) */
  subcategory: string
  /** Detection confidence (0-1) */
  confidence: number
  /** Position in source text */
  position: { start: number; end: number }
  /** Suggested replacement placeholder */
  suggestedPlaceholder: string
  /** Surrounding text for context */
  context: string
  /** Whether user approved this for masking */
  approved: boolean
  /** True if this is a logo detection (not text) */
  isImageDetection?: boolean
  /** Image ID for logo detections */
  imageId?: string
}

/**
 * Logo detection configuration.
 */
export interface LogoConfig {
  /** Whether logo detection is enabled */
  enabled: boolean
  /** Base64 thumbnail for UI preview */
  imageData: string | null
  /** Perceptual hash for similarity comparison */
  imageHash: string | null
  /** Similarity threshold (0-100, default 85) */
  similarityThreshold: number
  /** Replacement text (default "[LOGO REMOVED]") */
  placeholderText: string
}

/**
 * Categories for grouping detections.
 * - pii: Personal Identifiable Information
 * - company: Organization/company data
 * - financial: Monetary amounts, cards, IBANs
 * - technical: IPs, URLs, domains
 * - custom: User-defined keywords
 */
export type DetectionCategory = 'pii' | 'company' | 'financial' | 'technical' | 'custom'

/**
 * Mapping from placeholder to original values.
 * Used for the mapping file export.
 */
export interface EntityMapping {
  /** The placeholder text (e.g., "[PERSON_1]") */
  placeholder: string
  /** All original values this placeholder replaces */
  originalValues: string[]
  /** Entity category */
  category: DetectionCategory
  /** Number of occurrences in document */
  occurrences: number
}

/**
 * User configuration for detection and export.
 */
export interface Config {
  companyInfo: {
    primaryName: string
    aliases: string[]
    domain: string
    internalDomains: string[]
  }
  customEntities: {
    clients: NamedEntity[]
    projects: NamedEntity[]
    products: NamedEntity[]
    keywords: string[]
    names: string[] // Custom person names to detect
  }
  detectionSettings: {
    minConfidence: number
    autoMaskHighConfidence: boolean
    categoriesEnabled: DetectionCategory[]
  }
  exportPreferences: {
    includeMappingFile: boolean
    defaultFormat: 'same' | 'txt' | 'md'
  }
  logoDetection: LogoConfig
}

/**
 * A named entity with aliases (for custom detection).
 */
export interface NamedEntity {
  /** Primary name */
  name: string
  /** Alternative names/spellings */
  aliases: string[]
}

/**
 * Complete scan result with all detections and statistics.
 */
export interface ScanResult {
  /** Unique document identifier */
  documentId: string
  /** Original filename */
  originalFileName: string
  /** Extracted text content */
  content: string
  /** All detected entities */
  detections: Detection[]
  /** Scan statistics */
  stats: ScanStats
}

/**
 * Statistics about the scan results.
 */
export interface ScanStats {
  /** Total number of detections */
  totalDetections: number
  /** Count by category */
  byCategory: Record<DetectionCategory, number>
  /** Count by confidence level */
  byConfidence: { high: number; medium: number; low: number }
  /** Processing time in milliseconds */
  processingTimeMs: number
}

/**
 * A masked document ready for export.
 */
export interface MaskedDocument {
  /** Document content with placeholders */
  content: string
  /** Mapping from placeholders to original values */
  mapping: EntityMapping[]
  /** Masking statistics */
  stats: {
    totalMasked: number
    byCategory: Record<DetectionCategory, number>
  }
}

/**
 * Application view state.
 */
export type AppView = 'upload' | 'review' | 'config'
