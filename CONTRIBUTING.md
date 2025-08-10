# Contributing to AI Release Tool

Thank you for your interest in contributing! This project aims to make release automation intelligent and accessible.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/synctree/releasebot.git
cd releasebot

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the action
pnpm run build
```

## Contributing Guidelines

### Code Style
- Follow TypeScript strict mode conventions
- Use ESLint configuration provided
- Write comprehensive tests for new features

### Testing
- All tests must pass: `pnpm test`
- Add tests for new analyzers and providers
- Test error scenarios and edge cases

### Pull Request Process
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `pnpm test`
5. Build to verify: `pnpm run build`
6. Submit a pull request

### Architecture
- Follow the plugin-based architecture
- Implement proper interfaces for analyzers and providers
- Use confidence scoring for AI-based decisions

## Development Workflow

Never commit directly to `main`. Always use feature branches and pull requests.

## Questions?

Open an issue or start a discussion!
