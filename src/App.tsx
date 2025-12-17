import { useDocumentStore } from './stores/documentStore'
import { Header } from './components/Header'
import { FileUploader } from './components/FileUploader'
import { ReviewPanel } from './components/ReviewPanel'
import { ConfigModal } from './components/ConfigModal'
import { useState } from 'react'

export default function App() {
  const { view } = useDocumentStore()
  const [showConfig, setShowConfig] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <Header onConfigClick={() => setShowConfig(true)} />

      <main className="flex-1 overflow-hidden">
        {view === 'upload' && <FileUploader />}
        {view === 'review' && <ReviewPanel />}
      </main>

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  )
}
