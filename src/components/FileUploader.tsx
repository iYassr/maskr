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
      // Handle image files with OCR
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
      // Use the document parser API for complex formats
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
        // For text-based formats, decode directly
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
      // Fallback: read file using FileReader
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
      <div className="w-full max-w-2xl">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!pasteMode ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={isProcessing ? undefined : handleOpenFile}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ease-in-out
              ${isProcessing
                ? 'border-slate-200 bg-slate-50 cursor-wait'
                : isDragging
                  ? 'border-blue-500 bg-blue-50 cursor-pointer'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 cursor-pointer'
              }
            `}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-700">Processing document...</p>
                  <p className="mt-1 text-sm text-slate-500">Analyzing content for sensitive information</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center transition-colors
                  ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}
                `}>
                  <svg
                    className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-lg font-medium text-slate-700">
                    Drop files here or click to upload
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Supported: {SUPPORTED_FORMATS.map(f => `.${f}`).join(', ')}
                  </p>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <span className="text-sm text-slate-400">or</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPasteMode(true)
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Paste text directly
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-slate-800">Paste Text</h2>
              <button
                onClick={() => setPasteMode(false)}
                className="text-slate-400 hover:text-slate-600"
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
              placeholder="Paste your text here..."
              className="w-full h-64 p-4 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              disabled={isProcessing}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setPasteMode(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                disabled={!pasteText.trim() || isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Scan for Sensitive Data'}
              </button>
            </div>
          </div>
        )}

        {/* Features list */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { icon: '🔒', title: '100% Local', desc: 'No data leaves your device' },
            { icon: '🎯', title: 'Smart Detection', desc: 'PII, emails, phones & more' },
            { icon: '📄', title: 'Multi-Format', desc: 'DOCX, PDF, XLSX & more' }
          ].map((feature) => (
            <div key={feature.title} className="text-center p-4">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="font-medium text-slate-700">{feature.title}</h3>
              <p className="text-sm text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
