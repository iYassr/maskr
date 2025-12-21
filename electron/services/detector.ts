/**
 * @fileoverview Named Entity Recognition (NER) Service
 *
 * This module detects sensitive information in text using pattern matching
 * and NLP (Natural Language Processing). All detection happens locally
 * with no external API calls.
 *
 * Detection Categories:
 * - PII: Person names, emails, phones, Saudi IDs
 * - Financial: Currency amounts, credit cards (Luhn validated), IBANs (Mod97 validated)
 * - Technical: IP addresses (v4/v6), URLs, domain names
 *
 * Confidence Levels:
 * - 100%: User-defined custom names
 * - 95%: Algorithm-validated (credit cards, IBANs, emails)
 * - 90%: Pattern-matched with context (Saudi IDs, domains)
 * - 85%: NLP-detected (person names, phone numbers)
 *
 * @module electron/services/detector
 */

import nlp from 'compromise'

/**
 * Represents a detected entity in text.
 */
export interface NEREntity {
  /** The detected text content */
  text: string
  /** Entity type classification */
  type: 'person' | 'financial' | 'credit_card' | 'iban' | 'phone' | 'email' | 'ip' | 'url' | 'domain' | 'saudi_id'
  /** Start position in source text (0-indexed) */
  start: number
  /** End position in source text (exclusive) */
  end: number
  /** Detection confidence (0-100) */
  confidence?: number
}

/**
 * Set of user-defined custom names to detect.
 * These are always matched with 100% confidence.
 * @internal
 */
let customNames: Set<string> = new Set()

/**
 * Sets the custom names list for detection.
 * Names are normalized to lowercase and trimmed.
 *
 * @param names - Array of names to detect with 100% confidence
 *
 * @example
 * setCustomNames(['John Doe', 'Jane Smith'])
 */
export function setCustomNames(names: string[]): void {
  customNames = new Set(names.map(n => n.toLowerCase().trim()).filter(Boolean))
}

/**
 * Main entity extraction function.
 *
 * Processes text through multiple detection patterns in this order:
 * 1. Custom names (user-defined)
 * 2. Full names (NLP)
 * 3. Financial amounts (currency symbols)
 * 4. Credit cards (Luhn validation)
 * 5. IBANs (Mod97 validation)
 * 6. IP addresses (before phones to avoid false matches)
 * 7. Phone numbers
 * 8. Email addresses
 * 9. URLs
 * 10. Domain names (after URLs/emails to avoid duplicates)
 * 11. Saudi IDs
 *
 * Duplicate entities at the same position are automatically filtered.
 *
 * @param text - Text content to analyze
 * @param userCustomNames - Optional custom names to detect
 * @returns Array of detected entities sorted by position
 *
 * @example
 * const entities = extractEntities('Contact John Doe at john@example.com')
 * // Returns: [{ text: 'John Doe', type: 'person', ... }, { text: 'john@example.com', type: 'email', ... }]
 */
export function extractEntities(text: string, userCustomNames?: string[]): NEREntity[] {
  // Guard against invalid input
  if (!text || typeof text !== 'string') {
    return []
  }

  // Update custom names if provided
  if (userCustomNames) {
    setCustomNames(userCustomNames)
  }

  const entities: NEREntity[] = []
  const seenPositions = new Set<string>()

  // Helper to add entity if not duplicate and valid
  const addEntity = (entity: NEREntity) => {
    // Validate entity before adding
    if (!entity || !entity.text || entity.text.length === 0) return
    if (typeof entity.start !== 'number' || typeof entity.end !== 'number') return
    if (!Number.isFinite(entity.start) || !Number.isFinite(entity.end)) return
    if (entity.start < 0 || entity.end <= entity.start) return
    if (entity.start >= text.length || entity.end > text.length) return

    const key = `${entity.start}-${entity.end}`
    if (!seenPositions.has(key)) {
      seenPositions.add(key)
      entities.push(entity)
    }
  }

  // 1. Detect custom user-defined names
  detectCustomNames(text, addEntity)

  // 2. Detect full names using NLP (first + last name, at least 2 parts)
  detectFullNames(text, addEntity)

  // 3. Extract financial amounts - ONLY with explicit currency symbols
  detectFinancialAmounts(text, addEntity)

  // 4. Extract credit card numbers (with Luhn validation)
  detectCreditCards(text, addEntity)

  // 5. Extract IBAN numbers (with structure validation)
  detectIBANs(text, addEntity)

  // 6. Extract IP addresses (before phone to avoid false matches)
  detectIPAddresses(text, addEntity)

  // 7. Extract phone numbers (all formats)
  detectPhoneNumbers(text, addEntity)

  // 8. Extract email addresses
  detectEmails(text, addEntity)

  // 9. Extract URLs
  detectURLs(text, addEntity)

  // 10. Extract domain names (after URLs and emails to avoid duplicates)
  detectDomains(text, addEntity)

  // 11. Extract Saudi ID numbers (National ID and Iqama)
  detectSaudiIDs(text, addEntity)

  // Deduplicate entities (same position)
  const seen = new Set<string>()
  const uniqueEntities = entities.filter((e) => {
    const key = `${e.start}-${e.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return uniqueEntities.sort((a, b) => a.start - b.start)
}

/**
 * Detects monetary amounts with explicit currency symbols.
 *
 * Only matches amounts with clear currency indicators to avoid false positives.
 * Supports: $, €, £, ¥, ₹, SAR, AED, USD, EUR, GBP, CHF, JPY, INR
 * Also matches word-based currencies: dollars, euros, pounds, riyals, etc.
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectFinancialAmounts(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Currency patterns that require explicit symbols
  const currencyPatterns = [
    // Dollar: $100, $1,000.00, $1.5M, $1.5 million
    /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Euro: €100, 100€, EUR 100
    /€\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?€/g,
    /EUR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Pound: £100, GBP 100
    /(?:£\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|GBP\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // SAR: SAR 100, 100 SAR, SR 100, 100 SR
    /(?:SAR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*SAR|SR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*SR)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // AED: AED 100, 100 AED
    /(?:AED\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*AED)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // USD explicit: USD 100, 100 USD
    /(?:USD\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*USD)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Yen: ¥100, JPY 100
    /(?:¥\s*\d{1,3}(?:,\d{3})*|\d{1,3}(?:,\d{3})*\s*¥|JPY\s*\d{1,3}(?:,\d{3})*)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Indian Rupee: ₹100, INR 100
    /(?:₹\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|INR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Swiss Franc: CHF 100
    /CHF\s*\d{1,3}(?:[',]\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Generic with currency word: 100 dollars, 50 euros, 1000 riyals
    /\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:dollars?|euros?|pounds?|riyals?|dirhams?|yen|rupees?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi
  ]

  for (const pattern of currencyPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'financial',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 95
      })
    }
  }
}

/**
 * Validates credit card numbers using the Luhn algorithm (Mod 10).
 *
 * The Luhn algorithm is a checksum formula used by all major credit cards.
 * It can detect single-digit errors and most transpositions.
 *
 * @param cardNumber - Card number string (may contain non-digit characters)
 * @returns true if the number passes Luhn validation
 *
 * @example
 * isValidLuhn('4111111111111111') // true (valid Visa test number)
 * isValidLuhn('4111111111111112') // false (checksum fails)
 */
function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let isEven = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Detects credit card numbers with Luhn validation and prefix verification.
 *
 * Validates:
 * - Length: 13-19 digits
 * - Luhn checksum
 * - Card network prefix (Visa, Mastercard, Amex, Discover)
 *
 * Supported formats:
 * - Continuous: 4111111111111111
 * - With spaces: 4111 1111 1111 1111
 * - With dashes: 4111-1111-1111-1111
 * - Amex format: 3782 822463 10005
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectCreditCards(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Credit card patterns (various formats with spaces, dashes, or no separators)
  const cardPatterns = [
    // 16 digits with spaces: 4111 1111 1111 1111
    /\b\d{4}[\s]\d{4}[\s]\d{4}[\s]\d{4}\b/g,
    // 16 digits with dashes: 4111-1111-1111-1111
    /\b\d{4}[-]\d{4}[-]\d{4}[-]\d{4}\b/g,
    // 16 digits continuous: 4111111111111111
    /\b\d{16}\b/g,
    // 15 digits (Amex): 3782 822463 10005 or continuous
    /\b\d{4}[\s]\d{6}[\s]\d{5}\b/g,
    /\b\d{15}\b/g,
    // 13 digits (some Visa)
    /\b\d{13}\b/g
  ]

  for (const pattern of cardPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const cardText = match[0]
      const digitsOnly = cardText.replace(/\D/g, '')

      // Validate with Luhn algorithm
      if (isValidLuhn(digitsOnly)) {
        // Check for valid card prefixes (Visa, Mastercard, Amex, Discover, etc.)
        const isValidPrefix =
          digitsOnly.startsWith('4') || // Visa
          /^5[1-5]/.test(digitsOnly) || // Mastercard
          /^2[2-7]/.test(digitsOnly) || // Mastercard (2-series)
          /^3[47]/.test(digitsOnly) || // Amex
          digitsOnly.startsWith('6011') || // Discover
          /^65/.test(digitsOnly) || // Discover
          /^64[4-9]/.test(digitsOnly) // Discover

        if (isValidPrefix) {
          addEntity({
            text: cardText,
            type: 'credit_card',
            start: match.index,
            end: match.index + cardText.length,
            confidence: 95
          })
        }
      }
    }
  }
}

/**
 * Validates IBAN (International Bank Account Number) structure.
 *
 * Validation steps:
 * 1. Length check (15-34 characters)
 * 2. Format: 2 letters + 2 digits + alphanumeric BBAN
 * 3. Mod97 checksum validation (ISO 7064)
 *
 * @param iban - IBAN string (spaces allowed)
 * @returns true if IBAN structure is valid
 *
 * @example
 * isValidIBAN('SA0380000000608010167519') // true
 * isValidIBAN('GB82WEST12345698765432')   // true
 */
function isValidIBAN(iban: string): boolean {
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase()

  // Check length (varies by country, but minimum 15, maximum 34)
  if (cleanIBAN.length < 15 || cleanIBAN.length > 34) return false

  // Check format: 2 letters + 2 digits + alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleanIBAN)) return false

  // Move first 4 chars to end and convert letters to numbers (A=10, B=11, etc.)
  const rearranged = cleanIBAN.slice(4) + cleanIBAN.slice(0, 4)
  const numericString = rearranged.replace(/[A-Z]/g, (char) =>
    (char.charCodeAt(0) - 55).toString()
  )

  // Mod 97 check
  let remainder = 0
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97
  }

  return remainder === 1
}

/**
 * Detects IBAN numbers with Mod97 validation.
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectIBANs(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // IBAN patterns (with or without spaces)
  const ibanPatterns = [
    // Standard IBAN with spaces: SA03 8000 0000 6080 1016 7519
    /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\s?[A-Z0-9]{1,4}\b/gi,
    // IBAN without spaces: SA0380000000608010167519
    /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi
  ]

  for (const pattern of ibanPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const ibanText = match[0]
      const cleanIBAN = ibanText.replace(/\s/g, '').toUpperCase()

      // Validate IBAN structure
      if (isValidIBAN(cleanIBAN)) {
        addEntity({
          text: ibanText,
          type: 'iban',
          start: match.index,
          end: match.index + ibanText.length,
          confidence: 95
        })
      }
    }
  }
}

/**
 * Detects phone numbers in various international formats.
 *
 * Supported formats:
 * - International: +1 234 567 8900, +44 20 7946 0958
 * - Saudi Arabia: +966 5x xxx xxxx, 05xxxxxxxx
 * - UAE: +971 5x xxx xxxx
 * - US/Canada: (123) 456-7890, 123-456-7890
 * - UK: 020 7946 0958, 07xxx xxxxxx
 * - Germany, France, and other formats
 * - Toll-free: 1-800-xxx-xxxx
 * - With extensions: xxx-xxx-xxxx ext 1234
 *
 * Validation: 7-15 digits (international standard)
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectPhoneNumbers(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const phonePatterns = [
    // International with + prefix: +1 234 567 8900, +44 20 7946 0958
    /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{0,4}\b/g,

    // Saudi Arabia: +966 5x xxx xxxx, 00966 5xxxxxxxx, 05xxxxxxxx
    /(?:\+966|00966|0)5\d{8}\b/g,
    /(?:\+966|00966)[\s.-]?5\d[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

    // UAE: +971 5x xxx xxxx
    /(?:\+971|00971)[\s.-]?5\d[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

    // US/Canada: (123) 456-7890, 123-456-7890, 123.456.7890
    /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g,

    // UK: +44 20 7946 0958, 020 7946 0958, 07xxx xxxxxx
    /(?:\+44|0044)[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
    /\b0[1-9]\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g,
    /\b07\d{3}[\s.-]?\d{6}\b/g,

    // Germany: +49 xxx xxxxxxx
    /(?:\+49|0049)[\s.-]?\d{2,4}[\s.-]?\d{3,8}\b/g,

    // France: +33 x xx xx xx xx
    /(?:\+33|0033)[\s.-]?\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/g,

    // Generic international: sequences of 10-15 digits with separators
    /\b\d{3,4}[\s.-]\d{3,4}[\s.-]\d{3,4}(?:[\s.-]\d{1,4})?\b/g,

    // Toll-free US: 1-800-xxx-xxxx, 1-888-xxx-xxxx
    /\b1[\s.-]?8(?:00|44|55|66|77|88)[\s.-]?\d{3}[\s.-]?\d{4}\b/g,

    // Extensions: main number ext/x 1234
    /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}[\s.-]?(?:ext|x|extension)[\s.]?\d{1,5}\b/gi
  ]

  for (const pattern of phonePatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const phoneText = match[0]
      // Normalize for validation (remove all non-digits)
      const digitsOnly = phoneText.replace(/\D/g, '')

      // Must have at least 7 digits (minimum for a local number)
      if (digitsOnly.length < 7) continue

      // Must not be more than 15 digits (max international standard)
      if (digitsOnly.length > 15) continue

      addEntity({
        text: phoneText,
        type: 'phone',
        start: match.index,
        end: match.index + phoneText.length,
        confidence: 85
      })
    }
  }
}

/**
 * Detects email addresses with RFC-compliant validation.
 *
 * Validates:
 * - Local part length (1-64 characters)
 * - Domain length (1-253 characters)
 * - No leading/trailing dots
 * - Domain contains at least one dot
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectEmails(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Comprehensive email pattern
  // Matches: user@domain.com, user.name@domain.co.uk, user+tag@domain.org, etc.
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

  let match: RegExpExecArray | null
  while ((match = emailPattern.exec(text)) !== null) {
    const email = match[0].toLowerCase()

    // Validate basic structure
    const parts = email.split('@')
    if (parts.length !== 2) continue

    const [local, domain] = parts

    // Local part validations
    if (local.length === 0 || local.length > 64) continue
    if (local.startsWith('.') || local.endsWith('.')) continue

    // Domain validations
    if (domain.length === 0 || domain.length > 253) continue
    if (domain.startsWith('.') || domain.startsWith('-')) continue
    if (!domain.includes('.')) continue

    addEntity({
      text: match[0],
      type: 'email',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 95
    })
  }
}

/**
 * Detects user-defined custom names with 100% confidence.
 *
 * Uses word boundary matching for precise detection.
 * Names are matched case-insensitively.
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectCustomNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  if (customNames.size === 0) return

  for (const name of customNames) {
    // Create case-insensitive pattern for the name
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escapedName}\\b`, 'gi')

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'person',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 100 // User-defined names are 100% confident
      })
    }
  }
}

/**
 * Detects full person names using NLP (compromise library).
 *
 * Filters:
 * - Requires at least 2 name parts (first + last)
 * - Minimum 4 characters
 * - Excludes possessives ('s)
 * - Excludes false positives (Company, Provider, Customer, etc.)
 *
 * Note: Uses text.indexOf() which may match wrong instance if name appears
 * multiple times. This is a known limitation.
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectFullNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const doc = nlp(text)
  const people = doc.people()

  // Common words that indicate false positives
  const falsePositiveWords = [
    'company', 'corporation', 'provider', 'owner', 'customer', 'client',
    'employee', 'employer', 'manager', 'director', 'officer', 'member',
    'partner', 'vendor', 'supplier', 'contractor', 'tenant', 'landlord',
    'buyer', 'seller', 'lender', 'borrower', 'licensee', 'licensor',
    'assignee', 'assignor', 'beneficiary', 'trustee', 'agent', 'principal',
    'party', 'parties', 'entity', 'organization', 'business', 'firm',
    'service', 'services', 'product', 'products', 'software', 'system',
    'user', 'account', 'holder', 'applicant', 'recipient', 'donor',
    'trade', 'mark', 'trademark', 'copyright', 'patent'
  ]

  people.forEach((person: ReturnType<typeof nlp>) => {
    // Clean up the name - remove trailing punctuation
    const name = person.text().replace(/[,;:]+$/, '').trim()

    // Only detect if name has at least 2 parts (first + last)
    const parts = name.trim().split(/\s+/)
    if (parts.length < 2) return

    // Skip if name is too short (likely false positive)
    if (name.length < 4) return

    // Skip if contains possessive 's (like "Provider 's")
    if (name.includes("'s") || name.includes("' s")) return

    // Skip if any part is a common false positive word
    const lowerParts = parts.map(p => p.toLowerCase().replace(/[^a-z]/g, ''))
    if (lowerParts.some(p => falsePositiveWords.includes(p))) return

    // Find position in original text
    const start = text.indexOf(name)
    if (start === -1) return

    addEntity({
      text: name,
      type: 'person',
      start: start,
      end: start + name.length,
      confidence: 85
    })
  })
}

/**
 * Detects IP addresses (IPv4 and IPv6).
 *
 * IPv4: Standard dotted decimal (e.g., 192.168.1.1)
 * IPv6: Full and compressed formats (e.g., 2001:db8::1)
 *
 * Filters version-like numbers (e.g., 1.0.0.0) to reduce false positives.
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectIPAddresses(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const ipPatterns = [
    // IPv4: 192.168.1.1, 10.0.0.1, etc.
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    // IPv6 full: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    // IPv6 compressed: 2001:db8::1, ::1, fe80::
    /\b(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
  ]

  for (const pattern of ipPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      // Validate IPv4 to avoid version numbers like 1.0.0.0
      if (match[0].includes('.') && !match[0].includes(':')) {
        const parts = match[0].split('.')
        // Skip if it looks like a version number (all parts are small)
        const isVersionLike = parts.every(p => parseInt(p, 10) < 10)
        if (isVersionLike) continue
      }

      addEntity({
        text: match[0],
        type: 'ip',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 95
      })
    }
  }
}

/**
 * Detects URLs with protocol prefixes.
 *
 * Supported protocols: http, https, ftp
 * Automatically strips trailing punctuation that's likely not part of URL.
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectURLs(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // URL pattern - matches http://, https://, ftp://, etc.
  const urlPattern = /\b(?:https?|ftp):\/\/[^\s<>\[\]"'`,;)]+/gi

  let match: RegExpExecArray | null
  while ((match = urlPattern.exec(text)) !== null) {
    // Clean up trailing punctuation that might be part of sentence
    let url = match[0]
    // Remove trailing punctuation that's likely not part of URL
    url = url.replace(/[.,;:!?)]+$/, '')

    addEntity({
      text: url,
      type: 'url',
      start: match.index,
      end: match.index + url.length,
      confidence: 95
    })
  }
}

/**
 * Detects standalone domain names (not part of URLs or emails).
 *
 * Matches domains with common TLDs (.com, .org, .io, country codes, etc.)
 * Excludes domains that are part of:
 * - Email addresses (preceded by @)
 * - URLs (preceded by ://)
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectDomains(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Common TLDs to look for
  const tldPattern = /\b(?!www\.)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:com|org|net|io|co|tech|dev|app|ai|cloud|edu|gov|mil|info|biz|me|tv|cc|xyz|online|site|website|store|shop|blog|email|name|pro|mobi|asia|eu|uk|de|fr|es|it|nl|be|ch|at|au|nz|ca|us|in|jp|cn|kr|ru|br|mx|ar|za|ae|sa|eg|ng|ke|il|tr|pl|cz|se|no|fi|dk|pt|gr|ie|hu|ro|bg|hr|sk|si|lt|lv|ee|ua|by|kz|uz|pk|bd|vn|th|id|my|sg|ph|tw|hk)(?:\.[a-z]{2,3})?\b/gi

  let match: RegExpExecArray | null
  while ((match = tldPattern.exec(text)) !== null) {
    const domain = match[0]
    const start = match.index

    // Skip if this domain is part of an email (check for @ immediately before it)
    if (start > 0 && text[start - 1] === '@') continue
    // Also check if there's an @ with no space between
    const textBefore = text.slice(Math.max(0, start - 65), start)
    const lastAt = textBefore.lastIndexOf('@')
    const lastSpace = textBefore.lastIndexOf(' ')
    if (lastAt > lastSpace) continue

    // Skip if this domain is part of a URL (check for :// before it)
    const textBeforeShort = text.slice(Math.max(0, start - 10), start)
    if (textBeforeShort.includes('://')) continue

    addEntity({
      text: domain,
      type: 'domain',
      start: start,
      end: start + domain.length,
      confidence: 90
    })
  }
}

/**
 * Detects Saudi ID numbers (National ID and Iqama).
 *
 * Format:
 * - National ID (citizens): 10 digits starting with 1
 * - Iqama (residents): 10 digits starting with 2
 *
 * Filters:
 * - Excludes numbers preceded by + (likely phone numbers)
 * - Excludes numbers followed by more digits
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectSaudiIDs(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Saudi ID pattern:
  // - National ID (citizens): 10 digits starting with 1
  // - Iqama (residents): 10 digits starting with 2
  const saudiIdPattern = /\b[12]\d{9}\b/g

  let match: RegExpExecArray | null
  while ((match = saudiIdPattern.exec(text)) !== null) {
    const id = match[0]

    // Validate it's exactly 10 digits
    if (id.length !== 10) continue

    // Skip if it looks like a phone number (check context)
    const charBefore = text[match.index - 1] || ''
    const charAfter = text[match.index + id.length] || ''

    // Skip if preceded by + or followed by more digits
    if (charBefore === '+' || /\d/.test(charAfter)) continue

    addEntity({
      text: id,
      type: 'saudi_id',
      start: match.index,
      end: match.index + id.length,
      confidence: 90
    })
  }
}

/**
 * Detects person names from text (returns only custom names).
 *
 * This is a simplified version of entity extraction that only returns
 * custom user-defined names. Used for targeted name detection.
 *
 * @param text - Text to search
 * @returns Array of detected names with positions
 *
 * @example
 * setCustomNames(['John Doe'])
 * const names = detectPersonNames('Contact John Doe for details')
 * // Returns: [{ text: 'John Doe', start: 8, end: 16 }]
 */
export function detectPersonNames(text: string): Array<{ text: string; start: number; end: number }> {
  // Only return custom names now
  const results: Array<{ text: string; start: number; end: number }> = []

  if (customNames.size === 0) return results

  for (const name of customNames) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escapedName}\\b`, 'gi')

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      results.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      })
    }
  }

  return results
}

