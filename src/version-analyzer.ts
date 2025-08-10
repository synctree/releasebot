/**
 * Semantic Version Analyzer
 * Provides core logic for analyzing and incrementing semantic versions based on change types
 */

import type {
  SemanticVersion,
  VersionBumpType,
  VersionInfo,
  VersioningStrategy,
  GitDiff,
  ValidationResult,
} from './types/index.js';

/**
 * Error thrown when version parsing or validation fails
 */
export class VersionError extends Error {
  constructor(
    message: string,
    public readonly version?: string
  ) {
    super(message);
    this.name = 'VersionError';
  }
}

/**
 * Core semantic version analyzer with parsing, validation, and increment logic
 */
export class VersionAnalyzer {
  private readonly strategy: VersioningStrategy = 'conventional';

  /**
   * Parse a version string into semantic version components
   * Supports formats: 1.2.3, v1.2.3, 1.2.3-alpha.1, 1.2.3+build.123
   */
  parseVersion(versionString: string): SemanticVersion {
    if (versionString === '' || versionString == null) {
      throw new VersionError('Version string cannot be empty');
    }

    // Remove 'v' prefix if present
    const cleanVersion = versionString.replace(/^v/, '');

    // Regex to parse semantic version with optional prerelease and build metadata
    const versionRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

    const match = versionRegex.exec(cleanVersion);
    if (match === null) {
      throw new VersionError(`Invalid semantic version format: ${versionString}`, versionString);
    }

    const [, majorStr, minorStr, patchStr, prerelease, build] = match;

    if (majorStr === undefined || minorStr === undefined || patchStr === undefined) {
      throw new VersionError('Invalid version format: missing components');
    }

    const major = parseInt(majorStr, 10);
    const minor = parseInt(minorStr, 10);
    const patch = parseInt(patchStr, 10);

    // Validate that numbers are not negative
    if (major < 0 || minor < 0 || patch < 0) {
      throw new VersionError(`Version numbers cannot be negative: ${versionString}`, versionString);
    }

    const version: SemanticVersion = {
      major,
      minor,
      patch,
    };

    if (prerelease !== undefined) {
      version.prerelease = prerelease;
    }

    if (build !== undefined) {
      version.build = build;
    }

    return version;
  }

  /**
   * Determine the appropriate version bump type based on change analysis
   * This is a simplified implementation - will be enhanced by specific analyzers
   */
  determineVersionBump(changes: GitDiff): VersionBumpType {
    // Simple heuristic analysis based on commit messages and file changes
    const hasBreakingChanges = this.detectBreakingChanges(changes);
    const hasNewFeatures = this.detectNewFeatures(changes);
    const hasBugFixes = this.detectBugFixes(changes);

    if (hasBreakingChanges) {
      return 'major';
    }

    if (hasNewFeatures) {
      return 'minor';
    }

    if (hasBugFixes) {
      return 'patch';
    }

    // Default to patch if we have any changes
    return changes.commits.length > 0 ? 'patch' : 'none';
  }

  /**
   * Increment a semantic version based on the bump type
   */
  incrementVersion(version: SemanticVersion, bumpType: VersionBumpType): SemanticVersion {
    if (bumpType === 'none') {
      return { ...version };
    }

    // When incrementing, remove prerelease and build metadata unless it's a prerelease bump
    const newVersion: SemanticVersion = {
      major: version.major,
      minor: version.minor,
      patch: version.patch,
    };

    switch (bumpType) {
      case 'major':
        newVersion.major += 1;
        newVersion.minor = 0;
        newVersion.patch = 0;
        break;

      case 'minor':
        newVersion.minor += 1;
        newVersion.patch = 0;
        break;

      case 'patch':
        newVersion.patch += 1;
        break;

      default:
        // This should never happen due to TypeScript types, but adding for safety
        throw new VersionError(`Invalid bump type: ${String(bumpType)}`);
    }

    return newVersion;
  }

  /**
   * Create a version info object with analysis results
   */
  createVersionInfo(
    current: SemanticVersion,
    bumpType: VersionBumpType,
    confidence: number = 1.0
  ): VersionInfo {
    const next = this.incrementVersion(current, bumpType);

    return {
      current,
      next,
      bump: bumpType,
      confidence,
      strategy: this.strategy,
    };
  }

  /**
   * Support pre-release versions (alpha, beta, rc)
   */
  incrementPrerelease(version: SemanticVersion, prereleaseType: string = 'alpha'): SemanticVersion {
    const newVersion = { ...version };

    if (
      version.prerelease === undefined ||
      version.prerelease === null ||
      version.prerelease === ''
    ) {
      // First prerelease - increment patch and add prerelease
      newVersion.patch += 1;
      newVersion.prerelease = `${prereleaseType}.1`;
    } else {
      // Extract current prerelease info
      const prereleaseRegex = /^([a-zA-Z]+)\.(\d+)$/;
      const prereleaseMatch = prereleaseRegex.exec(version.prerelease);
      if (prereleaseMatch !== null) {
        const [, currentType, numberStr] = prereleaseMatch;
        if (numberStr === undefined) {
          throw new VersionError('Invalid prerelease format: missing number component');
        }
        const number = parseInt(numberStr, 10);

        if (currentType === prereleaseType) {
          // Increment the prerelease number
          newVersion.prerelease = `${prereleaseType}.${number + 1}`;
        } else {
          // Change prerelease type, reset to 1
          newVersion.prerelease = `${prereleaseType}.1`;
        }
      } else {
        // Invalid prerelease format, reset
        newVersion.prerelease = `${prereleaseType}.1`;
      }
    }

    // Remove build metadata when creating prerelease
    delete newVersion.build;

    return newVersion;
  }

  /**
   * Promote a prerelease to a stable release
   */
  promoteToStable(version: SemanticVersion): SemanticVersion {
    if (
      version.prerelease === undefined ||
      version.prerelease === null ||
      version.prerelease === ''
    ) {
      throw new VersionError(
        'Cannot promote stable version to stable',
        this.formatVersion(version)
      );
    }

    return {
      major: version.major,
      minor: version.minor,
      patch: version.patch,
      // Remove prerelease and build metadata
    };
  }

  /**
   * Validate version format and components
   */
  validateVersion(version: SemanticVersion): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for negative values
    if (version.major < 0) errors.push('Major version cannot be negative');
    if (version.minor < 0) errors.push('Minor version cannot be negative');
    if (version.patch < 0) errors.push('Patch version cannot be negative');

    // Validate prerelease format
    if (
      version.prerelease !== undefined &&
      version.prerelease !== null &&
      version.prerelease !== ''
    ) {
      const prereleaseRegex = /^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/;
      if (!prereleaseRegex.test(version.prerelease)) {
        errors.push('Invalid prerelease format');
      }
    }

    // Validate build metadata format
    if (version.build !== undefined && version.build !== null && version.build !== '') {
      const buildRegex = /^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/;
      if (!buildRegex.test(version.build)) {
        errors.push('Invalid build metadata format');
      }
    }

    // Check for reasonable version numbers
    if (version.major > 999) warnings.push('Major version is unusually high');
    if (version.minor > 99) warnings.push('Minor version is unusually high');
    if (version.patch > 999) warnings.push('Patch version is unusually high');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format a semantic version object back to string
   */
  formatVersion(version: SemanticVersion, includePrefix: boolean = false): string {
    let versionString = `${version.major}.${version.minor}.${version.patch}`;

    if (
      version.prerelease !== undefined &&
      version.prerelease !== null &&
      version.prerelease !== ''
    ) {
      versionString += `-${version.prerelease}`;
    }

    if (version.build !== undefined && version.build !== null && version.build !== '') {
      versionString += `+${version.build}`;
    }

    return includePrefix ? `v${versionString}` : versionString;
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  compareVersions(a: SemanticVersion, b: SemanticVersion): number {
    // Compare major.minor.patch
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;

    // Handle prerelease comparison
    const aHasPrerelease =
      a.prerelease !== undefined && a.prerelease !== null && a.prerelease !== '';
    const bHasPrerelease =
      b.prerelease !== undefined && b.prerelease !== null && b.prerelease !== '';

    if (!aHasPrerelease && !bHasPrerelease) return 0;
    if (!aHasPrerelease && bHasPrerelease) return 1; // 1.0.0 > 1.0.0-alpha
    if (aHasPrerelease && !bHasPrerelease) return -1; // 1.0.0-alpha < 1.0.0

    // Both have prerelease, compare them
    if (aHasPrerelease && bHasPrerelease) {
      const aPre = a.prerelease ?? '';
      const bPre = b.prerelease ?? '';
      return aPre.localeCompare(bPre);
    }

    return 0;
  }

  /**
   * Check if a version is greater than another
   */
  isGreaterThan(a: SemanticVersion, b: SemanticVersion): boolean {
    return this.compareVersions(a, b) > 0;
  }

  /**
   * Check if a version satisfies a range (simplified implementation)
   */
  satisfiesRange(version: SemanticVersion, range: string): boolean {
    // Simplified range checking - can be extended for complex ranges
    if (range.startsWith('^')) {
      // Caret range: ^1.2.3 means >=1.2.3 <2.0.0
      const targetVersion = this.parseVersion(range.slice(1));
      return (
        version.major === targetVersion.major && this.compareVersions(version, targetVersion) >= 0
      );
    }

    if (range.startsWith('~')) {
      // Tilde range: ~1.2.3 means >=1.2.3 <1.3.0
      const targetVersion = this.parseVersion(range.slice(1));
      return (
        version.major === targetVersion.major &&
        version.minor === targetVersion.minor &&
        this.compareVersions(version, targetVersion) >= 0
      );
    }

    // Exact match
    const targetVersion = this.parseVersion(range);
    return this.compareVersions(version, targetVersion) === 0;
  }

  /**
   * Get the next valid versions for all bump types
   */
  getNextVersions(version: SemanticVersion): Record<VersionBumpType, SemanticVersion> {
    return {
      major: this.incrementVersion(version, 'major'),
      minor: this.incrementVersion(version, 'minor'),
      patch: this.incrementVersion(version, 'patch'),
      none: version,
    };
  }

  // Private helper methods for change detection
  private detectBreakingChanges(changes: GitDiff): boolean {
    return changes.commits.some(
      commit =>
        commit.message.includes('BREAKING CHANGE:') ||
        commit.message.includes('!:') ||
        commit.message.toLowerCase().includes('breaking')
    );
  }

  private detectNewFeatures(changes: GitDiff): boolean {
    return changes.commits.some(
      commit =>
        commit.message.startsWith('feat:') ||
        commit.message.startsWith('feature:') ||
        commit.message.toLowerCase().includes('feature')
    );
  }

  private detectBugFixes(changes: GitDiff): boolean {
    return changes.commits.some(
      commit =>
        commit.message.startsWith('fix:') ||
        commit.message.startsWith('bugfix:') ||
        commit.message.toLowerCase().includes('fix')
    );
  }
}

/**
 * Utility functions for common version operations
 */
export const VersionUtils = {
  /**
   * Parse a version from package.json content
   */
  parseFromPackageJson(packageJsonContent: string): SemanticVersion {
    try {
      const packageData = JSON.parse(packageJsonContent) as unknown;

      // Type guard to check if packageData is an object with a version property
      if (typeof packageData !== 'object' || packageData === null) {
        throw new VersionError('Invalid package.json format');
      }

      const packageObj = packageData as Record<string, unknown>;

      if (typeof packageObj['version'] !== 'string' || packageObj['version'] === '') {
        throw new VersionError('No valid version field found in package.json');
      }

      const analyzer = new VersionAnalyzer();
      return analyzer.parseVersion(packageObj['version']);
    } catch (error) {
      if (error instanceof VersionError) throw error;
      throw new VersionError('Failed to parse package.json', packageJsonContent);
    }
  },

  /**
   * Create a version string suitable for git tags
   */
  createGitTag(version: SemanticVersion, prefix: string = 'v'): string {
    const analyzer = new VersionAnalyzer();
    return `${prefix}${analyzer.formatVersion(version)}`;
  },

  /**
   * Check if a version string is valid semantic version
   */
  isValidVersion(versionString: string): boolean {
    try {
      const analyzer = new VersionAnalyzer();
      analyzer.parseVersion(versionString);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get the highest version from an array of versions
   */
  getHighestVersion(versions: SemanticVersion[]): SemanticVersion | null {
    if (versions.length === 0) return null;

    const analyzer = new VersionAnalyzer();
    return versions.reduce((highest, current) =>
      analyzer.isGreaterThan(current, highest) ? current : highest
    );
  },
};
