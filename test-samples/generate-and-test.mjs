/**
 * Test script to generate sample files and test sanitization
 * Run with: node test-samples/generate-and-test.mjs
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputDir = path.join(__dirname, 'input')
const outputDir = path.join(__dirname, 'output')

// Sample PII content for testing
const sampleContent = {
  names: ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Jennifer Adams', 'Dr. Robert Williams'],
  emails: ['john.smith@acmecorp.com', 'sarah.johnson@acmecorp.com', 'contact@globaltech.io'],
  phones: ['(555) 123-4567', '+1-555-987-6543', '555-234-5678'],
  ssns: ['123-45-6789', '987-65-4321'],
  addresses: ['123 Oak Street, Apt 4B, San Francisco, CA 94102'],
  creditCards: ['4532015112830366'],
  ibans: ['DE89370400440532013000'],
  ips: ['192.168.1.105', '10.0.1.50'],
  urls: ['https://api.acmecorp.com', 'https://internal.acmecorp.com/hr'],
  money: ['$125,000.00', '$250,000.00', '$15,000']
}

// ============================================================================
// GENERATE DOCX FILE
// ============================================================================
async function generateDocx() {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = await import('docx')

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'CONFIDENTIAL: Human Resources Report', bold: true, size: 32 })]
        }),
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [new TextRun({ text: 'Employee Overview', bold: true, size: 24 })]
        }),
        new Paragraph({
          children: [new TextRun('This report contains sensitive employee information for Acme Corporation.')]
        }),
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [new TextRun({ text: 'Primary Contact: ', bold: true }), new TextRun('John Smith')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Email: ', bold: true }), new TextRun('john.smith@acmecorp.com')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Phone: ', bold: true }), new TextRun('(555) 123-4567')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'SSN: ', bold: true }), new TextRun('123-45-6789')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Address: ', bold: true }), new TextRun('123 Oak Street, Apt 4B, San Francisco, CA 94102')]
        }),
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [new TextRun({ text: 'Financial Information', bold: true, size: 24 })]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Salary: ', bold: true }), new TextRun('$125,000.00 annually')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Bank Account: ', bold: true }), new TextRun('1234567890')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'IBAN: ', bold: true }), new TextRun('DE89370400440532013000')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Credit Card: ', bold: true }), new TextRun('4532015112830366')]
        }),
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [new TextRun({ text: 'IT Access', bold: true, size: 24 })]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'IP Address: ', bold: true }), new TextRun('192.168.1.105')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Internal Portal: ', bold: true }), new TextRun('https://internal.acmecorp.com/hr')]
        }),
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [new TextRun({ text: 'Emergency Contact', bold: true, size: 24 })]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Name: ', bold: true }), new TextRun('Sarah Johnson')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Email: ', bold: true }), new TextRun('sarah.johnson@acmecorp.com')]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Phone: ', bold: true }), new TextRun('+1-555-987-6543')]
        }),
        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({
          children: [new TextRun({ text: 'Document prepared by Jennifer Adams', italics: true })]
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Contact: jennifer.adams@acmecorp.com', italics: true })]
        })
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  await fs.writeFile(path.join(inputDir, 'sample.docx'), buffer)
  console.log('Created: sample.docx')
}

// ============================================================================
// GENERATE XLSX FILE
// ============================================================================
async function generateXlsx() {
  const ExcelJS = (await import('exceljs')).default

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Test Generator'
  workbook.created = new Date()

  // Employee Sheet
  const empSheet = workbook.addWorksheet('Employees')
  empSheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'SSN', key: 'ssn', width: 15 },
    { header: 'Salary', key: 'salary', width: 15 },
    { header: 'Address', key: 'address', width: 45 }
  ]

  empSheet.addRows([
    { id: 'EMP001', name: 'John Smith', email: 'john.smith@acmecorp.com', phone: '(555) 123-4567', ssn: '123-45-6789', salary: '$125,000', address: '123 Oak Street, San Francisco, CA 94102' },
    { id: 'EMP002', name: 'Sarah Johnson', email: 'sarah.johnson@acmecorp.com', phone: '+1-555-987-6543', ssn: '234-56-7890', salary: '$95,000', address: '456 Elm Ave, Los Angeles, CA 90001' },
    { id: 'EMP003', name: 'Michael Chen', email: 'm.chen@acmecorp.com', phone: '555-333-4444', ssn: '345-67-8901', salary: '$110,000', address: '789 Pine Road, Seattle, WA 98101' },
    { id: 'EMP004', name: 'Jennifer Adams', email: 'jennifer.adams@acmecorp.com', phone: '(555) 111-2222', ssn: '456-78-9012', salary: '$135,000', address: '321 Maple Dr, Austin, TX 78701' },
    { id: 'EMP005', name: 'Dr. Robert Williams', email: 'r.williams@acmecorp.com', phone: '555-444-5555', ssn: '567-89-0123', salary: '$150,000', address: '654 Cedar Lane, Boston, MA 02101' }
  ])

  // Financial Sheet
  const finSheet = workbook.addWorksheet('Financial')
  finSheet.columns = [
    { header: 'Employee', key: 'employee', width: 25 },
    { header: 'Bank Account', key: 'account', width: 20 },
    { header: 'Routing Number', key: 'routing', width: 15 },
    { header: 'IBAN', key: 'iban', width: 30 },
    { header: 'Credit Card', key: 'cc', width: 20 }
  ]

  finSheet.addRows([
    { employee: 'John Smith', account: '1234567890', routing: '021000021', iban: 'DE89370400440532013000', cc: '4532015112830366' },
    { employee: 'Sarah Johnson', account: '0987654321', routing: '021000021', iban: 'GB82WEST12345698765432', cc: '5425233430109903' },
    { employee: 'Michael Chen', account: '5678901234', routing: '121000358', iban: 'FR7630006000011234567890189', cc: '374245455400126' }
  ])

  // IT Access Sheet
  const itSheet = workbook.addWorksheet('IT Access')
  itSheet.columns = [
    { header: 'Employee', key: 'employee', width: 25 },
    { header: 'Username', key: 'username', width: 15 },
    { header: 'IP Address', key: 'ip', width: 18 },
    { header: 'VPN Access', key: 'vpn', width: 12 },
    { header: 'Portal URL', key: 'url', width: 40 }
  ]

  itSheet.addRows([
    { employee: 'John Smith', username: 'jsmith', ip: '192.168.1.105', vpn: 'Yes', url: 'https://internal.acmecorp.com/hr' },
    { employee: 'Sarah Johnson', username: 'sjohnson', ip: '192.168.1.106', vpn: 'Yes', url: 'https://vpn.acmecorp.com' },
    { employee: 'Michael Chen', username: 'mchen', ip: '10.0.1.50', vpn: 'No', url: 'https://api.acmecorp.com/admin' }
  ])

  await workbook.xlsx.writeFile(path.join(inputDir, 'sample.xlsx'))
  console.log('Created: sample.xlsx')
}

// ============================================================================
// GENERATE PDF FILE
// ============================================================================
async function generatePdf() {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([612, 792]) // Letter size
  const { height } = page.getSize()

  let y = height - 50
  const lineHeight = 18
  const margin = 50

  const drawText = (text, options = {}) => {
    page.drawText(text, {
      x: options.x || margin,
      y,
      size: options.size || 12,
      font: options.bold ? helveticaBold : helvetica,
      color: rgb(0, 0, 0)
    })
    y -= options.lineHeight || lineHeight
  }

  // Title
  drawText('CONFIDENTIAL: Client Contract Agreement', { size: 18, bold: true, lineHeight: 30 })
  drawText('')

  // Client Information
  drawText('CLIENT INFORMATION', { size: 14, bold: true, lineHeight: 24 })
  drawText('Company: GlobalTech Industries')
  drawText('Contact Person: Robert Thompson')
  drawText('Email: rthompson@globaltech.io')
  drawText('Phone: (555) 888-9999')
  drawText('Address: 456 Corporate Blvd, Suite 100, New York, NY 10001')
  drawText('')

  // Vendor Information
  drawText('VENDOR INFORMATION', { size: 14, bold: true, lineHeight: 24 })
  drawText('Company: Acme Corporation')
  drawText('Contact: Jennifer Adams')
  drawText('Email: jennifer.adams@acmecorp.com')
  drawText('Phone: (555) 111-2222')
  drawText('')

  // Contract Details
  drawText('CONTRACT DETAILS', { size: 14, bold: true, lineHeight: 24 })
  drawText('Contract Value: $500,000.00')
  drawText('Start Date: March 1, 2024')
  drawText('End Date: February 28, 2025')
  drawText('')

  // Payment Information
  drawText('PAYMENT INFORMATION', { size: 14, bold: true, lineHeight: 24 })
  drawText('Bank: First National Bank')
  drawText('Account Number: 9876543210')
  drawText('Routing Number: 021000021')
  drawText('IBAN: DE89370400440532013000')
  drawText('SWIFT: FNBKUS33')
  drawText('')

  // Technical Contact
  drawText('TECHNICAL CONTACT', { size: 14, bold: true, lineHeight: 24 })
  drawText('Name: Michael Chen')
  drawText('Email: m.chen@acmecorp.com')
  drawText('Phone: 555-333-4444')
  drawText('Server IP: 10.0.1.50')
  drawText('API Endpoint: https://api.acmecorp.com/v2/contract')
  drawText('')

  // Signatory
  drawText('AUTHORIZED SIGNATORY', { size: 14, bold: true, lineHeight: 24 })
  drawText('Name: John Smith')
  drawText('Title: Chief Executive Officer')
  drawText('SSN (for tax purposes): 123-45-6789')
  drawText('Email: john.smith@acmecorp.com')

  const pdfBytes = await pdfDoc.save()
  await fs.writeFile(path.join(inputDir, 'sample.pdf'), pdfBytes)
  console.log('Created: sample.pdf')
}

// ============================================================================
// TEST FILES USING APP SERVICES
// ============================================================================
async function testFiles() {
  console.log('\n' + '='.repeat(60))
  console.log('TESTING FILES THROUGH MASKR SERVICES')
  console.log('='.repeat(60) + '\n')

  // Import the app's services
  const documentParserPath = path.join(__dirname, '..', 'electron', 'services', 'document-parser.ts')
  const detectorPath = path.join(__dirname, '..', 'electron', 'services', 'detector.ts')

  // We need to use ts-node or compile first, so let's use a different approach
  // We'll test by calling the electron main process directly

  const files = await fs.readdir(inputDir)
  console.log(`Found ${files.length} test files:\n`)

  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    console.log(`  - ${file} (${ext})`)
  }

  return files
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  console.log('='.repeat(60))
  console.log('GENERATING TEST FILES WITH PII DATA')
  console.log('='.repeat(60) + '\n')

  try {
    // Ensure directories exist
    await fs.mkdir(inputDir, { recursive: true })
    await fs.mkdir(outputDir, { recursive: true })

    // Generate all file types
    console.log('Generating sample files...\n')

    await generateDocx()
    await generateXlsx()
    await generatePdf()

    console.log('\n' + '='.repeat(60))
    console.log('ALL TEST FILES GENERATED SUCCESSFULLY')
    console.log('='.repeat(60))
    console.log(`\nInput directory: ${inputDir}`)
    console.log(`Output directory: ${outputDir}`)

    // List all files
    const files = await testFiles()

    console.log('\n' + '='.repeat(60))
    console.log('EXPECTED PII TO BE DETECTED')
    console.log('='.repeat(60))
    console.log('\nNames:', sampleContent.names.join(', '))
    console.log('Emails:', sampleContent.emails.join(', '))
    console.log('Phones:', sampleContent.phones.join(', '))
    console.log('SSNs:', sampleContent.ssns.join(', '))
    console.log('Credit Cards:', sampleContent.creditCards.join(', '))
    console.log('IBANs:', sampleContent.ibans.join(', '))
    console.log('IPs:', sampleContent.ips.join(', '))
    console.log('URLs:', sampleContent.urls.join(', '))
    console.log('Money:', sampleContent.money.join(', '))

    console.log('\n' + '='.repeat(60))
    console.log('NEXT STEPS')
    console.log('='.repeat(60))
    console.log('\n1. Run: npm run dev')
    console.log('2. Load each file from test-samples/input/')
    console.log('3. Review detections and approve all')
    console.log('4. Export to test-samples/output/')
    console.log('5. Run: node test-samples/verify-output.mjs')

  } catch (error) {
    console.error('Error generating test files:', error)
    process.exit(1)
  }
}

main()
