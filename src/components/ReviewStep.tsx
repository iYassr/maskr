import { useMemo, useState, useCallback } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import type { Detection, DetectionCategory } from '../types'

// Category configuration
const CATEGORY_CONFIG: Record<DetectionCategory, { label: string; icon: React.ReactNode }> = {
  pii: { label: 'Personal Info', icon: <UserIcon /> },
  company: { label: 'Company', icon: <BuildingIcon /> },
  financial: { label: 'Financial', icon: <DollarIcon /> },
  technical: { label: 'Technical', icon: <CodeIcon /> },
  custom: { label: 'Custom', icon: <TagIcon /> }
}

interface ReviewStepProps {
  onContinue: () => void
  onBack: () => void
}

export function ReviewStep({ onContinue, onBack }: ReviewStepProps) {
  const {
    file,
    content,
    detections,
    toggleDetection,
    approveAll,
    rejectAll,
    toggleCategoryDetections
  } = useDocumentStore()

  const [activeCategory, setActiveCategory] = useState<DetectionCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Group detections by category
  const detectionsByCategory = useMemo(() => {
    const grouped: Record<DetectionCategory, Detection[]> = {
      pii: [],
      company: [],
      financial: [],
      technical: [],
      custom: []
    }
    detections.forEach(d => {
      grouped[d.category].push(d)
    })
    return grouped
  }, [detections])

  // Filter detections
  const filteredDetections = useMemo(() => {
    let filtered = activeCategory === 'all'
      ? detections
      : detections.filter(d => d.category === activeCategory)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(d =>
        d.text.toLowerCase().includes(query) ||
        d.subcategory.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [detections, activeCategory, searchQuery])

  // Stats
  const approvedCount = useMemo(() =>
    detections.filter(d => d.approved).length,
    [detections]
  )

  const handleSelectAll = useCallback(() => {
    if (activeCategory === 'all') {
      approveAll()
    } else {
      toggleCategoryDetections(activeCategory, true)
    }
  }, [activeCategory, approveAll, toggleCategoryDetections])

  const handleDeselectAll = useCallback(() => {
    if (activeCategory === 'all') {
      rejectAll()
    } else {
      toggleCategoryDetections(activeCategory, false)
    }
  }, [activeCategory, rejectAll, toggleCategoryDetections])

  return (
    <div className="flex flex-col h-full animate-in">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-medium text-[var(--text-primary)]">
              Review Detections
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {file?.fileName} &middot; {detections.length} items found &middot; {approvedCount} selected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeselectAll}
              className="btn-secondary px-3 py-1.5 rounded-lg text-sm"
            >
              Deselect All
            </button>
            <button
              onClick={handleSelectAll}
              className="btn-secondary px-3 py-1.5 rounded-lg text-sm"
            >
              Select All
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1">
          <CategoryTab
            label="All"
            count={detections.length}
            isActive={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {(Object.keys(CATEGORY_CONFIG) as DetectionCategory[]).map(cat => (
            <CategoryTab
              key={cat}
              label={CATEGORY_CONFIG[cat].label}
              count={detectionsByCategory[cat].length}
              category={cat}
              isActive={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Content area - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Detection list */}
        <div className="w-1/2 flex flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          {/* Search */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search detections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredDetections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <p>No detections found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredDetections.map(detection => (
                  <DetectionItem
                    key={detection.id}
                    detection={detection}
                    onToggle={() => toggleDetection(detection.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Document preview */}
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm text-[var(--text-muted)]">Document Preview</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <DocumentPreview content={content} detections={detections.filter(d => d.approved)} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onBack}
          className="btn-secondary px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <ChevronLeftIcon />
          Back
        </button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--text-muted)]">
            {approvedCount} of {detections.length} items will be masked
          </span>
          <button
            onClick={onContinue}
            disabled={approvedCount === 0}
            className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

// Category tab component
function CategoryTab({
  label,
  count,
  category,
  isActive,
  onClick
}: {
  label: string
  count: number
  category?: DetectionCategory
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
        ${isActive
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }
      `}
      style={{
        background: isActive ? 'var(--bg-tertiary)' : 'transparent'
      }}
    >
      {label}
      <span
        className={`
          px-1.5 py-0.5 rounded text-xs
          ${category ? `badge-${category}` : ''}
        `}
        style={!category ? {
          background: 'var(--bg-elevated)',
          color: 'var(--text-muted)'
        } : undefined}
      >
        {count}
      </span>
    </button>
  )
}

// Detection item component
function DetectionItem({
  detection,
  onToggle
}: {
  detection: Detection
  onToggle: () => void
}) {
  return (
    <div
      className={`
        p-3 rounded-lg cursor-pointer transition-all
        ${detection.approved ? 'bg-[var(--bg-tertiary)]' : 'bg-transparent hover:bg-[var(--bg-secondary)]'}
      `}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={detection.approved}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="detection-checkbox mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge-${detection.category} px-2 py-0.5 rounded text-xs font-medium`}>
              {detection.subcategory}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {Math.round(detection.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-sm text-[var(--text-primary)] font-mono truncate">
            {detection.text}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
            → {detection.suggestedPlaceholder}
          </p>
        </div>
      </div>
    </div>
  )
}

// Document preview with highlighting
function DocumentPreview({
  content,
  detections
}: {
  content: string
  detections: Detection[]
}) {
  const highlightedContent = useMemo(() => {
    try {
      // Ensure content is a string
      const safeContent = typeof content === 'string' ? content : ''
      if (!safeContent) return ''

      // Ensure detections is an array
      const safeDetections = Array.isArray(detections) ? detections : []
      if (safeDetections.length === 0) return escapeHtml(safeContent)

      // Filter valid detections with strict validation
      const validDetections = safeDetections.filter(d => {
        if (!d || !d.position) return false
        const start = Number(d.position.start)
        const end = Number(d.position.end)
        return (
          !isNaN(start) &&
          !isNaN(end) &&
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end > start &&
          start < safeContent.length &&
          end <= safeContent.length
        )
      })

      if (validDetections.length === 0) return escapeHtml(safeContent)

      // Sort by start position ascending
      const sorted = [...validDetections].sort((a, b) =>
        Number(a.position.start) - Number(b.position.start)
      )

      // Build result by iterating through content
      const parts: string[] = []
      let lastEnd = 0

      for (const detection of sorted) {
        const start = Number(detection.position.start)
        const end = Number(detection.position.end)

        // Skip overlapping detections
        if (start < lastEnd) continue

        // Add text before this detection (escaped)
        if (start > lastEnd) {
          parts.push(escapeHtml(safeContent.slice(lastEnd, start)))
        }

        // Add highlighted detection
        const text = safeContent.slice(start, end)
        const category = detection.category || 'custom'
        parts.push(`<mark class="highlight-${category}">${escapeHtml(text)}</mark>`)

        lastEnd = end
      }

      // Add remaining text after last detection
      if (lastEnd < safeContent.length) {
        parts.push(escapeHtml(safeContent.slice(lastEnd)))
      }

      return parts.join('')
    } catch (err) {
      console.error('DocumentPreview error:', err)
      return escapeHtml(typeof content === 'string' ? content : '')
    }
  }, [content, detections])

  return (
    <div
      className="document-preview p-4 h-full overflow-auto whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
    />
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Icons
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  )
}

function DollarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
