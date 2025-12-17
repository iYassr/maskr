import { useState, type ReactNode } from 'react'
import { useConfigStore } from '../stores/configStore'
import type { DetectionCategory } from '../types'

interface ConfigModalProps {
  onClose: () => void
}

type Tab = 'company' | 'detection' | 'export'

const categoryConfig: Record<DetectionCategory, { label: string; description: string; badgeClass: string }> = {
  pii: { label: 'Personal Information', description: 'Names, emails, phones, SSN, addresses', badgeClass: 'badge-error' },
  company: { label: 'Company Information', description: 'Organization names, locations, domains', badgeClass: 'badge-info' },
  financial: { label: 'Financial Data', description: 'Credit cards, bank accounts, amounts', badgeClass: 'badge-success' },
  technical: { label: 'Technical Information', description: 'IP addresses, API keys, credentials', badgeClass: 'badge-secondary' },
  custom: { label: 'Custom Keywords', description: 'Your specified terms and phrases', badgeClass: 'badge-warning' }
}

export function ConfigModal({ onClose }: ConfigModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('company')
  const [newAlias, setNewAlias] = useState('')
  const [newKeyword, setNewKeyword] = useState('')

  const {
    config,
    updateCompanyInfo,
    updateDetectionSettings,
    updateExportPreferences,
    addAlias,
    removeAlias,
    addKeyword,
    removeKeyword,
    toggleCategory,
    resetConfig
  } = useConfigStore()

  const handleAddAlias = () => {
    if (newAlias.trim()) {
      addAlias(newAlias.trim())
      setNewAlias('')
    }
  }

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      addKeyword(newKeyword.trim())
      setNewKeyword('')
    }
  }

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    {
      id: 'company',
      label: 'Company Profile',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      id: 'detection',
      label: 'Detection',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'export',
      label: 'Export',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      )
    }
  ]

  return (
    <div className="modal modal-open">
      <div className="modal-backdrop bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-box max-w-2xl max-h-[85vh] flex flex-col p-0 animate-scale-in bg-base-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-base-content">Settings</h2>
              <p className="text-xs text-neutral-content">Configure detection and export preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-square"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed gap-1 px-6 py-3 bg-base-300">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab gap-2 ${activeTab === tab.id ? 'tab-active bg-primary text-primary-content' : ''}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'company' && (
            <div className="space-y-6 animate-fade-in">
              {/* Company Name */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-2 text-sm font-medium text-base-content mb-3">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Company Name
                </label>
                <input
                  type="text"
                  value={config.companyInfo.primaryName}
                  onChange={(e) => updateCompanyInfo({ primaryName: e.target.value })}
                  placeholder="Enter your company name"
                  className="input input-bordered w-full bg-base-100"
                />
                <p className="mt-2 text-xs text-neutral-content flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Will be masked as <code className="px-1.5 py-0.5 bg-base-100 rounded text-primary font-mono">&lt;COMPANY_NAME&gt;</code>
                </p>
              </div>

              {/* Aliases */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-2 text-sm font-medium text-base-content mb-3">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Company Aliases
                </label>
                <div className="join w-full mb-3">
                  <input
                    type="text"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                    placeholder="Add alias (e.g., acronym, abbreviation)"
                    className="input input-bordered join-item flex-1 bg-base-100"
                  />
                  <button
                    onClick={handleAddAlias}
                    className="btn btn-primary join-item"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.companyInfo.aliases.length === 0 ? (
                    <span className="text-sm text-neutral-content">No aliases added yet</span>
                  ) : (
                    config.companyInfo.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="badge badge-lg badge-info gap-1.5 font-mono"
                      >
                        {alias}
                        <button
                          onClick={() => removeAlias(alias)}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Custom Keywords */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-2 text-sm font-medium text-base-content mb-3">
                  <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Custom Keywords to Detect
                </label>
                <div className="join w-full mb-3">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    placeholder="Add keyword (e.g., project name, client)"
                    className="input input-bordered join-item flex-1 bg-base-100"
                  />
                  <button
                    onClick={handleAddKeyword}
                    className="btn btn-primary join-item"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.customEntities.keywords.length === 0 ? (
                    <span className="text-sm text-neutral-content">No keywords added yet</span>
                  ) : (
                    config.customEntities.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="badge badge-lg badge-warning gap-1.5 font-mono"
                      >
                        {keyword}
                        <button
                          onClick={() => removeKeyword(keyword)}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'detection' && (
            <div className="space-y-6 animate-fade-in">
              {/* Categories */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-2 text-sm font-medium text-base-content mb-4">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Detection Categories
                </label>
                <div className="space-y-2">
                  {(Object.keys(categoryConfig) as DetectionCategory[]).map((category) => {
                    const isEnabled = config.detectionSettings.categoriesEnabled.includes(category)
                    return (
                      <label
                        key={category}
                        className={`
                          flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border
                          ${isEnabled
                            ? 'bg-base-100 border-primary'
                            : 'bg-base-200 border-neutral hover:border-neutral-content'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleCategory(category)}
                          className="checkbox checkbox-primary"
                        />
                        <div className="flex-1">
                          <span className={`text-sm font-medium ${isEnabled ? 'text-base-content' : 'text-neutral-content'}`}>
                            {categoryConfig[category].label}
                          </span>
                          <p className="text-xs text-neutral-content mt-0.5">
                            {categoryConfig[category].description}
                          </p>
                        </div>
                        <span className={`badge ${categoryConfig[category].badgeClass}`}>
                          {category.toUpperCase()}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Confidence Threshold */}
              <div className="card bg-base-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-base-content">
                    <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Minimum Confidence
                  </label>
                  <span className="text-2xl font-bold text-primary">
                    {config.detectionSettings.minConfidence}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={config.detectionSettings.minConfidence}
                  onChange={(e) => updateDetectionSettings({ minConfidence: parseInt(e.target.value) })}
                  className="range range-primary"
                />
                <div className="flex justify-between text-xs text-neutral-content mt-2">
                  <span>50% (More detections)</span>
                  <span>100% (Higher accuracy)</span>
                </div>
              </div>

              {/* Auto-mask */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.detectionSettings.autoMaskHighConfidence}
                    onChange={(e) => updateDetectionSettings({ autoMaskHighConfidence: e.target.checked })}
                    className="toggle toggle-primary"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-base-content">Auto-select high confidence items</span>
                    <p className="text-xs text-neutral-content mt-0.5">
                      Automatically select detections with 90%+ confidence for masking
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-6 animate-fade-in">
              {/* Include mapping file */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.exportPreferences.includeMappingFile}
                    onChange={(e) => updateExportPreferences({ includeMappingFile: e.target.checked })}
                    className="toggle toggle-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-base-content">Show mapping export option</span>
                    </div>
                    <p className="text-xs text-neutral-content mt-1 ml-6">
                      Export a JSON file mapping placeholders to original values for later reference
                    </p>
                  </div>
                </label>
              </div>

              {/* Default format */}
              <div className="card bg-base-300 p-5">
                <label className="flex items-center gap-2 text-sm font-medium text-base-content mb-3">
                  <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Default Export Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'same', label: 'Same as Input', icon: '=' },
                    { value: 'txt', label: 'Plain Text', icon: '.txt' },
                    { value: 'md', label: 'Markdown', icon: '.md' }
                  ].map((format) => (
                    <button
                      key={format.value}
                      onClick={() => updateExportPreferences({ defaultFormat: format.value as 'same' | 'txt' | 'md' })}
                      className={`btn flex-col h-auto py-4 ${
                        config.exportPreferences.defaultFormat === format.value
                          ? 'btn-primary'
                          : 'btn-ghost bg-base-200'
                      }`}
                    >
                      <div className="text-lg font-mono mb-1">{format.icon}</div>
                      <div className="text-xs">{format.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Security note */}
              <div className="alert alert-info">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">Privacy First</p>
                  <p className="text-xs opacity-80 mt-0.5">
                    All processing happens locally on your device. No data is ever sent to external servers.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral bg-base-300">
          <button
            onClick={resetConfig}
            className="btn btn-ghost btn-sm text-error gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="btn btn-primary gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
