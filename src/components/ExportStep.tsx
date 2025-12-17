import { useState, useEffect, useMemo } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import type { Detection } from '../types'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { ChevronLeft, Download, Copy, CheckCircle } from 'lucide-react'

interface ExportStepProps {
  onBack: () => void
  onReset: () => void
}

// Generate masked content by replacing approved detections with placeholders
function applyMasking(content: string, detections: Detection[]): string {
  try {
    const safeContent = typeof content === 'string' ? content : ''
    if (!safeContent) return ''

    const safeDetections = Array.isArray(detections) ? detections : []

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

// Category colors
const categoryColors: Record<string, string> = {
  pii: 'bg-red-500',
  company: 'bg-blue-500',
  financial: 'bg-green-500',
  technical: 'bg-purple-500',
  custom: 'bg-yellow-500'
}

export function ExportStep({ onBack, onReset }: ExportStepProps) {
  const { file, content, detections, maskedContent, setMaskedContent, setMappings } = useDocumentStore()

  const [isGenerating, setIsGenerating] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'sanitized' | 'comparison'>('sanitized')
  const [copied, setCopied] = useState(false)

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

  useEffect(() => {
    async function generateMasked() {
      try {
        const safeContent = typeof content === 'string' ? content : ''
        const safeDetections = Array.isArray(detections) ? detections : []
        const safeApproved = Array.isArray(approvedDetections) ? approvedDetections : []

        const masked = applyMasking(safeContent, safeDetections)
        setMaskedContent(masked)

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
      const ext = (file?.extension || '.txt').replace(/^\./, '')
      const baseName = file?.fileName?.replace(/\.[^/.]+$/, '') || 'document'
      const defaultName = `${baseName}_sanitized.${ext}`

      const contentBase64 = btoa(unescape(encodeURIComponent(maskedContent)))

      const result = await window.api?.saveFile(contentBase64, defaultName, ext)

      if (result) {
        setExportSuccess(true)
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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  if (exportSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-green-500/20">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Document Exported
          </h2>
          <p className="text-muted-foreground mb-8">
            Your sanitized document has been saved successfully.
          </p>

          <Button onClick={onReset}>
            Sanitize Another Document
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Export Sanitized Document
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {approvedDetections.length} items will be masked
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setViewMode('sanitized')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'sanitized'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sanitized
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
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
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-muted-foreground">Generating sanitized document...</p>
          </div>
        ) : viewMode === 'comparison' ? (
          <div className="flex-1 flex gap-0">
            <div className="flex-1 flex flex-col border-r border-border">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-xs font-medium text-muted-foreground">Original</span>
              </div>
              <ScrollArea className="flex-1">
                <pre className="p-4 text-sm whitespace-pre-wrap text-foreground font-mono">{content}</pre>
              </ScrollArea>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-xs font-medium text-muted-foreground">Sanitized</span>
              </div>
              <ScrollArea className="flex-1">
                <pre className="p-4 text-sm whitespace-pre-wrap text-foreground font-mono">{maskedContent}</pre>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <pre className="p-4 text-sm whitespace-pre-wrap text-foreground font-mono rounded-lg bg-muted/50 border border-border">{maskedContent}</pre>
              </div>
            </ScrollArea>

            {/* Stats sidebar */}
            <div className="w-64 flex-shrink-0 border-l border-border p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">Summary</h3>

              <div className="space-y-3">
                <StatItem
                  label="Total Masked"
                  value={approvedDetections.length}
                  colorClass="bg-primary"
                />
                {statsByCategory.pii && (
                  <StatItem label="Personal Info" value={statsByCategory.pii} colorClass="bg-red-500" />
                )}
                {statsByCategory.company && (
                  <StatItem label="Company" value={statsByCategory.company} colorClass="bg-blue-500" />
                )}
                {statsByCategory.financial && (
                  <StatItem label="Financial" value={statsByCategory.financial} colorClass="bg-green-500" />
                )}
                {statsByCategory.technical && (
                  <StatItem label="Technical" value={statsByCategory.technical} colorClass="bg-purple-500" />
                )}
                {statsByCategory.custom && (
                  <StatItem label="Custom" value={statsByCategory.custom} colorClass="bg-yellow-500" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-border flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCopyToClipboard}>
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || isGenerating}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-1" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Export Document
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatItem({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${colorClass}`}></span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
