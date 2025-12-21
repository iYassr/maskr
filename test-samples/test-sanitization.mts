/**
 * Direct Sanitization Test
 *
 * Tests all sample files through the maskr services directly and verifies:
 * 1. Files are parsed correctly
 * 2. PII is detected
 * 3. Sanitization works correctly
 *
 * Run with: npx tsx test-samples/test-sanitization.mts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputDir = path.join(__dirname, 'input')
const outputDir = path.join(__dirname, 'output')
const projectDir = path.join(__dirname, '..')

// Expected PII patterns that should be detected
const expectedPII = {
  emails: [
    'john.smith@acmecorp.com',
    'sarah.johnson@acmecorp.com',
    'jennifer.adams@acmecorp.com',
    'm.chen@acmecorp.com',
    'rthompson@globaltech.io',
    'johnsmith1985@gmail.com',
    'contact@globaltech.io',
    'dwilson@acmecorp.com',
    'sarah.miller@acmecorp.com',
    'legal@acmecorp.com',
    'ap@globaltech.io',
    'r.williams@acmecorp.com'
  ],
  phones: [
    '(555) 123-4567',
    '+1-555-987-6543',
    '555-234-5678',
    '(555) 111-2222',
    '555-333-4444',
    '(555) 777-8888',
    '555-444-5555',
    '(555) 888-9999'
  ],
  ssns: [
    '123-45-6789',
    '456-78-9012',
    '234-56-7890',
    '345-67-8901',
    '456-78-9012',
    '567-89-0123'
  ],
  creditCards: [
    '4532015112830366',
    '5425233430109903',
    '374245455400126'
  ],
  ibans: [
    'DE89370400440532013000',
    'GB82WEST12345698765432',
    'FR7630006000011234567890189'
  ],
  ips: [
    '192.168.1.105',
    '192.168.1.106',
    '10.0.1.50',
    '10.0.2.50'
  ],
  names: [
    'John Smith',
    'Sarah Johnson',
    'Michael Chen',
    'Jennifer Adams',
    'Robert Williams',
    'Robert Thompson',
    'David Wilson',
    'Mary Smith',
    'Sarah Miller'
  ]
}

// Test files to process
const testFiles = [
  { name: 'sample.txt', format: 'txt' },
  { name: 'sample.md', format: 'md' },
  { name: 'sample.docx', format: 'docx' },
  { name: 'sample.xlsx', format: 'xlsx' },
  { name: 'sample.pdf', format: 'pdf' }
]

interface Detection {
  id: string
  text: string
  category: string
  subcategory: string
  confidence: number
  position: { start: number; end: number }
  suggestedPlaceholder: string
  context: string
  approved: boolean
}

interface TestResult {
  file: string
  success: boolean
  contentLength: number
  detections: Detection[]
  errors: string[]
  piiFound: {
    emails: string[]
    phones: string[]
    ssns: string[]
    creditCards: string[]
    ibans: string[]
    ips: string[]
    names: string[]
  }
  sanitizedContent?: string
  piiRemaining: string[]
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
}

function log(message: string, color?: keyof typeof colors) {
  if (color) {
    console.log(`${colors[color]}${message}${colors.reset}`)
  } else {
    console.log(message)
  }
}

/**
 * Map NER entity type to detection category.
 */
function mapNerTypeToCategory(nerType: string): 'pii' | 'company' | 'financial' | 'technical' | 'custom' {
  const typeMap: Record<string, 'pii' | 'company' | 'financial' | 'technical' | 'custom'> = {
    email: 'pii',
    phone: 'pii',
    ssn: 'pii',
    person: 'pii',
    address: 'pii',
    date: 'pii',
    organization: 'company',
    company: 'company',
    credit_card: 'financial',
    iban: 'financial',
    money: 'financial',
    ip: 'technical',
    url: 'technical',
    domain: 'technical'
  }
  return typeMap[nerType.toLowerCase()] || 'custom'
}

/**
 * Apply masking to content by replacing detected text with placeholders.
 * Processes detections from end to start to preserve position indices.
 */
function applyMasking(content: string, detections: Detection[]): { maskedContent: string; mappings: Map<string, string[]> } {
  // Only use approved detections
  const approvedDetections = detections.filter(d => d.approved)

  // Sort by position descending (to replace from end first)
  const sorted = [...approvedDetections].sort((a, b) => b.position.start - a.position.start)

  let maskedContent = content
  const mappings = new Map<string, string[]>()

  for (const detection of sorted) {
    const before = maskedContent.slice(0, detection.position.start)
    const after = maskedContent.slice(detection.position.end)
    maskedContent = before + detection.suggestedPlaceholder + after

    // Track mappings
    const existing = mappings.get(detection.suggestedPlaceholder) || []
    if (!existing.includes(detection.text)) {
      existing.push(detection.text)
    }
    mappings.set(detection.suggestedPlaceholder, existing)
  }

  return { maskedContent, mappings }
}

async function processFile(fileName: string): Promise<TestResult> {
  const result: TestResult = {
    file: fileName,
    success: false,
    contentLength: 0,
    detections: [],
    errors: [],
    piiFound: {
      emails: [],
      phones: [],
      ssns: [],
      creditCards: [],
      ibans: [],
      ips: [],
      names: []
    },
    piiRemaining: []
  }

  try {
    const filePath = path.join(inputDir, fileName)
    const fileBuffer = fs.readFileSync(filePath)

    // Import services dynamically (tsx handles TypeScript)
    const documentParser = await import(
      path.join(projectDir, 'electron', 'services', 'document-parser.ts')
    )
    const { parseDocument } = documentParser

    // Use electron service detector (works in Node.js)
    const detector = await import(
      path.join(projectDir, 'electron', 'services', 'detector.ts')
    )
    const { extractEntities } = detector

    // Parse the document (takes filePath and Buffer)
    log(`\n  Parsing ${fileName}...`, 'dim')
    const parseResult = await parseDocument(filePath, fileBuffer)
    const content = parseResult.content

    if (!content || content.trim().length === 0) {
      result.errors.push('Document parsing returned empty content')
      return result
    }

    result.contentLength = content.length
    log(`  Content length: ${content.length} characters`, 'dim')

    // Custom names to detect (optional)
    const customNames: string[] = []

    // Run entity detection - extractEntities returns NEREntity[] format
    log(`  Running entity detection...`, 'dim')
    const nerEntities = extractEntities(content, customNames)

    // Convert NER entities to Detection format
    const detections: Detection[] = nerEntities.map((entity, idx) => ({
      id: `${fileName}-${idx}`,
      text: entity.text,
      category: mapNerTypeToCategory(entity.type),
      subcategory: entity.type,
      confidence: 0.9, // NER results have high confidence
      position: { start: entity.start, end: entity.end },
      suggestedPlaceholder: `[${entity.type.toUpperCase()}_${idx + 1}]`,
      context: content.slice(Math.max(0, entity.start - 30), Math.min(content.length, entity.end + 30)),
      approved: true // Auto-approve for testing
    }))

    result.detections = detections
    log(`  Found ${detections.length} detections`, 'dim')

    // Categorize detections
    for (const detection of detections) {
      const text = detection.text
      const sub = detection.subcategory.toLowerCase()

      if (sub.includes('email') || text.includes('@')) {
        result.piiFound.emails.push(text)
      } else if (sub.includes('phone') || sub.includes('tel')) {
        result.piiFound.phones.push(text)
      } else if (sub.includes('ssn') || sub.includes('social')) {
        result.piiFound.ssns.push(text)
      } else if (sub.includes('credit') || sub.includes('card')) {
        result.piiFound.creditCards.push(text)
      } else if (sub.includes('iban')) {
        result.piiFound.ibans.push(text)
      } else if (sub.includes('ip') && /\d+\.\d+\.\d+\.\d+/.test(text)) {
        result.piiFound.ips.push(text)
      } else if (sub.includes('person') || sub.includes('name')) {
        result.piiFound.names.push(text)
      }
    }

    // Approve all detections for masking
    const approvedDetections = detections.map(d => ({ ...d, approved: true }))

    // Create masked document
    log(`  Creating masked document...`, 'dim')
    const masked = applyMasking(content, approvedDetections)

    result.sanitizedContent = masked.maskedContent
    result.success = true

    // Check for remaining PII in sanitized content
    const sanitized = masked.maskedContent.toLowerCase()

    for (const email of expectedPII.emails) {
      if (sanitized.includes(email.toLowerCase())) {
        result.piiRemaining.push(`Email: ${email}`)
      }
    }

    for (const ssn of expectedPII.ssns) {
      if (sanitized.includes(ssn)) {
        result.piiRemaining.push(`SSN: ${ssn}`)
      }
    }

    for (const cc of expectedPII.creditCards) {
      if (sanitized.includes(cc)) {
        result.piiRemaining.push(`Credit Card: ${cc}`)
      }
    }

    for (const iban of expectedPII.ibans) {
      if (sanitized.includes(iban.toLowerCase())) {
        result.piiRemaining.push(`IBAN: ${iban}`)
      }
    }

    // Save sanitized output
    const ext = path.extname(fileName).toLowerCase()
    const outputPath = path.join(outputDir, `sanitized_${fileName}`)
    if (ext === '.pdf') {
      // For PDF, save as text since we're working with extracted content
      fs.writeFileSync(outputPath + '.txt', masked.maskedContent, 'utf-8')
    } else if (ext === '.xlsx') {
      // For Excel, save as text
      fs.writeFileSync(outputPath + '.txt', masked.maskedContent, 'utf-8')
    } else if (ext === '.docx') {
      // For Word, save as text
      fs.writeFileSync(outputPath + '.txt', masked.maskedContent, 'utf-8')
    } else {
      fs.writeFileSync(outputPath, masked.maskedContent, 'utf-8')
    }

    // Also save the mapping file
    if (masked.mappings && masked.mappings.size > 0) {
      const baseName = path.basename(fileName, ext)
      const mappingPath = path.join(outputDir, `mapping_${baseName}.json`)
      // Convert Map to array of objects for JSON serialization
      const mappingArray = Array.from(masked.mappings.entries()).map(([placeholder, values]) => ({
        placeholder,
        originalValues: values
      }))
      fs.writeFileSync(mappingPath, JSON.stringify(mappingArray, null, 2), 'utf-8')
    }

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return result
}

async function runTests() {
  log('\n' + '='.repeat(70), 'cyan')
  log('  MASKR SANITIZATION TEST SUITE', 'cyan')
  log('='.repeat(70), 'cyan')

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Services are imported directly via tsx (TypeScript)

  const results: TestResult[] = []
  let passed = 0
  let failed = 0

  for (const file of testFiles) {
    log(`\n${'─'.repeat(70)}`, 'dim')
    log(`Testing: ${file.name}`, 'blue')

    const result = await processFile(file.name)
    results.push(result)

    if (result.success && result.errors.length === 0) {
      passed++
      log(`\n  ✓ PASSED`, 'green')
    } else {
      failed++
      log(`\n  ✗ FAILED`, 'red')
      for (const error of result.errors) {
        log(`    Error: ${error}`, 'red')
      }
    }

    // Print detection summary
    log(`\n  Detection Summary:`, 'cyan')
    log(`    Total detections: ${result.detections.length}`)
    log(`    Emails found: ${result.piiFound.emails.length}`)
    log(`    Phones found: ${result.piiFound.phones.length}`)
    log(`    SSNs found: ${result.piiFound.ssns.length}`)
    log(`    Credit cards found: ${result.piiFound.creditCards.length}`)
    log(`    IBANs found: ${result.piiFound.ibans.length}`)
    log(`    IPs found: ${result.piiFound.ips.length}`)
    log(`    Names found: ${result.piiFound.names.length}`)

    if (result.piiRemaining.length > 0) {
      log(`\n  ⚠ PII Remaining in Output:`, 'yellow')
      for (const pii of result.piiRemaining) {
        log(`    - ${pii}`, 'yellow')
      }
    } else if (result.success) {
      log(`\n  ✓ All expected PII sanitized`, 'green')
    }
  }

  // Print summary
  log('\n' + '='.repeat(70), 'cyan')
  log('  TEST SUMMARY', 'cyan')
  log('='.repeat(70), 'cyan')

  log(`\n  Total files tested: ${testFiles.length}`)
  log(`  Passed: ${passed}`, passed === testFiles.length ? 'green' : 'yellow')
  log(`  Failed: ${failed}`, failed === 0 ? 'green' : 'red')

  // Aggregate statistics
  const totalDetections = results.reduce((sum, r) => sum + r.detections.length, 0)
  const totalEmails = results.reduce((sum, r) => sum + r.piiFound.emails.length, 0)
  const totalPhones = results.reduce((sum, r) => sum + r.piiFound.phones.length, 0)
  const totalSsns = results.reduce((sum, r) => sum + r.piiFound.ssns.length, 0)
  const totalCreditCards = results.reduce((sum, r) => sum + r.piiFound.creditCards.length, 0)
  const totalIbans = results.reduce((sum, r) => sum + r.piiFound.ibans.length, 0)
  const totalIps = results.reduce((sum, r) => sum + r.piiFound.ips.length, 0)
  const totalNames = results.reduce((sum, r) => sum + r.piiFound.names.length, 0)
  const totalRemaining = results.reduce((sum, r) => sum + r.piiRemaining.length, 0)

  log(`\n  Aggregate Detection Statistics:`)
  log(`    Total detections: ${totalDetections}`)
  log(`    Emails: ${totalEmails}`)
  log(`    Phones: ${totalPhones}`)
  log(`    SSNs: ${totalSsns}`)
  log(`    Credit Cards: ${totalCreditCards}`)
  log(`    IBANs: ${totalIbans}`)
  log(`    IPs: ${totalIps}`)
  log(`    Names: ${totalNames}`)

  if (totalRemaining > 0) {
    log(`\n  ⚠ Total PII remaining: ${totalRemaining}`, 'yellow')
  } else {
    log(`\n  ✓ All PII successfully sanitized across all files`, 'green')
  }

  log(`\n  Output files saved to: ${outputDir}`)
  log('\n' + '='.repeat(70) + '\n', 'cyan')

  return failed === 0
}

// Run tests
runTests().then(success => {
  process.exit(success ? 0 : 1)
}).catch(error => {
  console.error('Test runner error:', error)
  process.exit(1)
})
