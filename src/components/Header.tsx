import { useDocumentStore } from '../stores/documentStore'

interface HeaderProps {
  onConfigClick: () => void
}

export function Header({ onConfigClick }: HeaderProps) {
  const { view, file, reset, stats } = useDocumentStore()

  return (
    <header className="titlebar-drag-region navbar bg-base-200 border-b border-base-300 px-6">
      <div className="flex-1">
        <div className="flex items-center gap-4">
          {/* Logo and branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg">
              <svg
                className="w-6 h-6 text-primary-content"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-base-content">
                DocSanitizer
              </h1>
              <p className="text-xs text-neutral-content">
                SECURE • LOCAL • PRIVATE
              </p>
            </div>
          </div>

          {/* File info when reviewing */}
          {view === 'review' && file && (
            <div className="flex items-center gap-3 ml-6 pl-6 border-l border-base-300">
              <div className="badge badge-lg badge-outline gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-sm">{file.fileName}</span>
              </div>
              {stats && (
                <div className="flex items-center gap-2 text-xs text-neutral-content">
                  <span>{stats.processingTimeMs}ms</span>
                  <span className="opacity-50">|</span>
                  <span>{stats.totalDetections} found</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="titlebar-no-drag flex-none flex items-center gap-2">
        {view === 'review' && (
          <button onClick={reset} className="btn btn-ghost btn-sm gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            New Scan
          </button>
        )}

        <button
          onClick={onConfigClick}
          className="btn btn-ghost btn-square btn-sm"
          title="Settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
