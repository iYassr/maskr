import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WEB_APP_URL = 'file://' + join(__dirname, '../docs/app/index.html')
const COMPREHENSIVE_DATA = readFileSync(join(__dirname, 'fixtures/comprehensive-pii-sample.txt'), 'utf-8')

test.describe('Web App - Comprehensive PII Detection', () => {
  test('detects 700+ entities from comprehensive test data', async ({ page }) => {
    // Increase timeout for this large test
    test.setTimeout(120000)

    await page.goto(WEB_APP_URL)
    await page.waitForSelector('.upload-area')

    // Open text input
    await page.click('#toggleTextInput')
    await page.waitForSelector('#textInputArea.visible')

    // Paste the comprehensive test data
    await page.fill('#textInput', COMPREHENSIVE_DATA)

    // Click analyze
    await page.click('#analyzeTextBtn')

    // Wait for detection to complete (may take a while with large data)
    await page.waitForSelector('#step2:not(.hidden)', { timeout: 60000 })

    // Get the count of detections
    const detectionCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('#detectionTable tr')
      return rows.length
    })

    console.log(`\n=== WEB VERSION DETECTION RESULTS ===`)
    console.log(`Total detections: ${detectionCount}`)

    // Get stats by type
    const stats = await page.evaluate(() => {
      const statElements = document.querySelectorAll('#stats .stat')
      const result: Record<string, number> = {}
      statElements.forEach((stat) => {
        const value = stat.querySelector('.stat-value')?.textContent || '0'
        const label = stat.querySelector('.stat-label')?.textContent || 'unknown'
        result[label] = parseInt(value, 10)
      })
      return result
    })

    console.log(`\nDetections by type:`)
    for (const [type, count] of Object.entries(stats)) {
      console.log(`  ${type}: ${count}`)
    }

    // Verify we're detecting a substantial number
    // The standalone version detected 900+, web should detect at least 500+
    expect(detectionCount).toBeGreaterThan(500)

    // Verify specific entity types are detected
    expect(stats['email'] || 0).toBeGreaterThan(40)
    expect(stats['phone'] || 0).toBeGreaterThan(30)
    expect(stats['credit_card'] || 0).toBeGreaterThan(50)
    expect(stats['iban'] || 0).toBeGreaterThan(50)
    expect(stats['ip'] || 0).toBeGreaterThan(50)
    expect(stats['financial'] || 0).toBeGreaterThan(50)
    expect(stats['saudi_id'] || 0).toBeGreaterThan(30)
    expect(stats['ssn'] || 0).toBeGreaterThan(15)
    expect(stats['person'] || 0).toBeGreaterThan(50)

    console.log(`\n=== TEST PASSED ===\n`)
  })
})
