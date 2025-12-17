import Store from 'electron-store'

export interface ConfigProfile {
  id: string
  name: string
  config: {
    companyName?: string
    aliases?: string[]
    customKeywords?: string[]
    enabledCategories: string[]
    maskingStyle: 'brackets' | 'redacted' | 'custom'
    customMaskTemplate?: string
    confidenceThreshold: number
    detectNames: boolean
    detectOrganizations: boolean
  }
}

const store = new Store<{
  profiles: ConfigProfile[]
  activeProfileId: string
}>({
  name: 'profiles',
  defaults: {
    profiles: [
      {
        id: 'default',
        name: 'Default',
        config: {
          enabledCategories: [
            'email',
            'phone',
            'ssn',
            'credit_card',
            'saudi_id',
            'iban',
            'ip_address',
            'address',
            'date_of_birth'
          ],
          maskingStyle: 'brackets',
          confidenceThreshold: 0.7,
          detectNames: true,
          detectOrganizations: true
        }
      },
      {
        id: 'strict',
        name: 'Strict (All PII)',
        config: {
          enabledCategories: [
            'email',
            'phone',
            'ssn',
            'credit_card',
            'saudi_id',
            'iban',
            'ip_address',
            'address',
            'date_of_birth',
            'passport',
            'driver_license',
            'medical_record',
            'bank_account',
            'api_key',
            'aws_key',
            'person_name',
            'organization',
            'currency',
            'coordinates'
          ],
          maskingStyle: 'redacted',
          confidenceThreshold: 0.5,
          detectNames: true,
          detectOrganizations: true
        }
      },
      {
        id: 'minimal',
        name: 'Minimal (Contacts Only)',
        config: {
          enabledCategories: ['email', 'phone'],
          maskingStyle: 'brackets',
          confidenceThreshold: 0.8,
          detectNames: false,
          detectOrganizations: false
        }
      }
    ],
    activeProfileId: 'default'
  }
})

export function getAllProfiles(): ConfigProfile[] {
  return store.get('profiles')
}

export function getProfile(id: string): ConfigProfile | undefined {
  const profiles = store.get('profiles')
  return profiles.find((p) => p.id === id)
}

export function getActiveProfile(): ConfigProfile {
  const activeId = store.get('activeProfileId')
  const profile = getProfile(activeId)
  return profile || getProfile('default')!
}

export function setActiveProfile(id: string): boolean {
  const profile = getProfile(id)
  if (profile) {
    store.set('activeProfileId', id)
    return true
  }
  return false
}

export function saveProfile(profile: ConfigProfile): void {
  const profiles = store.get('profiles')
  const existingIndex = profiles.findIndex((p) => p.id === profile.id)

  if (existingIndex >= 0) {
    profiles[existingIndex] = profile
  } else {
    profiles.push(profile)
  }

  store.set('profiles', profiles)
}

export function deleteProfile(id: string): boolean {
  // Don't allow deleting built-in profiles
  if (['default', 'strict', 'minimal'].includes(id)) {
    return false
  }

  const profiles = store.get('profiles')
  const filteredProfiles = profiles.filter((p) => p.id !== id)

  if (filteredProfiles.length < profiles.length) {
    store.set('profiles', filteredProfiles)

    // If deleted profile was active, switch to default
    if (store.get('activeProfileId') === id) {
      store.set('activeProfileId', 'default')
    }
    return true
  }

  return false
}

export function createProfile(name: string, config: ConfigProfile['config']): ConfigProfile {
  const id = `custom_${Date.now()}`
  const profile: ConfigProfile = { id, name, config }
  saveProfile(profile)
  return profile
}
