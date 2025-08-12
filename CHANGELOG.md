# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-08-12

### Fixed
- Fixed "Git command failed: symbolic-ref refs/remotes/origin/HEAD" error in GitHub Actions environments (#3)
- Fixed "File not found: dist/index.js" error by committing distribution files (#7)
- Improved default branch detection with robust fallback strategies
- Enhanced repository validation to work in environments where symbolic-ref is not available

### Changed
- Repository validation now uses current branch or falls back to 'main' instead of relying solely on symbolic-ref
- Removed `dist/` from `.gitignore` to allow GitHub Actions distribution files to be committed

## [1.0.0] - 2025-08-10

### Added
- Initial release of ReleaseBot
- AI-powered release automation for GitHub Actions
- Automated changelog generation
- Semantic versioning support
- Release workflow management
- Git operations and repository validation