import { useMemo, useState, type ReactNode } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import { useConfigStore } from '../stores/configStore'
import { applyMasking } from '../lib/detector'
import type { Detection, DetectionCategory } from '../types'

const categoryConfig: Record<DetectionCategory, { label: string; icon: ReactNode; badgeClass: string; borderColor: string }> = {
  pii: {
    label: 'Personal Info',
    badgeClass: 'badge-error',
    borderColor: 'oklch(var(--er))',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  company: {
    label: 'Company',
    badgeClass: 'badge-info',
    borderColor: 'oklch(var(--in))',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  financial: {
    label: 'Financial',
    badgeClass: 'badge-success',
    borderColor: 'oklch(var(--su))',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  technical: {
    label: 'Technical',
    badgeClass: 'badge-secondary',
    borderColor: 'oklch(var(--s))',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )
  },
  custom: {
    label: 'Custom',
    badgeClass: 'badge-warning',
    borderColor: 'oklch(var(--wa))',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    )
  }
}

export function ReviewPanel() {
  const { content, detections, stats, toggleDetection, approveAll, rejectAll, file } = useDocumentStore()
  const { config } = useConfigStore()
  const [showPreview, setShowPreview] = useState<'original' | 'masked'>('original')
  const [copied, setCopied] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<DetectionCategory>>(new Set(['pii', 'company', 'financial', 'technical', 'custom']))

  // Group detections by category
  const groupedDetections = useMemo(() => {
    const groups: Record<DetectionCategory, Detection[]> = {
      pii: [],
      company: [],
      financial: [],
      technical: [],
      custom: []
    }

    for (const detection of detections) {
      groups[detection.category].push(detection)
    }

    return groups
  }, [detections])

  // Generate masked content
  const { maskedContent, mappings } = useMemo(() => {
    return applyMasking(content, detections)
  }, [content, detections])

  // Highlighted content for preview
  const highlightedContent = useMemo(() => {
    if (showPreview === 'masked') {
      return maskedContent
    }

    // Create highlighted version
    const sortedDetections = [...detections]
      .filter(d => d.approved)
      .sort((a, b) => b.position.start - a.position.start)

    let result = content
    for (const detection of sortedDetections) {
      const before = result.slice(0, detection.position.start)
      const text = result.slice(detection.position.start, detection.position.end)
      const after = result.slice(detection.position.end)
      result = `${before}<mark class="highlight-${detection.category}">${text}</mark>${after}`
    }

    return result
  }, [content, detections, showPreview, maskedContent])

  const approvedCount = detections.filter(d => d.approved).length

  const toggleCategory = (category: DetectionCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleDownload = async () => {
    const binaryFormats = ['docx', 'pdf', 'xlsx']
    const originalExt = file?.extension?.toLowerCase() || 'txt'
    const isBinaryFormat = binaryFormats.includes(originalExt)

    // Get base filename without extension
    const baseName = file?.fileName?.replace(/\.[^/.]+$/, '') || 'document'

    // Determine export format based on config preference
    let exportExt = 'txt'
    if (config.exportPreferences.defaultFormat === 'md') {
      exportExt = 'md'
    } else if (config.exportPreferences.defaultFormat === 'same') {
      exportExt = isBinaryFormat ? originalExt : originalExt
    }

    const fileName = `sanitized_${baseName}.${exportExt}`

    // For binary formats, use the Electron API to create proper files
    if (binaryFormats.includes(exportExt) && file?.buffer) {
      try {
        const result = await window.api.createMaskedDocument(
          file.buffer,
          maskedContent,
          exportExt
        )

        if (result.success && result.buffer) {
          // Use save dialog for binary files
          await window.api.saveFile(result.buffer, fileName, exportExt)
        } else {
          console.error('Failed to create masked document:', result.error)
          // Fallback to text export
          downloadAsText(fileName.replace(`.${exportExt}`, '.txt'))
        }
      } catch (error) {
        console.error('Error creating masked document:', error)
        // Fallback to text export
        downloadAsText(fileName.replace(`.${exportExt}`, '.txt'))
      }
    } else {
      // For text formats, download directly
      downloadAsText(fileName)
    }
  }

  const downloadAsText = (fileName: string) => {
    const ext = fileName.split('.').pop() || 'txt'
    const mimeType = ext === 'md' ? 'text/markdown' : 'text/plain'
    const blob = new Blob([maskedContent], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyToClipboard = async () => {
    await navigator.clipboard.writeText(maskedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportMapping = () => {
    const mappingObj: Record<string, string[]> = {}
    mappings.forEach((values, placeholder) => {
      mappingObj[placeholder] = values
    })

    const blob = new Blob([JSON.stringify(mappingObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mapping_${file?.fileName || 'document'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full">
      {/* Left: Document Preview */}
      <div className="flex-1 flex flex-col border-r border-neutral">
        {/* Preview header */}
        <div className="flex items-center justify-between px-6 py-4 bg-base-200 border-b border-base-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="font-semibold text-base-content">Document Preview</h2>
            </div>

            {/* Toggle buttons */}
            <div className="join">
              <button
                onClick={() => setShowPreview('original')}
                className={`join-item btn btn-sm ${showPreview === 'original' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Original
              </button>
              <button
                onClick={() => setShowPreview('masked')}
                className={`join-item btn btn-sm ${showPreview === 'masked' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Masked
              </button>
            </div>
          </div>

          {stats && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-base-300 rounded-lg">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-mono text-neutral-content">{stats.processingTimeMs}ms</span>
            </div>
          )}
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto p-6 bg-base-100">
          <div className="max-w-4xl mx-auto card bg-base-200 p-8 animate-fade-in">
            <pre
              className="whitespace-pre-wrap font-mono text-sm text-neutral-content leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedContent }}
            />
          </div>
        </div>
      </div>

      {/* Right: Detection Panel */}
      <div className="w-[400px] flex flex-col bg-base-200">
        {/* Stats header */}
        <div className="px-5 py-4 border-b border-neutral">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="font-semibold text-base-content">Detections</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">{approvedCount}</span>
              <span className="text-sm text-neutral-content">/ {detections.length}</span>
            </div>
          </div>

          {/* Progress bar */}
          <progress
            className="progress progress-primary w-full mb-4"
            value={detections.length > 0 ? (approvedCount / detections.length) * 100 : 0}
            max="100"
          />

          <div className="flex gap-2">
            <button
              onClick={approveAll}
              className="flex-1 btn btn-sm btn-outline gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
              Select All
            </button>
            <button
              onClick={rejectAll}
              className="flex-1 btn btn-sm btn-outline gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Deselect All
            </button>
          </div>
        </div>

        {/* Detection list */}
        <div className="flex-1 overflow-auto">
          {(Object.keys(groupedDetections) as DetectionCategory[]).map((category) => {
            const items = groupedDetections[category]
            if (items.length === 0) return null

            const approvedInCategory = items.filter(d => d.approved).length
            const isExpanded = expandedCategories.has(category)
            const catConfig = categoryConfig[category]

            return (
              <div key={category} className="border-b border-neutral/50">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-base-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${catConfig.badgeClass}`}>
                      {catConfig.icon}
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-sm text-base-content">
                        {catConfig.label}
                      </span>
                      <div className="text-xs text-neutral-content">
                        {approvedInCategory} of {items.length} selected
                      </div>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-neutral-content transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Detection items */}
                {isExpanded && (
                  <div className="bg-base-100">
                    {items.map((detection, index) => (
                      <label
                        key={detection.id}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-base-300 border-l-2 animate-fade-in"
                        style={{
                          animationDelay: `${index * 0.03}s`,
                          borderLeftColor: detection.approved ? catConfig.borderColor : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={detection.approved}
                          onChange={() => toggleDetection(detection.id)}
                          className="checkbox checkbox-primary checkbox-sm mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-base-content break-all">
                              {detection.text}
                            </span>
                            <span className={`badge badge-sm ${catConfig.badgeClass}`}>
                              {detection.confidence}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-neutral-content font-mono">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="text-primary">{detection.suggestedPlaceholder}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {detections.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-success/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="font-semibold text-base-content">All Clear</p>
              <p className="text-sm text-neutral-content mt-1">No sensitive data detected in this document</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-neutral bg-base-300 space-y-3">
          {config.exportPreferences.includeMappingFile && approvedCount > 0 && (
            <button
              onClick={handleExportMapping}
              className="w-full btn btn-outline btn-sm gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Mapping File
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCopyToClipboard}
              className="flex-1 btn btn-outline btn-sm gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 btn btn-primary btn-sm gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
