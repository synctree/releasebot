/**
 * Conventional Commits Utility
 * Shared logic for parsing and categorizing conventional commit messages
 */
import type { ChangeCategory } from '../types/index.js';
/**
 * Parsed conventional commit information
 */
export interface ConventionalCommit {
    type: ChangeCategory;
    scope: string | undefined;
    description: string;
    isBreaking: boolean;
    rawMessage: string;
}
/**
 * Parse a conventional commit message into structured data
 */
export declare function parseConventionalCommit(message: string): ConventionalCommit;
/**
 * Categorize commit type based on conventional commits
 */
export declare function categorizeCommitType(message: string): ChangeCategory;
/**
 * Extract scope from conventional commit message
 */
export declare function extractScope(message: string): string | undefined;
/**
 * Clean and extract description from commit message
 */
export declare function cleanCommitMessage(message: string): string;
/**
 * Check if a commit message follows conventional commit format
 */
export declare function isConventionalCommit(message: string): boolean;
/**
 * Determine if a commit represents a breaking change
 */
export declare function isBreakingChange(message: string): boolean;
//# sourceMappingURL=conventionalCommits.d.ts.map