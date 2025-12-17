import nlp from 'compromise'

export interface NEREntity {
  text: string
  type: 'person' | 'organization' | 'money' | 'phone' | 'email' | 'ip'
  start: number
  end: number
  confidence?: number
}

// Custom names that users can add - ONLY these names will be detected as persons
let customNames: Set<string> = new Set()

export function setCustomNames(names: string[]): void {
  customNames = new Set(names.map(n => n.toLowerCase().trim()).filter(Boolean))
}

export function extractEntities(text: string, userCustomNames?: string[]): NEREntity[] {
  // Guard against invalid input
  if (!text || typeof text !== 'string') {
    return []
  }

  // Update custom names if provided
  if (userCustomNames) {
    setCustomNames(userCustomNames)
  }

  const doc = nlp(text)
  const entities: NEREntity[] = []
  const seenPositions = new Set<string>()

  // Helper to add entity if not duplicate and valid
  const addEntity = (entity: NEREntity) => {
    // Validate entity before adding
    if (!entity || !entity.text || entity.text.length === 0) return
    if (typeof entity.start !== 'number' || typeof entity.end !== 'number') return
    if (!Number.isFinite(entity.start) || !Number.isFinite(entity.end)) return
    if (entity.start < 0 || entity.end <= entity.start) return
    if (entity.start >= text.length || entity.end > text.length) return

    const key = `${entity.start}-${entity.end}`
    if (!seenPositions.has(key)) {
      seenPositions.add(key)
      entities.push(entity)
    }
  }

  // 1. ONLY detect custom user-defined names (no automatic name detection)
  detectCustomNames(text, addEntity)

  // 2. Extract organizations
  const orgs = doc.organizations()
  orgs.forEach((org: ReturnType<typeof nlp>) => {
    const orgText = org.text()
    if (!orgText || orgText.length < 2) return
    const indices = findAllIndices(text, orgText)
    indices.forEach((start) => {
      addEntity({
        text: orgText,
        type: 'organization',
        start,
        end: start + orgText.length
      })
    })
  })

  // 3. Extract money/currency - ONLY with explicit currency symbols
  detectMoneyWithSymbols(text, addEntity)

  // 4. Extract IP addresses
  detectIPAddresses(text, addEntity)

  // Deduplicate entities (same position)
  const seen = new Set<string>()
  const uniqueEntities = entities.filter((e) => {
    const key = `${e.start}-${e.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return uniqueEntities.sort((a, b) => a.start - b.start)
}

// Detect money ONLY when it has explicit currency symbols
function detectMoneyWithSymbols(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Currency patterns that require explicit symbols
  const moneyPatterns = [
    // Dollar: $100, $1,000.00, $1.5M, $1.5 million
    /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Euro: €100, 100€, EUR 100
    /€\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?€/g,
    /EUR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Pound: £100, GBP 100
    /(?:£\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|GBP\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // SAR: SAR 100, 100 SAR, SR 100, 100 SR
    /(?:SAR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*SAR|SR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*SR)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // AED: AED 100, 100 AED
    /(?:AED\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*AED)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // USD explicit: USD 100, 100 USD
    /(?:USD\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*USD)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Yen: ¥100, JPY 100
    /(?:¥\s*\d{1,3}(?:,\d{3})*|\d{1,3}(?:,\d{3})*\s*¥|JPY\s*\d{1,3}(?:,\d{3})*)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Indian Rupee: ₹100, INR 100
    /(?:₹\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|INR\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Swiss Franc: CHF 100
    /CHF\s*\d{1,3}(?:[',]\d{3})*(?:\.\d{1,2})?(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi,
    // Generic with currency word: 100 dollars, 50 euros, 1000 riyals
    /\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:dollars?|euros?|pounds?|riyals?|dirhams?|yen|rupees?)(?:\s*(?:K|M|B|million|billion|thousand))?\b/gi
  ]

  for (const pattern of moneyPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'money',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 95
      })
    }
  }
}

// Detect ONLY custom user-defined names
function detectCustomNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  if (customNames.size === 0) return

  for (const name of customNames) {
    // Create case-insensitive pattern for the name
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escapedName}\\b`, 'gi')

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'person',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 100 // User-defined names are 100% confident
      })
    }
  }
}

// Detect IP addresses (IPv4 and IPv6)
function detectIPAddresses(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  const ipPatterns = [
    // IPv4: 192.168.1.1, 10.0.0.1, etc.
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    // IPv6 full: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    // IPv6 compressed: 2001:db8::1, ::1, fe80::
    /\b(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
  ]

  for (const pattern of ipPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      // Validate IPv4 to avoid version numbers like 1.0.0.0
      if (match[0].includes('.') && !match[0].includes(':')) {
        const parts = match[0].split('.')
        // Skip if it looks like a version number (all parts are small)
        const isVersionLike = parts.every(p => parseInt(p, 10) < 10)
        if (isVersionLike) continue
      }

      addEntity({
        text: match[0],
        type: 'ip',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 95
      })
    }
  }
}

function findAllIndices(text: string, search: string): number[] {
  // Guard against empty or invalid search strings
  if (!search || typeof search !== 'string' || search.length === 0) {
    return []
  }
  if (!text || typeof text !== 'string') {
    return []
  }

  const indices: number[] = []
  let idx = text.indexOf(search)
  // Limit iterations to prevent infinite loops
  const maxIterations = 10000
  let iterations = 0

  while (idx !== -1 && iterations < maxIterations) {
    indices.push(idx)
    idx = text.indexOf(search, idx + 1)
    iterations++
  }
  return indices
}

// Additional NER-based detection for specific entity types
export function detectPersonNames(text: string): Array<{ text: string; start: number; end: number }> {
  // Only return custom names now
  const results: Array<{ text: string; start: number; end: number }> = []

  if (customNames.size === 0) return results

  for (const name of customNames) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escapedName}\\b`, 'gi')

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      results.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      })
    }
  }

  return results
}

export function detectOrganizations(text: string): Array<{ text: string; start: number; end: number }> {
  const doc = nlp(text)
  const results: Array<{ text: string; start: number; end: number }> = []

  const orgs = doc.organizations()
  orgs.forEach((org: ReturnType<typeof nlp>) => {
    const orgText = org.text()
    if (orgText.length >= 2) {
      const indices = findAllIndices(text, orgText)
      indices.forEach((start) => {
        results.push({
          text: orgText,
          start,
          end: start + orgText.length
        })
      })
    }
  })

  return results
}

