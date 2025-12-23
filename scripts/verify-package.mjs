#!/usr/bin/env node
/**
 * Verify that all critical dependencies are included in the packaged app
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const ASAR_PATHS = [
  { path: 'release/mac-arm64/maskr.app/Contents/Resources/app.asar', platform: 'macOS (arm64)' },
  { path: 'release/mac/maskr.app/Contents/Resources/app.asar', platform: 'macOS (x64)' },
  { path: 'release/win-unpacked/resources/app.asar', platform: 'Windows (x64)' },
  { path: 'release/win-arm64-unpacked/resources/app.asar', platform: 'Windows (arm64)' },
  { path: 'release/linux-unpacked/resources/app.asar', platform: 'Linux (x64)' },
  { path: 'release/linux-arm64-unpacked/resources/app.asar', platform: 'Linux (arm64)' }
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

// Find all existing asars
const existingAsars = ASAR_PATHS.filter(p => existsSync(p.path))

if (existingAsars.length === 0) {
  console.error('❌ No packaged app found. Run `npm run build` first.')
  process.exit(1)
}

console.log(`\n📦 Found ${existingAsars.length} platform build(s)\n`)

let totalErrors = 0

for (const { path: asarPath, platform } of existingAsars) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`🖥️  ${platform}`)
  console.log(`${'='.repeat(50)}`)

  // Get asar contents
  const contents = execSync(`npx asar list "${asarPath}"`, { encoding: 'utf-8' })
  const files = new Set(contents.split('\n').map(f => f.trim()))

  let platformErrors = 0

  for (const file of CRITICAL_FILES) {
    const fullPath = '/' + file
    if (files.has(fullPath)) {
      console.log(`  ✓ ${file}`)
    } else {
      console.error(`  ❌ MISSING: ${file}`)
      platformErrors++
    }
  }

  // Check tesseract is unpacked (for OCR)
  const tesseractUnpacked = existsSync(
    path.join(path.dirname(asarPath), 'app.asar.unpacked/node_modules/tesseract.js')
  )
  if (tesseractUnpacked) {
    console.log(`  ✓ tesseract.js unpacked for OCR`)
  } else {
    console.log(`  ⚠ tesseract.js not found in unpacked`)
  }

  if (platformErrors === 0) {
    console.log(`\n  ✓ ${platform} PASSED`)
  } else {
    console.error(`\n  ❌ ${platform} FAILED (${platformErrors} missing)`)
    totalErrors += platformErrors
  }
}

// Summary
console.log(`\n${'='.repeat(50)}`)
console.log('SUMMARY')
console.log(`${'='.repeat(50)}`)
console.log(`Platforms checked: ${existingAsars.length}`)
console.log(`Platforms: ${existingAsars.map(a => a.platform).join(', ')}`)

if (totalErrors > 0) {
  console.error(`\n❌ VERIFICATION FAILED - ${totalErrors} total errors`)
  console.error('Some critical files are missing. Check electron-builder.yml.')
  process.exit(1)
} else {
  console.log(`\n✅ ALL PLATFORMS PASSED`)
  console.log('All critical dependencies are included in all builds.')
}
