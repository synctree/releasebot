/**
 * ReleaseWorkflow - Main orchestrator for the AI Release Tool
 *
 * This class coordinates all the core modules to execute a complete release workflow:
 * 1. Git operations - analyze changes and commits
 * 2. Version analysis - determine appropriate version bump
 * 3. AI analysis - categorize changes and generate descriptions
 * 4. Changelog management - update CHANGELOG.md
 * 5. Git operations - create release branch and commit changes
 */
import type { VersionBumpType, ChangelogData } from './types/index.js';
/**
 * Configuration for the release workflow
 */
export interface WorkflowConfig {
    mainBranch: string;
    featureBranch: string;
    githubToken: string;
    packageJsonPath: string;
    changelogPath: string;
    versioningStrategy: 'conventional' | 'ai' | 'hybrid';
    aiProvider: 'openai' | 'anthropic';
    openaiApiKey?: string;
    anthropicApiKey?: string;
    aiModel: string;
    aiConfidenceThreshold: number;
    conventionalTypes: string[];
    preRelease: boolean;
    preReleaseIdentifier: string;
    skipChangelog: boolean;
    skipGitTag: boolean;
    maxCommitsAnalysis: number;
    debugMode: boolean;
}
/**
 * Result of the release workflow execution
 */
export interface ReleaseResult {
    version: string;
    releaseBranch: string;
    versionBump: VersionBumpType;
    changelogEntry: string;
    analysisStrategy: string;
    aiConfidence: number | undefined;
    reasoning: string[];
    commitCount: number;
    breakingChanges: boolean;
    changelogData: ChangelogData | undefined;
}
/**
 * Custom error class for workflow-related operations
 */
export declare class WorkflowError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown> | undefined;
    readonly recoverable: boolean;
    constructor(message: string, code: string, context?: Record<string, unknown>, recoverable?: boolean);
}
/**
 * Main Release Workflow Class
 *
 * Orchestrates the complete release process by coordinating git operations,
 * version analysis, AI-powered change categorization, and changelog management.
 */
export declare class ReleaseWorkflow {
    private readonly config;
    private readonly gitOps;
    private readonly versionAnalyzer;
    private readonly aiAnalyzer;
    private readonly changelogManager;
    constructor(config: WorkflowConfig);
    /**
     * Execute the complete release workflow
     */
    execute(): Promise<ReleaseResult>;
    /**
     * Step 1: Analyze repository changes and commits
     */
    private analyzeChanges;
    /**
     * Step 2: Determine version bump using conventional commits analysis
     */
    private analyzeVersion;
    /**
     * Step 3: Analyze changes with AI (if strategy requires it)
     */
    private analyzeWithAI;
    /**
     * Step 4: Update changelog with analyzed changes
     */
    private updateChangelog;
    /**
     * Step 5: Create release branch and commit changes
     */
    private createReleaseBranch;
    /**
     * Helper: Create basic changelog entries from commits using conventional commit analysis
     */
    private createBasicChangelogEntries;
    /**
     * Helper: Check if AI should be used based on strategy
     */
    private shouldUseAI;
    /**
     * Helper: Create AI analyzer instance
     */
    private createAIAnalyzer;
    /**
     * Helper: Validate workflow configuration
     */
    private validateConfiguration;
    /**
     * Helper: Format semantic version object to string
     */
    private formatVersion;
}
