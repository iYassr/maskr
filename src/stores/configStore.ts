import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Config, DetectionCategory, LogoConfig } from '../types'

// Input validation helpers
const MAX_STRING_LENGTH = 500
const MAX_ARRAY_SIZE = 100
const MAX_KEYWORD_LENGTH = 100

function sanitizeString(input: string, maxLength = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, maxLength)
}

function validateConfidence(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 70
  return Math.min(100, Math.max(0, Math.round(value)))
}

function isDuplicateEntry(arr: string[], value: string): boolean {
  const normalized = value.toLowerCase().trim()
  return arr.some(item => item.toLowerCase().trim() === normalized)
}

const defaultConfig: Config = {
  companyInfo: {
    primaryName: '',
    aliases: [],
    domain: '',
    internalDomains: []
  },
  customEntities: {
    clients: [],
    projects: [],
    products: [],
    keywords: [],
    names: []
  },
  detectionSettings: {
    minConfidence: 70,
    autoMaskHighConfidence: true,
    categoriesEnabled: ['pii', 'company', 'financial', 'technical', 'custom']
  },
  exportPreferences: {
    includeMappingFile: true,
    defaultFormat: 'same'
  },
  logoDetection: {
    enabled: false,
    imageData: null,
    imageHash: null,
    similarityThreshold: 85,
    placeholderText: '[LOGO REMOVED]'
  }
}

interface ConfigState {
  config: Config
  setConfig: (config: Config) => void
  updateCompanyInfo: (info: Partial<Config['companyInfo']>) => void
  updateDetectionSettings: (settings: Partial<Config['detectionSettings']>) => void
  updateExportPreferences: (prefs: Partial<Config['exportPreferences']>) => void
  addKeyword: (keyword: string) => void
  removeKeyword: (keyword: string) => void
  addAlias: (alias: string) => void
  removeAlias: (alias: string) => void
  addName: (name: string) => void
  removeName: (name: string) => void
  addInternalDomain: (domain: string) => void
  removeInternalDomain: (domain: string) => void
  toggleCategory: (category: DetectionCategory) => void
  setLogoConfig: (logoConfig: Partial<LogoConfig>) => void
  clearLogo: () => void
  resetConfig: () => void
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,

      setConfig: (config) => set({ config }),

      updateCompanyInfo: (info) =>
        set((state) => {
          const sanitizedInfo: Partial<Config['companyInfo']> = {}
          if (info.primaryName !== undefined) {
            sanitizedInfo.primaryName = sanitizeString(info.primaryName)
          }
          if (info.domain !== undefined) {
            sanitizedInfo.domain = sanitizeString(info.domain, 253)
          }
          if (info.aliases !== undefined) {
            sanitizedInfo.aliases = info.aliases
              .map(a => sanitizeString(a, MAX_KEYWORD_LENGTH))
              .filter(Boolean)
              .slice(0, MAX_ARRAY_SIZE)
          }
          if (info.internalDomains !== undefined) {
            sanitizedInfo.internalDomains = info.internalDomains
              .map(d => sanitizeString(d, 253))
              .filter(Boolean)
              .slice(0, MAX_ARRAY_SIZE)
          }
          return {
            config: {
              ...state.config,
              companyInfo: { ...state.config.companyInfo, ...sanitizedInfo }
            }
          }
        }),

      updateDetectionSettings: (settings) =>
        set((state) => {
          const sanitizedSettings: Partial<Config['detectionSettings']> = {}
          if (settings.minConfidence !== undefined) {
            sanitizedSettings.minConfidence = validateConfidence(settings.minConfidence)
          }
          if (settings.autoMaskHighConfidence !== undefined) {
            sanitizedSettings.autoMaskHighConfidence = Boolean(settings.autoMaskHighConfidence)
          }
          if (settings.categoriesEnabled !== undefined) {
            sanitizedSettings.categoriesEnabled = settings.categoriesEnabled
          }
          return {
            config: {
              ...state.config,
              detectionSettings: { ...state.config.detectionSettings, ...sanitizedSettings }
            }
          }
        }),

      updateExportPreferences: (prefs) =>
        set((state) => ({
          config: {
            ...state.config,
            exportPreferences: { ...state.config.exportPreferences, ...prefs }
          }
        })),

      addKeyword: (keyword) =>
        set((state) => {
          const sanitized = sanitizeString(keyword, MAX_KEYWORD_LENGTH)
          if (!sanitized) return state
          if (isDuplicateEntry(state.config.customEntities.keywords, sanitized)) return state
          if (state.config.customEntities.keywords.length >= MAX_ARRAY_SIZE) return state

          return {
            config: {
              ...state.config,
              customEntities: {
                ...state.config.customEntities,
                keywords: [...state.config.customEntities.keywords, sanitized]
              }
            }
          }
        }),

      removeKeyword: (keyword) =>
        set((state) => ({
          config: {
            ...state.config,
            customEntities: {
              ...state.config.customEntities,
              keywords: state.config.customEntities.keywords.filter((k) => k !== keyword)
            }
          }
        })),

      addAlias: (alias) =>
        set((state) => {
          const sanitized = sanitizeString(alias, MAX_KEYWORD_LENGTH)
          if (!sanitized) return state
          if (isDuplicateEntry(state.config.companyInfo.aliases, sanitized)) return state
          if (state.config.companyInfo.aliases.length >= MAX_ARRAY_SIZE) return state

          return {
            config: {
              ...state.config,
              companyInfo: {
                ...state.config.companyInfo,
                aliases: [...state.config.companyInfo.aliases, sanitized]
              }
            }
          }
        }),

      removeAlias: (alias) =>
        set((state) => ({
          config: {
            ...state.config,
            companyInfo: {
              ...state.config.companyInfo,
              aliases: state.config.companyInfo.aliases.filter((a) => a !== alias)
            }
          }
        })),

      addName: (name) =>
        set((state) => {
          const sanitized = sanitizeString(name, MAX_KEYWORD_LENGTH)
          if (!sanitized) return state
          if (isDuplicateEntry(state.config.customEntities.names, sanitized)) return state
          if (state.config.customEntities.names.length >= MAX_ARRAY_SIZE) return state

          return {
            config: {
              ...state.config,
              customEntities: {
                ...state.config.customEntities,
                names: [...state.config.customEntities.names, sanitized]
              }
            }
          }
        }),

      removeName: (name) =>
        set((state) => ({
          config: {
            ...state.config,
            customEntities: {
              ...state.config.customEntities,
              names: state.config.customEntities.names.filter((n) => n !== name)
            }
          }
        })),

      addInternalDomain: (domain) =>
        set((state) => {
          const sanitized = sanitizeString(domain, 253).toLowerCase()
          if (!sanitized) return state
          if (isDuplicateEntry(state.config.companyInfo.internalDomains, sanitized)) return state
          if (state.config.companyInfo.internalDomains.length >= MAX_ARRAY_SIZE) return state

          return {
            config: {
              ...state.config,
              companyInfo: {
                ...state.config.companyInfo,
                internalDomains: [...state.config.companyInfo.internalDomains, sanitized]
              }
            }
          }
        }),

      removeInternalDomain: (domain) =>
        set((state) => ({
          config: {
            ...state.config,
            companyInfo: {
              ...state.config.companyInfo,
              internalDomains: state.config.companyInfo.internalDomains.filter((d) => d !== domain)
            }
          }
        })),

      toggleCategory: (category) =>
        set((state) => {
          const categories = state.config.detectionSettings.categoriesEnabled
          const newCategories = categories.includes(category)
            ? categories.filter((c) => c !== category)
            : [...categories, category]
          return {
            config: {
              ...state.config,
              detectionSettings: {
                ...state.config.detectionSettings,
                categoriesEnabled: newCategories
              }
            }
          }
        }),

      setLogoConfig: (logoConfig) =>
        set((state) => {
          const sanitizedConfig: Partial<LogoConfig> = {}
          if (logoConfig.enabled !== undefined) {
            sanitizedConfig.enabled = Boolean(logoConfig.enabled)
          }
          if (logoConfig.imageData !== undefined) {
            sanitizedConfig.imageData = logoConfig.imageData
          }
          if (logoConfig.imageHash !== undefined) {
            sanitizedConfig.imageHash = logoConfig.imageHash
          }
          if (logoConfig.similarityThreshold !== undefined) {
            sanitizedConfig.similarityThreshold = Math.min(100, Math.max(0, Math.round(logoConfig.similarityThreshold)))
          }
          if (logoConfig.placeholderText !== undefined) {
            sanitizedConfig.placeholderText = sanitizeString(logoConfig.placeholderText, 50)
          }
          return {
            config: {
              ...state.config,
              logoDetection: { ...state.config.logoDetection, ...sanitizedConfig }
            }
          }
        }),

      clearLogo: () =>
        set((state) => ({
          config: {
            ...state.config,
            logoDetection: {
              ...state.config.logoDetection,
              enabled: false,
              imageData: null,
              imageHash: null
            }
          }
        })),

      resetConfig: () => set({ config: defaultConfig })
    }),
    {
      name: 'docsanitizer-config',
      // Merge persisted state with defaults to handle new properties
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { config?: Partial<Config> } | undefined
        return {
          ...currentState,
          config: {
            ...defaultConfig,
            ...persisted?.config,
            // Ensure nested objects exist with defaults
            customEntities: {
              ...defaultConfig.customEntities,
              ...persisted?.config?.customEntities
            },
            logoDetection: {
              ...defaultConfig.logoDetection,
              ...persisted?.config?.logoDetection
            }
          }
        }
      }
    }
  )
)
