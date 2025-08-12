/**
 * Semantic Version Analyzer
 * Provides core logic for analyzing and incrementing semantic versions based on change types
 */
import type { SemanticVersion, VersionBumpType, VersionInfo, GitDiff, ValidationResult } from './types/index.js';
/**
 * Error thrown when version parsing or validation fails
 */
export declare class VersionError extends Error {
    readonly version?: string | undefined;
    constructor(message: string, version?: string | undefined);
}
/**
 * Core semantic version analyzer with parsing, validation, and increment logic
 */
export declare class VersionAnalyzer {
    private readonly strategy;
    /**
     * Parse a version string into semantic version components
     * Supports formats: 1.2.3, v1.2.3, 1.2.3-alpha.1, 1.2.3+build.123
     */
    parseVersion(versionString: string): SemanticVersion;
    /**
     * Determine the appropriate version bump type based on change analysis
     * This is a simplified implementation - will be enhanced by specific analyzers
     */
    determineVersionBump(changes: GitDiff): VersionBumpType;
    /**
     * Increment a semantic version based on the bump type
     */
    incrementVersion(version: SemanticVersion, bumpType: VersionBumpType): SemanticVersion;
    /**
     * Create a version info object with analysis results
     */
    createVersionInfo(current: SemanticVersion, bumpType: VersionBumpType, confidence?: number): VersionInfo;
    /**
     * Support pre-release versions (alpha, beta, rc)
     */
    incrementPrerelease(version: SemanticVersion, prereleaseType?: string): SemanticVersion;
    /**
     * Promote a prerelease to a stable release
     */
    promoteToStable(version: SemanticVersion): SemanticVersion;
    /**
     * Validate version format and components
     */
    validateVersion(version: SemanticVersion): ValidationResult;
    /**
     * Format a semantic version object back to string
     */
    formatVersion(version: SemanticVersion, includePrefix?: boolean): string;
    /**
     * Compare two semantic versions
     * Returns: -1 if a < b, 0 if a === b, 1 if a > b
     */
    compareVersions(a: SemanticVersion, b: SemanticVersion): number;
    /**
     * Check if a version is greater than another
     */
    isGreaterThan(a: SemanticVersion, b: SemanticVersion): boolean;
    /**
     * Check if a version satisfies a range (simplified implementation)
     */
    satisfiesRange(version: SemanticVersion, range: string): boolean;
    /**
     * Get the next valid versions for all bump types
     */
    getNextVersions(version: SemanticVersion): Record<VersionBumpType, SemanticVersion>;
    private detectBreakingChanges;
    private detectNewFeatures;
    private detectBugFixes;
}
/**
 * Utility functions for common version operations
 */
export declare const VersionUtils: {
    /**
     * Parse a version from package.json content
     */
    parseFromPackageJson(packageJsonContent: string): SemanticVersion;
    /**
     * Create a version string suitable for git tags
     */
    createGitTag(version: SemanticVersion, prefix?: string): string;
    /**
     * Check if a version string is valid semantic version
     */
    isValidVersion(versionString: string): boolean;
    /**
     * Get the highest version from an array of versions
     */
    getHighestVersion(versions: SemanticVersion[]): SemanticVersion | null;
};
