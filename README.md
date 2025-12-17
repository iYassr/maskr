# DocSanitizer

A local-first desktop application for detecting and masking sensitive information in documents before sharing with AI applications or other parties.

## Features

- **100% Local Processing**: All document analysis happens on your device - no data leaves your machine
- **Multi-Format Support**: Process TXT, MD, DOCX, XLSX, CSV, PDF, JSON, HTML files
- **Image OCR**: Extract and scan text from images (PNG, JPG, JPEG, GIF, BMP, WebP, TIFF)
- **Smart Detection**: Automatically detect PII including:
  - Email addresses
  - Phone numbers (US, UK, Saudi, international formats)
  - Social Security Numbers
  - Credit card numbers
  - Saudi National IDs
  - IBANs
  - IP addresses
  - AWS keys and API tokens
  - Person names (via NER)
  - Organization names (via NER)
  - And more...
- **Configurable Profiles**: Save and switch between detection profiles
- **Entity Consistency**: Same entity always maps to the same placeholder
- **Review & Edit**: Review detections before applying masks
- **Export Options**: Export sanitized documents in original format

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Development Setup

```bash
# Clone the repository
git clone https://github.com/iYassr/DocSanitizer.git
cd DocSanitizer

# Install dependencies
npm install

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

1. **Open a Document**: Click the upload area or drag and drop a file
2. **Review Detections**: See highlighted sensitive information with categories
3. **Customize**: Toggle individual detections on/off
4. **Export**: Save the sanitized document

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

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React 19**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool
- **Tailwind CSS 4**: Styling
- **Zustand**: State management
- **Tesseract.js**: OCR engine
- **compromise.js**: NER extraction
- **mammoth/docx**: DOCX handling
- **ExcelJS**: XLSX handling
- **pdf-parse/pdf-lib**: PDF handling

## Privacy

DocSanitizer is designed with privacy as a core principle:

- No internet connection required for processing
- No telemetry or analytics
- No cloud services
- All processing happens locally on your machine

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
