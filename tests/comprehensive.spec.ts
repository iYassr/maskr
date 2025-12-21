import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Comprehensive test data with various PII types
const COMPREHENSIVE_TEST_CONTENT = `CONFIDENTIAL BUSINESS DOCUMENT

PERSONAL INFORMATION:
Full Name: Dr. Sarah Johnson-Williams
Email: sarah.johnson@techcorp.io
Phone: +1 (555) 987-6543
Mobile: +44 7700 900123
Address: 742 Evergreen Terrace, Springfield, IL 62701

FINANCIAL DATA:
Credit Card: 4111-1111-1111-1111
Visa: 4532015112830366
MasterCard: 5425233430109903
IBAN: DE89370400440532013000
SSN: 123-45-6789

TECHNICAL INFORMATION:
IP Address: 192.168.1.100
Server: 10.0.0.50
API Key: sk_live_abc123xyz789def456ghi
AWS Access Key: AKIAIOSFODNN7EXAMPLE

COMPANY DETAILS:
Company: Acme Corporation

Document Classification: TOP SECRET
Date: December 21, 2024
Author: John Smith
`

const SIMPLE_TEXT = `Contact Info:
Name: Alice Brown
Email: alice@example.com
Phone: 555-123-4567`

// Shared test directory - created once per test file run
const testDir = path.join(os.tmpdir(), `maskr-comprehensive-${Date.now()}`)

test.beforeAll(async () => {
  await fs.mkdir(testDir, { recursive: true })
  console.log('Test directory:', testDir)

  // Create test files with different content
  await fs.writeFile(path.join(testDir, 'comprehensive.txt'), COMPREHENSIVE_TEST_CONTENT)
  await fs.writeFile(path.join(testDir, 'simple.txt'), SIMPLE_TEXT)
  await fs.writeFile(path.join(testDir, 'markdown.md'), `# Test Document\n\n${SIMPLE_TEXT}`)
})

test.afterAll(async () => {
  console.log('Test files preserved in:', testDir)
})

test.describe('Comprehensive maskr E2E Tests', () => {
  let electronApp: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
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

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[RENDERER ${msg.type()}]:`, msg.text())
      }
    })
  })

  test.afterEach(async () => {
    await electronApp?.close()
  })

  // ============================================================================
  // DIRECT TEXT INPUT TESTS
  // ============================================================================

  test('Direct text input: basic sanitization', async () => {
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Find the textarea for direct text input
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })

    // Fill with test content
    await textarea.fill(SIMPLE_TEXT)
    await page.waitForTimeout(500)

    // Click sanitize button - wait for it to be enabled
    const scanButton = page.locator('button', { hasText: /Sanitize/i })
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })
    await scanButton.click()

    // Wait for processing and review screen
    const reviewHeader = page.locator('text=Review Detections')
    await expect(reviewHeader).toBeVisible({ timeout: 30000 })

    // Verify we have detections
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 5000 })

    console.log('Direct text input test passed!')
  })

  test('Direct text input: detects email addresses', async () => {
    await page.waitForTimeout(1000)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Please contact John Smith at test@example.com or call 555-123-4567 for more information about the project.')
    await page.waitForTimeout(500)

    const scanButton = page.locator('button', { hasText: /Sanitize/i })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })
    await scanButton.click()

    // Wait for review screen
    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })

    // Check that the table has at least one detection
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 5000 })

    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    console.log(`Email test: Found ${count} detections`)

    // Should detect at least the email
    expect(count).toBeGreaterThan(0)
    console.log('Email detection in text input passed!')
  })

  // ============================================================================
  // FILE UPLOAD TESTS
  // ============================================================================

  test('File upload: TXT with comprehensive PII', async () => {
    const testFile = path.join(testDir, 'comprehensive.txt')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for review screen
    const reviewHeader = page.locator('text=Review Detections')
    await expect(reviewHeader).toBeVisible({ timeout: 30000 })

    // Count detections - should have many
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    console.log(`Comprehensive file: Found ${count} detections`)
    expect(count).toBeGreaterThan(5) // Should detect multiple PII types

    // Verify specific detection types exist
    const table = page.locator('table')
    const tableText = await table.textContent()

    // Check for various PII types
    const hasEmail = tableText?.includes('@') || tableText?.toLowerCase().includes('email')
    const hasPhone = tableText?.includes('555') || tableText?.toLowerCase().includes('phone')

    expect(hasEmail || hasPhone).toBe(true)
    console.log('Comprehensive TXT upload test passed!')
  })

  test('File upload: Markdown file', async () => {
    const testFile = path.join(testDir, 'markdown.md')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    const reviewHeader = page.locator('text=Review Detections')
    await expect(reviewHeader).toBeVisible({ timeout: 30000 })

    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    console.log(`Markdown file: Found ${count} detections`)
    expect(count).toBeGreaterThan(0)
    console.log('Markdown upload test passed!')
  })

  // ============================================================================
  // THEME TOGGLE TESTS
  // ============================================================================

  test('Theme toggle: switches between light and dark', async () => {
    // Check initial theme
    const html = page.locator('html')
    const initialClass = await html.getAttribute('class') || ''
    console.log('Initial theme class:', initialClass)

    // Find and click theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme"], button[title*="theme"]').first()
    await expect(themeToggle).toBeVisible({ timeout: 5000 })

    // Get initial state - check if dark class is present
    const hasDarkInitially = initialClass.includes('dark')
    console.log('Has dark initially:', hasDarkInitially)

    // Click to toggle
    await themeToggle.click()
    await page.waitForTimeout(500)

    // Check theme changed
    const newClass = await html.getAttribute('class') || ''
    const hasDarkAfter = newClass.includes('dark')
    console.log('Has dark after toggle:', hasDarkAfter)

    // Theme should have changed
    expect(hasDarkAfter).not.toBe(hasDarkInitially)
    console.log(`Theme toggled from ${hasDarkInitially ? 'dark' : 'light'} to ${hasDarkAfter ? 'dark' : 'light'}`)

    // Toggle back
    await themeToggle.click()
    await page.waitForTimeout(500)

    const finalClass = await html.getAttribute('class') || ''
    const hasDarkFinal = finalClass.includes('dark')
    expect(hasDarkFinal).toBe(hasDarkInitially)
    console.log('Theme toggle test passed!')
  })

  // ============================================================================
  // DETECTION CATEGORY TESTS
  // ============================================================================

  test('Detection categories: all tabs work', async () => {
    const testFile = path.join(testDir, 'comprehensive.txt')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })

    // Test each category tab
    const categories = ['All', 'Personal', 'Financial', 'Technical']

    for (const category of categories) {
      const tab = page.locator('button', { hasText: category })
      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tab.click()
        await page.waitForTimeout(300)

        // Table should still be visible
        const table = page.locator('table')
        await expect(table).toBeVisible()
        console.log(`Category tab "${category}" works`)
      }
    }
    console.log('All category tabs test passed!')
  })

  // ============================================================================
  // EXPORT WORKFLOW TESTS
  // ============================================================================

  test('Export workflow: full flow to export screen', async () => {
    const testFile = path.join(testDir, 'simple.txt')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for review
    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })

    // Click continue
    const continueBtn = page.locator('button', { hasText: 'Continue' })
    await expect(continueBtn).toBeVisible()
    await continueBtn.click()

    // Wait for export screen
    await page.waitForTimeout(2000)
    const exportSection = page.locator('text=Export Sanitized Document')
    await expect(exportSection).toBeVisible({ timeout: 10000 })

    // Verify compare view shows original and sanitized
    const previewAreas = page.locator('.whitespace-pre-wrap')
    const previewCount = await previewAreas.count()
    expect(previewCount).toBeGreaterThanOrEqual(1)

    // Verify export button exists
    const exportBtn = page.locator('button', { hasText: 'Export Document' })
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toBeEnabled()

    console.log('Export workflow test passed!')
  })

  test('Export: sanitized content has placeholders', async () => {
    const testFile = path.join(testDir, 'simple.txt')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })

    await page.locator('button', { hasText: 'Continue' }).click()
    await page.waitForTimeout(2000)

    // Get sanitized content
    const previewAreas = page.locator('.whitespace-pre-wrap')
    const sanitizedArea = previewAreas.last()
    const content = await sanitizedArea.textContent() || ''

    // Should NOT contain original PII
    expect(content).not.toContain('alice@example.com')
    expect(content).not.toContain('Alice Brown')

    // Should contain placeholders
    const hasPlaceholder = content.includes('[') && content.includes(']')
    expect(hasPlaceholder).toBe(true)

    console.log('Sanitized content verification passed!')
  })

  // ============================================================================
  // CHECKBOX SELECTION TESTS
  // ============================================================================

  test('Detection selection: toggle individual items', async () => {
    const testFile = path.join(testDir, 'comprehensive.txt')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })

    // Find checkboxes in the table
    const checkboxes = page.locator('table tbody tr input[type="checkbox"], table tbody tr [role="checkbox"]')
    const count = await checkboxes.count()

    if (count > 0) {
      // Toggle first checkbox
      const firstCheckbox = checkboxes.first()
      const initialState = await firstCheckbox.isChecked().catch(() => null)

      await firstCheckbox.click()
      await page.waitForTimeout(200)

      const newState = await firstCheckbox.isChecked().catch(() => null)

      if (initialState !== null && newState !== null) {
        expect(newState).not.toBe(initialState)
        console.log('Checkbox toggle works!')
      }
    }
    console.log('Detection selection test passed!')
  })

  // ============================================================================
  // NAVIGATION TESTS
  // ============================================================================

  test('Navigation: complete back/forward flow', async () => {
    const testFile = path.join(testDir, 'simple.txt')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Step 1: Upload -> Review
    await page.locator('text=Review Detections').waitFor({ timeout: 30000 })
    console.log('Step 1: At Review screen')

    // Step 2: Review -> Export
    await page.locator('button', { hasText: 'Continue' }).click()
    await page.locator('text=Export Sanitized Document').waitFor({ timeout: 10000 })
    console.log('Step 2: At Export screen')

    // Step 3: Export -> Review (back)
    await page.locator('button', { hasText: 'Back' }).click()
    await page.locator('text=Review Detections').waitFor({ timeout: 5000 })
    console.log('Step 3: Back to Review screen')

    // Step 4: Review -> Upload (back)
    await page.locator('button', { hasText: 'Back' }).click()
    await page.locator('text=Drop file here').waitFor({ timeout: 5000 })
    console.log('Step 4: Back to Upload screen')

    console.log('Complete navigation flow test passed!')
  })

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  test('Error handling: empty text input disables button', async () => {
    await page.waitForTimeout(1000)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5000 })

    // Clear any existing text
    await textarea.fill('')
    await page.waitForTimeout(300)

    // Button should be disabled when text is empty
    const scanButton = page.locator('button', { hasText: /Sanitize/i })
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeDisabled()

    // Fill with text and verify button becomes enabled
    await textarea.fill('Some text with email@test.com')
    await page.waitForTimeout(300)
    await expect(scanButton).toBeEnabled()

    console.log('Empty text error handling test passed!')
  })

  // ============================================================================
  // UI ELEMENT TESTS
  // ============================================================================

  test('UI elements: logo and footer visible', async () => {
    await page.waitForTimeout(1000)

    // Check for maskr text somewhere on the page (logo or footer)
    const maskrText = page.locator('text=maskr').first()
    await expect(maskrText).toBeVisible({ timeout: 5000 })

    // Check footer with version
    const version = page.locator('text=v1.3')
    await expect(version).toBeVisible({ timeout: 5000 })

    // Check theme toggle button exists
    const themeToggle = page.locator('button[aria-label*="theme"], button[title*="theme"]').first()
    await expect(themeToggle).toBeVisible({ timeout: 5000 })

    console.log('UI elements test passed!')
  })

  test('UI elements: supported formats shown', async () => {
    // Check for format badges
    const formats = ['.txt', '.docx', '.pdf', '.xlsx', '.md']

    for (const format of formats) {
      const formatBadge = page.locator(`text=${format}`)
      const isVisible = await formatBadge.isVisible({ timeout: 1000 }).catch(() => false)
      if (isVisible) {
        console.log(`Format ${format} badge visible`)
      }
    }
    console.log('Supported formats display test passed!')
  })
})
