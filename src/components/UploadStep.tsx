import { useState, useCallback, useRef } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import type { Detection, DetectionCategory } from '../types'

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.md']

// Map NER entity types to detection categories
const typeToCategory: Record<string, DetectionCategory> = {
  person: 'pii',
  email: 'pii',
  phone: 'pii',
  organization: 'company',
  money: 'financial',
  place: 'technical',
  date: 'technical'
}

// Generate placeholder based on type
function generatePlaceholder(type: string, index: number): string {
  const prefixes: Record<string, string> = {
    person: 'PERSON',
    email: 'EMAIL',
    phone: 'PHONE',
    organization: 'ORG',
    money: 'AMOUNT',
    place: 'LOCATION',
    date: 'DATE'
  }
  return `[${prefixes[type] || 'REDACTED'}_${index + 1}]`
}

// Icons
const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

interface UploadStepProps {
  onFileUploaded: () => void
}

export function UploadStep({ onFileUploaded }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setFile, setContent, setDetections, setStats } = useDocumentStore()

  const processFile = useCallback(async (file: File) => {
    setError(null)
    setIsProcessing(true)
    setProcessingStatus('Reading file...')

    try {
      // Read file as base64
      const buffer = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // Remove data URL prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const fileData = {
        filePath: file.name,
        fileName: file.name,
        extension: '.' + file.name.split('.').pop()?.toLowerCase(),
        buffer,
        size: file.size
      }

      // Parse document via IPC
      setProcessingStatus('Parsing document...')
      const parseResult = await window.api?.parseDocument(file.name, buffer)

      if (!parseResult?.success || !parseResult.content) {
        throw new Error(parseResult?.error || 'Failed to parse document')
      }

      // Extract entities via NER
      setProcessingStatus('Detecting sensitive information...')
      const nerResult = await window.api?.extractEntities(parseResult.content)

      if (!nerResult?.success) {
        throw new Error(nerResult?.error || 'Failed to analyze document')
      }

      const documentContent = parseResult.content || ''

      // Safely get entities array
      const rawEntities = Array.isArray(nerResult.entities) ? nerResult.entities : []

      // Filter valid entities and convert to Detection format
      const validEntities = rawEntities.filter(entity => {
        if (!entity) return false
        const start = Number(entity.start)
        const end = Number(entity.end)
        return (
          !isNaN(start) &&
          !isNaN(end) &&
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end > start &&
          start < documentContent.length &&
          end <= documentContent.length &&
          typeof entity.text === 'string' &&
          entity.text.length > 0 &&
          typeof entity.type === 'string'
        )
      })

      // Limit to reasonable number of detections to prevent memory issues
      const limitedEntities = validEntities.slice(0, 1000)

      const detections: Detection[] = limitedEntities.map((entity, index) => {
        const start = Number(entity.start)
        const end = Number(entity.end)
        const contextStart = Math.max(0, start - 30)
        const contextEnd = Math.min(documentContent.length, end + 30)

        return {
          id: `detection-${index}-${start}`,
          text: String(entity.text),
          category: typeToCategory[entity.type] || 'custom',
          subcategory: entity.type.charAt(0).toUpperCase() + entity.type.slice(1),
          confidence: 0.85,
          position: { start, end },
          suggestedPlaceholder: generatePlaceholder(entity.type, index),
          context: documentContent.slice(contextStart, contextEnd),
          approved: true
        }
      })

      // Calculate stats safely
      const stats = {
        totalDetections: detections.length,
        byCategory: {
          pii: detections.filter(d => d.category === 'pii').length,
          company: detections.filter(d => d.category === 'company').length,
          financial: detections.filter(d => d.category === 'financial').length,
          technical: detections.filter(d => d.category === 'technical').length,
          custom: detections.filter(d => d.category === 'custom').length
        },
        byConfidence: {
          high: detections.filter(d => d.confidence >= 0.8).length,
          medium: detections.filter(d => d.confidence >= 0.5 && d.confidence < 0.8).length,
          low: detections.filter(d => d.confidence < 0.5).length
        },
        processingTimeMs: 0
      }

      // Update store
      setFile(fileData)
      setContent(documentContent)
      setDetections(detections)
      setStats(stats)

      // Trigger transition
      onFileUploaded()
    } catch (err) {
      console.error('File processing error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [setFile, setContent, setDetections, setStats, onFileUploaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        processFile(file)
      } else {
        setError(`Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`)
      }
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 animate-in">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!isProcessing ? handleBrowseClick : undefined}
        className={`
          relative w-full max-w-lg aspect-[4/3] rounded-2xl border-2 border-dashed
          flex flex-col items-center justify-center gap-4
          ${!isProcessing ? 'cursor-pointer' : 'cursor-wait'}
          ${isDragging ? 'drop-zone-active' : 'drop-zone-idle'}
          ${isProcessing ? 'pointer-events-none opacity-80' : ''}
        `}
        style={{ borderColor: 'var(--border-strong)' }}
      >
        {isProcessing ? (
          <>
            {/* Processing animation */}
            <div className="w-12 h-12 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            <p className="text-[var(--text-secondary)] text-sm">{processingStatus}</p>
          </>
        ) : (
          <>
            <div className="text-[var(--accent)]">
              <UploadIcon />
            </div>
            <div className="text-center">
              <p className="text-[var(--text-primary)] font-medium mb-1">
                Drop your document here
              </p>
              <p className="text-[var(--text-muted)] text-sm">
                or click to browse
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 px-4 py-3 rounded-lg bg-[var(--cat-pii-bg)] border border-[var(--cat-pii)] text-[var(--cat-pii)] text-sm animate-in">
          {error}
        </div>
      )}

      {/* Supported formats */}
      <div className="mt-8 animate-in animate-delay-1">
        <p className="text-[var(--text-muted)] text-xs mb-3 text-center">Supported formats</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUPPORTED_EXTENSIONS.map((ext) => (
            <span
              key={ext}
              className="px-2 py-1 rounded text-xs font-mono"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)'
              }}
            >
              {ext}
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl animate-in animate-delay-2">
        <Feature
          icon={<FileIcon />}
          title="Parse"
          description="Extract text from PDF, Word, Excel"
        />
        <Feature
          icon={<SearchIcon />}
          title="Detect"
          description="Find names, emails, phone numbers"
        />
        <Feature
          icon={<CheckIcon />}
          title="Sanitize"
          description="Mask sensitive data securely"
        />
      </div>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-lg flex items-center justify-center text-[var(--accent)]" style={{ background: 'var(--accent-glow)' }}>
        {icon}
      </div>
      <h3 className="font-display text-sm font-medium text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  )
}

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)
