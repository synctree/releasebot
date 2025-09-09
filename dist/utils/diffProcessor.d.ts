/**
 * Diff Processing Utilities
 * Smart filtering and compression of git diffs for AI analysis
 */
import type { GitDiff, GitFileChange } from '../types/index.js';
/**
 * Configuration for diff processing
 */
export interface DiffProcessorConfig {
    /** Maximum files to include in analysis */
    maxFiles: number;
    /** File patterns to exclude from analysis */
    excludePatterns: string[];
    /** File patterns to prioritize in analysis */
    priorityPatterns: string[];
    /** Maximum total changes (additions + deletions) to include */
    maxTotalChanges: number;
}
/**
 * Default configuration for diff processing
 */
export declare const DEFAULT_DIFF_CONFIG: DiffProcessorConfig;
/**
 * Filters and prioritizes file changes for AI analysis
 */
export declare function filterFileChanges(fileChanges: GitFileChange[], config?: DiffProcessorConfig): GitFileChange[];
/**
 * Compresses file changes to fit within limits
 */
export declare function compressFileChanges(fileChanges: GitFileChange[], config?: DiffProcessorConfig): GitFileChange[];
/**
 * Creates a smart summary of excluded files
 */
export declare function createExcludedFilesSummary(originalFiles: GitFileChange[], includedFiles: GitFileChange[]): string;
/**
 * Processes a GitDiff to fit within constraints for AI analysis
 */
export declare function processGitDiff(gitDiff: GitDiff, config?: DiffProcessorConfig): GitDiff;
//# sourceMappingURL=diffProcessor.d.ts.map