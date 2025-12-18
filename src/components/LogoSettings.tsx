import { useState, useCallback, useRef, useEffect } from 'react'
import { useConfigStore } from '../stores/configStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Spinner } from './ui/spinner'
import { Upload, Trash2, Image, AlertCircle } from 'lucide-react'

interface LogoSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogoSettings({ open, onOpenChange }: LogoSettingsProps) {
  const { config, setLogoConfig, clearLogo } = useConfigStore()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if Sharp is available on mount
  useEffect(() => {
    if (open) {
      window.api?.logoIsAvailable().then(setIsAvailable)
    }
  }, [open])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Please select a PNG, JPG, WebP, or GIF image')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // Remove data URL prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Compute hash via IPC
      const result = await window.api?.logoComputeHash(base64)
      console.log('Logo upload result:', result)

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to process image')
      }

      if (!result.thumbnail) {
        throw new Error('Failed to create image thumbnail')
      }

      // Update config with the PNG thumbnail
      console.log('Saving logo config:', {
        thumbnailLength: result.thumbnail.length,
        hash: result.hash,
        enabled: true
      })

      setLogoConfig({
        imageData: result.thumbnail,
        imageHash: result.hash,
        enabled: true
      })

      console.log('Logo config saved successfully')
    } catch (err) {
      console.error('Logo upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [setLogoConfig])

  const handleClearLogo = useCallback(() => {
    clearLogo()
    setError(null)
  }, [clearLogo])

  const handleThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setLogoConfig({ similarityThreshold: value })
  }, [setLogoConfig])

  const handlePlaceholderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoConfig({ placeholderText: e.target.value })
  }, [setLogoConfig])

  const handleEnabledChange = useCallback((checked: boolean) => {
    setLogoConfig({ enabled: checked })
  }, [setLogoConfig])

  const logoDetection = config.logoDetection

  // Debug: log current state
  console.log('LogoSettings state:', {
    enabled: logoDetection.enabled,
    hasImageData: !!logoDetection.imageData,
    hasImageHash: !!logoDetection.imageHash,
    imageHash: logoDetection.imageHash,
    threshold: logoDetection.similarityThreshold
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Logo Detection Settings
          </DialogTitle>
          <DialogDescription>
            Configure company logo detection to automatically find and remove logos from documents.
          </DialogDescription>
        </DialogHeader>

        {isAvailable === false && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Logo detection requires Sharp library which is not available. Image processing is disabled.
            </p>
          </div>
        )}

        {isAvailable !== false && (
          <div className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable Logo Detection</label>
                <p className="text-xs text-muted-foreground">
                  Scan DOCX files for company logos
                </p>
              </div>
              <Switch
                checked={logoDetection.enabled}
                onCheckedChange={handleEnabledChange}
                disabled={!logoDetection.imageHash}
              />
            </div>

            {/* Logo upload section */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Company Logo</label>

              {logoDetection.imageData ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={`data:image/png;base64,${logoDetection.imageData}`}
                      alt="Company logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">
                      Logo configured
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearLogo}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    transition-colors hover:border-muted-foreground hover:bg-muted/30
                    ${isUploading ? 'pointer-events-none opacity-60' : ''}
                  `}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Spinner className="h-8 w-8" />
                      <p className="text-sm text-muted-foreground">Processing...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Upload logo image</p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, WebP or GIF (max 5MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Similarity threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Similarity Threshold</label>
                <span className="text-sm text-muted-foreground">
                  {logoDetection.similarityThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={logoDetection.similarityThreshold}
                onChange={handleThresholdChange}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More matches</span>
                <span>Exact match</span>
              </div>
            </div>

            {/* Placeholder text */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Replacement Text</label>
              <input
                type="text"
                value={logoDetection.placeholderText}
                onChange={handlePlaceholderChange}
                placeholder="[LOGO REMOVED]"
                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Text to replace detected logos with
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
