# Product Requirements Document: DocSanitizer
## Sensitive Information Detection & Masking Desktop Application

**Version:** 1.2
**Date:** December 2024
**Last Updated:** December 2024

---

## 1. Executive Summary

DocSanitizer is a desktop application (built with Electron) that automatically detects and masks sensitive information in documents before they are shared with AI applications or external parties. The tool scans uploaded documents for PII, company-specific information, financial data, and other configurable sensitive patterns, then replaces them with safe placeholder tokens. All processing happens locally on the user's machine—no data ever leaves the device.

---

## 2. Problem Statement

Organizations need to share documents with AI tools (ChatGPT, Claude, Copilot, etc.) for analysis, summarization, or processing. However, these documents often contain sensitive information that should not be exposed to external services:

- Company names and internal project codenames
- Personal Identifiable Information (PII)
- Financial figures and account numbers
- Client/partner names
- Internal IP addresses and system names
- Confidential business metrics

Manual redaction is time-consuming, error-prone, and inconsistent.

---

## 3. Solution Overview

A cross-platform desktop application (Windows, macOS, Linux) that:
1. Accepts document uploads via native file dialogs or drag-and-drop
2. Scans content using configurable detection rules (100% local processing)
3. Presents detected sensitive items for review
4. Replaces/masks sensitive data with consistent placeholder tokens
5. Exports sanitized documents ready for AI consumption

---

## 4. User Stories

### 4.1 Document Upload
- **US-01:** As a user, I want to upload documents in various formats (DOCX, MD, XLSX, TXT, PDF, CSV) so I can sanitize any document type.
- **US-02:** As a user, I want to drag-and-drop files for quick upload.
- **US-03:** As a user, I want to paste text directly for quick sanitization without file upload.

### 4.2 Detection & Review
- **US-04:** As a user, I want to see all detected sensitive items highlighted in a preview so I can review what will be masked.
- **US-05:** As a user, I want to approve or reject individual detections before masking.
- **US-06:** As a user, I want to manually select additional text to mask that wasn't auto-detected.
- **US-07:** As a user, I want to see detection categories (PII, Company, Financial, etc.) color-coded.

### 4.3 Configuration
- **US-08:** As a user, I want to configure my company name and aliases so they are always detected.
- **US-09:** As a user, I want to add custom keywords/patterns to detect (project names, client names, product names).
- **US-10:** As a user, I want to save my configuration for future sessions.
- **US-11:** As a user, I want to import/export configuration profiles.
- **US-12:** As a user, I want to define custom placeholder tokens for each category.

### 4.4 Masking & Export
- **US-13:** As a user, I want sensitive data replaced with consistent tokens (e.g., `<COMPANY_NAME>`, `<PERSON_1>`, `<EMAIL_1>`).
- **US-14:** As a user, I want the same entity to use the same token throughout the document (consistency).
- **US-15:** As a user, I want to download the sanitized document in my preferred format.
- **US-16:** As a user, I want to copy sanitized text directly to clipboard.
- **US-17:** As a user, I want to download a mapping file showing original → masked values (for my reference only).

### 4.5 Image Handling
- **US-18:** As a user, I want images in documents to be detected and flagged.
- **US-19:** As a user, I want options to: remove images entirely, blur/pixelate images, or replace with placeholder.
- **US-20:** As a user, I want OCR capability to detect text within images and mask it.

---

## 5. Functional Requirements

### 5.1 Supported File Formats

| Format | Extension | Read | Write | Notes |
|--------|-----------|------|-------|-------|
| Microsoft Word | .docx | ✓ | ✓ | Preserve basic formatting |
| Markdown | .md | ✓ | ✓ | Full support |
| Plain Text | .txt | ✓ | ✓ | Full support |
| Excel | .xlsx | ✓ | ✓ | All sheets processed |
| CSV | .csv | ✓ | ✓ | Full support |
| PDF | .pdf | ✓ | ✓ | Extract text, flatten images |
| JSON | .json | ✓ | ✓ | Preserve structure |
| HTML | .html | ✓ | ✓ | Strip scripts, preserve text |

### 5.2 Detection Categories & Patterns

#### 5.2.1 Personal Identifiable Information (PII)
| Type | Pattern/Logic | Placeholder Format |
|------|---------------|-------------------|
| Email addresses | Regex pattern | `<EMAIL_1>`, `<EMAIL_2>` |
| Phone numbers | International formats | `<PHONE_1>`, `<PHONE_2>` |
| National IDs | Saudi ID (10 digits starting with 1 or 2), SSN, etc. | `<NATIONAL_ID_1>` |
| Names | NER (Named Entity Recognition) | `<PERSON_1>`, `<PERSON_2>` |
| Physical addresses | NER + pattern matching | `<ADDRESS_1>` |
| Dates of birth | Date patterns with context | `<DOB_1>` |
| Passport numbers | Country-specific patterns | `<PASSPORT_1>` |
| IBAN | Standard IBAN format | `<IBAN_1>` |
| Credit card numbers | Luhn validation + patterns | `<CARD_NUMBER_1>` |

#### 5.2.2 Company & Business Information
| Type | Pattern/Logic | Placeholder Format |
|------|---------------|-------------------|
| Company name | User-configured + NER | `<COMPANY_NAME>` |
| Company aliases | User-configured list | `<COMPANY_NAME>` |
| Competitor names | User-configured list | `<COMPETITOR_1>` |
| Client/Partner names | User-configured list | `<CLIENT_1>`, `<PARTNER_1>` |
| Project codenames | User-configured list | `<PROJECT_1>` |
| Product names | User-configured list | `<PRODUCT_1>` |
| Department names | User-configured list | `<DEPARTMENT_1>` |

#### 5.2.3 Financial Information
| Type | Pattern/Logic | Placeholder Format |
|------|---------------|-------------------|
| Monetary amounts | Currency + number patterns | `<AMOUNT_1>` |
| Account numbers | Numeric patterns | `<ACCOUNT_1>` |
| Revenue/profit figures | Context + numbers | `<FINANCIAL_FIGURE_1>` |
| Percentages (sensitive) | Context-aware | `<PERCENTAGE_1>` |

#### 5.2.4 Technical Information
| Type | Pattern/Logic | Placeholder Format |
|------|---------------|-------------------|
| IP addresses | IPv4/IPv6 patterns | `<IP_ADDRESS_1>` |
| Internal URLs | User-configured domains | `<INTERNAL_URL_1>` |
| Server/host names | User-configured patterns | `<SERVER_1>` |
| API keys/tokens | High-entropy strings | `<API_KEY_1>` |
| Database names | User-configured | `<DATABASE_1>` |
| Credentials | Pattern matching | `<CREDENTIAL_1>` |

#### 5.2.5 Dates & Timestamps
| Type | Pattern/Logic | Placeholder Format |
|------|---------------|-------------------|
| Specific dates | Date patterns | `<DATE_1>` |
| Meeting times | Time patterns with context | `<DATETIME_1>` |

### 5.3 Detection Confidence Levels

Each detection should have a confidence score:
- **High (90-100%):** Definite match (regex, exact keyword match)
- **Medium (70-89%):** Probable match (NER, context-based)
- **Low (50-69%):** Possible match (heuristic)

User can configure minimum confidence threshold for auto-masking.

### 5.4 Image Processing

| Option | Description |
|--------|-------------|
| Remove | Delete image entirely, leave `[IMAGE REMOVED]` placeholder |
| Blur | Apply gaussian blur (configurable intensity) |
| Pixelate | Mosaic effect (configurable block size) |
| OCR + Mask | Extract text from image, mask sensitive text, re-render |
| Keep | Leave image unchanged (with warning) |

Default: Remove (safest option)

### 5.5 Consistency Engine

The system must maintain entity consistency:
- First occurrence of "John Smith" → `<PERSON_1>`
- All subsequent "John Smith" → `<PERSON_1>`
- "John" alone (if linked) → `<PERSON_1>`
- Different person "Jane Doe" → `<PERSON_2>`

This mapping is maintained per document session and can be exported.

---

## 6. Configuration System

### 6.1 Configuration Categories

```yaml
company_info:
  primary_name: "Your Company Name"
  aliases: ["YCN", "YourCo", "Your Company"]
  domain: "yourcompany.com"
  internal_domains: ["internal.yourcompany.com", "gitlab.yourcompany.com"]

custom_entities:
  clients:
    - name: "Client A Corp"
      aliases: ["Client A", "CAC"]
  projects:
    - name: "Project Phoenix"
      aliases: ["Phoenix", "PX-2024"]
  products:
    - name: "ProductName"
      aliases: ["PN"]

detection_settings:
  min_confidence: 70
  auto_mask_high_confidence: true
  categories_enabled:
    - pii
    - company
    - financial
    - technical
  
masking_preferences:
  style: "placeholder"  # Options: placeholder, redact, hash
  preserve_format: true  # Keep same character length
  
image_handling:
  default_action: "remove"
  ocr_enabled: true
  
export_preferences:
  include_mapping_file: true
  default_format: "same_as_input"
```

### 6.2 Configuration UI

The configuration panel should include:

1. **Company Profile Tab**
   - Company name input
   - Aliases list (add/remove)
   - Internal domains list

2. **Custom Entities Tab**
   - Clients/Partners section
   - Projects section  
   - Products section
   - Custom keywords section
   - Import from CSV option

3. **Detection Settings Tab**
   - Category toggles (PII, Financial, etc.)
   - Confidence threshold slider
   - Regex pattern builder for advanced users

4. **Masking Preferences Tab**
   - Placeholder style selector
   - Custom placeholder templates
   - Image handling defaults

5. **Profile Management**
   - Save profile
   - Load profile
   - Export/Import JSON
   - Reset to defaults

---

## 7. User Interface Requirements

### 7.1 Main Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  DocSanitizer                              [Config] [Help] [⚙]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │         Drop files here or click to upload              │   │
│  │              Supported: DOCX, MD, XLSX, TXT, PDF        │   │
│  │                                                         │   │
│  │                    [Or paste text]                      │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Review Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  DocSanitizer                              [Config] [Help] [⚙]  │
├─────────────────────────────────────────────────────────────────┤
│  document.docx                    Detected: 23 items   [Scan]  │
├───────────────────────────────────┬─────────────────────────────┤
│                                   │  Detected Items            │
│  Document Preview                 │  ─────────────────────────  │
│  ─────────────────────────────    │                             │
│                                   │  ☑ PII (8)                  │
│  The meeting with [John Smith]    │    ☑ John Smith → PERSON_1  │
│  from [Acme Corp] discussed       │    ☑ john@email.com→EMAIL_1 │
│  the [Q3 revenue] figures of      │    ☑ +966-xxx → PHONE_1     │
│  [$2.5M] for [Project Alpha].     │                             │
│                                   │  ☑ Company (4)              │
│  Contact: [john@acme.com]         │    ☑ Acme Corp → CLIENT_1   │
│  Phone: [+966 55 123 4567]        │    ☑ Project Alpha→PROJECT_1│
│                                   │                             │
│  [IMAGE: Screenshot.png]          │  ☑ Financial (3)            │
│   ⚠ Contains potential PII       │    ☑ $2.5M → AMOUNT_1       │
│   Action: [Remove ▼]              │    ☑ Q3 revenue→FIN_METRIC_1│
│                                   │                             │
│                                   │  ☑ Images (1)               │
│                                   │    ☑ Screenshot.png→[Remove]│
│                                   │                             │
├───────────────────────────────────┴─────────────────────────────┤
│  [Select All] [Deselect All]        [Export Mapping] [Download] │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Color Coding

| Category | Color | Hex Code |
|----------|-------|----------|
| PII | Red | `#EF4444` |
| Company | Blue | `#3B82F6` |
| Financial | Green | `#22C55E` |
| Technical | Purple | `#A855F7` |
| Custom | Orange | `#F97316` |
| Images | Yellow | `#EAB308` |

### 7.4 Responsive Design

- Desktop: Full side-by-side view
- Tablet: Collapsible detection panel
- Mobile: Stacked view with tabs

---

## 8. Technical Architecture

### 8.1 Recommended Stack (Electron Desktop App)

```
Core Framework:
├── Runtime: Electron 39+
├── Renderer: React 18 + TypeScript
├── Build Tool: Vite 7 (fast HMR, optimized builds)
├── Packaging: electron-builder
└── IPC Bridge: Secure preload scripts

Frontend (Renderer Process):
├── Framework: React 18 + TypeScript
├── UI Library: Tailwind CSS + shadcn/ui
├── State Management: Zustand
├── Document Preview: TipTap or Monaco Editor
└── File Dialogs: Native Electron dialogs

Backend (Main Process - Node.js):
├── NLP/NER: Compromise.js (lightweight, fast)
├── OCR: Tesseract.js (local processing)
├── Document Processing:
│   ├── DOCX: mammoth (read) + docx (write)
│   ├── XLSX: ExcelJS (full formatting support)
│   ├── PDF: pdf-parse (read) + pdf-lib (write)
│   └── Images: Sharp (native, fast)
└── Storage: electron-store (encrypted, persistent)
```

### 8.2 Dependencies

```json
{
  "dependencies": {
    "mammoth": "^1.11.0",
    "docx": "^9.5.1",
    "exceljs": "^4.4.0",
    "pdf-parse": "^2.4.5",
    "pdf-lib": "^1.17.1",
    "sharp": "^0.34.5",
    "tesseract.js": "^6.0.1",
    "compromise": "^14.14.4",
    "electron-store": "^11.0.2"
  },
  "devDependencies": {
    "electron": "^39.2.7",
    "electron-builder": "^26.0.12",
    "vite": "^7.3.0",
    "vite-plugin-electron": "^0.29.0",
    "@vitejs/plugin-react": "^5.1.2"
  }
}
```

### 8.3 Project Structure

```
docsanitizer/
├── electron/
│   ├── main.ts                 # Main process entry
│   ├── preload.ts              # Secure IPC bridge
│   ├── ipc/
│   │   ├── file-handlers.ts    # Open/save dialogs, file I/O
│   │   ├── detection.ts        # NLP/regex processing
│   │   └── export.ts           # Document generation
│   └── services/
│       ├── document-parser.ts  # Multi-format parsing
│       ├── detector.ts         # Detection engine
│       ├── masker.ts           # Replacement engine
│       ├── consistency.ts      # Entity tracking
│       └── ocr.ts              # Tesseract wrapper
├── src/                        # React renderer
│   ├── components/
│   │   ├── FileUploader.tsx
│   │   ├── DocumentPreview.tsx
│   │   ├── DetectionPanel.tsx
│   │   ├── ConfigModal.tsx
│   │   └── ExportOptions.tsx
│   ├── hooks/
│   │   ├── useDetection.ts
│   │   ├── useConfig.ts
│   │   └── useElectronIPC.ts
│   ├── stores/
│   │   ├── documentStore.ts
│   │   ├── detectionStore.ts
│   │   └── configStore.ts
│   ├── lib/
│   │   └── ipc.ts              # Typed IPC calls
│   └── App.tsx
├── resources/
│   ├── icon.png                # App icon
│   ├── icon.icns               # macOS icon
│   ├── icon.ico                # Windows icon
│   └── tesseract/              # OCR language data
│       ├── eng.traineddata
│       └── ara.traineddata
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 8.4 Electron Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS                            │
│  (Node.js - Full system access)                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   File I/O  │  │  Document   │  │  Detection  │        │
│  │   (fs, path)│  │  Parsers    │  │  Engine     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Sharp    │  │ Tesseract   │  │  electron-  │        │
│  │   (images)  │  │   (OCR)     │  │   store     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     PRELOAD SCRIPT                          │
│  (Secure bridge - exposes only specific APIs)              │
│                                                             │
│  contextBridge.exposeInMainWorld('api', {                  │
│    openFile, saveFile, scanDocument, applyMasking,         │
│    getConfig, setConfig, ...                               │
│  })                                                         │
├─────────────────────────────────────────────────────────────┤
│                   RENDERER PROCESS                          │
│  (Chromium - Sandboxed, no Node.js access)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │                 React Application                │       │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐     │       │
│  │  │  Upload   │ │  Preview  │ │  Config   │     │       │
│  │  │   View    │ │   View    │ │   Modal   │     │       │
│  │  └───────────┘ └───────────┘ └───────────┘     │       │
│  │                                                  │       │
│  │  State: Zustand    Styling: Tailwind + shadcn   │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.5 IPC Communication

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data: Buffer, defaultName: string) => 
    ipcRenderer.invoke('dialog:saveFile', data, defaultName),
  
  // Document processing
  scanDocument: (filePath: string, config: Config) => 
    ipcRenderer.invoke('document:scan', filePath, config),
  applyMasking: (docId: string, approvedDetections: Detection[]) => 
    ipcRenderer.invoke('document:mask', docId, approvedDetections),
  
  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: Config) => ipcRenderer.invoke('config:set', config),
  exportConfig: () => ipcRenderer.invoke('config:export'),
  importConfig: () => ipcRenderer.invoke('config:import'),
  
  // Progress events
  onProgress: (callback: (progress: number) => void) => 
    ipcRenderer.on('processing:progress', (_, progress) => callback(progress)),
});

// Type definitions for renderer
declare global {
  interface Window {
    api: {
      openFile: () => Promise<{ filePath: string; content: Buffer } | null>;
      saveFile: (data: Buffer, defaultName: string) => Promise<string | null>;
      scanDocument: (filePath: string, config: Config) => Promise<ScanResult>;
      applyMasking: (docId: string, approvedDetections: Detection[]) => Promise<Buffer>;
      getConfig: () => Promise<Config>;
      setConfig: (config: Config) => Promise<void>;
      exportConfig: () => Promise<void>;
      importConfig: () => Promise<Config | null>;
      onProgress: (callback: (progress: number) => void) => void;
    };
  }
}
```

### 8.6 Electron-Specific Features

| Feature | Implementation | Benefit |
|---------|---------------|---------|
| Native File Dialogs | `dialog.showOpenDialog()` | Familiar OS experience |
| Drag & Drop | Full file path access | No upload needed |
| Recent Documents | `app.addRecentDocument()` | Quick access |
| Menu Bar | Custom application menu | File/Edit/View/Help |
| Auto-Updates | `electron-updater` | Seamless updates |
| System Tray | Optional minimize to tray | Background availability |
| Touch Bar (macOS) | Quick action buttons | Pro user workflow |
| Native Notifications | Processing complete alerts | Batch processing feedback |

### 8.7 Build Configuration

```yaml
# electron-builder.yml
appId: com.yourcompany.docsanitizer
productName: DocSanitizer
copyright: Copyright © 2024

directories:
  output: dist
  buildResources: resources

files:
  - dist/**/*
  - electron/**/*
  - package.json

extraResources:
  - from: resources/tesseract
    to: tesseract
    filter:
      - "**/*"

mac:
  category: public.app-category.productivity
  icon: resources/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  target:
    - dmg
    - zip

win:
  icon: resources/icon.ico
  target:
    - nsis
    - portable

linux:
  icon: resources/icon.png
  category: Office
  target:
    - AppImage
    - deb

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

### 8.8 Processing Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Upload  │───▶│  Parse   │───▶│  Detect  │───▶│  Review  │
│(Renderer)│    │  (Main)  │    │  (Main)  │    │(Renderer)│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │                │               │
     ▼               ▼                ▼               ▼
┌──────────┐   ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Native   │   │ mammoth/ │    │ NER +    │    │  User    │
│ Dialog / │   │ exceljs/ │    │ Regex +  │    │ Approve/ │
│ Drag&Drop│   │ pdf-parse│    │ Config   │    │ Reject   │
└──────────┘   └──────────┘    └──────────┘    └──────────┘
                                                    │
                     ┌──────────────────────────────┘
                     ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  Mask    │───▶│ Rebuild  │───▶│  Export  │
              │  (Main)  │    │  (Main)  │    │(Renderer)│
              └──────────┘    └──────────┘    └──────────┘
                                                    │
                                                    ▼
                                             ┌──────────┐
                                             │ Native   │
                                             │ Save     │
                                             │ Dialog   │
                                             └──────────┘
```

### 8.9 Security Considerations

1. **100% Local Processing**
   - All document processing happens on user's machine
   - No network calls, no cloud dependencies
   - Zero data leaves the device
   - Works completely offline

2. **Electron Security Best Practices**
   - Renderer process is sandboxed (`sandbox: true`)
   - Context isolation enabled (`contextIsolation: true`)
   - Node integration disabled in renderer (`nodeIntegration: false`)
   - Preload scripts expose only necessary APIs
   - No remote module usage
   - CSP headers configured

3. **Configuration Security**
   - `electron-store` encrypts sensitive config data
   - Config stored in user's app data directory
   - Optional: password-protect configuration profiles

4. **Export Security**
   - Mapping file contains sensitive original values
   - Clear warning when exporting mapping file
   - Option to encrypt mapping file with password
   - Mapping file never auto-saved

5. **Code Signing (Distribution)**
   - macOS: Notarized with Apple Developer ID
   - Windows: EV code signing certificate
   - Prevents tampering warnings

---

## 9. Detection Rules Engine

### 9.1 Rule Structure

```typescript
interface DetectionRule {
  id: string;
  name: string;
  category: 'pii' | 'company' | 'financial' | 'technical' | 'custom';
  type: 'regex' | 'keyword' | 'ner' | 'ml';
  pattern?: RegExp;
  keywords?: string[];
  nerEntityType?: string;
  confidence: number;
  placeholderTemplate: string;
  enabled: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}
```

### 9.2 Built-in Rules Examples

```javascript
// Email detection
{
  id: 'pii-email',
  name: 'Email Address',
  category: 'pii',
  type: 'regex',
  pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  confidence: 95,
  placeholderTemplate: '<EMAIL_{n}>',
  enabled: true
}

// Saudi National ID
{
  id: 'pii-saudi-id',
  name: 'Saudi National ID',
  category: 'pii',
  type: 'regex',
  pattern: /\b[12]\d{9}\b/g,
  confidence: 85,
  placeholderTemplate: '<NATIONAL_ID_{n}>',
  enabled: true
}

// IBAN
{
  id: 'pii-iban',
  name: 'IBAN',
  category: 'pii',
  type: 'regex',
  pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
  confidence: 90,
  placeholderTemplate: '<IBAN_{n}>',
  enabled: true
}

// IP Address
{
  id: 'tech-ip',
  name: 'IP Address',
  category: 'technical',
  type: 'regex',
  pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  confidence: 95,
  placeholderTemplate: '<IP_ADDRESS_{n}>',
  enabled: true
}

// Monetary amounts
{
  id: 'fin-money',
  name: 'Monetary Amount',
  category: 'financial',
  type: 'regex',
  pattern: /(?:SAR|USD|\$|£|€|ر\.س)\s*[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:SAR|USD|dollars?|riyals?)\b/gi,
  confidence: 80,
  placeholderTemplate: '<AMOUNT_{n}>',
  enabled: true
}
```

---

## 10. IPC API Specification (Main ↔ Renderer)

### 10.1 IPC Channels

```typescript
// File Operations
'dialog:openFile'     → Promise<{ filePath: string; buffer: Buffer } | null>
'dialog:saveFile'     → Promise<string | null>  // Returns saved path
'dialog:openFolder'   → Promise<string | null>  // For batch processing

// Document Processing
'document:scan'       → Promise<ScanResult>
'document:mask'       → Promise<MaskedDocument>
'document:preview'    → Promise<PreviewData>

// Configuration
'config:get'          → Promise<Config>
'config:set'          → Promise<void>
'config:export'       → Promise<void>  // Opens save dialog
'config:import'       → Promise<Config | null>
'config:reset'        → Promise<Config>

// Progress Events (Main → Renderer)
'processing:progress' → { stage: string; percent: number }
'processing:error'    → { message: string; details?: string }
'processing:complete' → { documentId: string }
```

### 10.2 Type Definitions

```typescript
// Scan Result
interface ScanResult {
  documentId: string;
  originalFileName: string;
  format: DocumentFormat;
  content: ContentBlock[];
  detections: Detection[];
  images: ImageInfo[];
  stats: ScanStats;
}

interface Detection {
  id: string;
  text: string;
  category: 'pii' | 'company' | 'financial' | 'technical' | 'custom';
  subcategory: string;
  confidence: number;
  position: { start: number; end: number; blockId: string };
  suggestedPlaceholder: string;
  context: string;  // Surrounding text for review
  approved: boolean;
}

interface ImageInfo {
  id: string;
  name: string;
  blockId: string;
  dimensions: { width: number; height: number };
  ocrText?: string;
  ocrDetections?: Detection[];
  action: 'keep' | 'remove' | 'blur' | 'pixelate' | 'ocr-mask';
}

interface ScanStats {
  totalDetections: number;
  byCategory: Record<string, number>;
  byConfidence: { high: number; medium: number; low: number };
  imagesFound: number;
  processingTimeMs: number;
}

// Masked Document
interface MaskedDocument {
  documentId: string;
  buffer: Buffer;
  format: DocumentFormat;
  mapping: EntityMapping[];
  stats: MaskingStats;
}

interface EntityMapping {
  placeholder: string;
  originalValues: string[];  // All variants that map to this
  category: string;
  occurrences: number;
}

// Configuration
interface Config {
  companyInfo: {
    primaryName: string;
    aliases: string[];
    domain: string;
    internalDomains: string[];
  };
  customEntities: {
    clients: NamedEntity[];
    projects: NamedEntity[];
    products: NamedEntity[];
    keywords: string[];
  };
  detectionSettings: {
    minConfidence: number;
    autoMaskHighConfidence: boolean;
    categoriesEnabled: string[];
    saudiSpecific: {
      detectNationalId: boolean;
      detectIqama: boolean;
      detectSaudiPhone: boolean;
      detectSaudiIban: boolean;
    };
  };
  imageHandling: {
    defaultAction: 'keep' | 'remove' | 'blur' | 'pixelate';
    ocrEnabled: boolean;
    ocrLanguages: string[];
    blurIntensity: number;
    pixelateBlockSize: number;
  };
  exportPreferences: {
    includeMappingFile: boolean;
    defaultFormat: 'same' | 'txt' | 'md';
    encryptMapping: boolean;
  };
}

interface NamedEntity {
  name: string;
  aliases: string[];
}

type DocumentFormat = 'txt' | 'md' | 'docx' | 'xlsx' | 'pdf' | 'csv' | 'json' | 'html';
```

### 10.3 Usage Examples

```typescript
// Renderer: Open and scan a file
const openAndScan = async () => {
  const file = await window.api.openFile();
  if (!file) return;
  
  const config = await window.api.getConfig();
  const result = await window.api.scanDocument(file.filePath, config);
  
  setDetections(result.detections);
  setImages(result.images);
};

// Renderer: Apply masking and save
const maskAndSave = async (approvedDetections: Detection[]) => {
  const masked = await window.api.applyMasking(documentId, approvedDetections);
  const savedPath = await window.api.saveFile(masked.buffer, `sanitized_${originalName}`);
  
  if (savedPath && config.exportPreferences.includeMappingFile) {
    // Mapping file saved alongside
  }
};

// Renderer: Listen for progress
useEffect(() => {
  window.api.onProgress((progress) => {
    setProcessingProgress(progress.percent);
    setProcessingStage(progress.stage);
  });
}, []);
```

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Detection accuracy (precision) | > 95% |
| Detection coverage (recall) | > 90% |
| False positive rate | < 10% |
| Processing time (avg document) | < 5 seconds |
| User configuration save rate | > 80% |
| Successful export rate | > 99% |

---

## 12. Future Enhancements (v2.0+)

1. **Batch Processing:** Upload multiple documents at once
2. **API Integration:** Direct integration with AI platforms
3. **Team Configurations:** Shared org-wide settings
4. **Audit Logging:** Track who sanitized what (enterprise)
5. **Reverse Mapping:** Re-hydrate documents with original values
6. **Browser Extension:** Right-click to sanitize selected text
7. **AI-Powered Detection:** ML model for context-aware detection
8. **Language Support:** Arabic NER and RTL document support
9. **Compliance Templates:** Pre-built profiles for GDPR, SAMA, PCI-DSS

---

## 13. Glossary

| Term | Definition |
|------|------------|
| PII | Personally Identifiable Information |
| NER | Named Entity Recognition |
| OCR | Optical Character Recognition |
| Placeholder Token | Replacement text for sensitive data (e.g., `<PERSON_1>`) |
| Masking | The act of replacing sensitive data with placeholders |
| Redaction | Permanent removal/blackout of sensitive data |
| Entity Consistency | Same real-world entity gets same placeholder throughout |

---

## 14. Appendix: Sample Configurations

### 14.1 Minimal Configuration (Quick Start)
```json
{
  "company_name": "MyCompany",
  "detection_categories": ["pii", "company"],
  "image_action": "remove"
}
```

### 14.2 Enterprise Configuration
```json
{
  "company_info": {
    "primary_name": "Saudi Fintech Corp",
    "aliases": ["SFC", "SaudiFintech", "سعودي فينتك"],
    "domain": "saudifintech.com",
    "internal_domains": [
      "gitlab.saudifintech.internal",
      "jira.saudifintech.internal"
    ]
  },
  "custom_entities": {
    "clients": [
      {"name": "Bank ABC", "aliases": ["BABC"]},
      {"name": "Insurance XYZ", "aliases": ["IXYZ"]}
    ],
    "projects": [
      {"name": "Project Falcon", "aliases": ["PF", "Falcon"]},
      {"name": "Initiative 2025", "aliases": ["I25"]}
    ],
    "products": [
      {"name": "PaymentGateway Pro", "aliases": ["PGP", "Gateway"]}
    ],
    "keywords": [
      "SAMA audit",
      "penetration test results",
      "vulnerability report"
    ]
  },
  "detection_settings": {
    "min_confidence": 75,
    "categories_enabled": ["pii", "company", "financial", "technical"],
    "saudi_specific": {
      "detect_national_id": true,
      "detect_iqama": true,
      "detect_saudi_phone": true,
      "detect_saudi_iban": true
    }
  },
  "image_handling": {
    "default_action": "remove",
    "ocr_enabled": true,
    "ocr_language": ["eng", "ara"]
  }
}
```

---

## 15. Development Phases

### Phase 1: Foundation & MVP (2-3 weeks) - COMPLETED
- [x] Initialize Electron + Vite + React + TypeScript project
- [x] Set up electron-builder configuration
- [x] Implement secure IPC bridge (preload script)
- [x] Native file open/save dialogs
- [x] File upload via drag-and-drop
- [x] Basic document parsing (TXT, MD)
- [x] Basic regex detection (email, phone, IP)
- [x] Simple configuration UI (company name, custom keywords)
- [x] Text preview with syntax highlighting
- [x] Zustand for config persistence (with localStorage)
- [x] Download sanitized document

### Phase 2: Document Support & Detection (2 weeks) - COMPLETED
- [x] DOCX parsing with mammoth, writing with docx
- [x] Excel (XLSX) support with ExcelJS
- [x] PDF support with pdf-parse and pdf-lib
- [x] NER integration (Compromise.js) for names/organizations
- [x] Financial pattern detection (amounts, IBANs, credit cards)
- [x] Saudi-specific patterns (National ID, Saudi phone)
- [x] Entity consistency engine (same entity = same token)
- [x] Detection confidence scoring
- [x] Mapping file export

### Phase 3: Image Handling & OCR (1-2 weeks) - COMPLETED
- [x] Image detection in DOCX documents (using JSZip)
- [x] Image extraction from DOCX word/media folder
- [x] Company logo detection with perceptual hashing (Sharp)
- [x] Tesseract.js integration for OCR
- [x] OCR text extraction from image files
- [x] Progress indicators for processing
- [ ] Remove/blur/pixelate options with Sharp
- [ ] Bundle Arabic + English trained data
- [ ] Text masking within images

### Phase 4: Polish & Distribution (2 weeks) - PARTIALLY COMPLETED
- [x] Configuration profiles (save/load/export/import)
- [x] Application menu bar (File, Edit, View, Help)
- [x] Recent documents list
- [x] Keyboard shortcuts
- [x] Comprehensive testing
- [x] User documentation
- [ ] Native notifications (processing complete)
- [ ] Auto-updater integration
- [ ] macOS notarization & code signing
- [ ] Windows code signing
- [ ] Linux AppImage/deb builds

### Phase 5: Advanced Features (Future)
- [ ] Batch processing (folder scan)
- [ ] Arabic language NER support
- [ ] Custom regex rule builder UI
- [ ] System tray mode
- [ ] Touch Bar support (macOS)
- [ ] Reverse mapping (re-hydrate documents)
- [ ] Encrypted mapping file export

---

*End of PRD*

