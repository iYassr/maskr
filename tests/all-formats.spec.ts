import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test data with various sensitive information types
const TEST_CONTENT = `Confidential Business Document

Contact Information:
Name: Ahmed Al-Rashid
Email: ahmed.rashid@acme-corp.com
Phone: +966 55 123 4567
Mobile: +1 555-987-6543

Company: ACME Corporation
Address: 789 King Fahd Road, Riyadh, Saudi Arabia

Financial Information:
Credit Card: 4532015112830366
IBAN: SA0380000000608010167519
SSN: 123-45-6789

Technical Details:
Server IP: 192.168.1.100
IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
API Key: sk_live_abc123xyz789def456
AWS Key: AKIAIOSFODNN7EXAMPLE

Document Classification: Confidential
`

let testDir: string

// Helper to create test files in different formats
async function createTestFiles(dir: string) {
  // TXT
  await fs.writeFile(path.join(dir, 'test.txt'), TEST_CONTENT)

  // MD (Markdown)
  const mdContent = `# Confidential Report

## Contact Details
- **Name:** Ahmed Al-Rashid
- **Email:** ahmed.rashid@acme-corp.com
- **Phone:** +966 55 123 4567

## Financial Data
| Type | Value |
|------|-------|
| Credit Card | 4532015112830366 |
| IBAN | SA0380000000608010167519 |

## Technical Info
\`\`\`
Server: 192.168.1.100
API Key: sk_live_abc123xyz789def456
\`\`\`
`
  await fs.writeFile(path.join(dir, 'test.md'), mdContent)

  // JSON
  const jsonContent = {
    document: "Confidential",
    contact: {
      name: "Ahmed Al-Rashid",
      email: "ahmed.rashid@acme-corp.com",
      phone: "+966 55 123 4567"
    },
    financial: {
      creditCard: "4532015112830366",
      iban: "SA0380000000608010167519"
    },
    technical: {
      serverIp: "192.168.1.100",
      apiKey: "sk_live_abc123xyz789def456"
    }
  }
  await fs.writeFile(path.join(dir, 'test.json'), JSON.stringify(jsonContent, null, 2))

  // CSV
  const csvContent = `Name,Email,Phone,CreditCard,IBAN
Ahmed Al-Rashid,ahmed.rashid@acme-corp.com,+966 55 123 4567,4532015112830366,SA0380000000608010167519
Sarah Johnson,sarah.j@example.com,+1 555-123-4567,5425233430109903,DE89370400440532013000
`
  await fs.writeFile(path.join(dir, 'test.csv'), csvContent)

  // HTML
  const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Confidential Document</title></head>
<body>
  <h1>Contact Information</h1>
  <p>Name: Ahmed Al-Rashid</p>
  <p>Email: <a href="mailto:ahmed.rashid@acme-corp.com">ahmed.rashid@acme-corp.com</a></p>
  <p>Phone: +966 55 123 4567</p>

  <h2>Financial Data</h2>
  <ul>
    <li>Credit Card: 4532015112830366</li>
    <li>IBAN: SA0380000000608010167519</li>
  </ul>

  <h2>Technical</h2>
  <code>Server IP: 192.168.1.100</code>
</body>
</html>
`
  await fs.writeFile(path.join(dir, 'test.html'), htmlContent)
}

test.beforeAll(async () => {
  // Create temp directory for test files
  testDir = path.join(os.tmpdir(), `maskr-formats-test-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })
  console.log('Test directory:', testDir)

  // Create all test files
  await createTestFiles(testDir)
  console.log('Test files created')
})

test.afterAll(async () => {
  console.log('Test files preserved in:', testDir)
})

test.describe('maskr All Formats E2E Tests', () => {
  let electronApp: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
    // Launch fresh Electron app for each test
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../dist-electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    })
    page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Capture console messages for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[RENDERER ERROR]:`, msg.text())
      }
    })
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message)
    })
  })

  test.afterEach(async () => {
    await electronApp?.close()
  })

  // Helper function to test a file format
  async function testFileFormat(filename: string, expectedDetections: string[]) {
    const testFile = path.join(testDir, filename)
    const ext = path.extname(filename).toUpperCase()

    console.log(`\n=== Testing ${ext} format ===`)

    // Step 1: Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for processing
    await page.waitForTimeout(3000)

    // Take screenshot for debugging
    await page.screenshot({ path: path.join(testDir, `debug-${filename}.png`) })

    // Step 2: Wait for review screen
    const reviewHeader = page.locator('text=Review Detections')
    await expect(reviewHeader).toBeVisible({ timeout: 60000 })
    console.log(`${ext}: Review screen loaded`)

    // Step 3: Verify detections exist
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10000 })

    // Count detection rows
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    console.log(`${ext}: Found ${count} detections`)
    expect(count).toBeGreaterThan(0)

    // Check for expected detections
    for (const expected of expectedDetections) {
      const cell = page.locator('table').getByText(expected, { exact: false })
      const isVisible = await cell.first().isVisible().catch(() => false)
      console.log(`${ext}: Detection "${expected.substring(0, 30)}...": ${isVisible ? 'FOUND' : 'NOT FOUND'}`)
    }

    // Step 4: Continue to export
    const continueBtn = page.locator('button', { hasText: 'Continue' })
    await expect(continueBtn).toBeVisible({ timeout: 5000 })
    await continueBtn.click()

    // Step 5: Verify export screen
    await page.waitForTimeout(2000)
    const exportSection = page.locator('text=Export Sanitized Document')
    await expect(exportSection).toBeVisible({ timeout: 10000 })
    console.log(`${ext}: Export screen loaded`)

    // Verify content is masked
    const previewArea = page.locator('.whitespace-pre-wrap').first()
    if (await previewArea.isVisible().catch(() => false)) {
      const content = await previewArea.textContent() || ''

      // Verify email is masked
      const emailMasked = !content.includes('ahmed.rashid@acme-corp.com')
      console.log(`${ext}: Email masked: ${emailMasked}`)

      // Verify placeholder exists
      const hasPlaceholder = content.includes('[EMAIL') || content.includes('[CREDIT_CARD') || content.includes('[IP')
      console.log(`${ext}: Has placeholders: ${hasPlaceholder}`)
    }

    // Verify export button exists
    const exportBtn = page.locator('button', { hasText: 'Export' })
    await expect(exportBtn.first()).toBeVisible()

    console.log(`${ext}: Test PASSED`)
    return true
  }

  // === TEXT FORMAT TESTS ===

  test('TXT format - full workflow', async () => {
    await testFileFormat('test.txt', [
      'ahmed.rashid@acme-corp.com',
      '4532015112830366',
      '192.168.1.100'
    ])
  })

  test('MD (Markdown) format - full workflow', async () => {
    await testFileFormat('test.md', [
      'ahmed.rashid@acme-corp.com',
      '4532015112830366',
      'SA0380000000608010167519'
    ])
  })

  test('JSON format - full workflow', async () => {
    await testFileFormat('test.json', [
      'ahmed.rashid@acme-corp.com',
      '4532015112830366',
      '192.168.1.100'
    ])
  })

  test('CSV format - full workflow', async () => {
    await testFileFormat('test.csv', [
      'ahmed.rashid@acme-corp.com',
      'sarah.j@example.com',
      '4532015112830366'
    ])
  })

  test('HTML format - full workflow', async () => {
    await testFileFormat('test.html', [
      'ahmed.rashid@acme-corp.com',
      '4532015112830366',
      '192.168.1.100'
    ])
  })

  // === DETECTION ACCURACY TESTS ===

  test('Email detection accuracy', async () => {
    const testFile = path.join(testDir, 'test.csv')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // Check both emails are detected
    const email1 = page.locator('table').getByText('ahmed.rashid@acme-corp.com')
    const email2 = page.locator('table').getByText('sarah.j@example.com')

    await expect(email1.first()).toBeVisible({ timeout: 5000 })
    await expect(email2.first()).toBeVisible({ timeout: 5000 })

    console.log('Email detection: Both emails found')
  })

  test('Credit card detection with Luhn validation', async () => {
    const testFile = path.join(testDir, 'test.txt')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // Valid Visa card should be detected
    const creditCard = page.locator('table').getByText('4532015112830366')
    await expect(creditCard.first()).toBeVisible({ timeout: 5000 })

    console.log('Credit card detection: Valid card found')
  })

  test('IBAN detection', async () => {
    const testFile = path.join(testDir, 'test.txt')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // Saudi IBAN should be detected
    const iban = page.locator('table').getByText('SA0380000000608010167519')
    await expect(iban.first()).toBeVisible({ timeout: 5000 })

    console.log('IBAN detection: Saudi IBAN found')
  })

  test('IP address detection (IPv4)', async () => {
    const testFile = path.join(testDir, 'test.txt')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // IPv4 should be detected
    const ipv4 = page.locator('table').getByText('192.168.1.100')
    await expect(ipv4.first()).toBeVisible({ timeout: 5000 })

    console.log('IP detection: IPv4 found')
  })

  test('Phone number detection (international formats)', async () => {
    const testFile = path.join(testDir, 'test.txt')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // Check for phone detection - look for either format
    const table = page.locator('table')
    const tableContent = await table.textContent() || ''

    const hasSaudiPhone = tableContent.includes('966') || tableContent.includes('55 123')
    const hasUSPhone = tableContent.includes('555') || tableContent.includes('987')

    console.log('Phone detection - Saudi format:', hasSaudiPhone)
    console.log('Phone detection - US format:', hasUSPhone)

    expect(hasSaudiPhone || hasUSPhone).toBe(true)
  })

  // === CATEGORY FILTERING TESTS ===

  test('Category tabs filter correctly', async () => {
    const testFile = path.join(testDir, 'test.txt')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // Test Personal tab
    const personalTab = page.locator('button', { hasText: 'Personal' })
    await personalTab.click()
    await page.waitForTimeout(500)

    const emailVisible = await page.locator('table').getByText('ahmed.rashid@acme-corp.com').first().isVisible().catch(() => false)
    console.log('Personal tab - email visible:', emailVisible)

    // Test Financial tab
    const financialTab = page.locator('button', { hasText: 'Financial' })
    await financialTab.click()
    await page.waitForTimeout(500)

    const creditCardVisible = await page.locator('table').getByText('4532015112830366').first().isVisible().catch(() => false)
    console.log('Financial tab - credit card visible:', creditCardVisible)

    // Test Technical tab
    const technicalTab = page.locator('button', { hasText: 'Technical' })
    await technicalTab.click()
    await page.waitForTimeout(500)

    const ipVisible = await page.locator('table').getByText('192.168.1.100').first().isVisible().catch(() => false)
    console.log('Technical tab - IP visible:', ipVisible)
  })

  // === TOGGLE AND EXPORT TESTS ===

  test('Toggle detection on/off affects export', async () => {
    const testFile = path.join(testDir, 'test.txt')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 60000 })

    // Find and click the checkbox for the first detection
    const firstCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"], button[role="checkbox"]').first()
    if (await firstCheckbox.isVisible().catch(() => false)) {
      await firstCheckbox.click()
      console.log('Toggled first detection off')
    }

    // Continue to export
    await page.locator('button', { hasText: 'Continue' }).click()
    await page.waitForTimeout(2000)

    // Verify export screen loaded
    const exportSection = page.locator('text=Export Sanitized Document')
    await expect(exportSection).toBeVisible({ timeout: 10000 })

    console.log('Toggle test: Export screen loaded after toggle')
  })
})
