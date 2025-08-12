/**
 * Git Operations Module
 * Handles git repository operations including branch management, diff generation, and commit operations
 */
import type { GitDiff, RepositoryInfo } from './types/index.js';
/**
 * Error thrown when git operations fail
 */
export declare class GitOperationError extends Error {
    readonly command?: string | undefined;
    readonly exitCode?: number | undefined;
    constructor(message: string, command?: string | undefined, exitCode?: number | undefined);
}
/**
 * Git operations class for handling repository interactions
 */
export declare class GitOperations {
    private readonly workingDirectory;
    constructor(workingDirectory?: string);
    /**
     * Validate repository state and permissions
     */
    validateRepository(): RepositoryInfo;
    /**
     * Create a release branch from the base branch
     */
    createReleaseBranch(version: string, baseBranch?: string): string;
    /**
     * Generate diff between two branches
     */
    generateDiff(baseBranch: string, featureBranch: string): GitDiff;
    /**
     * Resolve branch name to a git reference (handles both local and remote branches)
     */
    private resolveBranchRef;
    /**
     * Validate that specified branches exist
     */
    validateBranches(branches: string[]): void;
    /**
     * Commit changes to the current branch
     */
    commitChanges(files: string[], message: string): string;
    /**
     * Push commits to remote repository
     */
    pushChanges(branchName: string, setUpstream?: boolean): void;
    /**
     * Commit and push changes in one operation
     */
    commitAndPush(files: string[], message: string, branchName: string, setUpstream?: boolean): string;
    /**
     * Get the current branch name
     */
    getCurrentBranch(): string;
    /**
     * Get the latest commit SHA
     */
    getLatestCommitSha(): string;
    /**
     * Check if working directory is clean
     */
    isWorkingDirectoryClean(): boolean;
    /**
     * Execute a git command and return output
     */
    private executeGitCommand;
    /**
     * Parse repository URL to extract owner and name
     */
    private parseRepositoryUrl;
    /**
     * Get commits between two branches
     */
    private getCommitsBetweenBranches;
    /**
     * Get file changes between two branches
     */
    private getFileChangesBetweenBranches;
    /**
     * Get files changed in a specific commit
     */
    private getFilesChangedInCommit;
}
/**
 * Utility functions for git operations
 */
export declare const GitUtils: {
    /**
     * Validate branch name format
     */
    isValidBranchName(branchName: string): boolean;
    /**
     * Sanitize branch name
     */
    sanitizeBranchName(name: string): string;
    /**
     * Format commit message according to conventional commits
     */
    formatCommitMessage(type: string, scope: string | undefined, description: string): string;
    /**
     * Parse conventional commit message
     */
    parseConventionalCommit(message: string): {
        type: string;
        scope?: string;
        description: string;
        isBreaking: boolean;
    } | null;
};
