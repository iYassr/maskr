<p align="center">
  <img src="logos/final/maskr-logo-banner.svg" alt="maskr" width="500">
</p>

<p align="center">
  <strong>A privacy-focused desktop app for detecting and masking sensitive information in documents</strong>
</p>

<p align="center">
  <a href="#screenshots">Screenshots</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-formats">Formats</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/node-%3E%3D24-green" alt="Node Version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/electron-39-9feaf9" alt="Electron">
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React">
</p>

---

## Why maskr?

Before sharing documents with AI assistants, cloud services, or external parties, you need to ensure sensitive information is properly masked. maskr runs **100% locally** on your machine - no data ever leaves your device.

## Screenshots

### 1. Upload Your Document
Drag and drop or browse to select any supported document format. The sidebar shows what types of sensitive information will be detected.

<p align="center">
  <img src="screenshots/upload.png" alt="maskr Upload Screen" width="800">
</p>

### 2. Review Detections
See all detected sensitive information organized in a table with categories, confidence scores, replacements, and context. Filter by type and toggle items on/off.

<p align="center">
  <img src="screenshots/review.png" alt="maskr Review Screen" width="800">
</p>

### 3. Export Sanitized Document
Preview the sanitized document with all sensitive data replaced by placeholders. View a summary of masked items by category, then export.

<p align="center">
  <img src="screenshots/export.png" alt="maskr Export Screen" width="800">
</p>

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

### Smart Detection
- **Person Names** - Automatic NLP detection using compromise.js (first + last names)
- **Email Addresses** - Personal and corporate emails
- **Phone Numbers** - US, UK, Saudi, and international formats
- **Social Security Numbers** - US SSN format (XXX-XX-XXXX)
- **Saudi National IDs** - 10-digit IDs starting with 1 (citizens) or 2 (residents/Iqama)
- **Credit Cards** - With Luhn algorithm validation
- **IBANs** - International bank account numbers with validation
- **IP Addresses** - Both IPv4 and IPv6
- **URLs & Domains** - Full URLs and standalone domain names
- **Financial Amounts** - Currency symbols and amounts
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
1. Download `maskr-1.3.1-arm64-mac.zip` (Apple Silicon) or `maskr-1.3.1-mac.zip` (Intel)
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
- `maskr-1.3.1-setup.exe` - Standard installer
- `maskr-1.3.1-portable.exe` - Portable version (no installation required)

#### Linux
- `.AppImage` - Universal format, make executable with `chmod +x` and run
- `.deb` - For Debian/Ubuntu: `sudo dpkg -i maskr_1.3.1_amd64.deb`

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

<p align="center">
  Made with privacy in mind
</p>
