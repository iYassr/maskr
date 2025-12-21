# Changelog

All notable changes to maskr will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-12-21

### Added
- **NLP-Based Name Detection** - Automatic detection of full names (first + last) using compromise.js
  - Works with hyphenated names (Sarah Johnson-Williams)
  - Works with apostrophes (Michael O'Brien)
  - Works with multicultural names (Ahmed Al-Rashid, Maria Garcia-Lopez)
  - Titles supported (Dr., Prof., Mr., Ms.)
  - Single names filtered to reduce false positives
  - False positive filtering for common words (Provider, Owner, Company, etc.)
- **Saudi ID Detection** - Detect Saudi National IDs and Iqama numbers
  - 10-digit numbers starting with 1 (citizens)
  - 10-digit numbers starting with 2 (residents/Iqama)
- **URL Detection** - Full URLs (http://, https://, ftp://)
- **Domain Detection** - Standalone domain names (google.com, api.company.io)
- **Duplicate Detection** - All occurrences of same sensitive data now detected (was previously deduplicated)
- **Compare View Improvements**
  - Compare view now default on export screen
  - Red highlighting for original sensitive data
  - Green highlighting for sanitized placeholders
  - Both panels independently scrollable

### Changed
- Renamed `ner.ts` to `detector.ts` (more accurate naming)
- Updated Gruvbox theme with orange accent color (#fe8019)
- App icon now shows in development mode (macOS dock and window)
- E2E test updated to check for SVG logo instead of h1

### Fixed
- Trailing punctuation (commas, colons) stripped from detected names
- Fixed duplicate detection for emails, phones, credit cards, IBANs

## [1.1.0] - 2024-12-19

### Added
- Comprehensive README with badges and feature documentation
- MIT LICENSE file
- CONTRIBUTING.md with contribution guidelines
- GitHub issue and PR templates
- CHANGELOG.md for version tracking
- ESLint configuration for code quality

### Changed
- Optimized bundle size (16% reduction)
  - Replaced lucide-react (44MB) with custom SVG icons (~5KB)
  - Replaced pdf-parse with unpdf for lighter PDF processing
  - Removed unused dependencies (CodeMirror, daisyui, sonner, next-themes)
- Updated screenshots with localized Saudi Arabian data
- Moved documentation to `docs/` folder
- Cleaned up debug console.log statements

### Fixed
- DOCX export now creates proper binary documents
- SortableHeader component moved outside render to fix React warnings
- Removed unused variables causing lint warnings

## [1.0.0] - 2024-12-19

### Added
- Initial public release
- **Document Support**: Parse and export TXT, MD, JSON, CSV, HTML, DOCX, XLSX, PDF
- **OCR Support**: Extract text from images (PNG, JPG, JPEG, GIF, BMP, WebP, TIFF) using Tesseract.js
- **Logo Detection**: Detect and remove company logos from DOCX files using perceptual hashing
- **Smart Detection**: Automatically detect sensitive information
  - Email addresses
  - Phone numbers (US, UK, Saudi, international formats)
  - Credit card numbers (with Luhn validation)
  - Social Security Numbers
  - IBANs (with structure validation)
  - IP addresses (IPv4 and IPv6)
  - AWS keys and API tokens
- **Custom Detection**: Add custom names and keywords
- **Configuration Profiles**: Save and switch between detection profiles
  - Default profile for balanced detection
  - Strict profile for maximum detection
  - Minimal profile for contacts only
- **Entity Consistency**: Same entity always maps to the same placeholder
- **Confidence Scores**: Each detection includes a confidence rating
- **Privacy First**: 100% local processing, no data leaves the device
- **Cross-Platform**: Support for macOS, Windows, and Linux
- **Keyboard Shortcuts**: Quick access to common actions

### Technical
- Built with Electron 39, React 19, TypeScript 5
- Vite 7 for fast development and building
- Tailwind CSS 4 for styling
- Zustand for state management with persistence
- Optimized bundle size (replaced heavy dependencies with lightweight alternatives)

---

## Future Releases

### Planned Features
- Additional document format support
- Batch processing for multiple files
- Custom regex pattern support
- Export mapping table
- Improved PDF text extraction

[1.0.0]: https://github.com/iYassr/maskr/releases/tag/v1.0.0
[1.1.0]: https://github.com/iYassr/maskr/releases/tag/v1.1.0
[1.2.0]: https://github.com/iYassr/maskr/releases/tag/v1.2.0
