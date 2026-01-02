import { test, expect } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WEB_APP_URL = 'file://' + join(__dirname, '../docs/app/index.html')

test.describe('Web App - Browser Version', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WEB_APP_URL)
    // Wait for page to load
    await page.waitForSelector('.upload-area')
  })

  test('loads the page correctly', async ({ page }) => {
    // Check header
    await expect(page.locator('header .logo span')).toHaveText('maskr')
    await expect(page.locator('.badge')).toHaveText('Web Version')

    // Check privacy badge
    await expect(page.locator('.privacy-badge')).toContainText('100% Client-Side')

    // Check steps are visible
    await expect(page.locator('.step').first()).toHaveClass(/active/)
    await expect(page.locator('.step-label').first()).toHaveText('Upload')
  })

  test('can toggle text input area', async ({ page }) => {
    // Initially hidden
    await expect(page.locator('#textInputArea')).not.toHaveClass(/visible/)

    // Click toggle button
    await page.click('#toggleTextInput')

    // Now visible
    await expect(page.locator('#textInputArea')).toHaveClass(/visible/)
  })

  test('analyze button is disabled until text is entered', async ({ page }) => {
    await page.click('#toggleTextInput')

    // Initially disabled
    await expect(page.locator('#analyzeTextBtn')).toBeDisabled()

    // Type some text
    await page.fill('#textInput', 'Hello world')

    // Now enabled
    await expect(page.locator('#analyzeTextBtn')).toBeEnabled()
  })

  test('detects email addresses from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Contact us at test@example.com for more info.')
    await page.click('#analyzeTextBtn')

    // Wait for detection to complete
    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    // Check detection table has email
    const table = page.locator('#detectionTable')
    await expect(table).toContainText('email')
    await expect(table).toContainText('test@example.com')
  })

  test('detects phone numbers from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Call me at +1 555-123-4567 tomorrow.')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('phone')
    await expect(table).toContainText('+1 555-123-4567')
  })

  test('detects credit card numbers from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'My card is 4111 1111 1111 1111')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('credit_card')
    await expect(table).toContainText('4111 1111 1111 1111')
  })

  test('detects SSN from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'SSN: 123-45-6789')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('ssn')
    await expect(table).toContainText('123-45-6789')
  })

  test('detects Saudi ID from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'ID number: 1234567890')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('saudi_id')
    await expect(table).toContainText('1234567890')
  })

  test('detects IBAN from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Bank account: SA0380000000608010167519')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('iban')
    await expect(table).toContainText('SA0380000000608010167519')
  })

  test('detects URLs from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Visit https://example.com/page for details')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('url')
    await expect(table).toContainText('https://example.com/page')
  })

  test('detects IP addresses from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Server IP: 192.168.1.100')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('ip')
    await expect(table).toContainText('192.168.1.100')
  })

  test('detects financial amounts from text input', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'The total is $1,500.00')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('financial')
    await expect(table).toContainText('$1,500.00')
  })

  test('custom names are detected with 100% confidence', async ({ page }) => {
    // Add custom name
    await page.fill('#customNamesInput', 'John Doe')

    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Contact John Doe for more information.')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('person')
    await expect(table).toContainText('John Doe')
    await expect(table).toContainText('100%')
  })

  test('can navigate through all steps', async ({ page }) => {
    // Step 1: Enter text
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Email: test@example.com')
    await page.click('#analyzeTextBtn')

    // Step 2: Review
    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })
    await expect(page.locator('.step').nth(1)).toHaveClass(/active/)

    // Continue to Step 3
    await page.click('#continueToExport')
    await page.waitForSelector('#step3:not(.hidden)')
    await expect(page.locator('.step').nth(2)).toHaveClass(/active/)

    // Check previews are populated
    await expect(page.locator('#originalPreview')).toContainText('test@example.com')
    await expect(page.locator('#sanitizedPreview')).toContainText('<EMAIL_1>')

    // Go back to Step 2
    await page.click('#backToReview')
    await expect(page.locator('#step2')).not.toHaveClass(/hidden/)

    // Go back to Step 1
    await page.click('#backToUpload')
    await expect(page.locator('#step1')).not.toHaveClass(/hidden/)
  })

  test('can toggle detection items on/off', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Email: test@example.com')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    // Toggle off the detection by clicking the checkbox
    const checkbox = page.locator('#detectionTable .checkbox').first()
    await checkbox.click()

    // Continue to export
    await page.click('#continueToExport')
    await page.waitForSelector('#step3:not(.hidden)')

    // Original email should still be in sanitized output since we disabled the detection
    await expect(page.locator('#sanitizedPreview')).toContainText('test@example.com')
  })

  test('copy to clipboard button exists', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Email: test@example.com')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })
    await page.click('#continueToExport')
    await page.waitForSelector('#step3:not(.hidden)')

    await expect(page.locator('#copyBtn')).toBeVisible()
    await expect(page.locator('#downloadBtn')).toBeVisible()
  })

  test('stats are displayed correctly', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Email: test@example.com, Phone: +1 555-123-4567')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    // Check stats section exists and has values
    const stats = page.locator('#stats .stat')
    await expect(stats).toHaveCount(2) // email and phone
  })

  test('multiple detections of same type get unique placeholders', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', 'Contact alice@test.com or bob@test.com')
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    // Continue to export to see placeholders in action
    await page.click('#continueToExport')
    await page.waitForSelector('#step3:not(.hidden)')

    // Check that both emails are replaced with unique placeholders
    const sanitized = page.locator('#sanitizedPreview')
    await expect(sanitized).toContainText('EMAIL_1')
    await expect(sanitized).toContainText('EMAIL_2')
  })

  test('detects multiple entity types in one document', async ({ page }) => {
    await page.click('#toggleTextInput')
    await page.fill('#textInput', `
      Contact: john@example.com
      Phone: +966 512345678
      Card: 4111 1111 1111 1111
      SSN: 123-45-6789
      IBAN: SA0380000000608010167519
      Amount: $5,000
    `)
    await page.click('#analyzeTextBtn')

    await page.waitForSelector('#step2:not(.hidden)', { timeout: 10000 })

    const table = page.locator('#detectionTable')
    await expect(table).toContainText('email')
    await expect(table).toContainText('phone')
    await expect(table).toContainText('credit_card')
    await expect(table).toContainText('ssn')
    await expect(table).toContainText('iban')
    await expect(table).toContainText('financial')
  })
})
