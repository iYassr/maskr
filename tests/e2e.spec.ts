import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test data with sensitive information
const TEST_CONTENT = `Confidential Business Document

Contact Information:
Name: Yasser Al-Rashid
Email: yasser.rashid@armc-corp.com
Phone: +966 55 123 4567
Mobile: +1 555-123-4567

Company: ARMC Corp
Address: 456 King Fahd Road, Riyadh, Saudi Arabia 12345

Financial Information:
Credit Card: 4532015112830366
IBAN: SA0380000000608010167519

Technical Details:
Server IP: 192.168.1.100
API Key: sk_live_abc123xyz789def456
AWS Key: AKIAIOSFODNN7EXAMPLE

Document Date: December 19, 2024
Classification: Director Use Only
`

let testDir: string

test.beforeAll(async () => {
  // Create temp directory for test files
  testDir = path.join(os.tmpdir(), `maskr-test-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })
  console.log('Test directory:', testDir)

  // Create test files
  await fs.writeFile(path.join(testDir, 'test.txt'), TEST_CONTENT)
})

test.afterAll(async () => {
  console.log('Test files in:', testDir)
})

test.describe('Maskr E2E Tests', () => {
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

    // Capture console messages
    page.on('console', msg => {
      console.log(`[RENDERER ${msg.type()}]:`, msg.text())
    })
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message)
    })
  })

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('App launches and shows upload screen', async () => {
    // Verify app launched
    expect(electronApp).toBeTruthy()
    expect(page).toBeTruthy()

    // Look for key upload screen elements
    const uploadArea = page.locator('text=Drop file here')
    await expect(uploadArea).toBeVisible({ timeout: 10000 })

    // Check supported formats are shown
    const txtFormat = page.locator('text=.txt')
    await expect(txtFormat).toBeVisible()

    // Check Maskr logo (SVG with maskr text)
    const logo = page.locator('svg:has(text:has-text("maskr"))')
    await expect(logo).toBeVisible()
  })

  test('Full workflow: upload, review, export TXT', async () => {
    const testFile = path.join(testDir, 'test.txt')

    // Step 1: Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for processing - look for spinner or status text
    await page.waitForTimeout(3000)

    // Check for errors - look for any error div
    const errorDiv = page.locator('.bg-destructive, [class*="destructive"], [class*="error"]')
    const hasError = await errorDiv.count() > 0
    if (hasError) {
      const errorText = await errorDiv.first().textContent()
      console.log('ERROR FOUND:', errorText)
    }

    // Also check for any visible error text
    const errorTexts = await page.locator('p').allTextContents()
    const errors = errorTexts.filter(t => t.toLowerCase().includes('failed') || t.toLowerCase().includes('error'))
    if (errors.length > 0) {
      console.log('ERROR MESSAGES:', errors)
    }

    // Take screenshot for debugging
    await page.screenshot({ path: path.join(testDir, 'debug-after-upload.png') })

    // Check page content
    const pageContent = await page.content()
    console.log('Page contains Review:', pageContent.includes('Review'))
    console.log('Page contains error:', pageContent.includes('error') || pageContent.includes('Error'))

    // Wait for review screen
    const reviewHeader = page.locator('text=Review Detections')
    await expect(reviewHeader).toBeVisible({ timeout: 30000 })

    // Step 2: Verify detections exist
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 5000 })

    // Count detection rows
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    console.log(`Found ${count} detections`)
    expect(count).toBeGreaterThan(0)

    // Check for email detection specifically
    const emailCell = page.getByRole('cell', { name: 'yasser.rashid@armc-corp.com', exact: true })
    await expect(emailCell).toBeVisible({ timeout: 5000 })

    // Step 3: Continue to export
    const continueBtn = page.locator('button', { hasText: 'Continue' })
    await expect(continueBtn).toBeVisible({ timeout: 5000 })
    await expect(continueBtn).toBeEnabled()
    await continueBtn.click()

    // Step 4: Verify export screen
    await page.waitForTimeout(2000)
    const exportSection = page.locator('text=Export Sanitized Document')
    await expect(exportSection).toBeVisible({ timeout: 10000 })

    // Find the preview content area
    const previewArea = page.locator('.whitespace-pre-wrap').first()
    await expect(previewArea).toBeVisible({ timeout: 5000 })

    const content = await previewArea.textContent() || ''

    // Verify email is masked (replaced with placeholder)
    expect(content).not.toContain('yasser.rashid@armc-corp.com')

    // Verify placeholder exists
    expect(content).toMatch(/\[EMAIL[_\d]*\]/i)

    // Step 5: Verify export button exists
    const exportBtn = page.locator('button', { hasText: 'Export Document' })
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toBeEnabled()

    console.log('Full workflow test passed!')
  })

  test('Detection categories are correct', async () => {
    const testFile = path.join(testDir, 'test.txt')

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for review screen
    const reviewHeader = page.locator('text=Review Detections')
    await expect(reviewHeader).toBeVisible({ timeout: 30000 })

    // Check category tabs exist (Personal = PII)
    const personalTab = page.locator('button', { hasText: 'Personal' })
    const financialTab = page.locator('button', { hasText: 'Financial' })
    const technicalTab = page.locator('button', { hasText: 'Technical' })

    await expect(personalTab).toBeVisible()
    await expect(financialTab).toBeVisible()
    await expect(technicalTab).toBeVisible()

    // Click Personal tab and verify email shows
    await personalTab.click()
    await page.waitForTimeout(500)

    // Check email is in Personal category
    const emailInTable = page.getByRole('cell', { name: 'yasser.rashid@armc-corp.com', exact: true })
    const emailVisible = await emailInTable.isVisible().catch(() => false)
    console.log('Email visible in Personal tab:', emailVisible)
    expect(emailVisible).toBe(true)
  })

  test('Back button navigation works', async () => {
    const testFile = path.join(testDir, 'test.txt')

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for review screen
    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })

    // Continue to export
    await page.locator('button', { hasText: 'Continue' }).click()
    await page.waitForTimeout(1000)

    // Verify on export screen
    await expect(page.locator('text=Export Sanitized Document')).toBeVisible({ timeout: 5000 })

    // Go back
    await page.locator('button', { hasText: 'Back' }).click()
    await page.waitForTimeout(1000)

    // Should be back on review
    await expect(page.locator('text=Review Detections')).toBeVisible({ timeout: 5000 })

    // Go back again
    await page.locator('button', { hasText: 'Back' }).click()
    await page.waitForTimeout(1000)

    // Should be back on upload
    await expect(page.locator('text=Drop file here')).toBeVisible({ timeout: 5000 })

    console.log('Navigation test passed!')
  })
})
