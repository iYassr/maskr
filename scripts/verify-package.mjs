#!/usr/bin/env node
/**
 * Verify that all critical dependencies are included in the packaged app
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const ASAR_PATHS = [
  'release/mac-arm64/maskr.app/Contents/Resources/app.asar',
  'release/mac/maskr.app/Contents/Resources/app.asar',
  'release/win-unpacked/resources/app.asar',
  'release/linux-unpacked/resources/app.asar'
]

// Critical files that MUST exist in the package
const CRITICAL_FILES = [
  // ExcelJS (the doc folder was being excluded)
  'node_modules/exceljs/lib/doc/workbook.js',
  'node_modules/exceljs/lib/exceljs.nodejs.js',

  // Mammoth for DOCX
  'node_modules/mammoth/lib/index.js',

  // Compromise NLP
  'node_modules/compromise/src/three.js',

  // PDF handling
  'node_modules/pdf-lib/cjs/index.js',
  'node_modules/pdfjs-dist/legacy/build/pdf.mjs',

  // Our code
  'dist-electron/main.js',
  'dist-electron/preload.js',
  'dist/index.html'
]

// Find first existing asar
let asarPath = null
for (const p of ASAR_PATHS) {
  if (existsSync(p)) {
    asarPath = p
    break
  }
}

if (!asarPath) {
  console.error('❌ No packaged app found. Run `npm run build` first.')
  process.exit(1)
}

console.log(`\n📦 Checking: ${asarPath}\n`)

// Get asar contents
const contents = execSync(`npx asar list "${asarPath}"`, { encoding: 'utf-8' })
const files = new Set(contents.split('\n').map(f => f.trim()))

let hasErrors = false

for (const file of CRITICAL_FILES) {
  const fullPath = '/' + file
  if (files.has(fullPath)) {
    console.log(`✓ ${file}`)
  } else {
    console.error(`❌ MISSING: ${file}`)
    hasErrors = true
  }
}

// Additional checks
console.log('\n--- Additional Checks ---')

// Check tesseract is unpacked (for OCR)
const tesseractUnpacked = existsSync(
  path.join(path.dirname(asarPath), 'app.asar.unpacked/node_modules/tesseract.js')
)
if (tesseractUnpacked) {
  console.log('✓ tesseract.js unpacked for OCR')
} else {
  console.log('⚠ tesseract.js not found in unpacked (OCR may not work)')
}

// Summary
console.log('\n' + '='.repeat(40))
if (hasErrors) {
  console.error('❌ Package verification FAILED')
  console.error('Some critical files are missing from the package.')
  console.error('Check electron-builder.yml exclusion patterns.')
  process.exit(1)
} else {
  console.log('✓ Package verification PASSED')
  console.log('All critical dependencies are included.')
}
