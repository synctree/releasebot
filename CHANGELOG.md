# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-08-12

### Fixed

- **GitHub Actions Compatibility**: Fixed git symbolic-ref error that prevented the action from working in GitHub Actions environments ([#3](https://github.com/synctree/releasebot/issues/3))
  - Replaced problematic `git symbolic-ref refs/remotes/origin/HEAD` command with robust fallback mechanism
  - Added graceful handling when symbolic reference is not available (common in GitHub Actions checkout)
  - Implemented safe default branch detection with fallback to 'main' branch
  - Improved error handling and debugging for git repository validation

### Technical Details

The issue occurred because GitHub Actions' `actions/checkout` does not automatically set up the symbolic reference `refs/remotes/origin/HEAD` that points to the default branch. The previous implementation assumed this reference would always exist, causing the action to fail during repository validation.

**Before (problematic code):**
```typescript
const defaultBranch = this.executeGitCommand('symbolic-ref refs/remotes/origin/HEAD')
  .replace('refs/remotes/origin/', '')
  .trim();
```

**After (robust fix):**
```typescript
let defaultBranch = 'main'; // Safe fallback
try {
  // Try to get the current branch if available
  const currentBranch = this.executeGitCommand('rev-parse --abbrev-ref HEAD').trim();
  if (currentBranch !== '' && currentBranch !== 'HEAD') {
    defaultBranch = currentBranch;
  }
} catch {
  // If we can't get current branch, stick with 'main' fallback
  core.debug('Could not determine current branch, using "main" as default');
}
```

### Impact

- ✅ The action now works properly in standard GitHub Actions workflows
- ✅ No breaking changes - existing workflows will continue to work
- ✅ Improved reliability across different git repository configurations
- ✅ Better debugging information when git operations fail

### Upgrade Instructions

No action required from users. Simply update your workflow to use `synctree/releasebot@v1.0.1` or `synctree/releasebot@v1` to get the fix automatically.

**Example workflow update:**
```yaml
- uses: synctree/releasebot@v1.0.1  # or @v1
  with:
    feature-branch: 'develop'
    main-branch: 'main'
    versioning-strategy: 'hybrid'
    github-token: ${{ secrets.GITHUB_TOKEN }}
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

## [1.0.0] - 2025-08-10

### Added

- 🤖 **AI-Powered Release Analysis**: Intelligent changelog generation and version bump determination using OpenAI
- 📈 **Semantic Versioning**: Automatic major, minor, and patch version bump detection
- 📝 **Changelog Generation**: Formatted changelog entries following Keep a Changelog format
- 🔄 **Multi-Strategy Versioning**: Support for conventional commits, AI analysis, and hybrid approaches
- ✅ **GitHub Integration**: Seamless integration with GitHub Actions and API
- 🎯 **Branch Management**: Automated release branch creation and management
- 🛡️ **Repository Validation**: Git repository state and permissions validation
- 🎨 **Flexible Configuration**: Comprehensive input options for different workflow needs

### Features

#### Versioning Strategies
- **Conventional Commits**: Parse semantic commit messages for version bumps
- **AI Analysis**: Use OpenAI to analyze actual code changes and determine impact
- **Hybrid Mode**: Combine both approaches with confidence scoring for optimal reliability

#### AI Capabilities
- Analyzes git diffs to understand the scope and impact of changes
- Generates human-readable explanations for versioning decisions
- Provides confidence scores for AI-driven decisions
- Supports multiple AI models (GPT-4, GPT-3.5-turbo)

#### GitHub Actions Integration
- Comprehensive input/output support for workflow automation
- Supports manual triggers, PR analysis, and scheduled releases
- Compatible with multiple branching strategies (GitFlow, feature branches, trunk-based)
- Automatic release branch creation and management

#### Changelog Management
- Generates formatted changelog entries
- Supports Keep a Changelog format
- Categorizes changes by type (Added, Changed, Fixed, etc.)
- Includes commit references and contributor information

### Initial Release Capabilities

This first release provides a complete release automation solution for GitHub repositories, with intelligent AI-powered analysis to reduce manual effort in determining version bumps and creating release notes.

Perfect for teams wanting to automate their release process while maintaining high-quality, informative changelogs and proper semantic versioning.

[1.0.1]: https://github.com/synctree/releasebot/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/synctree/releasebot/releases/tag/v1.0.0