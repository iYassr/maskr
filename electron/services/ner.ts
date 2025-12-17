import nlp from 'compromise'
import {
  isKnownFirstName,
  isKnownArabicFamilyName
} from './names-dictionary'

export interface NEREntity {
  text: string
  type: 'person' | 'organization' | 'place' | 'date' | 'money' | 'phone' | 'email'
  start: number
  end: number
  confidence?: number
}

// Custom names that users can add
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

  // 1. Extract people names using Compromise NLP
  const people = doc.people()
  people.forEach((person: ReturnType<typeof nlp>) => {
    const personText = person.text()
    if (!personText || personText.length < 2) return // Skip empty or single-char results
    const indices = findAllIndices(text, personText)
    indices.forEach((start) => {
      addEntity({
        text: personText,
        type: 'person',
        start,
        end: start + personText.length,
        confidence: 75
      })
    })
  })

  // 2. Dictionary-based name detection
  detectDictionaryNames(text, addEntity)

  // 3. Contextual name detection (names after titles/prefixes)
  detectContextualNames(text, addEntity)

  // 4. Custom user-defined names
  detectCustomNames(text, addEntity)

  // Extract organizations
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

  // Extract places
  const places = doc.places()
  places.forEach((place: ReturnType<typeof nlp>) => {
    const placeText = place.text()
    if (!placeText || placeText.length < 2) return
    const indices = findAllIndices(text, placeText)
    indices.forEach((start) => {
      addEntity({
        text: placeText,
        type: 'place',
        start,
        end: start + placeText.length
      })
    })
  })

  // Extract money/currency mentions
  const money = doc.money()
  money.forEach((m: ReturnType<typeof nlp>) => {
    const moneyText = m.text()
    if (!moneyText || moneyText.length < 1) return
    const indices = findAllIndices(text, moneyText)
    indices.forEach((start) => {
      addEntity({
        text: moneyText,
        type: 'money',
        start,
        end: start + moneyText.length
      })
    })
  })

  // Extract dates
  const dates = doc.dates()
  dates.forEach((d: ReturnType<typeof nlp>) => {
    const dateText = d.text()
    if (!dateText || dateText.length < 1) return
    const indices = findAllIndices(text, dateText)
    indices.forEach((start) => {
      addEntity({
        text: dateText,
        type: 'date',
        start,
        end: start + dateText.length
      })
    })
  })

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

// Detect names from dictionary (capitalized words that match known names)
function detectDictionaryNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Match capitalized words (potential names)
  const capitalizedWordPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
  let match: RegExpExecArray | null

  while ((match = capitalizedWordPattern.exec(text)) !== null) {
    const potentialName = match[1]
    const words = potentialName.split(/\s+/)

    // Check if any word is a known first name
    const hasKnownFirstName = words.some(w => isKnownFirstName(w))

    // Check for Arabic full name pattern (FirstName + Al/El family name)
    const hasArabicPattern = words.length >= 2 &&
      isKnownFirstName(words[0]) &&
      (words.some(w => w.toLowerCase().startsWith('al') || w.toLowerCase().startsWith('el')) ||
       words.some(w => isKnownArabicFamilyName(w)))

    if (hasKnownFirstName || hasArabicPattern) {
      // For single known first names, require additional context or be more conservative
      if (words.length === 1) {
        // Single word - check surrounding context for name indicators
        const contextStart = Math.max(0, match.index - 50)
        const contextBefore = text.slice(contextStart, match.index).toLowerCase()

        // Only add if there's a name indicator before it or it's clearly a name context
        const hasNameContext = /(?:mr|mrs|ms|dr|dear|hi|hello|from|to|by|name|contact|author|signed)\s*[:.]?\s*$/i.test(contextBefore)

        if (hasNameContext) {
          addEntity({
            text: potentialName,
            type: 'person',
            start: match.index,
            end: match.index + potentialName.length,
            confidence: 85
          })
        }
      } else {
        // Multi-word names with known first name - higher confidence
        addEntity({
          text: potentialName,
          type: 'person',
          start: match.index,
          end: match.index + potentialName.length,
          confidence: hasArabicPattern ? 90 : 80
        })
      }
    }
  }
}

// Detect names after title prefixes (Mr., Dr., Dear, etc.)
function detectContextualNames(
  text: string,
  addEntity: (entity: NEREntity) => void
): void {
  // Pattern: Title/prefix followed by capitalized name(s)
  const contextualPatterns = [
    // Mr./Mrs./Ms./Dr. followed by name
    /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Eng|Sir|Madam|Sheikh|Prince|Princess)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    // Dear/Hi/Hello followed by name
    /\b(?:Dear|Hi|Hello|Hey)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    // "Name:" or "Contact:" or "Author:" followed by name
    /\b(?:Name|Contact|Author|Prepared by|Submitted by|From|To|Attn|Attention|Signed|Regards|Sincerely)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    // Email signature patterns: name at end of line before email
    /\n([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n.*?@/g
  ]

  for (const pattern of contextualPatterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]
      if (name && name.length >= 2) {
        // Find the actual position of the name in the match
        const nameStart = text.indexOf(name, match.index)
        if (nameStart !== -1) {
          addEntity({
            text: name,
            type: 'person',
            start: nameStart,
            end: nameStart + name.length,
            confidence: 90 // High confidence for contextual matches
          })
        }
      }
    }
  }
}

// Detect custom user-defined names
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
  const doc = nlp(text)
  const results: Array<{ text: string; start: number; end: number }> = []

  const people = doc.people()
  people.forEach((person: ReturnType<typeof nlp>) => {
    const personText = person.text()
    if (personText.length >= 2) {
      // Filter out single letters
      const indices = findAllIndices(text, personText)
      indices.forEach((start) => {
        results.push({
          text: personText,
          start,
          end: start + personText.length
        })
      })
    }
  })

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

export function detectAddresses(text: string): Array<{ text: string; start: number; end: number }> {
  // Use NLP to find potential address patterns
  // This is a simplified version - real address detection would need more sophisticated patterns
  const addressPatterns = [
    // US style addresses
    /\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*(?:\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir))\b\.?(?:\s*,?\s*(?:Suite|Ste|Apt|Apartment|Unit|#)\s*\d+)?/gi,
    // PO Box
    /P\.?O\.?\s*Box\s*\d+/gi,
    // City, State ZIP
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/g
  ]

  const results: Array<{ text: string; start: number; end: number }> = []
  const seen = new Set<string>()

  for (const pattern of addressPatterns) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      const key = `${match.index}-${match.index + match[0].length}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length
        })
      }
    }
  }

  return results
}
