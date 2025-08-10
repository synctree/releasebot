/**
 * @jest-environment node
 */

import * as core from '@actions/core';
import { KeepAChangelogManager, ChangelogError } from '../KeepAChangelogManager';
import type {
  ChangelogEntry,
  SemanticVersion,
  ChangelogGenerationOptions,
} from '../types/index.js';
import * as fs from 'fs/promises';

// Mock @actions/core
jest.mock('@actions/core');

// Mock fs/promises
jest.mock('fs/promises');

const mockCore = core as jest.Mocked<typeof core>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('KeepAChangelogManager', () => {
  let manager: KeepAChangelogManager;
  const testChangelogPath = '/test/CHANGELOG.md';

  const sampleChangelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature implementation
- Enhanced user interface

### Fixed
- Bug fix for authentication

## [1.2.0] - 2025-08-01

### Added
- Initial implementation
- Basic functionality

### Fixed
- Critical security fix
`;

  const mockChangelogEntry: ChangelogEntry = {
    category: 'feat',
    description: 'Add new awesome feature',
    commitSha: 'abc1234',
    author: 'Test Author',
    isBreaking: false,
    scope: 'core',
    pullRequest: 123,
    issues: [456],
    confidence: 0.9,
  };

  const mockVersion: SemanticVersion = {
    major: 1,
    minor: 3,
    patch: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup core mocks
    mockCore.debug = jest.fn();
    mockCore.info = jest.fn();
    mockCore.warning = jest.fn();
    mockCore.error = jest.fn();

    // Setup fs mocks - reset them
    mockFs.readFile.mockReset();
    mockFs.writeFile.mockReset();
    mockFs.mkdir.mockReset();

    // Create manager instance
    manager = new KeepAChangelogManager(testChangelogPath);
  });

  describe('constructor', () => {
    it('should initialize with default path', () => {
      new KeepAChangelogManager();
      expect(mockCore.debug).toHaveBeenCalledWith(
        expect.stringContaining('KeepAChangelogManager initialized')
      );
    });

    it('should initialize with custom path', () => {
      expect(mockCore.debug).toHaveBeenCalledWith(
        `📖 KeepAChangelogManager initialized for: ${testChangelogPath}`
      );
    });
  });

  describe('parseChangelog', () => {
    it('should parse valid changelog content', () => {
      const result = manager.parseChangelog(sampleChangelog);

      expect(result).toEqual({
        header: {
          title: 'Changelog',
          description: 'All notable changes to this project will be documented in this file.',
          keepAChangelogUrl: 'https://keepachangelog.com/en/1.0.0/',
          semverUrl: 'https://semver.org/spec/v2.0.0.html',
        },
        unreleased: {
          entries: {},
          content: '',
        },
        releases: [],
        rawContent: sampleChangelog,
      });

      expect(mockCore.info).toHaveBeenCalledWith('📖 Parsing changelog content...');
      expect(mockCore.info).toHaveBeenCalledWith('✅ Parsed changelog with 0 releases');
    });

    it('should handle empty content', () => {
      const result = manager.parseChangelog('');

      expect(result.header.title).toBe('Changelog');
      expect(result.releases).toEqual([]);
    });

    it('should handle empty content gracefully', () => {
      const emptyContent = '';
      const result = manager.parseChangelog(emptyContent);

      expect(result.header.title).toBe('Changelog');
      expect(result.unreleased.entries).toEqual({});
      expect(result.releases).toEqual([]);
      expect(result.rawContent).toBe(emptyContent);
    });
  });

  describe('generateMarkdown', () => {
    const mockChangelogData = {
      version: mockVersion,
      date: new Date('2025-08-09T10:00:00Z'),
      entries: {
        breaking: [],
        feat: [mockChangelogEntry],
        fix: [],
        perf: [],
        refactor: [],
        docs: [],
        style: [],
        test: [],
        build: [],
        ci: [],
        chore: [],
        revert: [],
        deps: [],
      },
      summary: {
        totalChanges: 1,
        breakingChanges: 0,
        features: 1,
        fixes: 0,
        contributors: 1,
        contributorNames: ['Test Author'],
      },
      markdown: '',
    };

    it('should generate markdown with default options', () => {
      const result = manager.generateMarkdown(mockChangelogData);

      expect(result).toContain('# Changelog');
      expect(result).toContain('## [Unreleased]');
      expect(result).toContain('## [1.3.0] - 2025-08-09');
      expect(result).toContain('### Added');
      expect(result).toContain('**core**: Add new awesome feature (abc1234) [#123]');
      expect(mockCore.info).toHaveBeenCalledWith('📝 Generating changelog markdown...');
    });

    it('should generate markdown without unreleased section', () => {
      const options: ChangelogGenerationOptions = {
        includeUnreleased: false,
      };

      const result = manager.generateMarkdown(mockChangelogData, options);

      expect(result).not.toContain('## [Unreleased]');
      expect(result).toContain('## [1.3.0] - 2025-08-09');
    });

    it('should use custom date format', () => {
      const options: ChangelogGenerationOptions = {
        dateFormat: 'DD/MM/YYYY',
      };

      const result = manager.generateMarkdown(mockChangelogData, options);

      expect(result).toContain('## [1.3.0] - 09/08/2025');
    });

    it('should use custom section order', () => {
      const options: ChangelogGenerationOptions = {
        sectionOrder: ['Fixed', 'Added', 'Changed'],
      };

      const result = manager.generateMarkdown(mockChangelogData, options);

      // The markdown should still contain the entry in the correct section
      expect(result).toContain('### Added');
      expect(result).toContain('**core**: Add new awesome feature');
    });
  });

  describe('readChangelogFile', () => {
    it('should read existing file successfully', async () => {
      mockFs.readFile.mockResolvedValueOnce(sampleChangelog);

      const result = await manager.readChangelogFile();

      expect(result).toBe(sampleChangelog);
      expect(mockFs.readFile).toHaveBeenCalledWith(testChangelogPath, 'utf-8');
      expect(mockCore.debug).toHaveBeenCalledWith(`📖 Read changelog from: ${testChangelogPath}`);
    });

    it('should handle missing file by returning default header', async () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValueOnce(error);

      const result = await manager.readChangelogFile();

      expect(result).toContain('# Changelog');
      expect(result).toContain('Keep a Changelog');
      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Changelog not found'));
    });

    it('should throw ChangelogError for other file read errors', async () => {
      const error = new Error('Permission denied');
      mockFs.readFile.mockRejectedValueOnce(error);

      await expect(manager.readChangelogFile()).rejects.toThrow(ChangelogError);
    });

    it('should read from custom path', async () => {
      const customPath = '/custom/CHANGELOG.md';
      mockFs.readFile.mockResolvedValueOnce(sampleChangelog);

      await manager.readChangelogFile(customPath);

      expect(mockFs.readFile).toHaveBeenCalledWith(customPath, 'utf-8');
    });
  });

  describe('writeChangelogFile', () => {
    const testContent = '# Test Changelog\n\nContent here.\n';

    it('should write file successfully', async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      await manager.writeChangelogFile(testContent);

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('/test'), {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(testChangelogPath, testContent, 'utf-8');
      expect(mockCore.debug).toHaveBeenCalledWith(`📝 Wrote changelog to: ${testChangelogPath}`);
    });

    it('should write to custom path', async () => {
      const customPath = '/custom/CHANGELOG.md';
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      await manager.writeChangelogFile(testContent, customPath);

      expect(mockFs.writeFile).toHaveBeenCalledWith(customPath, testContent, 'utf-8');
    });

    it('should throw ChangelogError for write failures', async () => {
      const error = new Error('Disk full');
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(error);

      await expect(manager.writeChangelogFile(testContent)).rejects.toThrow(ChangelogError);
    });
  });

  describe('addUnreleasedEntries', () => {
    it('should add entries to unreleased section', async () => {
      // Mock reading the existing changelog
      mockFs.readFile.mockResolvedValueOnce(sampleChangelog);
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const entries = [mockChangelogEntry];

      await manager.addUnreleasedEntries(entries);

      expect(mockCore.info).toHaveBeenCalledWith('📝 Adding 1 entries to unreleased section...');
      expect(mockCore.info).toHaveBeenCalledWith('✅ Added entries to unreleased section');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle no existing changelog', async () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValueOnce(error);
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const entries = [mockChangelogEntry];

      await manager.addUnreleasedEntries(entries);

      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Changelog not found'));
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('createRelease', () => {
    it('should create a new release', async () => {
      // Parse a changelog first
      manager.parseChangelog(sampleChangelog);

      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const result = await manager.createRelease(mockVersion);

      expect(result.version).toEqual(mockVersion);
      expect(result.summary.totalChanges).toBe(0);
      expect(mockCore.info).toHaveBeenCalledWith('🚀 Creating release 1.3.0...');
      expect(mockCore.info).toHaveBeenCalledWith('✅ Created new release');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should create release with custom date', async () => {
      manager.parseChangelog(sampleChangelog);
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const customDate = new Date('2025-12-31T23:59:59Z');
      const result = await manager.createRelease(mockVersion, customDate);

      expect(result.date).toBe(customDate);
    });

    it('should throw error if no changelog loaded', async () => {
      await expect(manager.createRelease(mockVersion)).rejects.toThrow(ChangelogError);
    });
  });

  describe('validateFormat', () => {
    it('should validate correct changelog format', () => {
      const result = manager.validateFormat(sampleChangelog);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(mockCore.info).toHaveBeenCalledWith('🔍 Validating changelog format...');
      expect(mockCore.info).toHaveBeenCalledWith('✅ Validation complete: PASSED');
    });

    it('should detect missing header', () => {
      const invalidChangelog = 'Some content without proper header';

      const result = manager.validateFormat(invalidChangelog);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing changelog header');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'missing-header',
            severity: 'error',
            message: 'Missing changelog header',
          }),
        ])
      );
    });

    it('should detect missing Keep a Changelog reference', () => {
      const changelogWithoutReference = '# Changelog\n\nSome content here.';

      const result = manager.validateFormat(changelogWithoutReference);

      expect(result.warnings).toContain('Missing Keep a Changelog reference');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'missing-header',
            severity: 'warning',
            message: 'Missing Keep a Changelog reference',
          }),
        ])
      );
    });
  });

  describe('formatEntry', () => {
    it('should format entry with all details', () => {
      const result = (manager as any).formatEntry(mockChangelogEntry);

      expect(result).toBe('**core**: Add new awesome feature (abc1234) [#123]');
    });

    it('should format entry without scope', () => {
      const entryWithoutScope = { ...mockChangelogEntry, scope: undefined };
      const result = (manager as any).formatEntry(entryWithoutScope);

      expect(result).toBe('Add new awesome feature (abc1234) [#123]');
    });

    it('should format entry without PR', () => {
      const entryWithoutPR = { ...mockChangelogEntry, pullRequest: undefined };
      const result = (manager as any).formatEntry(entryWithoutPR);

      expect(result).toBe('**core**: Add new awesome feature (abc1234)');
    });

    it('should format entry with empty commit SHA', () => {
      const entryWithoutSha = { ...mockChangelogEntry, commitSha: '' };
      const result = (manager as any).formatEntry(entryWithoutSha);

      expect(result).toBe('**core**: Add new awesome feature [#123]');
    });
  });

  describe('formatVersion', () => {
    it('should format basic version', () => {
      const result = (manager as any).formatVersion(mockVersion);
      expect(result).toBe('1.3.0');
    });

    it('should format version with prerelease', () => {
      const prereleaseVersion = { ...mockVersion, prerelease: 'alpha.1' };
      const result = (manager as any).formatVersion(prereleaseVersion);
      expect(result).toBe('1.3.0-alpha.1');
    });

    it('should format version with build', () => {
      const buildVersion = { ...mockVersion, build: '20250809' };
      const result = (manager as any).formatVersion(buildVersion);
      expect(result).toBe('1.3.0+20250809');
    });

    it('should format version with prerelease and build', () => {
      const fullVersion = { ...mockVersion, prerelease: 'beta.2', build: '20250809' };
      const result = (manager as any).formatVersion(fullVersion);
      expect(result).toBe('1.3.0-beta.2+20250809');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2025-08-09T15:30:45Z');

    it('should format date with default format', () => {
      const result = (manager as any).formatDate(testDate);
      expect(result).toBe('2025-08-09');
    });

    it('should format date with custom format', () => {
      const result = (manager as any).formatDate(testDate, 'DD/MM/YYYY');
      expect(result).toBe('09/08/2025');
    });

    it('should handle single-digit dates', () => {
      const earlyDate = new Date('2025-01-05T10:00:00Z');
      const result = (manager as any).formatDate(earlyDate);
      expect(result).toBe('2025-01-05');
    });
  });

  describe('ChangelogError', () => {
    it('should create error with all properties', () => {
      const context = { file: 'test.md', line: 42 };
      const error = new ChangelogError('Test error', 'TEST_ERROR', context, true);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toBe(context);
      expect(error.recoverable).toBe(true);
      expect(error.name).toBe('ChangelogError');
    });

    it('should create error with default values', () => {
      const error = new ChangelogError('Test error');

      expect(error.code).toBe('CHANGELOG_ERROR');
      expect(error.context).toBeUndefined();
      expect(error.recoverable).toBe(false);
    });
  });
});
