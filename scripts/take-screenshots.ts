import { _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Rich test document with diverse sensitive information
const TEST_CONTENT = `CONFIDENTIAL - Internal Use Only

Employee Records Summary
========================

Contact Information:
- Name: Ahmed Al-Rashid
- Email: ahmed.rashid@techcorp.com
- Phone: +966 55 123 4567
- Secondary Email: a.rashid@gmail.com

Manager: Sarah Johnson-Williams
Manager Email: sarah.williams@techcorp.com
Manager Phone: +1 (555) 987-6543

Company Information:
- Organization: TechCorp International
- Website: https://www.techcorp.com
- Internal Portal: portal.techcorp.internal

Financial Details:
- Credit Card: 4532015112830366
- IBAN: SA0380000000608010167519
- Account Balance: $45,750.00

Technical Access:
- Server IP: 192.168.1.100
- API Key: sk_live_abc123xyz789def456
- AWS Access Key: AKIAIOSFODNN7EXAMPLE

Saudi National ID: 1090163073
Iqama Number: 2098765432

Additional Contacts:
- Mohammed Al-Farsi: m.farsi@company.org
- Lisa Chen: lisa.chen@techcorp.com
- Customer Support: support@techcorp.com

Document Classification: Confidential
Last Updated: December 2024
`

async function takeScreenshots() {
  console.log('Starting screenshot capture...')

  // Create temp directory for test file
  const testDir = path.join(os.tmpdir(), `maskr-screenshots-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })

  // Create test file
  const testFile = path.join(testDir, 'employee-records.txt')
  await fs.writeFile(testFile, TEST_CONTENT)
  console.log('Test file created:', testFile)

  // Screenshots output directory
  const screenshotsDir = path.join(__dirname, '..', 'screenshots')
  await fs.mkdir(screenshotsDir, { recursive: true })

  let electronApp: ElectronApplication | null = null

  try {
    // Launch Electron app
    console.log('Launching Electron app...')
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../dist-electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    })

    const page: Page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 800 })

    // Screenshot 1: Upload Screen
    console.log('Capturing upload screen...')
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: path.join(screenshotsDir, 'upload.png'),
      type: 'png'
    })
    console.log('✓ upload.png saved')

    // Upload the test file
    console.log('Uploading test file...')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Wait for processing to complete
    await page.waitForTimeout(3000)

    // Wait for review screen
    const reviewHeader = page.locator('text=Review Detections')
    await reviewHeader.waitFor({ timeout: 30000 })
    await page.waitForTimeout(1000)

    // Screenshot 2: Review Screen
    console.log('Capturing review screen...')
    await page.screenshot({
      path: path.join(screenshotsDir, 'review.png'),
      type: 'png'
    })
    console.log('✓ review.png saved')

    // Continue to export
    console.log('Navigating to export screen...')
    const continueBtn = page.locator('button', { hasText: 'Continue' })
    await continueBtn.click()
    await page.waitForTimeout(2000)

    // Wait for export screen
    const exportSection = page.locator('text=Export Sanitized Document')
    await exportSection.waitFor({ timeout: 10000 })
    await page.waitForTimeout(1000)

    // Screenshot 3: Export Screen (Compare View with Highlighting)
    console.log('Capturing export screen...')
    await page.screenshot({
      path: path.join(screenshotsDir, 'export.png'),
      type: 'png'
    })
    console.log('✓ export.png saved')

    console.log('\n✅ All screenshots captured successfully!')
    console.log(`Screenshots saved to: ${screenshotsDir}`)

  } catch (error) {
    console.error('Error capturing screenshots:', error)
    throw error
  } finally {
    if (electronApp) {
      await electronApp.close()
    }
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  }
}

takeScreenshots().catch(console.error)
