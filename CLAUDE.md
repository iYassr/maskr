# Claude Code Instructions for maskr

## Project Overview
maskr is an Electron desktop app for detecting and masking sensitive information in documents. Built with React 19, TypeScript, Vite 7, and Electron 39.

- **Owner**: iYassr (GitHub)
- **Repo**: https://github.com/iYassr/maskr
- **License**: MIT

## User Preferences
- **Be concise** - Short responses, get to the point
- **Act, don't ask** - Do the work, don't ask for permission on routine tasks
- **Test before claiming done** - User will verify manually, so make sure it actually works
- **Push when asked** - Only push/release when explicitly requested
- **No unnecessary files** - Don't create documentation unless asked
- **Use latest stable packages** - Always use current stable versions, not outdated or beta
- **Use shadcn/ui components** - Prefer built-in shadcn components when available, don't reinvent

## Things NOT To Do
- Don't refactor code unless explicitly asked
- Don't add comments/docstrings to code you didn't write
- Don't suggest "improvements" beyond what was requested
- Don't keep restarting dev server hoping it fixes things - rebuild instead
- Don't say "it should work now" without running tests first
- Don't create new files when you can edit existing ones

## Frequent Tasks

### "run it" / "start it"
```bash
npm run build:vite && npx electron dist-electron/main.js
```

### "test it"
```bash
npm run build:vite && npm test
```

### "push it"
```bash
git add -A && git commit -m "message" && git push origin main
```

### "release it" (full workflow)
1. Update version: `npm version X.Y.Z --no-git-tag-version`
2. Commit version bump
3. Build all platforms: `npm run build -- --mac --win --linux --x64 --arm64`
4. Rename Windows files (remove spaces)
5. Create tag: `git tag -a vX.Y.Z -m "Version X.Y.Z"`
6. Push tag: `git push origin vX.Y.Z`
7. Create GitHub release with all assets

## Known Issues
- **Windows filenames** - electron-builder creates files with spaces, must rename before GitHub upload
- **Dev mode stale builds** - Electron main process doesn't hot-reload, must rebuild
- **macOS quarantine** - Users need `xattr -cr` to run unsigned app
- **Port conflicts** - Dev server auto-increments port if 5173 is busy

## Critical Build/Test Workflow

### Before Telling User "It Works"
1. **Always rebuild before testing**: `npm run build:vite`
2. **Run tests to verify**: `npm test` (runs all 35 E2E tests)
3. **Never rely on dev mode for verification** - dev mode can have stale Electron builds

### Running the App
```bash
# For development with hot reload (renderer only - Electron main may be stale!)
npm run dev

# For reliable testing (builds everything fresh)
npm run build:vite && npx electron dist-electron/main.js
```

### Common Gotcha
`npm run dev` hot-reloads the React frontend but the **Electron main process** may use stale code. If user reports errors like "Failed to analyze text" or "Failed to parse document", the fix is usually:
```bash
npm run build:vite
```

## Release Workflow

### Before Tagging a Release
1. Update version in `package.json`: `npm version X.Y.Z --no-git-tag-version`
2. Commit the version bump
3. Then create tag: `git tag -a vX.Y.Z -m "Version X.Y.Z"`

### Building All Platforms
```bash
npm run build -- --mac --win --linux --x64 --arm64
```

### Release File Naming
- Avoid spaces in filenames (GitHub upload fails)
- Current naming convention:
  - macOS: `maskr-X.Y.Z-arm64-mac.zip`, `maskr-X.Y.Z-mac.zip`
  - Windows: `maskr-X.Y.Z-setup.exe`, `maskr-X.Y.Z-portable.exe`
  - Linux: `maskr-X.Y.Z.AppImage`, `maskr_X.Y.Z_amd64.deb`

### Uploading to GitHub
```bash
gh release create vX.Y.Z --title "maskr vX.Y.Z - Title" --notes "..." file1 file2 ...
```

## Testing

### Test Files Location
- `tests/e2e.spec.ts` - Core workflow tests (4 tests)
- `tests/comprehensive.spec.ts` - Extended tests (13 tests)
- `tests/all-formats.spec.ts` - Format-specific tests (12 tests)
- `tests/binary-formats.spec.ts` - DOCX/XLSX/PDF tests (6 tests)

### Running Tests
```bash
npm test                    # All tests
npx playwright test tests/e2e.spec.ts  # Specific file
```

## Key Dependencies (External in Vite Build)
These are marked as external in `vite.config.ts` and must be available at runtime:
- compromise (NLP for name detection)
- mammoth (DOCX parsing)
- exceljs (XLSX handling)
- pdfjs-dist, pdf-lib (PDF handling)
- tesseract.js (OCR)
- sharp (image processing)

## Project Structure

```
├── electron/           # Electron main process
│   ├── main.ts         # Main entry, IPC handlers
│   ├── preload.ts      # Preload script, exposes API to renderer
│   └── services/       # Core services
│       ├── detector.ts # PII detection logic (NER, regex patterns)
│       ├── document-parser.ts  # File format parsing
│       └── security.ts # Input validation
├── src/                # React renderer
│   ├── App.tsx         # Main app component
│   ├── components/     # UI components
│   │   ├── UploadStep.tsx    # File upload + text input
│   │   ├── ReviewStep.tsx    # Detection review table
│   │   └── ExportStep.tsx    # Export sanitized document
│   └── stores/         # Zustand state management
├── tests/              # Playwright E2E tests
├── release/            # Built packages (git-ignored)
└── dist-electron/      # Built Electron code
```

## Key Files to Know
- `electron/services/detector.ts` - All PII detection patterns (email, phone, SSN, etc.)
- `src/components/UploadStep.tsx` - Handles both file upload AND direct text input
- `vite.config.ts` - Build config, lists external dependencies
- `electron-builder.yml` - Package naming, build targets

## Lessons Learned
1. **Verify before declaring success** - Run tests, don't just start the app
2. **Rebuild on errors** - Most "failed to analyze/parse" errors are stale build issues
3. **Check version consistency** - package.json version must match git tag
4. **Test the actual build** - Use production build for user-facing verification
5. **Don't restart dev server repeatedly** - If something's broken, rebuild first
