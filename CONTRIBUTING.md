# Contributing to maskr

Thank you for your interest in contributing to maskr! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check the [existing issues](https://github.com/iYassr/maskr/issues) to avoid duplicates
2. Update to the latest version to see if the issue persists

When reporting a bug, include:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (OS, Node.js version, etc.)
- Screenshots if applicable
- Sample files (with sensitive data removed) if relevant

### Suggesting Features

Feature suggestions are welcome! Please:
1. Check existing issues for similar suggestions
2. Provide a clear use case
3. Explain how the feature aligns with maskr's privacy-first mission

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following the coding standards below
4. **Test your changes**: `npm run typecheck && npm run lint`
5. **Commit with clear messages** (see commit guidelines)
6. **Push and create a Pull Request**

## Development Setup

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/maskr.git
cd maskr

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build and package for production |
| `npm run build:vite` | Build without packaging |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run Playwright tests |

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Prefer interfaces over type aliases for object shapes
- Use explicit return types for functions

### React

- Use functional components with hooks
- Keep components focused and small
- Use the existing UI components from `src/components/ui`

### Styling

- Use Tailwind CSS for styling
- Follow the existing color scheme and design patterns
- Maintain dark mode compatibility

### File Organization

```
src/
├── components/     # React components
│   └── ui/        # Reusable UI components
├── stores/        # Zustand stores
├── types/         # TypeScript type definitions
└── lib/           # Utility functions

electron/
├── services/      # Electron main process services
├── main.ts        # Main process entry
└── preload.ts     # Preload script
```

## Commit Guidelines

Use clear, descriptive commit messages:

```
feat: add SSN detection pattern
fix: correct credit card validation for Amex
docs: update installation instructions
refactor: simplify detection pipeline
test: add tests for XLSX export
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:headed
```

### Writing Tests

- Add tests for new detection patterns
- Test edge cases for document parsing
- Ensure export functionality works correctly

## Security Considerations

maskr handles sensitive documents. When contributing:

- **Never log sensitive data** in console or error messages
- **Don't add network requests** - all processing must remain local
- **Review regex patterns** for potential ReDoS vulnerabilities
- **Test with real-world data** (use your own test files)

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping make maskr better!
