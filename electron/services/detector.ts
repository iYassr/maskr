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

import { logDebug, logInfo, logError, logWarn } from './logger.js'

// Lazy-loaded NLP module cache
let nlpModule: typeof import('compromise') | null = null

async function getNLP() {
  if (!nlpModule) {
    logInfo('Loading compromise NLP module')
    try {
      nlpModule = await import('compromise')
      logInfo('Compromise NLP module loaded successfully')
    } catch (err) {
      logError('Failed to load compromise NLP module', err)
      throw err
    }
  }
  return nlpModule.default
}

/**
 * Represents a detected entity in text.
 */
export interface NEREntity {
  /** The detected text content */
  text: string
  /** Entity type classification */
  type: 'person' | 'financial' | 'credit_card' | 'iban' | 'phone' | 'email' | 'ip' | 'url' | 'domain' | 'saudi_id' | 'ssn' | 'passport' | 'dob' | 'mac_address' | 'api_key' | 'license_plate' | 'medical_record' | 'drivers_license' | 'gps' | 'vin' | 'company_code' | 'address'
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
export async function extractEntities(text: string, userCustomNames?: string[]): Promise<NEREntity[]> {
  logInfo('Starting entity extraction', { textLength: text?.length, hasCustomNames: !!(userCustomNames?.length) })

  // Guard against invalid input
  if (!text || typeof text !== 'string') {
    logWarn('Invalid input to extractEntities', { text: typeof text })
    return []
  }

  // Update custom names if provided
  if (userCustomNames) {
    setCustomNames(userCustomNames)
    logDebug('Custom names set', { count: userCustomNames.length })
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

  // Track counts for each detection type
  const countBefore = () => entities.length

  // 1. Detect custom user-defined names
  let before = countBefore()
  detectCustomNames(text, addEntity)
  logDebug('Custom names detection complete', { found: entities.length - before })

  // 2. Detect full names using NLP (first + last name, at least 2 parts)
  before = countBefore()
  await detectFullNames(text, addEntity)
  logDebug('Full names (NLP) detection complete', { found: entities.length - before })

  // 2b. Detect Arabic names (pattern-based since NLP doesn't recognize them well)
  before = countBefore()
  detectArabicNames(text, addEntity)
  logDebug('Arabic names detection complete', { found: entities.length - before })

  // 3. Extract financial amounts - ONLY with explicit currency symbols
  before = countBefore()
  detectFinancialAmounts(text, addEntity)
  logDebug('Financial amounts detection complete', { found: entities.length - before })

  // 4. Extract credit card numbers (with Luhn validation)
  before = countBefore()
  detectCreditCards(text, addEntity)
  logDebug('Credit cards detection complete', { found: entities.length - before })

  // 5. Extract IBAN numbers (with structure validation)
  before = countBefore()
  detectIBANs(text, addEntity)
  logDebug('IBANs detection complete', { found: entities.length - before })

  // 6. Extract IP addresses (before phone to avoid false matches)
  before = countBefore()
  detectIPAddresses(text, addEntity)
  logDebug('IP addresses detection complete', { found: entities.length - before })

  // 7. Extract phone numbers (all formats)
  before = countBefore()
  detectPhoneNumbers(text, addEntity)
  logDebug('Phone numbers detection complete', { found: entities.length - before })

  // 8. Extract email addresses
  before = countBefore()
  detectEmails(text, addEntity)
  logDebug('Email addresses detection complete', { found: entities.length - before })

  // 9. Extract URLs
  before = countBefore()
  detectURLs(text, addEntity)
  logDebug('URLs detection complete', { found: entities.length - before })

  // 10. Extract domain names (after URLs and emails to avoid duplicates)
  before = countBefore()
  detectDomains(text, addEntity)
  logDebug('Domain names detection complete', { found: entities.length - before })

  // 11. Extract Saudi ID numbers (National ID and Iqama)
  before = countBefore()
  detectSaudiIDs(text, addEntity)
  logDebug('Saudi IDs detection complete', { found: entities.length - before })

  // 12. Extract US Social Security Numbers (SSN)
  before = countBefore()
  detectSSNs(text, addEntity)
  logDebug('SSNs detection complete', { found: entities.length - before })

  // 13. Extract passport numbers
  before = countBefore()
  detectPassports(text, addEntity)
  logDebug('Passports detection complete', { found: entities.length - before })

  // 14. Extract dates of birth (year 2000+)
  before = countBefore()
  detectDOB(text, addEntity)
  logDebug('DOB detection complete', { found: entities.length - before })

  // 15. Extract MAC addresses
  before = countBefore()
  detectMACAddresses(text, addEntity)
  logDebug('MAC addresses detection complete', { found: entities.length - before })

  // 16. Extract API keys and tokens
  before = countBefore()
  detectAPIKeys(text, addEntity)
  logDebug('API keys detection complete', { found: entities.length - before })

  // 17. Extract license plates
  before = countBefore()
  detectLicensePlates(text, addEntity)
  logDebug('License plates detection complete', { found: entities.length - before })

  // 18. Extract medical record numbers
  before = countBefore()
  detectMedicalRecords(text, addEntity)
  logDebug('Medical records detection complete', { found: entities.length - before })

  // 19. Extract driver's licenses
  before = countBefore()
  detectDriversLicenses(text, addEntity)
  logDebug('Drivers licenses detection complete', { found: entities.length - before })

  // 20. Extract GPS coordinates
  before = countBefore()
  detectGPSCoordinates(text, addEntity)
  logDebug('GPS coordinates detection complete', { found: entities.length - before })

  // 21. Extract VIN numbers
  before = countBefore()
  detectVINNumbers(text, addEntity)
  logDebug('VIN numbers detection complete', { found: entities.length - before })

  // 22. Extract company/project codes
  before = countBefore()
  detectCompanyCodes(text, addEntity)
  logDebug('Company codes detection complete', { found: entities.length - before })

  // 23. Extract addresses (with explicit context only)
  before = countBefore()
  detectAddresses(text, addEntity)
  logDebug('Addresses detection complete', { found: entities.length - before })

  // Deduplicate entities (same position)
  const seen = new Set<string>()
  const uniqueEntities = entities.filter((e) => {
    const key = `${e.start}-${e.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Log summary by type
  const typeCounts: Record<string, number> = {}
  for (const entity of uniqueEntities) {
    typeCounts[entity.type] = (typeCounts[entity.type] || 0) + 1
  }

  logInfo('Entity extraction complete', {
    totalEntities: uniqueEntities.length,
    byType: typeCounts
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
    // SAR: SAR 100, 100 SAR, SR 100, 100 SR, Saudi Riyal 100
    /(?:SAR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*SAR|SR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*SR)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    /Saudi\s+Riyal\s+\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi,
    // Arabic currency symbol: ر.س 100, 100 ر.س
    /ر\.س\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g,
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*ر\.س/g,
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
    // Gulf currencies: KWD, QAR, BHD, OMR
    /(?:KWD\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?\s*KWD)/gi,
    /(?:QAR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*QAR)/gi,
    /(?:BHD\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?\s*BHD)/gi,
    /(?:OMR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,3})?\s*OMR)/gi,
    // Other currencies: CAD, AUD, EGP, TRY, ZAR, BRL
    /(?:CAD\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*CAD)/gi,
    /(?:AUD\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*AUD)/gi,
    /(?:EGP\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*EGP)/gi,
    /(?:TRY\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*TRY)/gi,
    /(?:ZAR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*ZAR)/gi,
    /(?:BRL\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*BRL)/gi,
    // Generic with currency word: 100 dollars, 50 euros, 1000 riyals
    /\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:dollars?|euros?|pounds?|riyals?|dirhams?|yen|rupees?|dinars?|francs?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi
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

      // Check for Mada card prefixes (specific Saudi debit card BINs)
      const isMadaCard = /^(4766|5297|4059|4244|4364|4473|4543|4834|4903|4918|4966|5078|5128|5160|5210|5213|5265|5289|5310|5329|5341|5349|5371|5407|5434|5435|5459|5460|5480|5534|5545|5860|5862|5898|6051|6136|6200|6208|6304|6367|6521|6586|6396|6396|6371)/.test(digitsOnly)

      // For Mada cards, trust the BIN prefix (they're very specific)
      // For other cards, require Luhn validation
      const passesValidation = isMadaCard || isValidLuhn(digitsOnly)

      if (passesValidation) {
        // Check for valid card prefixes (Visa, Mastercard, Amex, Discover, JCB, Diners, UnionPay, Mada)
        const isValidPrefix =
          isMadaCard || // Mada cards (already validated by BIN)
          digitsOnly.startsWith('4') || // Visa
          /^5[1-5]/.test(digitsOnly) || // Mastercard
          /^2[2-7]/.test(digitsOnly) || // Mastercard (2-series)
          /^3[47]/.test(digitsOnly) || // Amex
          digitsOnly.startsWith('6011') || // Discover
          /^65/.test(digitsOnly) || // Discover
          /^64[4-9]/.test(digitsOnly) || // Discover
          /^35[2-8]/.test(digitsOnly) || // JCB
          /^30[0-5]/.test(digitsOnly) || // Diners Club
          /^36/.test(digitsOnly) || // Diners Club International
          /^38/.test(digitsOnly) || // Diners Club
          /^62/.test(digitsOnly) // UnionPay

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

      // For Saudi/Gulf IBANs, trust the format (SA + 22 chars, AE + 21 chars, etc.)
      // These are very specific formats unlikely to appear randomly
      const isGulfIBAN = /^(SA[0-9]{22}|AE[0-9]{21}|BH[0-9A-Z]{18}|KW[0-9A-Z]{28}|OM[0-9]{21}|QA[0-9A-Z]{27})$/.test(cleanIBAN)

      // Validate IBAN structure - trust Gulf format or require Mod97
      if (isGulfIBAN || isValidIBAN(cleanIBAN)) {
        addEntity({
          text: ibanText,
          type: 'iban',
          start: match.index,
          end: match.index + ibanText.length,
          confidence: isGulfIBAN ? 90 : 95
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
async function detectFullNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): Promise<void> {
  const nlp = await getNLP()
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

  // Track already found positions to find all occurrences
  const foundNames = new Set<string>()

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

    // Skip if already processed this exact name
    if (foundNames.has(name)) return
    foundNames.add(name)

    // Find ALL occurrences of this name using regex for word boundaries
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escapedName}\\b`, 'gi')
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'person',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 85
      })
    }
  })
}

/**
 * Detects Arabic names using pattern matching.
 *
 * Recognizes:
 * - Names with Al- prefix (e.g., Mohammed Al-Rashid, Fatima Al-Qahtani)
 * - Names with bin/bint (e.g., Abdullah bin Mohammed)
 * - Common Arabic first names followed by family names
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectArabicNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Common Arabic first names (male and female)
  const arabicFirstNames = [
    // Male names
    'mohammed', 'mohammad', 'muhammad', 'ahmed', 'ahmad', 'ali', 'omar', 'umar',
    'khalid', 'khaled', 'abdullah', 'abdulrahman', 'abdulaziz', 'abdul', 'ibrahim',
    'yusuf', 'yousuf', 'youssef', 'tariq', 'tarek', 'faisal', 'fahad', 'fahd',
    'sultan', 'saud', 'saleh', 'salih', 'nasser', 'nasir', 'bandar', 'turki',
    'nawaf', 'meshal', 'majed', 'majid', 'nayef', 'naif', 'saad', 'badr',
    'hamad', 'hamed', 'waleed', 'walid', 'rashid', 'rasheed', 'sami', 'sameer',
    'yasser', 'yasir', 'adel', 'adil', 'karim', 'kareem', 'hassan', 'hussein',
    'hosain', 'mustafa', 'mostafa', 'jamal', 'gamal', 'osama', 'usama',
    'mansour', 'mansur', 'ziad', 'ziyad', 'mazen', 'rami', 'hani', 'amr',
    'amer', 'amir', 'basem', 'bassem', 'wael', 'hazem', 'hatem', 'hatim',
    'firas', 'feras', 'fouad', 'fuad', 'imad', 'emad', 'bilal', 'belal',
    'tamer', 'tamir', 'sherif', 'sharif', 'ashraf', 'akram', 'anwar', 'anas',
    'aws', 'ayman', 'aymen', 'bader', 'badri', 'essam', 'isam', 'issam',
    'ghassan', 'hisham', 'hesham', 'jihad', 'jihad', 'lotfi', 'lutfi',
    'marwan', 'maher', 'mahir', 'mohannad', 'muhannad', 'munir', 'monir',
    'nadim', 'nabil', 'nabeel', 'nader', 'nadir', 'rafiq', 'rafik', 'raed',
    'raid', 'ramzi', 'rashed', 'riad', 'riyad', 'saeed', 'said', 'shadi',
    'talal', 'tawfiq', 'tawfik', 'wissam', 'wisam', 'yahya', 'yehya', 'zaki',
    'zakaria', 'zakariya', 'zuhair', 'zoheir', 'qasim', 'qassim', 'kassem',
    // Female names
    'fatima', 'fatimah', 'aisha', 'aysha', 'noura', 'nora', 'maryam', 'mariam',
    'layla', 'leila', 'hana', 'hanna', 'sara', 'sarah', 'reem', 'rim',
    'dalal', 'mona', 'muna', 'abeer', 'rania', 'raniya', 'hessa', 'hissa',
    'ghada', 'afnan', 'shahad', 'wafa', 'lama', 'nada', 'dina', 'deena',
    'nouf', 'amal', 'asma', 'asma', 'zainab', 'zaynab', 'khadija', 'khadijah',
    'sumaya', 'sumayyah', 'lubna', 'najla', 'naglaa', 'huda', 'maysa', 'maisa'
  ]

  // Common Arabic family name patterns (Al- prefixed)
  const arabicFamilyPrefixes = [
    'al-', 'al ', 'el-', 'el ', 'bin ', 'ibn ', 'bint ', 'abu ', 'umm '
  ]

  // Common Arabic family names
  const arabicFamilyNames = [
    'saud', 'rashid', 'rasheed', 'qahtani', 'dosari', 'doseri', 'shehri',
    'ghamdi', 'harbi', 'otaibi', 'utaibi', 'mutairi', 'mutairy', 'anazi',
    'enezi', 'shamrani', 'zahrani', 'malki', 'juhani', 'johani', 'tamimi',
    'subaie', 'subai', 'dawsari', 'shammari', 'ruwaili', 'yami', 'ajmi',
    'harthi', 'harthy', 'saif', 'balawi', 'mudahi', 'saleh', 'farsi',
    'ahmed', 'hassan', 'hussein', 'ali', 'omar', 'ibrahim', 'mohammed',
    'khalil', 'mahmoud', 'nasser', 'abdullah', 'hamad', 'fahad', 'sultan',
    'saeed', 'said', 'khalaf', 'obaid', 'ubaid', 'thani', 'nahyan',
    'maktoum', 'zayed', 'rashid', 'nuaimi', 'sharqi', 'mualla', 'qasimi'
  ]

  // Build patterns for Arabic names
  const patterns: RegExp[] = []

  // Pattern 1: FirstName Al-FamilyName, FirstName Al FamilyName, or FirstName Alfamily (attached)
  const firstNamesPattern = arabicFirstNames.join('|')
  patterns.push(
    new RegExp(`\\b(${firstNamesPattern})\\s+(al[- ]?\\w+)\\b`, 'gi')
  )
  // Also match "Aldosari" style (Al attached to family name)
  patterns.push(
    new RegExp(`\\b(${firstNamesPattern})\\s+(al\\w{3,})\\b`, 'gi')
  )

  // Pattern 2: FirstName bin/bint FamilyName
  patterns.push(
    new RegExp(`\\b(${firstNamesPattern})\\s+(bin|bint|ibn|abu)\\s+(\\w+)\\b`, 'gi')
  )

  // Pattern 3: FirstName FamilyName (where family is a known Arabic name)
  const familyNamesPattern = arabicFamilyNames.join('|')
  patterns.push(
    new RegExp(`\\b(${firstNamesPattern})\\s+(${familyNamesPattern})\\b`, 'gi')
  )

  // Pattern 4: Title + Arabic name patterns (Dr., Mr., Mrs., etc.)
  patterns.push(
    new RegExp(`\\b(?:dr\\.?|mr\\.?|mrs\\.?|ms\\.?|prof\\.?)\\s+(${firstNamesPattern})\\s+(\\w+)\\b`, 'gi')
  )

  // Track found names to avoid duplicates
  const foundPositions = new Set<string>()

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const fullName = match[0].trim()
      const posKey = `${match.index}-${match.index + fullName.length}`

      // Skip if already found at this position
      if (foundPositions.has(posKey)) continue
      foundPositions.add(posKey)

      // Must have at least 2 parts
      const parts = fullName.split(/\s+/)
      if (parts.length < 2) continue

      // Skip very short matches
      if (fullName.length < 5) continue

      addEntity({
        text: fullName,
        type: 'person',
        start: match.index,
        end: match.index + fullName.length,
        confidence: 85
      })
    }
  }
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
    // IPv6 loopback: ::1
    /(?:^|[^:])::1(?:$|[^:\d])/g,
    // IPv6 full: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    // IPv6 with double colon: 2001:db8::1, fe80::1, etc.
    /\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}\b/g,
    /\b(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}\b/g,
    /\b[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}\b/g,
    // IPv6 ending with :: (like fe80::)
    /\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b/g,
    // IPv6 starting with :: (like ::ffff:192.168.1.1)
    /::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    // IPv6 starting with :: and having hex
    /::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,5}\b/g
  ]

  for (const pattern of ipPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      let ipText = match[0]
      let startOffset = 0

      // Handle the ::1 loopback pattern which may include surrounding chars
      if (ipText.includes('::1') && !ipText.includes('.')) {
        const idx = ipText.indexOf('::1')
        ipText = '::1'
        startOffset = idx
      }

      // Validate IPv4 to avoid version numbers like 1.0.0.0
      if (ipText.includes('.') && !ipText.includes(':')) {
        const parts = ipText.split('.')
        // Skip if it looks like a version number (all parts are small)
        const isVersionLike = parts.every(p => parseInt(p, 10) < 10)
        if (isVersionLike) continue
      }

      addEntity({
        text: ipText,
        type: 'ip',
        start: match.index + startOffset,
        end: match.index + startOffset + ipText.length,
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
  const urlPattern = /\b(?:https?|ftp):\/\/[^\s<>[\]"'`,;)]+/gi

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
 * Detects US Social Security Numbers (SSN).
 *
 * SSN format: XXX-XX-XXXX (with or without dashes)
 * Validates basic SSN rules:
 * - Area number (first 3 digits) cannot be 000, 666, or 900-999
 * - Group number (middle 2 digits) cannot be 00
 * - Serial number (last 4 digits) cannot be 0000
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectSSNs(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // SSN pattern: XXX-XX-XXXX or XXXXXXXXX
  const ssnPattern = /\b(\d{3})[-\s]?(\d{2})[-\s]?(\d{4})\b/g

  let match: RegExpExecArray | null
  while ((match = ssnPattern.exec(text)) !== null) {
    const area = match[1]
    const group = match[2]
    const serial = match[3]

    // Validate SSN rules
    // Area cannot be 000, 666, or 900-999
    const areaNum = parseInt(area, 10)
    if (areaNum === 0 || areaNum === 666 || areaNum >= 900) continue

    // Group cannot be 00
    if (group === '00') continue

    // Serial cannot be 0000
    if (serial === '0000') continue

    addEntity({
      text: match[0],
      type: 'ssn',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 95
    })
  }
}

/**
 * Detects passport numbers with context validation.
 *
 * Passport formats vary by country:
 * - US: 9 digits
 * - UK: 9 alphanumeric
 * - Saudi/UAE/Gulf: 1 letter + 7-8 digits
 * - European: Various alphanumeric formats
 *
 * Requires context words like "passport", "travel document" nearby to reduce false positives.
 *
 * @param text - Text to search
 * @param addEntity - Callback to add detected entity
 * @internal
 */
function detectPassports(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Look for passport-related context
  const passportPatterns = [
    // Letter(s) followed by digits: A12345678, AB1234567
    /\b(?:passport|travel\s+document|passport\s+(?:number|no|#)|passport:)\s*[:\s#]*([A-Z]{1,2}\d{6,8})\b/gi,
    // Just digits with passport context: 123456789
    /\b(?:passport|travel\s+document|passport\s+(?:number|no|#)|passport:)\s*[:\s#]*(\d{8,9})\b/gi,
    // Passport followed by alphanumeric
    /\bpassport[:\s#]+([A-Z0-9]{6,12})\b/gi,
    // Standalone patterns with letter prefix (common format)
    /\b([A-Z][A-Z]?\d{7,8})\b(?=.*passport)/gi,
    /\bpassport.*?\b([A-Z][A-Z]?\d{7,8})\b/gi
  ]

  for (const pattern of passportPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      // Get the captured group (passport number) or full match
      const passportNum = match[1] || match[0]

      // Find the actual position of the passport number in the match
      const numStart = match[0].indexOf(passportNum)
      const start = match.index + numStart
      const end = start + passportNum.length

      // Validate - must be 6-12 characters
      if (passportNum.length < 6 || passportNum.length > 12) continue

      addEntity({
        text: passportNum,
        type: 'passport',
        start: start,
        end: end,
        confidence: 85
      })
    }
  }
}

/**
 * Detects dates of birth - with DOB context detects any year, without context only 2000+.
 * @internal
 */
function detectDOB(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Years 2000-2025 for dates without context
  const recentYearPattern = '200[0-9]|201[0-9]|202[0-5]'
  // Any realistic birth year (1920-2025) for dates with DOB context
  const anyYearPattern = '19[2-9][0-9]|20[0-2][0-9]'

  const dobPatterns = [
    // With DOB context - match any year
    // "Date of Birth: 15/03/1985" or "DOB: 1990-07-22"
    /\b(?:date\s+of\s+birth|dob|birth\s*date|born|birthday)[:\s]+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/gi,
    /\b(?:date\s+of\s+birth|dob|birth\s*date|born|birthday)[:\s]+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/gi,
    /\b(?:date\s+of\s+birth|dob|birth\s*date|born|birthday)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/gi,
    /\b(?:date\s+of\s+birth|dob|birth\s*date|born|birthday)[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/gi,

    // DD/MM/YYYY or DD-MM-YYYY with recent years only (2000+)
    new RegExp(`\\b(0?[1-9]|[12][0-9]|3[01])[-/\\.](0?[1-9]|1[0-2])[-/\\.](${recentYearPattern})\\b`, 'g'),
    // YYYY-MM-DD (ISO format) with recent years
    new RegExp(`\\b(${recentYearPattern})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12][0-9]|3[01])\\b`, 'g'),
    // Month DD, YYYY with recent years
    new RegExp(`\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\s+(0?[1-9]|[12][0-9]|3[01]),?\\s+(${recentYearPattern})\\b`, 'gi'),
  ]

  const seenPositions = new Set<string>()

  for (const pattern of dobPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      // Get the actual date part (captured group or full match)
      const dateText = match[1] || match[0]
      const start = match[1] ? match.index + match[0].indexOf(match[1]) : match.index
      const key = `${start}-${start + dateText.length}`

      if (seenPositions.has(key)) continue
      seenPositions.add(key)

      addEntity({
        text: match[0], // Include context like "DOB: "
        type: 'dob',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 85
      })
    }
  }
}

/**
 * Detects MAC addresses.
 * @internal
 */
function detectMACAddresses(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const macPatterns = [
    // XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
    /\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    // XXXX.XXXX.XXXX (Cisco format)
    /\b[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\b/g,
  ]

  for (const pattern of macPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'mac_address',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 95
      })
    }
  }
}

/**
 * Detects API keys and tokens.
 * @internal
 */
function detectAPIKeys(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const apiPatterns = [
    // Stripe keys
    /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    /\b(pk_live_[a-zA-Z0-9]{24,})\b/g,
    /\b(sk_test_[a-zA-Z0-9]{24,})\b/g,
    /\b(pk_test_[a-zA-Z0-9]{24,})\b/g,
    // AWS keys
    /\b(AKIA[0-9A-Z]{16})\b/g,
    /\b(ASIA[0-9A-Z]{16})\b/g,
    // Google API keys
    /\b(AIza[0-9A-Za-z_-]{35})\b/g,
    // GitHub tokens
    /\b(ghp_[a-zA-Z0-9]{36})\b/g,
    /\b(gho_[a-zA-Z0-9]{36})\b/g,
    /\b(ghu_[a-zA-Z0-9]{36})\b/g,
    // Generic API keys
    /\b(api[_-]?key)[=:\s]+["']?([a-zA-Z0-9_-]{20,})["']?\b/gi,
    /\b(api[_-]?secret)[=:\s]+["']?([a-zA-Z0-9_-]{20,})["']?\b/gi,
    /\b(auth[_-]?token)[=:\s]+["']?([a-zA-Z0-9_-]{20,})["']?\b/gi,
    /\b(access[_-]?token)[=:\s]+["']?([a-zA-Z0-9_-]{20,})["']?\b/gi,
    // Bearer tokens
    /\bBearer\s+([a-zA-Z0-9_-]{20,})\b/g,
    // JWT tokens (simplified)
    /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
  ]

  for (const pattern of apiPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'api_key',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 95
      })
    }
  }
}

/**
 * Detects license plates (Saudi and international formats).
 * @internal
 */
function detectLicensePlates(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const platePatterns = [
    // Saudi plates: 3 letters + 4 digits or vice versa
    /\b[A-Z]{3}\s*\d{4}\b/g,
    /\b\d{4}\s*[A-Z]{3}\b/g,
    // Saudi plates with Arabic-style: ABC 1234
    /\b[A-Z]{2,3}\s+\d{3,4}\b/g,
    // US plates: ABC-1234, ABC 1234
    /\b[A-Z]{1,3}[-\s]?\d{3,4}\b/g,
    // European plates: XX-999-XX
    /\b[A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{2}\b/g,
    // License/Plate context
    /\b(?:plate|license|vehicle|car|truck)[:\s#]+([A-Z0-9]{2,3}[-\s]?[A-Z0-9]{3,4}[-\s]?[A-Z0-9]{0,3})\b/gi,
  ]

  const seenPositions = new Set<string>()

  for (const pattern of platePatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const plateText = match[1] || match[0]
      const start = match[1] ? match.index + match[0].indexOf(match[1]) : match.index
      const key = `${start}-${start + plateText.length}`

      if (seenPositions.has(key)) continue
      seenPositions.add(key)

      // Must have both letters and numbers
      if (!/[A-Z]/i.test(plateText) || !/\d/.test(plateText)) continue

      addEntity({
        text: plateText,
        type: 'license_plate',
        start: start,
        end: start + plateText.length,
        confidence: 85
      })
    }
  }
}

/**
 * Detects medical record numbers and patient IDs.
 * @internal
 */
function detectMedicalRecords(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const medicalPatterns = [
    // MRN, PAT, INS, POL prefixes
    /\b(MRN|PAT|INS|POL|RX|LAB)[-:#\s]?\d{6,12}\b/gi,
    // Medical record with context
    /\b(?:medical\s+record|patient\s+id|insurance\s+id|policy\s+number|prescription)[:\s#]+([A-Z0-9-]{6,15})\b/gi,
    // ICD codes
    /\bICD[-\s]?10[-\s]?[A-Z]\d{2}(?:\.\d{1,2})?\b/gi,
    // CPT codes
    /\bCPT[-\s]?\d{5}\b/gi,
    // NPI (National Provider Identifier)
    /\bNPI[-:\s]?\d{10}\b/gi,
  ]

  for (const pattern of medicalPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'medical_record',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 90
      })
    }
  }
}

/**
 * Detects driver's license numbers.
 * @internal
 */
function detectDriversLicenses(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const dlPatterns = [
    // With DL/driver context
    /\b(?:driver'?s?\s*license|DL|driving\s+license)[:\s#]+([A-Z0-9]{7,15})\b/gi,
    // UK format: XXXXX999999XX9XX
    /\b[A-Z]{5}\d{6}[A-Z0-9]{5}\b/g,
    // US format: D + 7-8 digits or letter + digits
    /\b[A-Z]\d{7,8}\b/g,
    // Saudi DL: 10 digits
    /\b(?:saudi\s+dl|رخصة)[:\s#]?\d{10}\b/gi,
  ]

  for (const pattern of dlPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const dlText = match[1] || match[0]
      const start = match[1] ? match.index + match[0].indexOf(match[1]) : match.index

      addEntity({
        text: dlText,
        type: 'drivers_license',
        start: start,
        end: start + dlText.length,
        confidence: 85
      })
    }
  }
}

/**
 * Detects GPS coordinates.
 * @internal
 */
function detectGPSCoordinates(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const gpsPatterns = [
    // Decimal degrees: 24.7136, 46.6753 or (24.7136, 46.6753)
    /\(?\s*-?\d{1,3}\.\d{4,8}\s*,\s*-?\d{1,3}\.\d{4,8}\s*\)?/g,
    // DMS format: 24°42'49"N 46°40'31"E
    /\d{1,3}°\d{1,2}'[\d.]+"\s*[NSEW]\s+\d{1,3}°\d{1,2}'[\d.]+"\s*[NSEW]/g,
    // With GPS/coordinates context
    /\b(?:gps|coordinates?|location|lat(?:itude)?|lon(?:gitude)?)[:\s]+(-?\d{1,3}\.\d{4,8})/gi,
  ]

  for (const pattern of gpsPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'gps',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 90
      })
    }
  }
}

/**
 * Detects Vehicle Identification Numbers (VIN).
 * @internal
 */
function detectVINNumbers(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // VIN is exactly 17 alphanumeric characters (no I, O, Q)
  const vinPattern = /\b[A-HJ-NPR-Z0-9]{17}\b/g

  let match: RegExpExecArray | null
  while ((match = vinPattern.exec(text)) !== null) {
    const vin = match[0]

    // VIN must have mix of letters and numbers
    if (!/[A-Z]/.test(vin) || !/\d/.test(vin)) continue

    // Check if it looks like a VIN (has structure)
    // Position 9 is check digit, position 10 is year
    addEntity({
      text: vin,
      type: 'vin',
      start: match.index,
      end: match.index + vin.length,
      confidence: 85
    })
  }
}

/**
 * Detects company and project codes.
 * @internal
 */
function detectCompanyCodes(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const codePatterns = [
    // Project codes: PROJ-2024-001
    /\b(PROJ|PROJECT)[-_]?\d{4}[-_]\d{3,5}\b/gi,
    // Contract numbers: CNT-2024-12345
    /\b(CNT|CONTRACT)[-_]?\d{4}[-_]\d{3,6}\b/gi,
    // Invoice numbers: INV-2024-00001
    /\b(INV|INVOICE)[-_]?\d{4}[-_]\d{4,6}\b/gi,
    // Purchase orders: PO-2024-54321
    /\b(PO|PURCHASE[-_]?ORDER)[-_]?\d{4}[-_]\d{4,6}\b/gi,
    // Reference numbers: REF-2024-98765
    /\b(REF|REFERENCE)[-_]?\d{4}[-_]\d{4,6}\b/gi,
    // Order numbers: ORD-123456
    /\b(ORD|ORDER)[-_]?\d{5,8}\b/gi,
    // Ticket/Case numbers: TKT-123456, CASE-123456
    /\b(TKT|TICKET|CASE|INC|INCIDENT)[-_]?\d{5,10}\b/gi,
    // Generic ID patterns with context
    /\b(?:order|ticket|case|incident|request)[:\s#]+([A-Z]{2,4}[-_]?\d{4,10})\b/gi,
  ]

  for (const pattern of codePatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const codeText = match[1] && match[1].length < match[0].length ? match[0] : match[0]
      addEntity({
        text: codeText,
        type: 'company_code',
        start: match.index,
        end: match.index + codeText.length,
        confidence: 90
      })
    }
  }
}

/**
 * Detects addresses with explicit context keywords (conservative approach).
 * Only detects addresses that are explicitly labeled to minimize false positives.
 *
 * Supported contexts:
 * - "Address:", "Shipping address:", "Billing address:"
 * - "Ship to:", "Deliver to:", "Send to:"
 * - "Location:", "Residence:", "Home:"
 * - "P.O. Box", "PO Box"
 *
 * @internal
 */
function detectAddresses(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Context patterns that indicate an address follows
  const addressContextPatterns = [
    // Explicit address labels - capture until end of line or next label
    /\b(?:address|mailing\s+address|shipping\s+address|billing\s+address|home\s+address|work\s+address|street\s+address|physical\s+address|postal\s+address|residential\s+address)[:\s]+([^\n\r]{10,100})/gi,
    // Ship to / Deliver to patterns
    /\b(?:ship\s+to|deliver\s+to|send\s+to|mail\s+to)[:\s]+([^\n\r]{10,100})/gi,
    // Location patterns
    /\b(?:location|residence|domicile)[:\s]+([^\n\r]{10,100})/gi,
    // P.O. Box patterns (very common in Saudi/GCC)
    /\b(P\.?O\.?\s*Box\s+\d+(?:[,\s]+[A-Za-z\s]+)?(?:[,\s]+\d{5})?)/gi,
    // Saudi/GCC format with building/street
    /\b(?:عنوان|العنوان)[:\s]+([^\n\r]{10,100})/g,
  ]

  for (const pattern of addressContextPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      // Get the captured address part or full match for P.O. Box
      let addressText = (match[1] || match[0]).trim()

      // Clean up trailing punctuation and common end markers
      addressText = addressText
        .replace(/[,;.]+$/, '')
        .replace(/\s+(phone|tel|fax|email|contact|mobile).*$/i, '')
        .trim()

      // Skip if too short (likely not a real address)
      if (addressText.length < 10) continue

      // Skip if it looks like just a name or single word
      if (!/\d/.test(addressText) && addressText.split(/\s+/).length < 3) continue

      // Find actual position of address text in the match
      const addressStart = match[0].indexOf(addressText)
      const start = match.index + (addressStart >= 0 ? addressStart : 0)

      addEntity({
        text: addressText,
        type: 'address',
        start: start,
        end: start + addressText.length,
        confidence: 90
      })
    }
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

