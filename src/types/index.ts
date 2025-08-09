/**
 * Type definitions for the AI Release Tool
 * These will be expanded in subsequent issues
 */

export interface ReleaseConfig {
  /** OpenAI API key for AI analysis */
  openaiApiKey: string;
  /** GitHub token for API access */
  githubToken: string;
  /** Base branch for comparison */
  baseBranch: string;
  /** Head branch for comparison */
  headBranch: string;
}

export interface VersionBumpType {
  /** Major version bump (breaking changes) */
  major: boolean;
  /** Minor version bump (new features) */
  minor: boolean;
  /** Patch version bump (bug fixes) */
  patch: boolean;
}

export interface ChangelogEntry {
  /** Type of change */
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore' | 'breaking';
  /** Description of the change */
  description: string;
  /** Breaking change flag */
  breaking: boolean;
}
