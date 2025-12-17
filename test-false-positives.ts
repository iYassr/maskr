import { extractEntities, setCustomNames } from './electron/services/ner'

// Clear custom names - we want to test with NO custom names
setCustomNames([])

interface FalsePositiveTest {
  category: string
  input: string
  description: string
}

// Huge list of things that should NOT be detected
const falsePositiveTests: FalsePositiveTest[] = [
  // ==================== PLAIN NUMBERS ====================
  { category: 'Plain Numbers', input: 'There are 100 items in stock', description: 'Quantity' },
  { category: 'Plain Numbers', input: 'Page 42 of the document', description: 'Page number' },
  { category: 'Plain Numbers', input: 'Chapter 7 begins here', description: 'Chapter number' },
  { category: 'Plain Numbers', input: 'Version 2.0.1 released', description: 'Version number' },
  { category: 'Plain Numbers', input: 'Model number 12345', description: 'Model number' },
  { category: 'Plain Numbers', input: 'Serial: 987654321', description: 'Serial number' },
  { category: 'Plain Numbers', input: 'Order #45678', description: 'Order number' },
  { category: 'Plain Numbers', input: 'Invoice 2024-001', description: 'Invoice number' },
  { category: 'Plain Numbers', input: 'Reference: 123ABC456', description: 'Reference code' },
  { category: 'Plain Numbers', input: 'ID: 999888777', description: 'Generic ID' },
  { category: 'Plain Numbers', input: 'Case number 2024-12345', description: 'Case number' },
  { category: 'Plain Numbers', input: 'Ticket #789', description: 'Ticket number' },
  { category: 'Plain Numbers', input: 'Room 404', description: 'Room number' },
  { category: 'Plain Numbers', input: 'Building 5', description: 'Building number' },
  { category: 'Plain Numbers', input: 'Floor 23', description: 'Floor number' },
  { category: 'Plain Numbers', input: 'Gate 14', description: 'Gate number' },
  { category: 'Plain Numbers', input: 'Platform 9', description: 'Platform number' },
  { category: 'Plain Numbers', input: 'Lane 3', description: 'Lane number' },
  { category: 'Plain Numbers', input: 'Seat 27A', description: 'Seat number' },
  { category: 'Plain Numbers', input: 'Row 15', description: 'Row number' },

  // ==================== MEASUREMENTS ====================
  { category: 'Measurements', input: 'Weight: 75 kg', description: 'Weight in kg' },
  { category: 'Measurements', input: 'Height: 180 cm', description: 'Height in cm' },
  { category: 'Measurements', input: 'Distance: 500 km', description: 'Distance in km' },
  { category: 'Measurements', input: 'Speed: 120 mph', description: 'Speed in mph' },
  { category: 'Measurements', input: 'Temperature: 25 degrees', description: 'Temperature' },
  { category: 'Measurements', input: 'Capacity: 500 ml', description: 'Volume in ml' },
  { category: 'Measurements', input: 'Storage: 256 GB', description: 'Storage size' },
  { category: 'Measurements', input: 'Memory: 16 GB RAM', description: 'RAM size' },
  { category: 'Measurements', input: 'Screen: 15.6 inches', description: 'Screen size' },
  { category: 'Measurements', input: 'Resolution: 1920x1080', description: 'Screen resolution' },
  { category: 'Measurements', input: 'Bandwidth: 100 Mbps', description: 'Bandwidth' },
  { category: 'Measurements', input: 'Frequency: 2.4 GHz', description: 'Frequency' },
  { category: 'Measurements', input: 'Power: 500 watts', description: 'Power' },
  { category: 'Measurements', input: 'Voltage: 220V', description: 'Voltage' },
  { category: 'Measurements', input: 'Current: 15 amps', description: 'Current' },
  { category: 'Measurements', input: 'Pressure: 30 psi', description: 'Pressure' },
  { category: 'Measurements', input: 'Area: 150 sqft', description: 'Area' },
  { category: 'Measurements', input: 'Volume: 2.5 liters', description: 'Volume' },
  { category: 'Measurements', input: 'Density: 1.5 g/cm3', description: 'Density' },
  { category: 'Measurements', input: 'Concentration: 50 ppm', description: 'Concentration' },

  // ==================== PERCENTAGES & RATIOS ====================
  { category: 'Percentages', input: 'Growth rate: 25%', description: 'Growth percentage' },
  { category: 'Percentages', input: 'Discount: 15% off', description: 'Discount percentage' },
  { category: 'Percentages', input: 'Tax rate: 5%', description: 'Tax percentage' },
  { category: 'Percentages', input: 'Interest: 3.5%', description: 'Interest rate' },
  { category: 'Percentages', input: 'Completion: 80%', description: 'Progress percentage' },
  { category: 'Percentages', input: 'Accuracy: 99.9%', description: 'Accuracy percentage' },
  { category: 'Percentages', input: 'Ratio: 3:1', description: 'Ratio' },
  { category: 'Percentages', input: 'Odds: 5 to 1', description: 'Odds' },
  { category: 'Percentages', input: 'Scale: 1:100', description: 'Scale ratio' },
  { category: 'Percentages', input: 'Probability: 0.75', description: 'Probability' },

  // ==================== SCORES & RATINGS ====================
  { category: 'Scores', input: 'Score: 85 out of 100', description: 'Test score' },
  { category: 'Scores', input: 'Rating: 4.5 stars', description: 'Star rating' },
  { category: 'Scores', input: 'Grade: 92 points', description: 'Grade points' },
  { category: 'Scores', input: 'Level 50 achieved', description: 'Game level' },
  { category: 'Scores', input: 'Rank #1 globally', description: 'Ranking' },
  { category: 'Scores', input: 'Points: 2500', description: 'Points' },
  { category: 'Scores', input: 'XP: 15000', description: 'Experience points' },
  { category: 'Scores', input: 'Credits: 500', description: 'Credits' },
  { category: 'Scores', input: 'Likes: 1.5M', description: 'Social likes' },
  { category: 'Scores', input: 'Views: 10K', description: 'View count' },

  // ==================== TIME & DURATION ====================
  { category: 'Time', input: 'Duration: 45 minutes', description: 'Duration in minutes' },
  { category: 'Time', input: 'Runtime: 2 hours', description: 'Runtime' },
  { category: 'Time', input: 'Delay: 30 seconds', description: 'Delay' },
  { category: 'Time', input: 'Timeout: 5000 ms', description: 'Timeout' },
  { category: 'Time', input: 'Latency: 50ms', description: 'Latency' },
  { category: 'Time', input: 'Uptime: 99.99%', description: 'Uptime' },
  { category: 'Time', input: 'Age: 35 years old', description: 'Age' },
  { category: 'Time', input: 'Experience: 10 years', description: 'Years of experience' },
  { category: 'Time', input: 'Warranty: 2 years', description: 'Warranty period' },
  { category: 'Time', input: 'Subscription: 12 months', description: 'Subscription period' },

  // ==================== COMMON WORDS THAT LOOK LIKE NAMES ====================
  { category: 'Common Words', input: 'The apple fell from the tree', description: 'Apple (fruit)' },
  { category: 'Common Words', input: 'She wore a rose colored dress', description: 'Rose (flower)' },
  { category: 'Common Words', input: 'The summer heat was intense', description: 'Summer (season)' },
  { category: 'Common Words', input: 'He showed great grace under pressure', description: 'Grace (quality)' },
  { category: 'Common Words', input: 'The storm brought heavy rain', description: 'Storm (weather)' },
  { category: 'Common Words', input: 'She has hope for the future', description: 'Hope (emotion)' },
  { category: 'Common Words', input: 'The joy was overwhelming', description: 'Joy (emotion)' },
  { category: 'Common Words', input: 'He acted with honor', description: 'Honor (quality)' },
  { category: 'Common Words', input: 'The dawn broke early', description: 'Dawn (time of day)' },
  { category: 'Common Words', input: 'The hunter tracked the deer', description: 'Hunter (occupation)' },
  { category: 'Common Words', input: 'The mason built the wall', description: 'Mason (occupation)' },
  { category: 'Common Words', input: 'The carter delivered goods', description: 'Carter (occupation)' },
  { category: 'Common Words', input: 'The cooper made barrels', description: 'Cooper (occupation)' },
  { category: 'Common Words', input: 'The fisher caught many fish', description: 'Fisher (occupation)' },
  { category: 'Common Words', input: 'The miller ground the wheat', description: 'Miller (occupation)' },

  // ==================== TECHNICAL TERMS ====================
  { category: 'Technical', input: 'Set the variable to null', description: 'Null value' },
  { category: 'Technical', input: 'The function returns undefined', description: 'Undefined' },
  { category: 'Technical', input: 'Use boolean true or false', description: 'Boolean values' },
  { category: 'Technical', input: 'The array has 50 elements', description: 'Array size' },
  { category: 'Technical', input: 'Object has 10 properties', description: 'Object properties' },
  { category: 'Technical', input: 'String length is 255', description: 'String length' },
  { category: 'Technical', input: 'Maximum value: 2147483647', description: 'Max int value' },
  { category: 'Technical', input: 'Port 8080 is in use', description: 'Port number' },
  { category: 'Technical', input: 'HTTP status 404', description: 'HTTP status' },
  { category: 'Technical', input: 'Error code: E001', description: 'Error code' },
  { category: 'Technical', input: 'Buffer size: 1024 bytes', description: 'Buffer size' },
  { category: 'Technical', input: 'Cache hit rate: 95%', description: 'Cache rate' },
  { category: 'Technical', input: 'Query took 250ms', description: 'Query time' },
  { category: 'Technical', input: 'Threads: 8', description: 'Thread count' },
  { category: 'Technical', input: 'CPU usage: 45%', description: 'CPU usage' },

  // ==================== PRODUCT & BRAND NAMES (not people) ====================
  { category: 'Products', input: 'Running Windows 11', description: 'Windows OS' },
  { category: 'Products', input: 'Using macOS Sonoma', description: 'macOS version' },
  { category: 'Products', input: 'Ubuntu 22.04 LTS', description: 'Linux distro' },
  { category: 'Products', input: 'Chrome version 120', description: 'Browser version' },
  { category: 'Products', input: 'Firefox 121 released', description: 'Browser release' },
  { category: 'Products', input: 'Python 3.12 features', description: 'Python version' },
  { category: 'Products', input: 'Node.js 20 LTS', description: 'Node version' },
  { category: 'Products', input: 'React 18 hooks', description: 'React version' },
  { category: 'Products', input: 'Vue 3 composition API', description: 'Vue version' },
  { category: 'Products', input: 'Angular 17 update', description: 'Angular version' },

  // ==================== ADDRESSES & LOCATIONS (generic) ====================
  { category: 'Generic Location', input: 'Located on the main street', description: 'Generic street' },
  { category: 'Generic Location', input: 'Near the city center', description: 'City center' },
  { category: 'Generic Location', input: 'In the downtown area', description: 'Downtown' },
  { category: 'Generic Location', input: 'At the north entrance', description: 'Direction entrance' },
  { category: 'Generic Location', input: 'Behind the main building', description: 'Generic building' },
  { category: 'Generic Location', input: 'Across the parking lot', description: 'Parking lot' },
  { category: 'Generic Location', input: 'Next to the elevator', description: 'Elevator' },
  { category: 'Generic Location', input: 'On the ground floor', description: 'Ground floor' },
  { category: 'Generic Location', input: 'In conference room A', description: 'Conference room' },
  { category: 'Generic Location', input: 'At the reception desk', description: 'Reception' },

  // ==================== COMMON PHRASES WITH NUMBERS ====================
  { category: 'Phrases', input: 'One of the best solutions', description: 'One (word)' },
  { category: 'Phrases', input: 'Two options available', description: 'Two (word)' },
  { category: 'Phrases', input: 'Three main points', description: 'Three (word)' },
  { category: 'Phrases', input: 'A hundred percent sure', description: 'Hundred (word)' },
  { category: 'Phrases', input: 'A thousand thanks', description: 'Thousand (word)' },
  { category: 'Phrases', input: 'First and foremost', description: 'First (ordinal)' },
  { category: 'Phrases', input: 'Second to none', description: 'Second (ordinal)' },
  { category: 'Phrases', input: 'Third time is the charm', description: 'Third (ordinal)' },
  { category: 'Phrases', input: 'At the eleventh hour', description: 'Eleventh (ordinal)' },
  { category: 'Phrases', input: 'Feeling like a million', description: 'Million (expression)' },

  // ==================== BUSINESS/CORPORATE TERMS ====================
  { category: 'Business', input: 'Q1 results are in', description: 'Quarter reference' },
  { category: 'Business', input: 'FY2024 budget approved', description: 'Fiscal year' },
  { category: 'Business', input: 'KPI targets met', description: 'KPI mention' },
  { category: 'Business', input: 'ROI of 150%', description: 'ROI percentage' },
  { category: 'Business', input: 'MoM growth of 5%', description: 'Month over month' },
  { category: 'Business', input: 'YoY increase of 20%', description: 'Year over year' },
  { category: 'Business', input: 'CAGR of 12%', description: 'CAGR' },
  { category: 'Business', input: 'P&L statement review', description: 'P&L reference' },
  { category: 'Business', input: 'EBITDA margin: 25%', description: 'EBITDA' },
  { category: 'Business', input: 'Net margin: 15%', description: 'Net margin' },

  // ==================== SCIENTIFIC NOTATION ====================
  { category: 'Scientific', input: 'Value: 1.5e10', description: 'Scientific notation' },
  { category: 'Scientific', input: 'Constant: 6.022e23', description: 'Avogadro number' },
  { category: 'Scientific', input: 'Speed of light: 3e8 m/s', description: 'Speed of light' },
  { category: 'Scientific', input: 'Planck constant: 6.626e-34', description: 'Planck constant' },
  { category: 'Scientific', input: 'pH level: 7.0', description: 'pH value' },
  { category: 'Scientific', input: 'Wavelength: 500nm', description: 'Wavelength' },
  { category: 'Scientific', input: 'Mass: 1.67e-27 kg', description: 'Atomic mass' },
  { category: 'Scientific', input: 'Charge: 1.6e-19 C', description: 'Electron charge' },
  { category: 'Scientific', input: 'Molarity: 0.5M', description: 'Molarity' },
  { category: 'Scientific', input: 'Half-life: 5730 years', description: 'Half-life' },

  // ==================== RANDOM SENTENCES ====================
  { category: 'Random', input: 'The quick brown fox jumps over the lazy dog', description: 'Pangram' },
  { category: 'Random', input: 'Lorem ipsum dolor sit amet', description: 'Lorem ipsum' },
  { category: 'Random', input: 'Hello world program example', description: 'Hello world' },
  { category: 'Random', input: 'Testing one two three', description: 'Test phrase' },
  { category: 'Random', input: 'Foo bar baz qux', description: 'Placeholder words' },
  { category: 'Random', input: 'Sample text goes here', description: 'Sample text' },
  { category: 'Random', input: 'This is a placeholder', description: 'Placeholder' },
  { category: 'Random', input: 'Example content for testing', description: 'Example content' },
  { category: 'Random', input: 'Demo data inserted', description: 'Demo data' },
  { category: 'Random', input: 'Mock information only', description: 'Mock info' },

  // ==================== CODE-LIKE TEXT ====================
  { category: 'Code', input: 'const x = 42', description: 'Variable assignment' },
  { category: 'Code', input: 'if (count > 100) return', description: 'If statement' },
  { category: 'Code', input: 'for (i = 0; i < 10; i++)', description: 'For loop' },
  { category: 'Code', input: 'function calculate(a, b)', description: 'Function definition' },
  { category: 'Code', input: 'import React from "react"', description: 'Import statement' },
  { category: 'Code', input: 'export default Component', description: 'Export statement' },
  { category: 'Code', input: 'class User extends Model', description: 'Class definition' },
  { category: 'Code', input: 'try { } catch (e) { }', description: 'Try catch' },
  { category: 'Code', input: 'SELECT * FROM table WHERE id = 1', description: 'SQL query' },
  { category: 'Code', input: '{ "key": "value", "num": 123 }', description: 'JSON' },

  // ==================== COMMON TITLES WITHOUT NAMES ====================
  { category: 'Titles', input: 'The CEO made the announcement', description: 'CEO without name' },
  { category: 'Titles', input: 'Our CTO will present', description: 'CTO without name' },
  { category: 'Titles', input: 'The manager approved it', description: 'Manager without name' },
  { category: 'Titles', input: 'Contact the director', description: 'Director without name' },
  { category: 'Titles', input: 'Ask the supervisor', description: 'Supervisor without name' },
  { category: 'Titles', input: 'The president spoke', description: 'President without name' },
  { category: 'Titles', input: 'Our chairman decided', description: 'Chairman without name' },
  { category: 'Titles', input: 'The founder started', description: 'Founder without name' },
  { category: 'Titles', input: 'Contact customer service', description: 'Customer service' },
  { category: 'Titles', input: 'Ask the help desk', description: 'Help desk' },

  // ==================== FILE NAMES & PATHS ====================
  { category: 'Files', input: 'Open file document.pdf', description: 'PDF filename' },
  { category: 'Files', input: 'Save as report.xlsx', description: 'Excel filename' },
  { category: 'Files', input: 'Edit config.json', description: 'JSON filename' },
  { category: 'Files', input: 'Run script.sh', description: 'Shell script' },
  { category: 'Files', input: 'Load image.png', description: 'Image filename' },
  { category: 'Files', input: 'Path: /usr/local/bin', description: 'Unix path' },
  { category: 'Files', input: 'Folder: C:\\Users\\Public', description: 'Windows path' },
  { category: 'Files', input: 'Extension: .docx', description: 'File extension' },
  { category: 'Files', input: 'Archive: backup.zip', description: 'Zip filename' },
  { category: 'Files', input: 'Log file: app.log', description: 'Log filename' },

  // ==================== COLORS ====================
  { category: 'Colors', input: 'Color: #FF5733', description: 'Hex color' },
  { category: 'Colors', input: 'RGB: 255, 128, 0', description: 'RGB values' },
  { category: 'Colors', input: 'Set to blue color', description: 'Blue color word' },
  { category: 'Colors', input: 'The red indicator', description: 'Red color word' },
  { category: 'Colors', input: 'Green status light', description: 'Green color word' },

  // ==================== WEATHER ====================
  { category: 'Weather', input: 'Temperature: 72F', description: 'Fahrenheit temp' },
  { category: 'Weather', input: 'Humidity: 65%', description: 'Humidity' },
  { category: 'Weather', input: 'Wind: 15 mph NW', description: 'Wind speed' },
  { category: 'Weather', input: 'Precipitation: 0.5 inches', description: 'Precipitation' },
  { category: 'Weather', input: 'UV index: 8', description: 'UV index' },

  // ==================== SPORTS SCORES ====================
  { category: 'Sports', input: 'Final score: 3-2', description: 'Game score' },
  { category: 'Sports', input: 'Set: 6-4, 7-5', description: 'Tennis score' },
  { category: 'Sports', input: 'Halftime: 21-14', description: 'Football score' },
  { category: 'Sports', input: 'Innings: 5-3', description: 'Baseball score' },
  { category: 'Sports', input: 'Goals: 2-1', description: 'Soccer score' },

  // ==================== COOKING/RECIPES ====================
  { category: 'Cooking', input: 'Add 2 cups flour', description: 'Cups measurement' },
  { category: 'Cooking', input: 'Use 3 tablespoons', description: 'Tablespoons' },
  { category: 'Cooking', input: 'Heat to 350 degrees', description: 'Cooking temp' },
  { category: 'Cooking', input: 'Bake for 25 minutes', description: 'Baking time' },
  { category: 'Cooking', input: 'Serves 4 people', description: 'Servings' },

  // ==================== MUSIC ====================
  { category: 'Music', input: 'Track 5 playing', description: 'Track number' },
  { category: 'Music', input: 'BPM: 120', description: 'Beats per minute' },
  { category: 'Music', input: 'Volume: 75%', description: 'Volume level' },
  { category: 'Music', input: 'Duration: 3:45', description: 'Song duration' },
  { category: 'Music', input: 'Key: C major', description: 'Musical key' },

  // ==================== HEALTHCARE (non-PII) ====================
  { category: 'Healthcare', input: 'Blood pressure: 120/80', description: 'Blood pressure' },
  { category: 'Healthcare', input: 'Heart rate: 72 bpm', description: 'Heart rate' },
  { category: 'Healthcare', input: 'BMI: 24.5', description: 'BMI value' },
  { category: 'Healthcare', input: 'Dosage: 500mg twice daily', description: 'Dosage' },
  { category: 'Healthcare', input: 'Calories: 2000 kcal', description: 'Calories' },

  // ==================== LOREM IPSUM VARIATIONS ====================
  { category: 'Lorem', input: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem', description: 'Latin placeholder 1' },
  { category: 'Lorem', input: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur', description: 'Latin placeholder 2' },
  { category: 'Lorem', input: 'Neque porro quisquam est qui dolorem ipsum quia dolor', description: 'Latin placeholder 3' },
  { category: 'Lorem', input: 'Ut enim ad minima veniam quis nostrum exercitationem', description: 'Latin placeholder 4' },
  { category: 'Lorem', input: 'Quis autem vel eum iure reprehenderit qui in ea voluptate', description: 'Latin placeholder 5' },
]

// Run false positive tests
function runFalsePositiveTests() {
  console.log('='.repeat(80))
  console.log('FALSE POSITIVE TEST SUITE')
  console.log('='.repeat(80))
  console.log('')
  console.log('Testing inputs that should NOT trigger any person/money detections...')
  console.log('')

  let totalTests = 0
  let passed = 0
  let failed = 0
  const failures: { category: string; input: string; description: string; detected: string[] }[] = []
  const categoryStats: Record<string, { total: number; passed: number }> = {}

  for (const test of falsePositiveTests) {
    totalTests++

    // Initialize category stats
    if (!categoryStats[test.category]) {
      categoryStats[test.category] = { total: 0, passed: 0 }
    }
    categoryStats[test.category].total++

    const entities = extractEntities(test.input)

    // Filter to only person and money detections (the ones we fixed)
    const problematicEntities = entities.filter(e =>
      e.type === 'person' || e.type === 'money'
    )

    if (problematicEntities.length === 0) {
      passed++
      categoryStats[test.category].passed++
      console.log(`✅ PASS: [${test.category}] ${test.description}`)
    } else {
      failed++
      const detected = problematicEntities.map(e => `${e.type}:"${e.text}"`)
      failures.push({
        category: test.category,
        input: test.input,
        description: test.description,
        detected
      })
      console.log(`❌ FAIL: [${test.category}] ${test.description}`)
      console.log(`   └─ Input: "${test.input}"`)
      console.log(`   └─ Detected: ${detected.join(', ')}`)
    }
  }

  console.log('')
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Passed: ${passed} (${((passed / totalTests) * 100).toFixed(1)}%)`)
  console.log(`Failed: ${failed} (${((failed / totalTests) * 100).toFixed(1)}%)`)
  console.log('')

  if (failures.length > 0) {
    console.log('FALSE POSITIVES DETECTED:')
    console.log('-'.repeat(40))
    failures.forEach((f, i) => {
      console.log(`${i + 1}. [${f.category}] ${f.description}`)
      console.log(`   Input: "${f.input}"`)
      console.log(`   Wrongly detected: ${f.detected.join(', ')}`)
    })
    console.log('')
  }

  console.log('CATEGORY BREAKDOWN:')
  console.log('-'.repeat(40))

  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => a[0].localeCompare(b[0]))

  for (const [category, stats] of sortedCategories) {
    const pct = ((stats.passed / stats.total) * 100).toFixed(0)
    const bar = '█'.repeat(Math.floor(stats.passed / stats.total * 20)) +
                '░'.repeat(20 - Math.floor(stats.passed / stats.total * 20))
    const status = stats.passed === stats.total ? '✅' : '⚠️'
    console.log(`${status} ${category.padEnd(18)} ${bar} ${stats.passed}/${stats.total} (${pct}%)`)
  }

  console.log('')
  console.log('='.repeat(80))

  // Return exit code based on results
  if (failed > 0) {
    console.log(`⚠️  ${failed} FALSE POSITIVES FOUND - Review needed!`)
    process.exit(1)
  } else {
    console.log('✅ ALL TESTS PASSED - No false positives detected!')
    process.exit(0)
  }
}

runFalsePositiveTests()
