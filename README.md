<p align="center">
  <img src="logos/final/maskr-logo-banner.svg" alt="maskr - PII Detection and Document Sanitization Tool" width="500">
</p>

<h3 align="center">Never Leak Sensitive Data Again.</h3>

<p align="center">
  <strong>Open-source desktop & web app for PII detection, data masking, and document redaction. Protect personal information before sharing with AI, cloud services, or third parties.</strong>
</p>

<p align="center">
  <a href="#try-online">Try Online</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-formats">Formats</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20Web-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/node-%3E%3D24-green" alt="Node Version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/electron-39-9feaf9" alt="Electron">
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React">
</p>

<p align="center">
  <code>#pii-detection</code> <code>#data-masking</code> <code>#document-redaction</code> <code>#privacy-tool</code> <code>#gdpr-compliance</code> <code>#data-protection</code> <code>#sensitive-data</code> <code>#ocr</code> <code>#nlp</code> <code>#electron-app</code> <code>#web-app</code> <code>#open-source</code> <code>#offline-first</code>
</p>

---

## Demo

<p align="center">
  <img src="screenshots/demo.gif" alt="maskr demo" width="800">
</p>

## Try Online

**No installation required!** Try maskr directly in your browser:

<p align="center">
  <a href="https://iyassr.github.io/maskr/app/"><img src="https://img.shields.io/badge/Try%20maskr-Online-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Try Online"></a>
</p>

The web version runs 100% client-side in your browser - no data is sent to any server. It supports:
- Direct text input for quick sanitization
- File upload (TXT, MD, JSON, CSV, HTML, DOCX, XLSX, PDF)
- Image OCR (PNG, JPG, WebP)
- All 23 entity detection types (names, emails, phones, credit cards, IBANs, SSNs, passports, and more)

## Why maskr?

**The Problem:** Before sharing documents with ChatGPT, Claude, cloud services, or external parties, you need to ensure PII (Personally Identifiable Information) is properly masked. Manual redaction is time-consuming and error-prone.

**The Solution:** maskr automatically detects and masks sensitive data including names, emails, phone numbers, SSNs, credit cards, IBANs, and more. It runs **100% locally** on your machine - no data ever leaves your device. Perfect for GDPR compliance, HIPAA requirements, and privacy-conscious workflows.

### Use Cases
- **AI Safety** - Sanitize documents before uploading to ChatGPT, Claude, or other AI assistants
- **Data Sharing** - Remove PII before sharing with contractors, partners, or vendors
- **Compliance** - Meet GDPR, CCPA, HIPAA data protection requirements
- **Development** - Create anonymized test datasets from production data
- **Legal** - Redact sensitive information in legal documents

## Screenshots

### 1. Upload Your Document
Drag and drop or browse to select any supported document format. The sidebar shows what types of sensitive information will be detected.

| Dark Theme | Light Theme |
|------------|-------------|
| ![Upload Dark](screenshots/upload.png) | ![Upload Light](screenshots/upload-light.png) |

### 2. Review Detections
See all detected sensitive information organized in a table with categories, confidence scores, replacements, and context. Filter by type and toggle items on/off.

| Dark Theme | Light Theme |
|------------|-------------|
| ![Review Dark](screenshots/review.png) | ![Review Light](screenshots/review-light.png) |

### 3. Export Sanitized Document
Preview the sanitized document with all sensitive data replaced by placeholders. View a summary of masked items by category, then export.

| Dark Theme | Light Theme |
|------------|-------------|
| ![Export Dark](screenshots/export.png) | ![Export Light](screenshots/export-light.png) |

## Features

### Privacy First
- **100% Local Processing** - All analysis happens on your device
- **No Internet Required** - Works completely offline
- **No Telemetry** - Zero data collection or tracking
- **No Cloud Services** - Your documents stay on your machine

### User Experience
- **Direct Text Input** - Paste text directly without uploading a file
- **Light/Dark Theme** - Toggle between themes with persistent preference
- **Drag & Drop** - Simply drop files to start scanning

### Smart Detection (30+ Entity Types)
- **Person Names** - NLP detection for English names + 150+ Arabic names (Mohammed, Ahmed, Fatima, etc.)
- **Email Addresses** - Personal and corporate emails
- **Phone Numbers** - US, UK, Saudi (+966), UAE, and international formats
- **Social Security Numbers** - US SSN format (XXX-XX-XXXX)
- **Saudi National IDs** - 10-digit IDs starting with 1 (citizens) or 2 (residents/Iqama)
- **Credit Cards** - Visa, Mastercard, Amex, **Mada** (Saudi debit cards) with Luhn validation
- **IBANs** - SA (Saudi), AE (UAE), and international bank account numbers
- **IP Addresses** - Both IPv4 and IPv6
- **URLs & Domains** - Full URLs and standalone domain names
- **Financial Amounts** - USD, SAR, EUR, GBP, and 20+ currency formats
- **Dates of Birth** - Multiple date formats with context detection
- **MAC Addresses** - Network hardware identifiers
- **API Keys & Tokens** - AWS, Stripe, GitHub, and generic API keys
- **License Plates** - US, UK, Saudi, and EU formats
- **GPS Coordinates** - Latitude/longitude pairs
- **VIN Numbers** - Vehicle identification numbers
- **Custom Names** - Add your own names to detect (100% confidence)
- **Custom Keywords** - Define project-specific terms

### Advanced Capabilities
- **OCR Support** - Extract and scan text from images using Tesseract.js
- **Logo Detection** - Detect and remove company logos from DOCX files using perceptual hashing
- **Confidence Scores** - Each detection includes a confidence rating
- **Entity Consistency** - Same entity always maps to the same placeholder
- **Configuration Profiles** - Save and switch between detection settings

## Supported Formats

| Format | Parse | Export | OCR | Logo Detection |
|--------|-------|--------|-----|----------------|
| TXT    | Yes   | Yes    | -   | -              |
| MD     | Yes   | Yes    | -   | -              |
| JSON   | Yes   | Yes    | -   | -              |
| CSV    | Yes   | Yes    | -   | -              |
| HTML   | Yes   | Yes    | -   | -              |
| DOCX   | Yes   | Yes    | -   | Yes            |
| XLSX   | Yes   | Yes    | -   | -              |
| PDF    | Yes   | Yes    | -   | -              |
| PNG    | Yes   | -      | Yes | -              |
| JPG    | Yes   | -      | Yes | -              |
| WebP   | Yes   | -      | Yes | -              |

## Installation

### Download Pre-built Releases

Download the latest release for your platform from the [Releases page](https://github.com/iYassr/maskr/releases).

#### macOS
1. Download `maskr-1.3.15-arm64-mac.zip` (Apple Silicon) or `maskr-1.3.15-mac.zip` (Intel)
2. Extract the zip file
3. **Important:** Remove the quarantine flag before first run:
   ```bash
   xattr -cr /path/to/maskr.app
   ```
   For example, if extracted to Downloads:
   ```bash
   xattr -cr ~/Downloads/maskr.app
   ```
4. Drag to Applications folder (optional)

> **Why is this needed?** macOS quarantines apps downloaded from the internet. Since maskr is not yet notarized with Apple, you need to manually remove this flag.

#### Windows
- `maskr-1.3.15-setup.exe` - Standard installer
- `maskr-1.3.15-portable.exe` - Portable version (no installation required)

#### Linux
- `.AppImage` - Universal format, make executable with `chmod +x` and run
- `.deb` - For Debian/Ubuntu: `sudo dpkg -i maskr_1.3.15_amd64.deb`

---

### Build from Source

#### Prerequisites

- **Node.js** 24+ (LTS recommended)
- **npm** (comes with Node.js)

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/iYassr/maskr.git
cd maskr

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
# Build and package the application
npm run build
```

The packaged application will be available in the `release` directory.

### Platform-Specific Builds

The build process automatically creates installers for your current platform:
- **macOS**: `.dmg` file
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` and `.deb` packages

## Usage

### Basic Workflow

1. **Upload** - Drag and drop a document or click to browse
2. **Review** - See detected sensitive information with confidence scores
3. **Customize** - Toggle individual detections on/off
4. **Export** - Save the sanitized document

### Configuration Options

#### Custom Names & Keywords
Click the sliders icon to add:
- **Custom Names** - Employee names, client names, etc.
- **Custom Keywords** - Project names, confidential terms

These will be detected with 100% confidence.

#### Logo Detection (DOCX only)
1. Click the gear icon
2. Upload your company logo (PNG, JPG, WebP)
3. Adjust similarity threshold (default: 85%)
4. Enable detection

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + S` | Export sanitized document |
| `Cmd/Ctrl + 1` | Original view |
| `Cmd/Ctrl + 2` | Sanitized view |
| `Cmd/Ctrl + 3` | Side-by-side view |

## Detection Categories

| Category | Color | Examples |
|----------|-------|----------|
| **PII** | Red | Names, emails, phones, SSNs, Saudi IDs |
| **Company** | Blue | Organization names, logos |
| **Financial** | Green | Credit cards, IBANs, amounts |
| **Technical** | Purple | IP addresses, URLs, domains |
| **Custom** | Yellow | User-defined keywords |

## Configuration Profiles

maskr includes preset profiles:

- **Default** - Balanced detection for common PII
- **Strict** - Maximum detection, lower confidence threshold
- **Minimal** - Only emails and phone numbers

Create custom profiles via the Profiles menu.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Electron 39 | Cross-platform desktop |
| React 19 | UI framework |
| TypeScript 5 | Type safety |
| Vite 7 | Build tool |
| Tailwind CSS 4 | Styling |
| Zustand | State management |
| compromise | NLP for name detection |
| Tesseract.js | OCR engine |
| Sharp | Image processing |
| mammoth | DOCX parsing |
| ExcelJS | XLSX handling |
| pdf-lib | PDF handling |

## Troubleshooting

### macOS "App is damaged" Error
If you see "maskr.app is damaged and can't be opened", run:
```bash
xattr -cr /path/to/maskr.app
```
This removes the quarantine flag that macOS adds to downloaded apps.

### Node.js Version Error
```bash
# Using nvm
nvm install 24
nvm use 24
```

### Logo Detection Not Working
- Ensure Sharp is installed: `npm install sharp`
- Logo detection only works with DOCX files
- Try lowering the similarity threshold

### OCR Issues
- Use clear, high-resolution images
- Supported: PNG, JPG, JPEG, GIF, BMP, WebP, TIFF

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development

```bash
# Run in development mode
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR capabilities
- [Radix UI](https://www.radix-ui.com/) for accessible components
- [Tailwind CSS](https://tailwindcss.com/) for styling

---

## Keywords & Topics

<p align="center">
  <a href="https://github.com/topics/pii-detection"><img src="https://img.shields.io/badge/-PII%20Detection-red" alt="PII Detection"></a>
  <a href="https://github.com/topics/data-masking"><img src="https://img.shields.io/badge/-Data%20Masking-orange" alt="Data Masking"></a>
  <a href="https://github.com/topics/document-redaction"><img src="https://img.shields.io/badge/-Document%20Redaction-yellow" alt="Document Redaction"></a>
  <a href="https://github.com/topics/privacy"><img src="https://img.shields.io/badge/-Privacy-green" alt="Privacy"></a>
  <a href="https://github.com/topics/gdpr"><img src="https://img.shields.io/badge/-GDPR-blue" alt="GDPR"></a>
  <a href="https://github.com/topics/data-protection"><img src="https://img.shields.io/badge/-Data%20Protection-purple" alt="Data Protection"></a>
</p>

<p align="center">
  <a href="https://github.com/topics/electron"><img src="https://img.shields.io/badge/-Electron-9feaf9" alt="Electron"></a>
  <a href="https://github.com/topics/react"><img src="https://img.shields.io/badge/-React-61dafb" alt="React"></a>
  <a href="https://github.com/topics/typescript"><img src="https://img.shields.io/badge/-TypeScript-3178c6" alt="TypeScript"></a>
  <a href="https://github.com/topics/nlp"><img src="https://img.shields.io/badge/-NLP-ff6f61" alt="NLP"></a>
  <a href="https://github.com/topics/ocr"><img src="https://img.shields.io/badge/-OCR-4caf50" alt="OCR"></a>
  <a href="https://github.com/topics/desktop-app"><img src="https://img.shields.io/badge/-Desktop%20App-607d8b" alt="Desktop App"></a>
</p>

### Related Searches
- PII detection tool free download
- Mask sensitive data in PDF DOCX XLSX
- Document redaction software open source
- Remove personal information from documents
- GDPR compliance document sanitizer
- HIPAA compliant data masking
- Offline data masking tool
- Credit card number masker Mada Visa Mastercard
- SSN redaction software
- Email address anonymizer
- Phone number masking tool
- Saudi National ID detector (رقم الهوية)
- Iqama number masking (رقم الإقامة)
- Saudi IBAN masking tool (SA IBAN)
- Arabic name detection (أسماء عربية)
- Mada card number detector
- NLP name entity recognition
- OCR text extraction privacy
- Electron React TypeScript desktop app
- Data anonymization tool
- Personal data protection software
- Document sanitization before AI upload

---

<p align="center">
  <strong>maskr</strong> - Protect sensitive data before sharing documents
</p>

<p align="center">
  <sub>PII Detection • Data Masking • Document Redaction • Privacy Protection • GDPR Compliance • Offline Processing</sub>
</p>
