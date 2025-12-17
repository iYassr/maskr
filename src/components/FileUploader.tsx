import { useState, useCallback } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import { useConfigStore } from '../stores/configStore'
import { detectSensitiveInfo, calculateStats } from '../lib/detector'

const SUPPORTED_FORMATS = ['txt', 'md', 'docx', 'xlsx', 'csv', 'pdf', 'json', 'html', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff']
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff']

export function FileUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { setFile, setContent, setDetections, setStats, setView, setIsProcessing, isProcessing } = useDocumentStore()
  const { config } = useConfigStore()

  const processContent = useCallback(async (content: string, _fileName: string) => {
    setIsProcessing(true)
    const startTime = performance.now()

    try {
      const detections = await detectSensitiveInfo(content, config)
      const stats = calculateStats(detections)
      stats.processingTimeMs = Math.round(performance.now() - startTime)

      setContent(content)
      setDetections(detections)
      setStats(stats)
      setView('review')
      setError(null)
    } catch (err) {
      console.error('Processing error:', err)
      setError('Failed to process document. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [config, setContent, setDetections, setStats, setView, setIsProcessing])

  const handleFile = useCallback(async (fileData: {
    filePath: string
    fileName: string
    extension: string
    buffer: string
  }) => {
    setError(null)

    if (!SUPPORTED_FORMATS.includes(fileData.extension)) {
      setError(`Unsupported file format: .${fileData.extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`)
      return
    }

    setIsProcessing(true)

    try {
      if (IMAGE_FORMATS.includes(fileData.extension)) {
        const ocrResult = await window.api.ocrExtractText(fileData.buffer)

        if (!ocrResult.success) {
          setError(ocrResult.error || 'Failed to extract text from image')
          setIsProcessing(false)
          return
        }

        const content = ocrResult.text || ''
        const confidence = ocrResult.confidence || 0

        setFile({
          filePath: fileData.filePath,
          fileName: fileData.fileName,
          extension: fileData.extension,
          buffer: fileData.buffer,
          size: atob(fileData.buffer).length,
          content: `[OCR extracted text - Confidence: ${confidence.toFixed(1)}%]\n\n${content}`
        })

        await processContent(content, fileData.fileName)
      }
      else if (['docx', 'xlsx', 'pdf'].includes(fileData.extension)) {
        const parsed = await window.api.parseDocument(fileData.filePath || fileData.fileName, fileData.buffer)

        if (!parsed.success) {
          setError(parsed.error || 'Failed to parse document')
          setIsProcessing(false)
          return
        }

        setFile({
          filePath: fileData.filePath,
          fileName: fileData.fileName,
          extension: fileData.extension,
          buffer: fileData.buffer,
          size: atob(fileData.buffer).length,
          content: parsed.content
        })

        await processContent(parsed.content!, fileData.fileName)
      } else {
        const content = atob(fileData.buffer)

        setFile({
          filePath: fileData.filePath,
          fileName: fileData.fileName,
          extension: fileData.extension,
          buffer: fileData.buffer,
          size: content.length,
          content
        })

        await processContent(content, fileData.fileName)
      }
    } catch (err) {
      console.error('File handling error:', err)
      setError('Failed to process file. Please try again.')
      setIsProcessing(false)
    }
  }, [setFile, processContent, setIsProcessing])

  const handleOpenFile = async () => {
    const result = await window.api.openFile()
    if (result) {
      handleFile(result)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const filePath = (file as File & { path?: string }).path

    if (filePath) {
      const result = await window.api.readFile(filePath)
      if (result) {
        handleFile(result)
      }
    } else {
      const reader = new FileReader()
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const extension = file.name.split('.').pop()?.toLowerCase() || 'txt'

        handleFile({
          filePath: '',
          fileName: file.name,
          extension,
          buffer: base64
        })
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return

    setFile({
      filePath: '',
      fileName: 'pasted-text.txt',
      extension: 'txt',
      buffer: btoa(pasteText),
      size: pasteText.length,
      content: pasteText
    })

    await processContent(pasteText, 'pasted-text.txt')
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-3xl">
        {error && (
          <div className="alert alert-error mb-6">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!pasteMode ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={isProcessing ? undefined : handleOpenFile}
            className={`
              card bg-base-200 border-2 border-dashed transition-all duration-300 cursor-pointer
              ${isProcessing
                ? 'border-base-300 cursor-wait'
                : isDragging
                  ? 'border-primary'
                  : 'border-base-300 hover:border-primary'
              }
            `}
          >
            <div className="card-body items-center text-center py-16">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-6">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <div>
                    <p className="text-xl font-semibold">Analyzing Document</p>
                    <p className="mt-2 text-sm text-neutral-content">
                      Scanning for sensitive information...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div className={`
                    w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300
                    ${isDragging ? 'bg-primary/20 scale-110' : 'bg-base-300 hover:bg-primary/10'}
                  `}>
                    <svg
                      className={`w-12 h-12 transition-colors ${isDragging ? 'text-primary' : 'text-neutral-content'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  <div>
                    <p className="text-xl font-semibold">
                      {isDragging ? 'Release to scan' : 'Drop files here or click to upload'}
                    </p>
                    <p className="mt-2 text-sm text-neutral-content">
                      Supported: DOCX, PDF, XLSX, TXT, Images & more
                    </p>
                  </div>

                  <div className="divider w-48 mx-auto">OR</div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPasteMode(true)
                    }}
                    className="btn btn-outline btn-sm gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Paste text directly
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Paste Text</h2>
                    <p className="text-xs text-neutral-content">Enter or paste content to analyze</p>
                  </div>
                </div>
                <button
                  onClick={() => setPasteMode(false)}
                  className="btn btn-ghost btn-sm btn-square"
                  disabled={isProcessing}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your text here to scan for sensitive information..."
                className="textarea textarea-bordered w-full h-64 text-sm bg-base-300"
                autoFocus
                disabled={isProcessing}
              />

              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-neutral-content">
                  {pasteText.length.toLocaleString()} characters
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPasteMode(false)}
                    className="btn btn-ghost btn-sm"
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasteSubmit}
                    disabled={!pasteText.trim() || isProcessing}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Scan Document
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features list */}
        <div className="mt-10 grid grid-cols-3 gap-6">
          <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="card-body items-center text-center p-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/20 text-success">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold mt-2">100% Local</h3>
              <p className="text-sm text-neutral-content">All processing happens on your device</p>
            </div>
          </div>

          <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="card-body items-center text-center p-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/20 text-primary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold mt-2">Smart Detection</h3>
              <p className="text-sm text-neutral-content">NER-powered PII identification</p>
            </div>
          </div>

          <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="card-body items-center text-center p-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-secondary/20 text-secondary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="font-semibold mt-2">Multi-Format</h3>
              <p className="text-sm text-neutral-content">DOCX, PDF, XLSX, images & more</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
