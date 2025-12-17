import { extractEntities, setCustomNames } from './electron/services/ner'

interface TestCase {
  name: string
  input: string
  customNames?: string[]
  expected: {
    type: 'person' | 'organization' | 'place' | 'date' | 'money' | 'phone' | 'email'
    text: string
    shouldDetect: boolean
  }[]
}

const testCases: TestCase[] = [
  // ==================== MONEY TESTS ====================
  // Should DETECT (has currency symbol)
  {
    name: 'Dollar with $ symbol',
    input: 'The price is $100',
    expected: [{ type: 'money', text: '$100', shouldDetect: true }]
  },
  {
    name: 'Dollar with thousands',
    input: 'Total cost: $1,500.00',
    expected: [{ type: 'money', text: '$1,500.00', shouldDetect: true }]
  },
  {
    name: 'Dollar millions',
    input: 'Revenue of $5M expected',
    expected: [{ type: 'money', text: '$5M', shouldDetect: true }]
  },
  {
    name: 'Dollar with million word',
    input: 'Budget is $2.5 million',
    expected: [{ type: 'money', text: '$2.5 million', shouldDetect: true }]
  },
  {
    name: 'Euro symbol before',
    input: 'Price: €500',
    expected: [{ type: 'money', text: '€500', shouldDetect: true }]
  },
  {
    name: 'Euro symbol after',
    input: 'Cost is 250€',
    expected: [{ type: 'money', text: '250€', shouldDetect: true }]
  },
  {
    name: 'EUR code',
    input: 'Payment of EUR 1,000',
    expected: [{ type: 'money', text: 'EUR 1,000', shouldDetect: true }]
  },
  {
    name: 'British Pound symbol',
    input: 'Salary: £75,000',
    expected: [{ type: 'money', text: '£75,000', shouldDetect: true }]
  },
  {
    name: 'GBP code',
    input: 'Transfer GBP 500',
    expected: [{ type: 'money', text: 'GBP 500', shouldDetect: true }]
  },
  {
    name: 'SAR before number',
    input: 'Amount: SAR 10,000',
    expected: [{ type: 'money', text: 'SAR 10,000', shouldDetect: true }]
  },
  {
    name: 'SAR after number',
    input: 'Total: 5,000 SAR',
    expected: [{ type: 'money', text: '5,000 SAR', shouldDetect: true }]
  },
  {
    name: 'SR (Saudi Riyal short)',
    input: 'Price SR 200',
    expected: [{ type: 'money', text: 'SR 200', shouldDetect: true }]
  },
  {
    name: 'AED currency',
    input: 'Fee: AED 350',
    expected: [{ type: 'money', text: 'AED 350', shouldDetect: true }]
  },
  {
    name: 'USD explicit',
    input: 'Balance: USD 1,250.50',
    expected: [{ type: 'money', text: 'USD 1,250.50', shouldDetect: true }]
  },
  {
    name: 'Yen symbol',
    input: 'Cost: ¥10,000',
    expected: [{ type: 'money', text: '¥10,000', shouldDetect: true }]
  },
  {
    name: 'JPY code',
    input: 'JPY 50,000 transfer',
    expected: [{ type: 'money', text: 'JPY 50,000', shouldDetect: true }]
  },
  {
    name: 'Indian Rupee symbol',
    input: 'Amount ₹5,000',
    expected: [{ type: 'money', text: '₹5,000', shouldDetect: true }]
  },
  {
    name: 'INR code',
    input: 'INR 25,000 credited',
    expected: [{ type: 'money', text: 'INR 25,000', shouldDetect: true }]
  },
  {
    name: 'CHF currency',
    input: 'CHF 1,200 fee',
    expected: [{ type: 'money', text: 'CHF 1,200', shouldDetect: true }]
  },
  {
    name: 'Word dollars',
    input: 'Cost is 500 dollars',
    expected: [{ type: 'money', text: '500 dollars', shouldDetect: true }]
  },
  {
    name: 'Word euros',
    input: 'Pay 100 euros',
    expected: [{ type: 'money', text: '100 euros', shouldDetect: true }]
  },
  {
    name: 'Word pounds',
    input: 'Worth 50 pounds',
    expected: [{ type: 'money', text: '50 pounds', shouldDetect: true }]
  },
  {
    name: 'Word riyals',
    input: 'Fee is 1000 riyals',
    expected: [{ type: 'money', text: '1000 riyals', shouldDetect: true }]
  },
  {
    name: 'Word dirhams',
    input: 'Costs 200 dirhams',
    expected: [{ type: 'money', text: '200 dirhams', shouldDetect: true }]
  },

  // Should NOT DETECT (no currency symbol - false positive prevention)
  {
    name: 'Plain number - no currency',
    input: 'There are 100 items',
    expected: [{ type: 'money', text: '100', shouldDetect: false }]
  },
  {
    name: 'Number with comma - no currency',
    input: 'Population: 1,500,000',
    expected: [{ type: 'money', text: '1,500,000', shouldDetect: false }]
  },
  {
    name: 'Percentage',
    input: 'Growth of 25%',
    expected: [{ type: 'money', text: '25', shouldDetect: false }]
  },
  {
    name: 'Year number',
    input: 'In the year 2024',
    expected: [{ type: 'money', text: '2024', shouldDetect: false }]
  },
  {
    name: 'Phone number digits',
    input: 'Call 5551234',
    expected: [{ type: 'money', text: '5551234', shouldDetect: false }]
  },
  {
    name: 'Quantity',
    input: 'Order 50 units',
    expected: [{ type: 'money', text: '50', shouldDetect: false }]
  },
  {
    name: 'Score',
    input: 'Score: 95 out of 100',
    expected: [{ type: 'money', text: '95', shouldDetect: false }, { type: 'money', text: '100', shouldDetect: false }]
  },
  {
    name: 'Version number',
    input: 'Version 2.5.1',
    expected: [{ type: 'money', text: '2.5.1', shouldDetect: false }]
  },
  {
    name: 'Decimal without currency',
    input: 'Value is 3.14159',
    expected: [{ type: 'money', text: '3.14159', shouldDetect: false }]
  },
  {
    name: 'Age',
    input: 'He is 35 years old',
    expected: [{ type: 'money', text: '35', shouldDetect: false }]
  },
  {
    name: 'Distance',
    input: 'Drive 500 kilometers',
    expected: [{ type: 'money', text: '500', shouldDetect: false }]
  },
  {
    name: 'Weight',
    input: 'Weighs 75 kg',
    expected: [{ type: 'money', text: '75', shouldDetect: false }]
  },

  // ==================== NAME TESTS ====================
  // Should DETECT (custom names set)
  {
    name: 'Custom name - exact match',
    input: 'Meeting with John Smith tomorrow',
    customNames: ['John Smith'],
    expected: [{ type: 'person', text: 'John Smith', shouldDetect: true }]
  },
  {
    name: 'Custom name - case insensitive',
    input: 'Email from JOHN SMITH',
    customNames: ['john smith'],
    expected: [{ type: 'person', text: 'JOHN SMITH', shouldDetect: true }]
  },
  {
    name: 'Custom name - multiple occurrences',
    input: 'Ahmed called. Please call Ahmed back.',
    customNames: ['Ahmed'],
    expected: [{ type: 'person', text: 'Ahmed', shouldDetect: true }]
  },
  {
    name: 'Multiple custom names',
    input: 'Meeting between Sarah and Mohammed',
    customNames: ['Sarah', 'Mohammed'],
    expected: [
      { type: 'person', text: 'Sarah', shouldDetect: true },
      { type: 'person', text: 'Mohammed', shouldDetect: true }
    ]
  },
  {
    name: 'Arabic name with Al-prefix',
    input: 'Report by Khalid Al-Rashid',
    customNames: ['Khalid Al-Rashid'],
    expected: [{ type: 'person', text: 'Khalid Al-Rashid', shouldDetect: true }]
  },
  {
    name: 'Full name with middle name',
    input: 'Document signed by Robert James Wilson',
    customNames: ['Robert James Wilson'],
    expected: [{ type: 'person', text: 'Robert James Wilson', shouldDetect: true }]
  },

  // Should NOT DETECT (no custom names or name not in list)
  {
    name: 'Common name - NOT in custom list',
    input: 'Meeting with Michael Johnson',
    customNames: [],
    expected: [{ type: 'person', text: 'Michael Johnson', shouldDetect: false }]
  },
  {
    name: 'Name after Mr. - NOT in custom list',
    input: 'Dear Mr. Anderson',
    customNames: [],
    expected: [{ type: 'person', text: 'Anderson', shouldDetect: false }]
  },
  {
    name: 'Name after Dear - NOT in custom list',
    input: 'Dear Sarah',
    customNames: [],
    expected: [{ type: 'person', text: 'Sarah', shouldDetect: false }]
  },
  {
    name: 'Arabic first name - NOT in custom list',
    input: 'Ahmed sent the report',
    customNames: [],
    expected: [{ type: 'person', text: 'Ahmed', shouldDetect: false }]
  },
  {
    name: 'Western name - NOT in custom list',
    input: 'Email from David',
    customNames: [],
    expected: [{ type: 'person', text: 'David', shouldDetect: false }]
  },
  {
    name: 'Name in signature - NOT in custom list',
    input: 'Best regards,\nJohn Doe',
    customNames: [],
    expected: [{ type: 'person', text: 'John Doe', shouldDetect: false }]
  },
  {
    name: 'CEO name - NOT in custom list',
    input: 'CEO: Elizabeth Warren',
    customNames: [],
    expected: [{ type: 'person', text: 'Elizabeth Warren', shouldDetect: false }]
  },
  {
    name: 'Different name than custom',
    input: 'Meeting with James',
    customNames: ['John'],
    expected: [{ type: 'person', text: 'James', shouldDetect: false }]
  },

  // ==================== DATE TESTS ====================
  {
    name: 'ISO date format',
    input: 'Date: 2024-01-15',
    expected: [{ type: 'date', text: '2024-01-15', shouldDetect: true }]
  },
  {
    name: 'US date format',
    input: 'Due: 01/15/2024',
    expected: [{ type: 'date', text: '01/15/2024', shouldDetect: true }]
  },
  {
    name: 'US date short year',
    input: 'Date: 1/5/24',
    expected: [{ type: 'date', text: '1/5/24', shouldDetect: true }]
  },
  {
    name: 'European date format',
    input: 'Date: 15.01.2024',
    expected: [{ type: 'date', text: '15.01.2024', shouldDetect: true }]
  },
  {
    name: 'Written date - full month',
    input: 'Meeting on January 15, 2024',
    expected: [{ type: 'date', text: 'January 15, 2024', shouldDetect: true }]
  },
  {
    name: 'Written date - abbreviated month',
    input: 'Due: Jan 5, 2024',
    expected: [{ type: 'date', text: 'Jan 5, 2024', shouldDetect: true }]
  },
  {
    name: 'Written date - day first',
    input: 'On 15 January 2024',
    expected: [{ type: 'date', text: '15 January 2024', shouldDetect: true }]
  },
  {
    name: 'Date with ordinal',
    input: 'Meeting on January 1st, 2024',
    expected: [{ type: 'date', text: 'January 1st, 2024', shouldDetect: true }]
  },
  {
    name: 'Multiple dates',
    input: 'From 2024-01-01 to 2024-12-31',
    expected: [
      { type: 'date', text: '2024-01-01', shouldDetect: true },
      { type: 'date', text: '2024-12-31', shouldDetect: true }
    ]
  },

  // ==================== ORGANIZATION TESTS ====================
  {
    name: 'Company with Inc',
    input: 'Working at Microsoft Inc',
    expected: [{ type: 'organization', text: 'Microsoft Inc', shouldDetect: true }]
  },
  {
    name: 'Company with Corp',
    input: 'Contract with Apple Corporation',
    expected: [{ type: 'organization', text: 'Apple Corporation', shouldDetect: true }]
  },
  {
    name: 'University',
    input: 'Graduated from Harvard University',
    expected: [{ type: 'organization', text: 'Harvard University', shouldDetect: true }]
  },

  // ==================== PLACE TESTS ====================
  {
    name: 'City name',
    input: 'Located in New York',
    expected: [{ type: 'place', text: 'New York', shouldDetect: true }]
  },
  {
    name: 'Country name',
    input: 'Traveling to Japan',
    expected: [{ type: 'place', text: 'Japan', shouldDetect: true }]
  },

  // ==================== MIXED CONTENT TESTS ====================
  {
    name: 'Email with money and date',
    input: 'Invoice for $5,000 due on 2024-03-15',
    expected: [
      { type: 'money', text: '$5,000', shouldDetect: true },
      { type: 'date', text: '2024-03-15', shouldDetect: true }
    ]
  },
  {
    name: 'Contract excerpt',
    input: 'Agreement dated January 10, 2024 for EUR 50,000 payable to the contractor.',
    customNames: [],
    expected: [
      { type: 'date', text: 'January 10, 2024', shouldDetect: true },
      { type: 'money', text: 'EUR 50,000', shouldDetect: true }
    ]
  },
  {
    name: 'Business document with custom name',
    input: 'Mohammed Al-Faisal approved the budget of SAR 1,000,000 on 2024-02-20',
    customNames: ['Mohammed Al-Faisal'],
    expected: [
      { type: 'person', text: 'Mohammed Al-Faisal', shouldDetect: true },
      { type: 'money', text: 'SAR 1,000,000', shouldDetect: true },
      { type: 'date', text: '2024-02-20', shouldDetect: true }
    ]
  },
  {
    name: 'Report without custom names',
    input: 'Q1 report shows revenue of $2.5M. Prepared by Finance Team on March 1, 2024.',
    customNames: [],
    expected: [
      { type: 'money', text: '$2.5M', shouldDetect: true },
      { type: 'date', text: 'March 1, 2024', shouldDetect: true },
      { type: 'person', text: 'Finance Team', shouldDetect: false }
    ]
  },

  // ==================== EDGE CASES ====================
  {
    name: 'Empty string',
    input: '',
    expected: []
  },
  {
    name: 'Only whitespace',
    input: '   \n\t  ',
    expected: []
  },
  {
    name: 'No sensitive data',
    input: 'The quick brown fox jumps over the lazy dog.',
    expected: []
  },
  {
    name: 'Numbers that look like money but arent',
    input: 'Room 500, Building 100, Floor 25',
    expected: [
      { type: 'money', text: '500', shouldDetect: false },
      { type: 'money', text: '100', shouldDetect: false },
      { type: 'money', text: '25', shouldDetect: false }
    ]
  },
  {
    name: 'Partial custom name should not match',
    input: 'John went to the store',
    customNames: ['John Smith'],
    expected: [{ type: 'person', text: 'John', shouldDetect: false }]
  },
]

// Run tests
function runTests() {
  let passed = 0
  let failed = 0
  const failures: { name: string; details: string }[] = []

  console.log('=' .repeat(80))
  console.log('NER DETECTION TEST SUITE')
  console.log('=' .repeat(80))
  console.log('')

  for (const testCase of testCases) {
    // Set custom names if provided
    if (testCase.customNames) {
      setCustomNames(testCase.customNames)
    } else {
      setCustomNames([])
    }

    const entities = extractEntities(testCase.input)
    let testPassed = true
    const issues: string[] = []

    for (const expected of testCase.expected) {
      const found = entities.find(e =>
        e.type === expected.type &&
        e.text.toLowerCase() === expected.text.toLowerCase()
      )

      if (expected.shouldDetect && !found) {
        testPassed = false
        issues.push(`MISSED: Expected to detect ${expected.type} "${expected.text}" but didn't`)
      } else if (!expected.shouldDetect && found) {
        testPassed = false
        issues.push(`FALSE POSITIVE: Detected ${expected.type} "${expected.text}" but shouldn't have`)
      }
    }

    if (testPassed) {
      passed++
      console.log(`✅ PASS: ${testCase.name}`)
    } else {
      failed++
      console.log(`❌ FAIL: ${testCase.name}`)
      issues.forEach(issue => console.log(`   └─ ${issue}`))
      failures.push({ name: testCase.name, details: issues.join('\n') })
    }
  }

  console.log('')
  console.log('=' .repeat(80))
  console.log('SUMMARY')
  console.log('=' .repeat(80))
  console.log(`Total Tests: ${testCases.length}`)
  console.log(`Passed: ${passed} (${((passed / testCases.length) * 100).toFixed(1)}%)`)
  console.log(`Failed: ${failed} (${((failed / testCases.length) * 100).toFixed(1)}%)`)
  console.log('')

  if (failures.length > 0) {
    console.log('FAILED TESTS:')
    console.log('-'.repeat(40))
    failures.forEach((f, i) => {
      console.log(`${i + 1}. ${f.name}`)
      console.log(`   ${f.details}`)
    })
  }

  // Category breakdown
  const categories = {
    money: { total: 0, passed: 0 },
    person: { total: 0, passed: 0 },
    date: { total: 0, passed: 0 },
    organization: { total: 0, passed: 0 },
    place: { total: 0, passed: 0 },
    mixed: { total: 0, passed: 0 },
    edge: { total: 0, passed: 0 }
  }

  testCases.forEach((tc) => {
    const name = tc.name.toLowerCase()
    let cat: keyof typeof categories = 'edge'
    if (name.includes('dollar') || name.includes('euro') || name.includes('pound') ||
        name.includes('sar') || name.includes('yen') || name.includes('currency') ||
        name.includes('money') || name.includes('plain number') || name.includes('percentage') ||
        name.includes('year number') || name.includes('quantity') || name.includes('score') ||
        name.includes('version') || name.includes('decimal') || name.includes('age') ||
        name.includes('distance') || name.includes('weight') || name.includes('phone number') ||
        name.includes('chf') || name.includes('inr') || name.includes('jpy') || name.includes('aed') ||
        name.includes('usd') || name.includes('gbp') || name.includes('riyal') || name.includes('dirham')) {
      cat = 'money'
    } else if (name.includes('name') || name.includes('custom') || name.includes('arabic') ||
               name.includes('western') || name.includes('signature') || name.includes('ceo') ||
               name.includes('dear') || name.includes('mr.')) {
      cat = 'person'
    } else if (name.includes('date') || name.includes('iso') || name.includes('european')) {
      cat = 'date'
    } else if (name.includes('company') || name.includes('university') || name.includes('organization')) {
      cat = 'organization'
    } else if (name.includes('city') || name.includes('country') || name.includes('place')) {
      cat = 'place'
    } else if (name.includes('mixed') || name.includes('email with') || name.includes('contract') ||
               name.includes('business') || name.includes('report')) {
      cat = 'mixed'
    }

    categories[cat].total++
    // Check if this test passed (simplified check)
    if (tc.customNames) setCustomNames(tc.customNames)
    else setCustomNames([])
    const entities = extractEntities(tc.input)
    let thisPassed = true
    for (const expected of tc.expected) {
      const found = entities.find(e =>
        e.type === expected.type &&
        e.text.toLowerCase() === expected.text.toLowerCase()
      )
      if (expected.shouldDetect && !found) thisPassed = false
      if (!expected.shouldDetect && found) thisPassed = false
    }
    if (thisPassed) categories[cat].passed++
  })

  console.log('')
  console.log('CATEGORY BREAKDOWN:')
  console.log('-'.repeat(40))
  Object.entries(categories).forEach(([cat, stats]) => {
    if (stats.total > 0) {
      const pct = ((stats.passed / stats.total) * 100).toFixed(0)
      const bar = '█'.repeat(Math.floor(stats.passed / stats.total * 20)) +
                  '░'.repeat(20 - Math.floor(stats.passed / stats.total * 20))
      console.log(`${cat.padEnd(15)} ${bar} ${stats.passed}/${stats.total} (${pct}%)`)
    }
  })
}

runTests()
