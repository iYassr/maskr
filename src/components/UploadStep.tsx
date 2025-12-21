import { useState, useCallback, useRef } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import { useConfigStore } from '../stores/configStore'
import type { Detection, DetectionCategory } from '../types'
import { Spinner } from './ui/spinner'
import { LogoSettings } from './LogoSettings'
import { ConfigModal } from './ConfigModal'
import { Upload, User, Building2, DollarSign, Cpu, Key, CheckCircle, Settings, Image, Sliders } from './ui/icons'

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff']

// Map NER entity types to detection categories
// Note: Organizations/companies are only detected via user configuration, not NER
const typeToCategory: Record<string, DetectionCategory> = {
  person: 'pii',
  email: 'pii',
  phone: 'pii',
  saudi_id: 'pii',
  financial: 'financial',
  credit_card: 'financial',
  iban: 'financial',
  ip: 'technical',
  url: 'technical',
  domain: 'technical'
}

// Generate placeholder based on type
function generatePlaceholder(type: string, index: number): string {
  const prefixes: Record<string, string> = {
    person: 'PERSON',
    email: 'EMAIL',
    phone: 'PHONE',
    saudi_id: 'SAUDI_ID',
    financial: 'AMOUNT',
    credit_card: 'CARD',
    iban: 'IBAN',
    ip: 'IP_ADDRESS',
    url: 'URL',
    domain: 'DOMAIN'
  }
  return `[${prefixes[type] || 'REDACTED'}_${index + 1}]`
}

interface UploadStepProps {
  onFileUploaded: () => void
}

export function UploadStep({ onFileUploaded }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLogoSettings, setShowLogoSettings] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setFile, setContent, setDetections, setStats, pastedText, setPastedText } = useDocumentStore()
  const { config } = useConfigStore()

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

      if (!parseResult?.success) {
        throw new Error(parseResult?.error || 'Failed to parse document')
      }

      // Check if this is an image file that needs OCR
      const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff']
      const extension = file.name.split('.').pop()?.toLowerCase() || ''
      const isImageFile = imageExtensions.includes(extension)

      let contentForNER = parseResult.content || ''

      // If image file, run OCR to extract text
      if (isImageFile && (!contentForNER || contentForNER.trim() === '')) {
        setProcessingStatus('Running OCR on image...')
        try {
          const ocrResult = await window.api?.ocrExtractText(buffer)
          if (ocrResult?.success && ocrResult.text) {
            contentForNER = ocrResult.text
          }
        } catch {
          // OCR failed, continue without extracted text
        }
      }

      if (!contentForNER || contentForNER.trim() === '') {
        throw new Error('No text content found in document (OCR may have failed)')
      }

      // Extract entities via NER
      setProcessingStatus('Detecting sensitive information...')
      const nerResult = await window.api?.extractEntities(contentForNER)

      if (!nerResult?.success) {
        throw new Error(nerResult?.error || 'Failed to analyze document')
      }

      const documentContent = contentForNER

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

      // Logo detection for DOCX files
      const logoDetection = config.logoDetection

      if (
        logoDetection.enabled &&
        logoDetection.imageHash &&
        extension === 'docx' &&
        parseResult.hasImages
      ) {
        setProcessingStatus('Scanning for company logos...')

        try {
          const logoResult = await window.api?.logoScanDocument(
            file.name,
            buffer,
            logoDetection.imageHash,
            logoDetection.similarityThreshold
          )

          if (logoResult?.success && logoResult.matchedImageIds && logoResult.matchedImageIds.length > 0) {
            // Add logo detections
            logoResult.matchedImageIds.forEach((imageId: string, idx: number) => {
              const similarity = logoResult.similarities?.find((s: { id: string; similarity: number }) => s.id === imageId)?.similarity || 0
              detections.push({
                id: `logo-detection-${idx}-${imageId}`,
                text: `[Image: ${imageId}]`,
                category: 'company',
                subcategory: 'Logo',
                confidence: similarity / 100,
                position: { start: 0, end: 0 },
                suggestedPlaceholder: logoDetection.placeholderText,
                context: `Company logo detected in document (${Math.round(similarity)}% match)`,
                approved: true,
                isImageDetection: true,
                imageId: imageId
              })
            })
          }
        } catch {
          // Logo detection failed, continue without it
        }
      }

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
  }, [setFile, setContent, setDetections, setStats, onFileUploaded, config.logoDetection])

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

  const processText = useCallback(async () => {
    if (!pastedText.trim()) {
      setError('Please enter or paste some text to scan')
      return
    }

    setError(null)
    setIsProcessing(true)
    setProcessingStatus('Detecting sensitive information...')

    try {
      // Extract entities via NER
      const nerResult = await window.api?.extractEntities(pastedText)

      if (!nerResult?.success) {
        throw new Error(nerResult?.error || 'Failed to analyze text')
      }

      const documentContent = pastedText

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

      // Limit to reasonable number of detections
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

      // Calculate stats
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

      // Update store - use virtual file for pasted text
      setFile({
        filePath: 'pasted-text.txt',
        fileName: 'pasted-text.txt',
        extension: '.txt',
        buffer: '',
        size: pastedText.length
      })
      setContent(documentContent)
      setDetections(detections)
      setStats(stats)

      // Trigger transition
      onFileUploaded()
    } catch (err) {
      console.error('Text processing error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process text')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }, [pastedText, setFile, setContent, setDetections, setStats, onFileUploaded])

  return (
    <div className="flex h-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Left side - Drop zone and text input */}
      <div className="flex-1 flex flex-col p-6 border-r border-border overflow-auto">
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full gap-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={!isProcessing ? handleBrowseClick : undefined}
            className={`
              relative w-full rounded-xl border-2 border-dashed
              flex flex-col items-center justify-center gap-3 p-6 transition-all
              ${!isProcessing ? 'cursor-pointer' : 'cursor-wait'}
              ${isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-muted-foreground hover:bg-muted/30'
              }
              ${isProcessing ? 'pointer-events-none opacity-80' : ''}
            `}
          >
            {isProcessing ? (
              <>
                <Spinner className="h-10 w-10" />
                <p className="text-muted-foreground text-center text-sm">{processingStatus}</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-foreground">
                    Drop file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                {/* Supported formats */}
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {SUPPORTED_EXTENSIONS.slice(0, 8).map((ext) => (
                    <span
                      key={ext}
                      className="px-1.5 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground"
                    >
                      {ext}
                    </span>
                  ))}
                  <span className="px-1.5 py-0.5 text-xs text-muted-foreground">+more</span>
                </div>
              </>
            )}
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground font-medium">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Text input area */}
          <div className="flex flex-col gap-3">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste or type your text here..."
              disabled={isProcessing}
              className={`
                w-full h-32 p-4 rounded-xl border border-border bg-background
                text-sm text-foreground placeholder:text-muted-foreground
                resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            />
            <button
              onClick={processText}
              disabled={isProcessing || !pastedText.trim()}
              className={`
                w-full py-2.5 px-4 rounded-lg font-medium text-sm
                transition-all flex items-center justify-center gap-2
                ${pastedText.trim() && !isProcessing
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                }
              `}
            >
              {isProcessing ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Sanitize Text →</span>
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Logo Settings Dialog */}
      <LogoSettings open={showLogoSettings} onOpenChange={setShowLogoSettings} />

      {/* Config Modal */}
      <ConfigModal open={showConfigModal} onOpenChange={setShowConfigModal} />

      {/* Right side - Info panel */}
      <div className="w-96 flex flex-col p-8 bg-muted/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 175 90" className="h-14" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="175" height="90" fill="#282828" rx="8"/>
              <text x="10" y="45" fontFamily="ui-monospace, monospace" fontSize="28" fill="#ebdbb2">maskr</text>
              <rect x="150" y="25" width="14" height="28" fill="#fe8019"/>
              <text x="10" y="75" fontFamily="ui-monospace, monospace" fontSize="13" fill="#928374"># document sanitizer</text>
            </svg>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Detection Settings"
            >
              <Sliders className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowLogoSettings(true)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Logo Detection Settings"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <p className="text-muted-foreground mb-8">
          Automatically detect and mask sensitive information before sharing documents with AI tools or third parties.
        </p>

        <div className="space-y-4 flex-1">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            What we detect
          </h3>

          <FeatureItem
            icon={<User className="h-4 w-4" />}
            title="Personal Information"
            description="Names, emails, phone numbers, addresses"
          />
          <FeatureItem
            icon={<Building2 className="h-4 w-4" />}
            title="Company Data"
            description="Organization names, business details"
          />
          <FeatureItem
            icon={<DollarSign className="h-4 w-4" />}
            title="Financial Information"
            description="Account numbers, amounts, transactions"
          />
          <FeatureItem
            icon={<Cpu className="h-4 w-4" />}
            title="Technical Details"
            description="IP addresses, server names, configurations"
          />
          <FeatureItem
            icon={<Key className="h-4 w-4" />}
            title="Credentials"
            description="API keys, passwords, tokens"
          />
          <FeatureItem
            icon={<Image className="h-4 w-4" />}
            title="Company Logos"
            description="Detect and remove logos from DOCX files"
          />
        </div>

        <div className="pt-6 border-t border-border mt-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>100% local processing - your data never leaves your device</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
