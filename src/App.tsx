import { useState, useCallback } from 'react'
import { useDocumentStore } from './stores/documentStore'
import { UploadStep } from './components/UploadStep'
import { ReviewStep } from './components/ReviewStep'
import { ExportStep } from './components/ExportStep'
import { Check } from 'lucide-react'

type Step = 'upload' | 'review' | 'export'

const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'upload', label: 'Upload', number: 1 },
  { id: 'review', label: 'Review', number: 2 },
  { id: 'export', label: 'Export', number: 3 }
]

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const { reset } = useDocumentStore()

  const handleFileUploaded = useCallback(() => {
    setCurrentStep('review')
  }, [])

  const handleReviewComplete = useCallback(() => {
    setCurrentStep('export')
  }, [])

  const handleBackToReview = useCallback(() => {
    setCurrentStep('review')
  }, [])

  const handleBackToUpload = useCallback(() => {
    reset()
    setCurrentStep('upload')
  }, [reset])

  const handleReset = useCallback(() => {
    reset()
    setCurrentStep('upload')
  }, [reset])

  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep)

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header with step indicator */}
      <header className="flex-shrink-0 titlebar-drag-region bg-muted border-b border-border">
        {/* Drag area for window */}
        <div className="h-10 flex items-center justify-center">
          <div className="titlebar-no-drag flex items-center gap-6 px-4">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep
              const isCompleted = getCurrentStepIndex() > index
              const isPast = index < getCurrentStepIndex()

              return (
                <div key={step.id} className="flex items-center gap-3">
                  {/* Step indicator */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                        transition-all duration-300
                        ${isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                            ? 'bg-primary/60 text-primary-foreground'
                            : 'bg-secondary text-muted-foreground'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive
                          ? 'text-foreground'
                          : isPast
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/60'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-12 h-px ${
                        isPast ? 'bg-primary/60' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {currentStep === 'upload' && (
          <UploadStep onFileUploaded={handleFileUploaded} />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            onContinue={handleReviewComplete}
            onBack={handleBackToUpload}
          />
        )}
        {currentStep === 'export' && (
          <ExportStep
            onBack={handleBackToReview}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-2 flex items-center justify-between text-xs bg-muted border-t border-border text-muted-foreground">
        <span>DocSanitizer v1.0</span>
        <span>Secure document sanitization</span>
      </footer>
    </div>
  )
}
