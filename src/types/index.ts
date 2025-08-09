/**
 * Core type definitions for the AI Release Tool
 * This file contains all the interfaces and types used throughout the application
 */

// =============================================================================
// VERSION AND RELEASE TYPES
// =============================================================================

/** Semantic version components */
export interface SemanticVersion {
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
  /** Pre-release identifier (e.g., 'alpha', 'beta', 'rc') */
  prerelease?: string;
  /** Build metadata */
  build?: string;
}

/** Version bump types */
export type VersionBumpType = 'major' | 'minor' | 'patch' | 'none';

/** Version information with metadata */
export interface VersionInfo {
  /** Current version */
  current: SemanticVersion;
  /** Suggested next version */
  next: SemanticVersion;
  /** Type of version bump */
  bump: VersionBumpType;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Strategy used for analysis */
  strategy: VersioningStrategy;
}

/** Supported versioning strategies */
export type VersioningStrategy = 'conventional' | 'ai' | 'hybrid';

/** AI providers */
export type AIProvider = 'openai' | 'anthropic';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/** Main configuration for the release tool */
export interface ReleaseConfig {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Release strategy: conventional, ai, or hybrid */
  strategy: VersioningStrategy;
  /** AI provider to use */
  aiProvider?: AIProvider;
  /** Confidence threshold for AI analysis (0.0 - 1.0) */
  confidenceThreshold?: number;
  /** GitHub token for API access */
  githubToken?: string;
  /** OpenAI API key */
  openaiApiKey?: string;
  /** Anthropic API key */
  anthropicApiKey?: string;
  /** Debug mode flag */
  debugMode?: boolean;
  /** Custom changelog template path */
  changelogTemplate?: string;
  /** Conventional commit configuration */
  conventionalConfig?: ConventionalConfig;
}

/** Configuration for conventional commits analysis */
export interface ConventionalConfig {
  /** Custom commit types and their version impact */
  types: Record<string, ConventionalType>;
  /** Breaking change patterns */
  breakingPatterns: string[];
  /** Release notes sections */
  sections: ConventionalSection[];
}

/** Conventional commit type configuration */
export interface ConventionalType {
  /** Display name for the type */
  title: string;
  /** Version bump this type triggers */
  bump: VersionBumpType;
  /** Whether this type should appear in changelog */
  changelog: boolean;
  /** Section in changelog where this type appears */
  section?: string;
}

/** Conventional changelog section */
export interface ConventionalSection {
  /** Section identifier */
  type: string;
  /** Section title in changelog */
  title: string;
  /** Display order */
  order: number;
}

// =============================================================================
// CHANGELOG TYPES
// =============================================================================

/** Categories for organizing changelog entries */
export type ChangeCategory = 
  | 'breaking'     // Breaking changes
  | 'feat'         // New features
  | 'fix'          // Bug fixes
  | 'perf'         // Performance improvements
  | 'refactor'     // Code refactoring
  | 'docs'         // Documentation
  | 'style'        // Code style changes
  | 'test'         // Test updates
  | 'build'        // Build system changes
  | 'ci'           // CI/CD changes
  | 'chore'        // Maintenance tasks
  | 'revert'       // Reverts
  | 'deps';        // Dependency updates

/** Individual changelog entry */
export interface ChangelogEntry {
  /** Category of the change */
  category: ChangeCategory;
  /** Brief description of the change */
  description: string;
  /** Detailed description (optional) */
  details?: string;
  /** Commit SHA that introduced this change */
  commitSha: string;
  /** Commit author */
  author: string;
  /** Pull request number (if applicable) */
  pullRequest?: number;
  /** Breaking change flag */
  isBreaking: boolean;
  /** Scope of the change (e.g., 'auth', 'api', 'ui') */
  scope?: string;
  /** Related issues */
  issues?: number[];
  /** Confidence score for this entry (0.0 - 1.0) */
  confidence: number;
}

/** Complete changelog for a release */
export interface ChangelogData {
  /** Version being released */
  version: SemanticVersion;
  /** Release date */
  date: Date;
  /** Grouped changelog entries */
  entries: Record<ChangeCategory, ChangelogEntry[]>;
  /** Summary statistics */
  summary: ChangelogSummary;
  /** Raw markdown content */
  markdown: string;
}

/** Summary statistics for a changelog */
export interface ChangelogSummary {
  /** Total number of changes */
  totalChanges: number;
  /** Number of breaking changes */
  breakingChanges: number;
  /** Number of new features */
  features: number;
  /** Number of bug fixes */
  fixes: number;
  /** Number of contributors */
  contributors: number;
  /** List of contributor names */
  contributorNames: string[];
}

// =============================================================================
// GIT AND COMMIT TYPES
// =============================================================================

/** Git commit information */
export interface CommitInfo {
  /** Commit SHA */
  sha: string;
  /** Commit message */
  message: string;
  /** Commit author */
  author: {
    name: string;
    email: string;
    date: Date;
  };
  /** Committer (if different from author) */
  committer: {
    name: string;
    email: string;
    date: Date;
  };
  /** Files changed in this commit */
  files: GitFileChange[];
  /** Parent commit SHAs */
  parents: string[];
  /** Associated pull request */
  pullRequest?: PullRequestInfo;
}

/** Information about a pull request */
export interface PullRequestInfo {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR description */
  body: string;
  /** PR author */
  author: string;
  /** Merge commit SHA */
  mergeCommitSha?: string;
  /** Labels applied to the PR */
  labels: string[];
}

/** File change in a commit */
export interface GitFileChange {
  /** File path */
  path: string;
  /** Type of change */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Previous file path (for renames) */
  previousPath?: string;
}

/** Git diff information */
export interface GitDiff {
  /** Commits included in this diff */
  commits: CommitInfo[];
  /** Summary of all file changes */
  fileChanges: GitFileChange[];
  /** Total lines added */
  totalAdditions: number;
  /** Total lines deleted */
  totalDeletions: number;
  /** Date range of the diff */
  dateRange: {
    from: Date;
    to: Date;
  };
  /** Contributors in this diff */
  contributors: string[];
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

/** Result from version analysis */
export interface AnalysisResult {
  /** Suggested version bump */
  versionBump: VersionBumpType;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Strategy used for this analysis */
  strategy: VersioningStrategy;
  /** Human-readable reasoning */
  reasoning: string[];
  /** Generated changelog entries */
  changes: ChangelogEntry[];
  /** Analysis metadata */
  metadata: AnalysisMetadata;
  /** Execution time in milliseconds */
  executionTime: number;
}

/** Metadata about the analysis process */
export interface AnalysisMetadata {
  /** Timestamp when analysis was performed */
  timestamp: Date;
  /** Number of commits analyzed */
  commitsAnalyzed: number;
  /** Number of files changed */
  filesChanged: number;
  /** AI model used (if applicable) */
  aiModel?: string;
  /** API tokens consumed (if applicable) */
  tokensUsed?: number;
  /** Cost estimate in USD (if applicable) */
  estimatedCost?: number;
  /** Any warnings or issues during analysis */
  warnings: string[];
  /** Additional context used in analysis */
  context: Record<string, unknown>;
}

/** AI-specific analysis result */
export interface AIAnalysisResult extends AnalysisResult {
  /** AI model used */
  model: string;
  /** Prompt sent to AI */
  prompt: string;
  /** Raw AI response */
  rawResponse: string;
  /** Tokens used in the request */
  tokensUsed: number;
  /** Estimated cost of the API call */
  estimatedCost: number;
  /** Temperature used for the AI request */
  temperature: number;
}

/** Conventional commits analysis result */
export interface ConventionalAnalysisResult extends AnalysisResult {
  /** Parsed conventional commits */
  conventionalCommits: ConventionalCommit[];
  /** Invalid commits that couldn't be parsed */
  invalidCommits: CommitInfo[];
  /** Breaking changes detected */
  breakingChanges: BreakingChange[];
}

/** Parsed conventional commit */
export interface ConventionalCommit {
  /** Original commit info */
  commit: CommitInfo;
  /** Parsed type (feat, fix, etc.) */
  type: string;
  /** Scope of the change */
  scope?: string;
  /** Description */
  description: string;
  /** Body of the commit message */
  body?: string;
  /** Footer information */
  footer?: string;
  /** Breaking change flag */
  isBreaking: boolean;
  /** Breaking change description */
  breakingDescription?: string;
}

/** Breaking change information */
export interface BreakingChange {
  /** Commit that introduced the breaking change */
  commit: CommitInfo;
  /** Description of the breaking change */
  description: string;
  /** Migration guide or notes */
  migration?: string;
  /** Affected areas or modules */
  affected: string[];
}

// =============================================================================
// ANALYZER INTERFACES
// =============================================================================

/** Base interface for version analyzers */
export interface VersionAnalyzer {
  /** Analyze changes and determine version bump */
  analyze(changes: GitDiff): Promise<AnalysisResult>;
  /** Get the current confidence level */
  getConfidence(): number;
  /** Get the strategy name */
  getStrategy(): VersioningStrategy;
  /** Validate configuration */
  validateConfig(config: ReleaseConfig): boolean;
}

/** Context for analysis operations */
export interface AnalysisContext {
  /** Git diff to analyze */
  gitDiff: GitDiff;
  /** Current version */
  currentVersion: SemanticVersion;
  /** Release configuration */
  config: ReleaseConfig;
  /** Repository metadata */
  repository: RepositoryInfo;
  /** Previous release information */
  previousRelease?: ReleaseInfo;
}

/** Repository information */
export interface RepositoryInfo {
  /** Repository owner */
  owner: string;
  /** Repository name */
  name: string;
  /** Default branch */
  defaultBranch: string;
  /** Repository description */
  description?: string;
  /** Repository topics/tags */
  topics: string[];
  /** Programming languages used */
  languages: Record<string, number>;
  /** Repository size in bytes */
  size: number;
  /** Repository creation date */
  createdAt: Date;
  /** Last update date */
  updatedAt: Date;
}

/** Release information */
export interface ReleaseInfo {
  /** Release version */
  version: SemanticVersion;
  /** Release date */
  date: Date;
  /** Release notes */
  notes: string;
  /** Git tag name */
  tagName: string;
  /** Whether this is a pre-release */
  prerelease: boolean;
  /** Whether this is a draft */
  draft: boolean;
  /** Assets attached to the release */
  assets: ReleaseAsset[];
}

/** Release asset information */
export interface ReleaseAsset {
  /** Asset name */
  name: string;
  /** Download URL */
  downloadUrl: string;
  /** Content type */
  contentType: string;
  /** Size in bytes */
  size: number;
  /** Upload date */
  uploadedAt: Date;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/** Base error for the release tool */
export interface ReleaseError extends Error {
  /** Error code for programmatic handling */
  code: string;
  /** Additional error context */
  context?: Record<string, unknown>;
  /** Whether this error is recoverable */
  recoverable: boolean;
}

/** Analysis-specific errors */
export interface AnalysisError extends ReleaseError {
  /** Strategy that failed */
  strategy: VersioningStrategy;
  /** Fallback strategy to try */
  fallbackStrategy?: VersioningStrategy;
}

/** AI provider errors */
export interface AIProviderError extends ReleaseError {
  /** Provider that failed */
  provider: AIProvider;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** API error response */
  apiResponse?: unknown;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Configuration for different environments */
export interface EnvironmentConfig {
  development: Partial<ReleaseConfig>;
  staging: Partial<ReleaseConfig>;
  production: Partial<ReleaseConfig>;
}

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/** Progress callback for long-running operations */
export type ProgressCallback = (progress: {
  stage: string;
  percentage: number;
  message: string;
}) => void;

/** Options for various operations */
export interface OperationOptions {
  /** Whether to use verbose logging */
  verbose?: boolean;
  /** Whether to perform dry run */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Timeout in milliseconds */
  timeout?: number;
}
