# DocSanitizer

A local-first desktop application for detecting and masking sensitive information in documents before sharing with AI applications or other parties.

## Features

- **100% Local Processing**: All document analysis happens on your device - no data leaves your machine
- **Multi-Format Support**: Process TXT, MD, DOCX, XLSX, CSV, PDF, JSON, HTML files
- **Image OCR**: Extract and scan text from images (PNG, JPG, JPEG, GIF, BMP, WebP, TIFF) using Tesseract.js
- **Company Logo Detection**: Upload your company logo and automatically detect/remove it from DOCX files using perceptual hashing
- **Smart Detection**: Automatically detect PII including:
  - Email addresses
  - Phone numbers (US, UK, Saudi, international formats)
  - Social Security Numbers
  - Credit card numbers (with Luhn validation)
  - Saudi National IDs
  - IBANs (with structure validation)
  - IP addresses (IPv4 and IPv6)
  - AWS keys and API tokens
  - Person names (via custom names list)
  - And more...
- **Custom Detection**: Add your own keywords, names, and patterns to detect
- **Configurable Profiles**: Save and switch between detection profiles
- **Entity Consistency**: Same entity always maps to the same placeholder
- **Review & Edit**: Review detections with confidence scores before applying masks
- **Export Options**: Export sanitized documents in original format

## Installation

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm or yarn

### Development Setup

```bash
# Clone the repository
git clone https://github.com/iYassr/DocSanitizer.git
cd DocSanitizer

# Install dependencies
npm install

# If using nvm, ensure correct Node version
nvm use 22

# Start development server
npm run dev
```

### Building for Production

```bash
# Build the application
npm run build

# Or build without packaging
npm run build:vite
```

The packaged application will be in the `release` directory.

## Usage

1. **Configure Settings** (Optional):
   - Click the sliders icon to add custom names and keywords
   - Click the gear icon to configure logo detection

2. **Open a Document**: Click the upload area or drag and drop a file

3. **Review Detections**: See highlighted sensitive information with categories and confidence scores

4. **Customize**: Toggle individual detections on/off, filter by category

5. **Export**: Save the sanitized document

### Logo Detection Setup

1. Click the gear icon in the upload step
2. Upload your company logo (PNG, JPG, WebP)
3. Adjust the similarity threshold (default 85%)
4. Enable logo detection
5. When processing DOCX files, matching logos will be detected and can be replaced

### Custom Names & Keywords

1. Click the sliders icon in the upload step
2. Add custom names (employee names, client names, etc.)
3. Add custom keywords (project names, confidential terms, etc.)
4. These will be detected with 100% confidence

### Keyboard Shortcuts

- `Cmd/Ctrl + O`: Open file
- `Cmd/Ctrl + S`: Export sanitized document
- `Cmd/Ctrl + 1`: Show original view
- `Cmd/Ctrl + 2`: Show sanitized view
- `Cmd/Ctrl + 3`: Side by side view
- `Cmd/Ctrl + ,`: Open preferences (macOS)

## Configuration Profiles

DocSanitizer comes with built-in profiles:

- **Default**: Balanced detection for common PII
- **Strict (All PII)**: Maximum detection, lower confidence threshold
- **Minimal (Contacts Only)**: Only detect emails and phone numbers

You can also create custom profiles via the Profiles menu.

## Detection Categories

| Category | Examples | Color |
|----------|----------|-------|
| PII (Personal) | Names, emails, phones, IDs | Red |
| Company | Organization names, logos | Blue |
| Financial | Currency amounts, IBANs, credit cards | Green |
| Technical | IP addresses, API keys, URLs | Purple |
| Custom | User-defined keywords | Yellow |

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React 19**: UI framework
- **TypeScript**: Type-safe development
- **Vite 7**: Fast build tool
- **Tailwind CSS 4**: Styling
- **Zustand**: State management with persistence
- **Tesseract.js**: OCR engine for image text extraction
- **Sharp**: Image processing for logo detection
- **compromise.js**: NER extraction
- **mammoth/docx**: DOCX handling
- **JSZip**: DOCX image extraction
- **ExcelJS**: XLSX handling
- **pdf-parse/pdf-lib**: PDF handling

## Privacy

DocSanitizer is designed with privacy as a core principle:

- No internet connection required for processing
- No telemetry or analytics
- No cloud services
- All processing happens locally on your machine
- Configuration stored locally using encrypted storage

## Troubleshooting

### Node.js Version Error
If you see "Vite requires Node.js version 20.19+ or 22.12+":
```bash
# Using nvm
nvm install 22
nvm use 22
```

### Logo Detection Not Working
- Ensure Sharp is installed correctly (`npm install sharp`)
- Logo detection only works with DOCX files
- Try adjusting the similarity threshold (lower = more matches)

### OCR Not Extracting Text
- OCR requires Tesseract.js trained data
- For best results, use clear, high-resolution images
- Supported formats: PNG, JPG, JPEG, GIF, BMP, WebP, TIFF

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
