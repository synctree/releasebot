/**
 * @jest-environment node
 */

import { VersionAnalyzer, VersionError, VersionUtils } from '../version-analyzer.js';
import type { SemanticVersion, GitDiff } from '../types/index.js';

describe('VersionAnalyzer', () => {
  let analyzer: VersionAnalyzer;

  beforeEach(() => {
    analyzer = new VersionAnalyzer();
  });

  // Helper function to create a minimal GitDiff for testing
  const createTestGitDiff = (commitMessage: string): GitDiff => ({
    commits: [
      {
        sha: 'abc123',
        message: commitMessage,
        author: {
          name: 'Test User',
          email: 'test@example.com',
          date: new Date('2023-01-01'),
        },
        committer: {
          name: 'Test User',
          email: 'test@example.com',
          date: new Date('2023-01-01'),
        },
        files: [],
        parents: [],
      },
    ],
    fileChanges: [],
    totalAdditions: 0,
    totalDeletions: 0,
    dateRange: {
      from: new Date('2023-01-01'),
      to: new Date('2023-01-01'),
    },
    contributors: ['test@example.com'],
  });

  const createEmptyGitDiff = (): GitDiff => ({
    commits: [],
    fileChanges: [],
    totalAdditions: 0,
    totalDeletions: 0,
    dateRange: {
      from: new Date('2023-01-01'),
      to: new Date('2023-01-01'),
    },
    contributors: [],
  });

  describe('parseVersion', () => {
    it('should parse basic semantic versions', () => {
      const result = analyzer.parseVersion('1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should parse versions with v prefix', () => {
      const result = analyzer.parseVersion('v1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should parse versions with prerelease', () => {
      const result = analyzer.parseVersion('1.2.3-alpha.1');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
      });
    });

    it('should parse versions with build metadata', () => {
      const result = analyzer.parseVersion('1.2.3+build.123');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        build: 'build.123',
      });
    });

    it('should parse versions with both prerelease and build', () => {
      const result = analyzer.parseVersion('1.2.3-alpha.1+build.123');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: 'build.123',
      });
    });

    it('should handle complex prerelease identifiers', () => {
      const result = analyzer.parseVersion('1.0.0-beta.2.rc.1');
      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'beta.2.rc.1',
      });
    });

    it('should throw error for empty version string', () => {
      expect(() => analyzer.parseVersion('')).toThrow(VersionError);
      expect(() => analyzer.parseVersion('')).toThrow('Version string cannot be empty');
    });

    it('should throw error for invalid version format', () => {
      expect(() => analyzer.parseVersion('invalid')).toThrow(VersionError);
      expect(() => analyzer.parseVersion('1.2')).toThrow(VersionError);
      expect(() => analyzer.parseVersion('1.2.3.4')).toThrow(VersionError);
    });

    it('should throw error for negative version numbers', () => {
      expect(() => analyzer.parseVersion('-1.2.3')).toThrow(VersionError);
      expect(() => analyzer.parseVersion('1.-2.3')).toThrow(VersionError);
      expect(() => analyzer.parseVersion('1.2.-3')).toThrow(VersionError);
    });

    it('should handle leading zeros', () => {
      const result = analyzer.parseVersion('01.02.03');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });
  });

  describe('incrementVersion', () => {
    const baseVersion: SemanticVersion = { major: 1, minor: 2, patch: 3 };

    it('should increment major version', () => {
      const result = analyzer.incrementVersion(baseVersion, 'major');
      expect(result).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
      });
    });

    it('should increment minor version', () => {
      const result = analyzer.incrementVersion(baseVersion, 'minor');
      expect(result).toEqual({
        major: 1,
        minor: 3,
        patch: 0,
      });
    });

    it('should increment patch version', () => {
      const result = analyzer.incrementVersion(baseVersion, 'patch');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 4,
      });
    });

    it('should return same version for none bump', () => {
      const result = analyzer.incrementVersion(baseVersion, 'none');
      expect(result).toEqual(baseVersion);
      expect(result).not.toBe(baseVersion); // Should be a copy
    });

    it('should remove prerelease and build when incrementing', () => {
      const versionWithExtras: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: 'build.123',
      };

      const result = analyzer.incrementVersion(versionWithExtras, 'patch');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 4,
      });
    });
  });

  describe('incrementPrerelease', () => {
    it('should create first prerelease from stable version', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      const result = analyzer.incrementPrerelease(version, 'alpha');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 4,
        prerelease: 'alpha.1',
      });
    });

    it('should increment existing prerelease number', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
      };
      const result = analyzer.incrementPrerelease(version, 'alpha');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.2',
      });
    });

    it('should change prerelease type and reset number', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.5',
      };
      const result = analyzer.incrementPrerelease(version, 'beta');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta.1',
      });
    });

    it('should handle invalid prerelease format by resetting', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'invalid-format',
      };
      const result = analyzer.incrementPrerelease(version, 'alpha');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
      });
    });

    it('should remove build metadata', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        build: 'build.123',
      };
      const result = analyzer.incrementPrerelease(version, 'alpha');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 4,
        prerelease: 'alpha.1',
      });
    });
  });

  describe('promoteToStable', () => {
    it('should promote prerelease to stable', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
      };
      const result = analyzer.promoteToStable(version);
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should remove build metadata when promoting', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'rc.1',
        build: 'build.123',
      };
      const result = analyzer.promoteToStable(version);
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it('should throw error when promoting stable version', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(() => analyzer.promoteToStable(version)).toThrow(VersionError);
      expect(() => analyzer.promoteToStable(version)).toThrow(
        'Cannot promote stable version to stable'
      );
    });
  });

  describe('validateVersion', () => {
    it('should validate correct version', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: 'build.123',
      };
      const result = analyzer.validateVersion(version);
      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
    });

    it('should detect negative version numbers', () => {
      const version: SemanticVersion = { major: -1, minor: 2, patch: 3 };
      const result = analyzer.validateVersion(version);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Major version cannot be negative');
    });

    it('should detect invalid prerelease format', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'invalid format with spaces',
      };
      const result = analyzer.validateVersion(version);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid prerelease format');
    });

    it('should detect invalid build format', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        build: 'invalid format with spaces',
      };
      const result = analyzer.validateVersion(version);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid build metadata format');
    });

    it('should warn about unusually high version numbers', () => {
      const version: SemanticVersion = { major: 1000, minor: 100, patch: 1000 };
      const result = analyzer.validateVersion(version);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Major version is unusually high');
      expect(result.warnings).toContain('Minor version is unusually high');
      expect(result.warnings).toContain('Patch version is unusually high');
    });
  });

  describe('formatVersion', () => {
    it('should format basic version', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(analyzer.formatVersion(version)).toBe('1.2.3');
    });

    it('should format version with prerelease', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
      };
      expect(analyzer.formatVersion(version)).toBe('1.2.3-alpha.1');
    });

    it('should format version with build', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        build: 'build.123',
      };
      expect(analyzer.formatVersion(version)).toBe('1.2.3+build.123');
    });

    it('should format complete version', () => {
      const version: SemanticVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: 'build.123',
      };
      expect(analyzer.formatVersion(version)).toBe('1.2.3-alpha.1+build.123');
    });

    it('should include v prefix when requested', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(analyzer.formatVersion(version, true)).toBe('v1.2.3');
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions', () => {
      const v1: SemanticVersion = { major: 1, minor: 0, patch: 0 };
      const v2: SemanticVersion = { major: 2, minor: 0, patch: 0 };
      expect(analyzer.compareVersions(v1, v2)).toBeLessThan(0);
      expect(analyzer.compareVersions(v2, v1)).toBeGreaterThan(0);
    });

    it('should compare minor versions', () => {
      const v1: SemanticVersion = { major: 1, minor: 1, patch: 0 };
      const v2: SemanticVersion = { major: 1, minor: 2, patch: 0 };
      expect(analyzer.compareVersions(v1, v2)).toBeLessThan(0);
      expect(analyzer.compareVersions(v2, v1)).toBeGreaterThan(0);
    });

    it('should compare patch versions', () => {
      const v1: SemanticVersion = { major: 1, minor: 0, patch: 1 };
      const v2: SemanticVersion = { major: 1, minor: 0, patch: 2 };
      expect(analyzer.compareVersions(v1, v2)).toBeLessThan(0);
      expect(analyzer.compareVersions(v2, v1)).toBeGreaterThan(0);
    });

    it('should consider stable version greater than prerelease', () => {
      const stable: SemanticVersion = { major: 1, minor: 0, patch: 0 };
      const prerelease: SemanticVersion = {
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'alpha.1',
      };
      expect(analyzer.compareVersions(stable, prerelease)).toBeGreaterThan(0);
      expect(analyzer.compareVersions(prerelease, stable)).toBeLessThan(0);
    });

    it('should compare prerelease versions', () => {
      const alpha: SemanticVersion = {
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'alpha.1',
      };
      const beta: SemanticVersion = {
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1',
      };
      expect(analyzer.compareVersions(alpha, beta)).toBeLessThan(0);
      expect(analyzer.compareVersions(beta, alpha)).toBeGreaterThan(0);
    });

    it('should return 0 for equal versions', () => {
      const v1: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      const v2: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(analyzer.compareVersions(v1, v2)).toBe(0);
    });
  });

  describe('isGreaterThan', () => {
    it('should correctly identify greater version', () => {
      const v1: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      const v2: SemanticVersion = { major: 1, minor: 2, patch: 2 };
      expect(analyzer.isGreaterThan(v1, v2)).toBe(true);
      expect(analyzer.isGreaterThan(v2, v1)).toBe(false);
    });
  });

  describe('satisfiesRange', () => {
    it('should handle caret ranges', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(analyzer.satisfiesRange(version, '^1.2.0')).toBe(true);
      expect(analyzer.satisfiesRange(version, '^1.3.0')).toBe(false);
      expect(analyzer.satisfiesRange(version, '^2.0.0')).toBe(false);
    });

    it('should handle tilde ranges', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(analyzer.satisfiesRange(version, '~1.2.0')).toBe(true);
      expect(analyzer.satisfiesRange(version, '~1.3.0')).toBe(false);
    });

    it('should handle exact matches', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(analyzer.satisfiesRange(version, '1.2.3')).toBe(true);
      expect(analyzer.satisfiesRange(version, '1.2.4')).toBe(false);
    });
  });

  describe('determineVersionBump', () => {
    it('should detect breaking changes', () => {
      const changes = createTestGitDiff('feat!: breaking change');
      expect(analyzer.determineVersionBump(changes)).toBe('major');
    });

    it('should detect features', () => {
      const changes = createTestGitDiff('feat: new feature');
      expect(analyzer.determineVersionBump(changes)).toBe('minor');
    });

    it('should detect bug fixes', () => {
      const changes = createTestGitDiff('fix: bug fix');
      expect(analyzer.determineVersionBump(changes)).toBe('patch');
    });

    it('should default to patch for any changes', () => {
      const changes = createTestGitDiff('docs: update documentation');
      expect(analyzer.determineVersionBump(changes)).toBe('patch');
    });

    it('should return none for no changes', () => {
      const changes = createEmptyGitDiff();
      expect(analyzer.determineVersionBump(changes)).toBe('none');
    });
  });

  describe('getNextVersions', () => {
    it('should return all possible next versions', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      const result = analyzer.getNextVersions(version);

      expect(result).toEqual({
        major: { major: 2, minor: 0, patch: 0 },
        minor: { major: 1, minor: 3, patch: 0 },
        patch: { major: 1, minor: 2, patch: 4 },
        none: { major: 1, minor: 2, patch: 3 },
      });
    });
  });

  describe('createVersionInfo', () => {
    it('should create version info object', () => {
      const current: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      const result = analyzer.createVersionInfo(current, 'minor', 0.8);

      expect(result).toEqual({
        current: { major: 1, minor: 2, patch: 3 },
        next: { major: 1, minor: 3, patch: 0 },
        bump: 'minor',
        confidence: 0.8,
        strategy: 'conventional',
      });
    });
  });
});

describe('VersionUtils', () => {
  describe('parseFromPackageJson', () => {
    it('should parse version from valid package.json', () => {
      const packageJson = JSON.stringify({ version: '1.2.3' });
      const result = VersionUtils.parseFromPackageJson(packageJson);
      expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should throw error for invalid JSON', () => {
      expect(() => VersionUtils.parseFromPackageJson('invalid json')).toThrow(VersionError);
    });

    it('should throw error for missing version field', () => {
      const packageJson = JSON.stringify({ name: 'test' });
      expect(() => VersionUtils.parseFromPackageJson(packageJson)).toThrow(VersionError);
    });

    it('should throw error for empty version field', () => {
      const packageJson = JSON.stringify({ version: '' });
      expect(() => VersionUtils.parseFromPackageJson(packageJson)).toThrow(VersionError);
    });

    it('should throw error for non-string version field', () => {
      const packageJson = JSON.stringify({ version: 123 });
      expect(() => VersionUtils.parseFromPackageJson(packageJson)).toThrow(VersionError);
    });
  });

  describe('createGitTag', () => {
    it('should create git tag with default prefix', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(VersionUtils.createGitTag(version)).toBe('v1.2.3');
    });

    it('should create git tag with custom prefix', () => {
      const version: SemanticVersion = { major: 1, minor: 2, patch: 3 };
      expect(VersionUtils.createGitTag(version, 'release-')).toBe('release-1.2.3');
    });
  });

  describe('isValidVersion', () => {
    it('should validate correct version strings', () => {
      expect(VersionUtils.isValidVersion('1.2.3')).toBe(true);
      expect(VersionUtils.isValidVersion('v1.2.3')).toBe(true);
      expect(VersionUtils.isValidVersion('1.2.3-alpha.1')).toBe(true);
    });

    it('should reject invalid version strings', () => {
      expect(VersionUtils.isValidVersion('invalid')).toBe(false);
      expect(VersionUtils.isValidVersion('1.2')).toBe(false);
      expect(VersionUtils.isValidVersion('')).toBe(false);
    });
  });

  describe('getHighestVersion', () => {
    it('should return highest version from array', () => {
      const versions: SemanticVersion[] = [
        { major: 1, minor: 0, patch: 0 },
        { major: 1, minor: 2, patch: 3 },
        { major: 1, minor: 1, patch: 0 },
      ];
      const result = VersionUtils.getHighestVersion(versions);
      expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should return null for empty array', () => {
      expect(VersionUtils.getHighestVersion([])).toBeNull();
    });

    it('should handle array with single version', () => {
      const versions: SemanticVersion[] = [{ major: 1, minor: 0, patch: 0 }];
      const result = VersionUtils.getHighestVersion(versions);
      expect(result).toEqual({ major: 1, minor: 0, patch: 0 });
    });
  });
});

describe('VersionError', () => {
  it('should create error with message', () => {
    const error = new VersionError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('VersionError');
    expect(error.version).toBeUndefined();
  });

  it('should create error with message and version', () => {
    const error = new VersionError('Test error', '1.2.3');
    expect(error.message).toBe('Test error');
    expect(error.version).toBe('1.2.3');
  });
});
