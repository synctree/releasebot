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
name: Release
on:
  workflow_dispatch:
    inputs:
      base_branch:
        description: 'Base branch for comparison'
        required: true
        default: 'main'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: synctree/ai-release-tool@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          base-branch: ${{ inputs.base_branch }}
```

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
