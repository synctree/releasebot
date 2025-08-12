/**
 * Utility types for GitHub Action inputs and outputs
 * This file contains types specifically for action configuration and workflow integration
 */
import type { VersioningStrategy, AIProvider, VersionBumpType, SemanticVersion } from '../types/index.js';
/**
 * Input parameters for the GitHub Action
 * These correspond to the inputs defined in action.yml
 */
export interface ActionInputs {
    /** Repository owner (default: context.repo.owner) */
    owner: string;
    /** Repository name (default: context.repo.repo) */
    repo: string;
    /** Versioning strategy to use */
    'versioning-strategy': VersioningStrategy;
    /** AI provider for analysis */
    'ai-provider': AIProvider;
    /** Confidence threshold for AI analysis (0.0-1.0) */
    'ai-confidence-threshold': string;
    /** OpenAI API key */
    'openai-api-key': string;
    /** Anthropic API key */
    'anthropic-api-key': string;
    /** GitHub token for API access */
    'github-token': string;
    /** Base branch for comparison */
    'base-branch': string;
    /** Head branch for comparison */
    'head-branch': string;
    /** Enable debug mode */
    'debug-mode': string;
    /** Custom changelog template path */
    'changelog-template': string;
    /** Conventional commit types configuration */
    'conventional-types': string;
    /** Breaking change patterns */
    'breaking-patterns': string;
    /** Include pre-release versions */
    'include-prerelease': string;
    /** Custom version prefix */
    'version-prefix': string;
    /** Changelog output format */
    'changelog-format': string;
    /** Include commit links in changelog */
    'include-commit-links': string;
    /** Include author information */
    'include-authors': string;
    /** Maximum number of commits to analyze */
    'max-commits': string;
    /** AI model to use */
    'ai-model': string;
    /** AI temperature setting */
    'ai-temperature': string;
    /** AI max tokens */
    'ai-max-tokens': string;
    /** Custom AI prompt */
    'ai-prompt': string;
}
/**
 * Parsed and validated action inputs
 * This is the processed version of ActionInputs with proper types
 */
export interface ParsedActionInputs {
    /** Repository owner */
    owner: string;
    /** Repository name */
    repo: string;
    /** Versioning strategy to use */
    versioningStrategy: VersioningStrategy;
    /** AI provider for analysis */
    aiProvider: AIProvider;
    /** Confidence threshold for AI analysis */
    aiConfidenceThreshold: number;
    /** OpenAI API key */
    openaiApiKey?: string;
    /** Anthropic API key */
    anthropicApiKey?: string;
    /** GitHub token for API access */
    githubToken: string;
    /** Base branch for comparison */
    baseBranch: string;
    /** Head branch for comparison */
    headBranch: string;
    /** Enable debug mode */
    debugMode: boolean;
    /** Custom changelog template path */
    changelogTemplate?: string;
    /** Conventional commit types configuration */
    conventionalTypes?: Record<string, unknown>;
    /** Breaking change patterns */
    breakingPatterns: string[];
    /** Include pre-release versions */
    includePrerelease: boolean;
    /** Custom version prefix */
    versionPrefix: string;
    /** Changelog output format */
    changelogFormat: 'markdown' | 'json' | 'yaml';
    /** Include commit links in changelog */
    includeCommitLinks: boolean;
    /** Include author information */
    includeAuthors: boolean;
    /** Maximum number of commits to analyze */
    maxCommits: number;
    /** AI model to use */
    aiModel?: string;
    /** AI temperature setting */
    aiTemperature: number;
    /** AI max tokens */
    aiMaxTokens: number;
    /** Custom AI prompt */
    aiPrompt?: string;
}
/**
 * Output values from the GitHub Action
 * These correspond to the outputs defined in action.yml
 */
export interface ActionOutputs {
    /** Calculated version number */
    version: string;
    /** Type of version bump applied */
    'version-bump': VersionBumpType;
    /** Previous version number */
    'previous-version': string;
    /** Analysis strategy used */
    'analysis-strategy': VersioningStrategy;
    /** AI confidence score (if AI was used) */
    'ai-confidence': string;
    /** Generated changelog content */
    changelog: string;
    /** Analysis reasoning */
    reasoning: string;
    /** Number of changes detected */
    'changes-count': string;
    /** Breaking changes detected */
    'breaking-changes': string;
    /** Execution time in milliseconds */
    'execution-time': string;
    /** API cost estimate (if AI was used) */
    'api-cost': string;
    /** Tokens used (if AI was used) */
    'tokens-used': string;
    /** Analysis metadata as JSON */
    metadata: string;
    /** Whether this is a major release */
    'is-major': string;
    /** Whether this is a minor release */
    'is-minor': string;
    /** Whether this is a patch release */
    'is-patch': string;
    /** Git tag name for the release */
    'tag-name': string;
    /** Release notes in markdown */
    'release-notes': string;
    /** Contributors list */
    contributors: string;
    /** Files changed count */
    'files-changed': string;
    /** Commits analyzed count */
    'commits-analyzed': string;
}
/**
 * Structured output data before string conversion
 * This is used internally before converting to ActionOutputs
 */
export interface StructuredOutputs {
    /** Semantic version object */
    version: SemanticVersion;
    /** Type of version bump applied */
    versionBump: VersionBumpType;
    /** Previous semantic version */
    previousVersion: SemanticVersion;
    /** Analysis strategy used */
    analysisStrategy: VersioningStrategy;
    /** AI confidence score (if AI was used) */
    aiConfidence?: number;
    /** Generated changelog content */
    changelog: string;
    /** Analysis reasoning array */
    reasoning: string[];
    /** Number of changes detected */
    changesCount: number;
    /** Breaking changes detected */
    breakingChanges: boolean;
    /** Execution time in milliseconds */
    executionTime: number;
    /** API cost estimate (if AI was used) */
    apiCost?: number;
    /** Tokens used (if AI was used) */
    tokensUsed?: number;
    /** Analysis metadata */
    metadata: Record<string, unknown>;
    /** Git tag name for the release */
    tagName: string;
    /** Release notes in markdown */
    releaseNotes: string;
    /** Contributors list */
    contributors: string[];
    /** Files changed count */
    filesChanged: number;
    /** Commits analyzed count */
    commitsAnalyzed: number;
}
/** Input validation schema */
export interface InputValidationSchema {
    /** Field name */
    field: keyof ActionInputs;
    /** Whether the field is required */
    required: boolean;
    /** Default value if not provided */
    defaultValue?: string;
    /** Validation function */
    validator?: (value: string) => boolean;
    /** Error message for validation failure */
    errorMessage?: string;
    /** Transformation function */
    transformer?: (value: string) => unknown;
}
/** Input validation result */
export interface InputValidationResult {
    /** Whether validation passed */
    valid: boolean;
    /** Validation errors */
    errors: string[];
    /** Validation warnings */
    warnings: string[];
    /** Parsed inputs (if validation passed) */
    parsedInputs?: ParsedActionInputs;
}
/** GitHub workflow context information */
export interface WorkflowContext {
    /** Event that triggered the workflow */
    eventName: string;
    /** Repository information */
    repo: {
        owner: string;
        repo: string;
    };
    /** Git reference information */
    ref: string;
    /** SHA of the commit that triggered the workflow */
    sha: string;
    /** Workflow run ID */
    runId: number;
    /** Job ID */
    jobId: string;
    /** Actor who triggered the workflow */
    actor: string;
    /** Payload from the triggering event */
    payload: Record<string, unknown>;
}
/** Pull request context (when triggered by PR events) */
export interface PullRequestContext {
    /** PR number */
    number: number;
    /** Base branch */
    base: {
        ref: string;
        sha: string;
    };
    /** Head branch */
    head: {
        ref: string;
        sha: string;
    };
    /** PR title */
    title: string;
    /** PR description */
    body: string;
    /** PR author */
    user: {
        login: string;
    };
    /** Labels applied to the PR */
    labels: {
        name: string;
    }[];
}
/** Push context (when triggered by push events) */
export interface PushContext {
    /** Commit SHA before the push */
    before: string;
    /** Commit SHA after the push */
    after: string;
    /** Branch that was pushed to */
    ref: string;
    /** Commits included in the push */
    commits: {
        id: string;
        message: string;
        author: {
            name: string;
            email: string;
        };
        url: string;
    }[];
}
/** Action-specific error */
export interface ActionError extends Error {
    /** Error code for categorization */
    code: 'INPUT_VALIDATION' | 'API_ERROR' | 'ANALYSIS_FAILED' | 'CONFIG_ERROR' | 'UNKNOWN';
    /** Whether the error should fail the action */
    fatal: boolean;
    /** Additional context for debugging */
    context?: Record<string, unknown>;
    /** Suggested remedy */
    suggestion?: string;
}
/** Input validation error */
export interface InputValidationError extends ActionError {
    /** Field that failed validation */
    field: keyof ActionInputs;
    /** Provided value */
    value: string;
    /** Expected format */
    expected: string;
}
/** Environment variables expected by the action */
export interface ActionEnvironment {
    /** GitHub token */
    GITHUB_TOKEN: string;
    /** OpenAI API key */
    OPENAI_API_KEY?: string;
    /** Anthropic API key */
    ANTHROPIC_API_KEY?: string;
    /** GitHub repository */
    GITHUB_REPOSITORY: string;
    /** GitHub workspace path */
    GITHUB_WORKSPACE: string;
    /** GitHub event name */
    GITHUB_EVENT_NAME: string;
    /** GitHub event path */
    GITHUB_EVENT_PATH: string;
    /** GitHub actor */
    GITHUB_ACTOR: string;
    /** GitHub workflow */
    GITHUB_WORKFLOW: string;
    /** GitHub action */
    GITHUB_ACTION: string;
    /** GitHub ref */
    GITHUB_REF: string;
    /** GitHub SHA */
    GITHUB_SHA: string;
}
/** Action execution statistics */
export interface ActionStats {
    /** Start time */
    startTime: Date;
    /** End time */
    endTime: Date;
    /** Total execution time in milliseconds */
    duration: number;
    /** Memory usage peak in MB */
    memoryUsage: number;
    /** API calls made */
    apiCalls: number;
    /** Total API cost */
    totalCost: number;
    /** Cache hits */
    cacheHits: number;
    /** Cache misses */
    cacheMisses: number;
}
/** Configuration for action behavior */
export interface ActionConfig {
    /** Maximum execution time in milliseconds */
    maxExecutionTime: number;
    /** Maximum API cost allowed */
    maxApiCost: number;
    /** Enable caching */
    enableCaching: boolean;
    /** Cache TTL in seconds */
    cacheTtl: number;
    /** Retry configuration */
    retry: {
        attempts: number;
        delay: number;
        exponentialBackoff: boolean;
    };
    /** Rate limiting configuration */
    rateLimit: {
        requests: number;
        window: number;
    };
}
//# sourceMappingURL=types.d.ts.map