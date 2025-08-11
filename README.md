# AI Release Tool

An intelligent GitHub Action that automates release management using AI to analyze code changes and determine appropriate version bumps and changelog entries.

## Features

- 🤖 **AI-Powered Analysis**: Uses OpenAI to analyze git diffs and categorize changes
- 📈 **Semantic Versioning**: Automatically determines major, minor, or patch version bumps
- 📝 **Changelog Generation**: Creates formatted changelog entries following Keep a Changelog format
- 🔄 **Release Automation**: Creates release branches and manages the entire release workflow
- ✅ **GitHub Integration**: Seamlessly integrates with GitHub Actions and API

## Quick Start

```yaml
name: Create Release
on:
  workflow_dispatch:
    inputs:
      feature_branch:
        description: 'Branch to create release from'
        required: true
        default: 'develop'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: synctree/releasebot@v1
        with:
          feature-branch: ${{ inputs.feature_branch }}
          main-branch: 'main'
          versioning-strategy: 'hybrid'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

## Usage

### Basic Usage Patterns

The AI Release Tool analyzes changes between two branches to determine version bumps and generate changelogs. The key concept is comparing a **feature branch** (containing new changes) against a **main branch** (the baseline).

#### 1. Manual Release Creation (Recommended)

Create an interactive workflow for on-demand releases:

```yaml
name: Create Release
on:
  workflow_dispatch:
    inputs:
      feature_branch:
        description: 'Branch to create release from'
        required: true
        default: 'develop'
      versioning_strategy:
        description: 'How to determine version bump'
        required: true
        default: 'hybrid'
        type: choice
        options:
          - conventional
          - ai
          - hybrid

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for proper git diff analysis
      
      - uses: synctree/releasebot@v1
        with:
          feature-branch: ${{ inputs.feature_branch }}
          main-branch: 'main'
          versioning-strategy: ${{ inputs.versioning_strategy }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

**Team Usage:**
1. Go to Actions → "Create Release"
2. Enter branch name (e.g., `feature/new-dashboard`)
3. Select versioning strategy
4. Click "Run workflow"

#### 2. Pull Request Analysis

Automatically analyze PRs to preview release impact:

```yaml
name: Analyze PR Impact
on:
  pull_request:
    types: [opened, synchronize]
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: synctree/releasebot@v1
        id: analysis
        with:
          feature-branch: ${{ github.head_ref }}
          main-branch: ${{ github.base_ref }}
          versioning-strategy: 'ai'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🚀 Release Impact Analysis
              
              **Version Bump:** \`${{ steps.analysis.outputs.version-bump }}\`
              **New Version:** \`${{ steps.analysis.outputs.version }}\`
              **Strategy:** ${{ steps.analysis.outputs.analysis-strategy }}
              **AI Confidence:** ${{ steps.analysis.outputs.ai-confidence }}
              
              **Changes:**
              ${{ steps.analysis.outputs.changelog-entry }}
              `
            })
```

#### 3. Scheduled Releases

Automate regular releases from your development branch:

```yaml
name: Weekly Release
on:
  schedule:
    - cron: '0 10 * * 1'  # Every Monday at 10 AM
  workflow_dispatch:      # Allow manual trigger

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: synctree/releasebot@v1
        with:
          feature-branch: 'develop'
          main-branch: 'main'
          versioning-strategy: 'hybrid'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

### Branching Strategy Examples

#### GitFlow Integration

```yaml
# Release from develop branch
- uses: synctree/releasebot@v1
  with:
    feature-branch: 'develop'    # All integrated features
    main-branch: 'main'          # Last production release
    versioning-strategy: 'conventional'
```

#### Feature Branch Workflow

```yaml
# Release specific feature
- uses: synctree/releasebot@v1
  with:
    feature-branch: 'feature/user-auth'  # Specific feature
    main-branch: 'main'                  # Production baseline
    versioning-strategy: 'ai'
```

#### Trunk-based Development

```yaml
# Release from main/trunk
- uses: synctree/releasebot@v1
  with:
    feature-branch: 'main'       # Current trunk state
    main-branch: 'release/v1.0'  # Last release tag
    versioning-strategy: 'hybrid'
```

### Versioning Strategies

#### Conventional Commits
Uses semantic commit messages to determine version bumps:
```yaml
versioning-strategy: 'conventional'
# feat: → minor version bump
# fix: → patch version bump  
# BREAKING CHANGE: → major version bump
```

#### AI-Powered Analysis
Uses OpenAI to analyze code changes and determine impact:
```yaml
versioning-strategy: 'ai'
openai-api-key: ${{ secrets.OPENAI_API_KEY }}
# Analyzes actual code changes, not just commit messages
# Provides reasoning for decisions
```

#### Hybrid (Recommended)
Combines both approaches with confidence scoring:
```yaml
versioning-strategy: 'hybrid'
ai-confidence-threshold: 0.8
# Uses AI when confident, falls back to conventional commits
# Best of both worlds with reliability
```

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `feature-branch` | Branch containing changes to analyze | ✅ | - |
| `main-branch` | Baseline branch for comparison | | `main` |
| `versioning-strategy` | `conventional`, `ai`, or `hybrid` | | `hybrid` |
| `github-token` | GitHub API token | | `${{ github.token }}` |
| `openai-api-key` | OpenAI API key (required for AI strategies) | | - |
| `package-json-path` | Path to package.json | | `./package.json` |
| `changelog-path` | Path to CHANGELOG.md | | `./CHANGELOG.md` |
| `ai-model` | OpenAI model to use | | `gpt-4` |
| `ai-confidence-threshold` | Minimum AI confidence (0.0-1.0) | | `0.8` |
| `skip-changelog` | Skip changelog generation | | `false` |
| `debug-mode` | Enable verbose logging | | `false` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `version` | Calculated new version (e.g., `1.2.3`) |
| `version-bump` | Type of version bump (`major`, `minor`, `patch`) |
| `release-branch` | Created release branch name |
| `changelog-entry` | Generated changelog content |
| `analysis-strategy` | Strategy used for analysis |
| `ai-confidence` | AI confidence score (if applicable) |
| `reasoning` | Human-readable reasoning for decisions |
| `commit-count` | Number of commits analyzed |
| `breaking-changes` | Whether breaking changes were detected |

### Team Workflow Examples

#### Release Manager Workflow
```bash
# 1. Weekly release planning
Actions → "Create Release" → Input: "develop" → Run

# 2. Feature-specific release  
Actions → "Create Release" → Input: "feature/payments" → Run

# 3. Hotfix release
Actions → "Create Release" → Input: "hotfix/security-patch" → Run
```

#### Developer Workflow
```bash
# 1. Create feature branch
git checkout -b feature/user-dashboard

# 2. Make changes with conventional commits
git commit -m "feat: add user dashboard with analytics"
git commit -m "fix: resolve dashboard loading issue"

# 3. Push and create PR (automatic analysis via PR workflow)
git push origin feature/user-dashboard

# 4. When ready for release, team uses manual workflow
```

### Best Practices

1. **Use `fetch-depth: 0`** in checkout for proper git history
2. **Set up secrets** for `OPENAI_API_KEY` in repository settings
3. **Use conventional commits** for better analysis accuracy
4. **Test with `hybrid` strategy** for optimal reliability
5. **Review generated changelogs** before finalizing releases
6. **Set appropriate AI confidence thresholds** for your team's needs

## Development

### Prerequisites

- Node.js 22.12.0 (managed via [mise](https://mise.jdx.dev/))
- pnpm 10.14.0

### Development Tools

- **TypeScript**: 5.9.2 with strict configuration
- **Bundler**: @vercel/ncc for GitHub Actions optimization  
- **Testing**: Jest 30.0.5 with TypeScript support
- **Linting**: typescript-eslint 8.39.0 with modern flat config
- **Formatting**: Prettier with consistent style rules

### Setup

```bash
# Install mise and configure Node.js version
mise install

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Build the action
pnpm build

# Lint and format code
pnpm lint
pnpm format
```

## Development Workflow

### Pre-commit Hooks

This project uses [Husky](https://github.com/typicode/husky) and [lint-staged](https://github.com/okonet/lint-staged) to automatically lint and format code before commits:

- **ESLint**: Automatically fixes linting issues
- **Prettier**: Formats code according to project standards

The pre-commit hook runs automatically when you commit changes. If you need to bypass it temporarily (not recommended), use:

```bash
git commit --no-verify -m "your message"
```

### Manual Formatting

```bash
# Run linting with auto-fix
pnpm lint:fix

# Format all files
pnpm format

# Check formatting without changes
pnpm format:check
```

### Project Structure

```
src/
├── main.ts              # Entry point
├── types/               # TypeScript type definitions
├── core/                # Core business logic (future)
├── ai/                  # AI analysis modules (future)
├── git/                 # Git operations (future)
├── changelog/           # Changelog management (future)
└── __tests__/           # Test files
```

## License

MIT
