/**
 * @jest-environment node
 */

import {
  filterFileChanges,
  compressFileChanges,
  processGitDiff,
  DEFAULT_DIFF_CONFIG,
} from '../utils/diffProcessor';
import type { GitDiff, GitFileChange } from '../types/index.js';

describe('DiffProcessor', () => {
  const mockFileChanges: GitFileChange[] = [
    {
      path: 'src/main.ts',
      status: 'modified',
      additions: 50,
      deletions: 10,
    },
    {
      path: 'package-lock.json',
      status: 'modified',
      additions: 1000,
      deletions: 500,
    },
    {
      path: 'src/utils/helper.ts',
      status: 'added',
      additions: 30,
      deletions: 0,
    },
    {
      path: 'docs/README.md',
      status: 'modified',
      additions: 5,
      deletions: 2,
    },
    {
      path: 'src/test.spec.ts',
      status: 'added',
      additions: 100,
      deletions: 0,
    },
  ];

  const mockGitDiff: GitDiff = {
    commits: [
      {
        sha: 'abc123',
        message: 'feat: add new feature',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: new Date(),
        },
        committer: {
          name: 'Test Author',
          email: 'test@example.com',
          date: new Date(),
        },
        files: [],
        parents: [],
      },
    ],
    fileChanges: mockFileChanges,
    totalAdditions: 1185,
    totalDeletions: 512,
    dateRange: {
      from: new Date(),
      to: new Date(),
    },
    contributors: ['Test Author'],
  };

  describe('filterFileChanges', () => {
    it('should filter out excluded files', () => {
      const result = filterFileChanges(mockFileChanges, DEFAULT_DIFF_CONFIG);

      // Should exclude package-lock.json but keep others that don't match exclude patterns exactly
      expect(result.some(f => f.path === 'package-lock.json')).toBe(false);
      expect(result.some(f => f.path === 'src/main.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/utils/helper.ts')).toBe(true);
    });

    it('should prioritize important files', () => {
      const result = filterFileChanges(mockFileChanges, DEFAULT_DIFF_CONFIG);

      // Test files and main files should be sorted by impact (additions + deletions)
      expect(result.length).toBeGreaterThan(0);
      // The highest impact file (100 changes) should be first
      expect(result[0]?.path).toBe('src/test.spec.ts');
      if (result[0] !== undefined) {
        expect(result[0].additions + result[0].deletions).toBe(100);
      }
    });
  });

  describe('compressFileChanges', () => {
    it('should limit number of files', () => {
      const config = {
        ...DEFAULT_DIFF_CONFIG,
        maxFiles: 1,
      };

      const result = compressFileChanges(mockFileChanges, config);
      expect(result).toHaveLength(1);
    });

    it('should limit total changes', () => {
      const config = {
        ...DEFAULT_DIFF_CONFIG,
        maxTotalChanges: 50,
      };

      const result = compressFileChanges(mockFileChanges, config);

      // Should only include files that fit within the change limit
      const totalChanges = result.reduce((sum, file) => sum + file.additions + file.deletions, 0);
      expect(totalChanges).toBeLessThanOrEqual(50);
    });
  });

  describe('processGitDiff', () => {
    it('should process git diff and update totals', () => {
      const result = processGitDiff(mockGitDiff, DEFAULT_DIFF_CONFIG);

      // Should have filtered files
      expect(result.fileChanges.length).toBeLessThan(mockGitDiff.fileChanges.length);

      // Totals should be recalculated based on included files
      const expectedAdditions = result.fileChanges.reduce((sum, file) => sum + file.additions, 0);
      const expectedDeletions = result.fileChanges.reduce((sum, file) => sum + file.deletions, 0);

      expect(result.totalAdditions).toBe(expectedAdditions);
      expect(result.totalDeletions).toBe(expectedDeletions);
    });

    it('should preserve other git diff properties', () => {
      const result = processGitDiff(mockGitDiff, DEFAULT_DIFF_CONFIG);

      // Commits may be modified to include excluded files summary
      expect(result.commits).toHaveLength(mockGitDiff.commits.length);
      expect(result.commits[0]?.sha).toBe('abc123');
      expect(result.contributors).toEqual(mockGitDiff.contributors);
      expect(result.dateRange).toEqual(mockGitDiff.dateRange);
    });

    it('should handle lock file only scenarios with enhanced context', () => {
      const lockFileOnlyDiff: GitDiff = {
        commits: [
          {
            sha: 'def456',
            message: 'chore: update dependencies',
            author: {
              name: 'Dependabot',
              email: 'dependabot@github.com',
              date: new Date(),
            },
            committer: {
              name: 'Dependabot',
              email: 'dependabot@github.com',
              date: new Date(),
            },
            files: [
              {
                path: 'package-lock.json',
                status: 'modified',
                additions: 1500,
                deletions: 800,
              },
            ],
            parents: [],
          },
        ],
        fileChanges: [
          {
            path: 'package-lock.json',
            status: 'modified',
            additions: 1500,
            deletions: 800,
          },
        ],
        totalAdditions: 1500,
        totalDeletions: 800,
        dateRange: {
          from: new Date(),
          to: new Date(),
        },
        contributors: ['Dependabot'],
      };

      const result = processGitDiff(lockFileOnlyDiff, DEFAULT_DIFF_CONFIG);

      // All files should be filtered out
      expect(result.fileChanges).toHaveLength(0);
      expect(result.totalAdditions).toBe(0);
      expect(result.totalDeletions).toBe(0);

      // Commit message should be enhanced with context
      expect(result.commits[0]?.message).toContain('EXCLUDED FILES SUMMARY');
      expect(result.commits[0]?.message).toContain('CONTEXT: Dependency lock files updated');
    });
  });
});
