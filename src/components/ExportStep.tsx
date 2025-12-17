import { useState, useEffect, useMemo } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import type { Detection } from '../types'

interface ExportStepProps {
  onBack: () => void
  onReset: () => void
}

// Generate masked content by replacing approved detections with placeholders
function applyMasking(content: string, detections: Detection[]): string {
  try {
    // Ensure content is a string
    const safeContent = typeof content === 'string' ? content : ''
    if (!safeContent) return ''

    // Ensure detections is an array
    const safeDetections = Array.isArray(detections) ? detections : []

    // Filter valid approved detections with strict validation
    const validDetections = safeDetections.filter(d => {
      if (!d || !d.approved || !d.position) return false
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
        end <= safeContent.length &&
        typeof d.suggestedPlaceholder === 'string'
      )
    })

    if (validDetections.length === 0) return safeContent

    // Sort by position descending to replace from end to start (preserves positions)
    const sorted = [...validDetections].sort((a, b) =>
      Number(b.position.start) - Number(a.position.start)
    )

    let result = safeContent
    for (const detection of sorted) {
      const start = Number(detection.position.start)
      const end = Number(detection.position.end)
      const before = result.slice(0, start)
      const after = result.slice(end)
      result = before + (detection.suggestedPlaceholder || '[REDACTED]') + after
    }

    return result
  } catch (err) {
    console.error('applyMasking error:', err)
    return typeof content === 'string' ? content : ''
  }
}

export function ExportStep({ onBack, onReset }: ExportStepProps) {
  const { file, content, detections, maskedContent, setMaskedContent, setMappings } = useDocumentStore()

  const [isGenerating, setIsGenerating] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'sanitized' | 'comparison'>('sanitized')

  // Stats
  const approvedDetections = useMemo(() =>
    detections.filter(d => d.approved),
    [detections]
  )

  const statsByCategory = useMemo(() => {
    const stats: Record<string, number> = {}
    approvedDetections.forEach(d => {
      stats[d.category] = (stats[d.category] || 0) + 1
    })
    return stats
  }, [approvedDetections])

  // Generate masked content on mount
  useEffect(() => {
    async function generateMasked() {
      try {
        // Ensure we have valid data
        const safeContent = typeof content === 'string' ? content : ''
        const safeDetections = Array.isArray(detections) ? detections : []
        const safeApproved = Array.isArray(approvedDetections) ? approvedDetections : []

        // Apply masking locally
        const masked = applyMasking(safeContent, safeDetections)
        setMaskedContent(masked)

        // Build mapping table safely
        const mappingMap = new Map<string, { placeholder: string; values: Set<string>; category: string }>()
        safeApproved.forEach(d => {
          if (!d || typeof d.suggestedPlaceholder !== 'string') return
          const existing = mappingMap.get(d.suggestedPlaceholder)
          if (existing) {
            existing.values.add(String(d.text || ''))
          } else {
            mappingMap.set(d.suggestedPlaceholder, {
              placeholder: d.suggestedPlaceholder,
              values: new Set([String(d.text || '')]),
              category: String(d.category || 'custom')
            })
          }
        })

        const mappings = Array.from(mappingMap.values()).map(m => ({
          placeholder: m.placeholder,
          originalValues: Array.from(m.values),
          category: m.category as 'pii' | 'company' | 'financial' | 'technical' | 'custom',
          occurrences: m.values.size
        }))

        setMappings(mappings)
      } catch (err) {
        console.error('generateMasked error:', err)
        setError('Failed to generate sanitized document')
      } finally {
        setIsGenerating(false)
      }
    }

    const safeApproved = Array.isArray(approvedDetections) ? approvedDetections : []
    if (safeApproved.length > 0) {
      generateMasked()
    } else {
      setMaskedContent(typeof content === 'string' ? content : '')
      setIsGenerating(false)
    }
  }, [content, detections, approvedDetections, setMaskedContent, setMappings])

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      // Get original file extension (remove leading dot if present)
      const ext = (file?.extension || '.txt').replace(/^\./, '')
      const baseName = file?.fileName?.replace(/\.[^/.]+$/, '') || 'document'
      const defaultName = `${baseName}_sanitized.${ext}`

      // Convert content to base64 for the API
      const contentBase64 = btoa(unescape(encodeURIComponent(maskedContent)))

      const result = await window.api?.saveFile(contentBase64, defaultName, ext)

      if (result) {
        setExportSuccess(true)
      } else {
        // User cancelled - not an error
      }
    } catch (err) {
      setError('Failed to export document')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(maskedContent)
      // Could show a toast here
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  if (exportSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-in">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--cat-financial-bg)' }}>
            <CheckCircleIcon className="w-10 h-10 text-[var(--cat-financial)]" />
          </div>
          <h2 className="font-display text-2xl font-medium text-[var(--text-primary)] mb-2">
            Document Exported
          </h2>
          <p className="text-[var(--text-secondary)] mb-8">
            Your sanitized document has been saved successfully.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onReset}
              className="btn-primary px-6 py-2.5 rounded-lg"
            >
              Sanitize Another Document
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-in">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-medium text-[var(--text-primary)]">
              Export Sanitized Document
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {approvedDetections.length} items will be masked
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <button
              onClick={() => setViewMode('sanitized')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'sanitized'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Sanitized
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mb-4" />
            <p className="text-[var(--text-secondary)]">Generating sanitized document...</p>
          </div>
        ) : viewMode === 'comparison' ? (
          // Side by side comparison
          <div className="flex-1 flex gap-0">
            <div className="flex-1 flex flex-col border-r" style={{ borderColor: 'var(--border)' }}>
              <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <span className="w-2 h-2 rounded-full bg-[var(--cat-pii)]"></span>
                <span className="text-xs font-medium text-[var(--text-muted)]">Original</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="document-preview p-4 text-sm whitespace-pre-wrap">{content}</pre>
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <span className="w-2 h-2 rounded-full bg-[var(--cat-financial)]"></span>
                <span className="text-xs font-medium text-[var(--text-muted)]">Sanitized</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="document-preview p-4 text-sm whitespace-pre-wrap">{maskedContent}</pre>
              </div>
            </div>
          </div>
        ) : (
          // Sanitized view only
          <div className="flex-1 flex">
            <div className="flex-1 overflow-auto p-4">
              <pre className="document-preview p-4 text-sm whitespace-pre-wrap h-full">{maskedContent}</pre>
            </div>

            {/* Stats sidebar */}
            <div className="w-64 flex-shrink-0 border-l p-4" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Summary</h3>

              <div className="space-y-3">
                <StatItem
                  label="Total Masked"
                  value={approvedDetections.length}
                  color="var(--accent)"
                />
                {statsByCategory.pii && (
                  <StatItem label="Personal Info" value={statsByCategory.pii} color="var(--cat-pii)" />
                )}
                {statsByCategory.company && (
                  <StatItem label="Company" value={statsByCategory.company} color="var(--cat-company)" />
                )}
                {statsByCategory.financial && (
                  <StatItem label="Financial" value={statsByCategory.financial} color="var(--cat-financial)" />
                )}
                {statsByCategory.technical && (
                  <StatItem label="Technical" value={statsByCategory.technical} color="var(--cat-technical)" />
                )}
                {statsByCategory.custom && (
                  <StatItem label="Custom" value={statsByCategory.custom} color="var(--cat-custom)" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-lg bg-[var(--cat-pii-bg)] border border-[var(--cat-pii)] text-[var(--cat-pii)] text-sm">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onBack}
          className="btn-secondary px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <ChevronLeftIcon />
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyToClipboard}
            className="btn-secondary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <CopyIcon />
            Copy
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || isGenerating}
            className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <DownloadIcon />
                Export Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }}></span>
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

// Icons
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}
