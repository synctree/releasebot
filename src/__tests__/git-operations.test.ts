/**
 * @jest-environment node
 */

import { execSync } from 'child_process';
import * as core from '@actions/core';
import { GitOperations, GitOperationError, GitUtils } from '../git-operations.js';

// Mock child_process and @actions/core
jest.mock('child_process');
jest.mock('@actions/core');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockCore = core as jest.Mocked<typeof core>;

describe('GitOperations', () => {
  let gitOps: GitOperations;

  beforeEach(() => {
    gitOps = new GitOperations('/test/directory');
    jest.clearAllMocks();

    // Setup default mock behaviors
    mockCore.debug = jest.fn();
    mockCore.info = jest.fn();
    mockCore.warning = jest.fn();
  });

  describe('validateRepository', () => {
    it('should validate repository and return info', () => {
      mockExecSync
        .mockReturnValueOnce('') // rev-parse --git-dir
        .mockReturnValueOnce('git@github.com:synctree/releasebot.git\n') // remote get-url origin
        .mockReturnValueOnce('main\n'); // rev-parse --abbrev-ref HEAD

      const result = gitOps.validateRepository();

      expect(result).toEqual({
        owner: 'synctree',
        name: 'releasebot',
        defaultBranch: 'main',
        topics: [],
        languages: {},
        size: 0,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should handle HTTPS repository URL', () => {
      mockExecSync
        .mockReturnValueOnce('') // rev-parse --git-dir
        .mockReturnValueOnce('https://github.com/synctree/releasebot.git\n') // remote get-url origin
        .mockReturnValueOnce('main\n'); // rev-parse --abbrev-ref HEAD

      const result = gitOps.validateRepository();

      expect(result.owner).toBe('synctree');
      expect(result.name).toBe('releasebot');
    });

    it('should fallback to "main" when current branch detection fails', () => {
      mockExecSync
        .mockReturnValueOnce('') // rev-parse --git-dir
        .mockReturnValueOnce('git@github.com:synctree/releasebot.git\n') // remote get-url origin
        .mockImplementationOnce(() => {
          // rev-parse --abbrev-ref HEAD fails
          throw new Error('Unable to get current branch');
        });

      const result = gitOps.validateRepository();

      expect(result.defaultBranch).toBe('main');
      expect(mockCore.debug).toHaveBeenCalledWith(
        'Could not determine current branch, using "main" as default'
      );
    });

    it('should fallback to "main" when current branch is HEAD', () => {
      mockExecSync
        .mockReturnValueOnce('') // rev-parse --git-dir
        .mockReturnValueOnce('git@github.com:synctree/releasebot.git\n') // remote get-url origin
        .mockReturnValueOnce('HEAD\n'); // rev-parse --abbrev-ref HEAD returns HEAD (detached)

      const result = gitOps.validateRepository();

      expect(result.defaultBranch).toBe('main');
    });

    it('should throw error if not in git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      expect(() => gitOps.validateRepository()).toThrow(GitOperationError);
      expect(() => gitOps.validateRepository()).toThrow('Repository validation failed');
    });

    it('should throw error for invalid repository URL', () => {
      mockExecSync
        .mockReturnValueOnce('') // rev-parse --git-dir
        .mockReturnValueOnce('invalid-url\n'); // remote get-url origin (this will cause the parsing error)

      expect(() => gitOps.validateRepository()).toThrow(GitOperationError);
      expect(() => gitOps.validateRepository()).toThrow('Repository validation failed');
    });
  });

  describe('createReleaseBranch', () => {
    it('should create new release branch', () => {
      mockExecSync
        .mockReturnValueOnce('') // checkout main
        .mockReturnValueOnce('') // pull origin main
        .mockImplementationOnce(() => {
          // rev-parse --verify release/1.0.0
          throw new Error('Branch does not exist');
        })
        .mockReturnValueOnce(''); // checkout -b release/1.0.0

      const result = gitOps.createReleaseBranch('1.0.0');

      expect(result).toBe('release/1.0.0');
      expect(mockExecSync).toHaveBeenCalledWith('git checkout main', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git pull origin main', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith(
        'git checkout -b release/1.0.0',
        expect.any(Object)
      );
      expect(mockCore.info).toHaveBeenCalledWith('✅ Created release branch: release/1.0.0');
    });

    it('should use existing release branch if it exists', () => {
      mockExecSync
        .mockReturnValueOnce('') // checkout main
        .mockReturnValueOnce('') // pull origin main
        .mockReturnValueOnce('abc123\n') // rev-parse --verify release/1.0.0
        .mockReturnValueOnce(''); // checkout release/1.0.0

      const result = gitOps.createReleaseBranch('1.0.0');

      expect(result).toBe('release/1.0.0');
      expect(mockCore.warning).toHaveBeenCalledWith(
        'Branch release/1.0.0 already exists, using existing branch'
      );
    });

    it('should use custom base branch', () => {
      mockExecSync
        .mockReturnValueOnce('') // checkout develop
        .mockReturnValueOnce('') // pull origin develop
        .mockImplementationOnce(() => {
          // rev-parse --verify release/1.0.0
          throw new Error('Branch does not exist');
        })
        .mockReturnValueOnce(''); // checkout -b release/1.0.0

      gitOps.createReleaseBranch('1.0.0', 'develop');

      expect(mockExecSync).toHaveBeenCalledWith('git checkout develop', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git pull origin develop', expect.any(Object));
    });

    it('should throw error if git commands fail', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed');
      });

      expect(() => gitOps.createReleaseBranch('1.0.0')).toThrow(GitOperationError);
      expect(() => gitOps.createReleaseBranch('1.0.0')).toThrow('Failed to create release branch');
    });
  });

  describe('generateDiff', () => {
    it('should generate diff between branches', () => {
      // Mock branch validation (validateBranches)
      mockExecSync
        .mockReturnValueOnce('abc123\n') // validateBranches: rev-parse --verify main (succeeds locally)
        .mockReturnValueOnce('def456\n') // validateBranches: rev-parse --verify feature (succeeds locally)
        // Mock branch reference resolution (resolveBranchRef)
        .mockReturnValueOnce('abc123\n') // resolveBranchRef: rev-parse --verify main (succeeds locally)
        .mockReturnValueOnce('def456\n') // resolveBranchRef: rev-parse --verify feature (succeeds locally)
        .mockReturnValueOnce(
          `abc123|feat: add new feature|John Doe|john@example.com|1640995200|John Doe|john@example.com|1640995200\n`
        ) // git log
        .mockReturnValueOnce('abc123\n') // rev-list --parents (just commit sha, no parents)
        .mockReturnValueOnce('') // show --numstat for commit files
        .mockReturnValueOnce('10\t5\tsrc/feature.ts\n0\t2\tREADME.md\n'); // diff --numstat

      const result = gitOps.generateDiff('main', 'feature');

      expect(result).toEqual({
        commits: [
          {
            sha: 'abc123',
            message: 'feat: add new feature',
            author: {
              name: 'John Doe',
              email: 'john@example.com',
              date: new Date(1640995200 * 1000),
            },
            committer: {
              name: 'John Doe',
              email: 'john@example.com',
              date: new Date(1640995200 * 1000),
            },
            files: [],
            parents: [],
          },
        ],
        fileChanges: [
          {
            path: 'src/feature.ts',
            status: 'modified',
            additions: 10,
            deletions: 5,
          },
          {
            path: 'README.md',
            status: 'deleted',
            additions: 0,
            deletions: 2,
          },
        ],
        totalAdditions: 10,
        totalDeletions: 7,
        dateRange: {
          from: new Date(1640995200 * 1000),
          to: new Date(1640995200 * 1000),
        },
        contributors: ['john@example.com'],
      });
    });

    it('should handle empty diff', () => {
      mockExecSync
        .mockReturnValueOnce('abc123\n') // validateBranches: rev-parse --verify main (succeeds locally)
        .mockReturnValueOnce('def456\n') // validateBranches: rev-parse --verify feature (succeeds locally)
        // Mock branch reference resolution (resolveBranchRef)
        .mockReturnValueOnce('abc123\n') // resolveBranchRef: rev-parse --verify main (succeeds locally)
        .mockReturnValueOnce('def456\n') // resolveBranchRef: rev-parse --verify feature (succeeds locally)
        .mockReturnValueOnce('') // git log (empty)
        .mockReturnValueOnce(''); // diff --numstat (empty)

      const result = gitOps.generateDiff('main', 'feature');

      expect(result.commits).toHaveLength(0);
      expect(result.fileChanges).toHaveLength(0);
      expect(result.totalAdditions).toBe(0);
      expect(result.totalDeletions).toBe(0);
    });

    it('should throw error for invalid branches', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Branch does not exist');
      });

      expect(() => gitOps.generateDiff('main', 'nonexistent')).toThrow(GitOperationError);
      expect(() => gitOps.generateDiff('main', 'nonexistent')).toThrow(
        "Branch 'main' does not exist"
      );
    });
  });

  describe('validateBranches', () => {
    it('should validate existing branches', () => {
      mockExecSync
        .mockReturnValueOnce('abc123\n') // rev-parse main (succeeds locally)
        .mockReturnValueOnce('def456\n'); // rev-parse feature (succeeds locally)

      expect(() => gitOps.validateBranches(['main', 'feature'])).not.toThrow();
    });

    it('should throw error for non-existent branch', () => {
      // Reset the mock to avoid interference from previous tests
      mockExecSync.mockReset();

      // Mock sequence: local branch check fails, remote branch check fails, fetch fails
      mockExecSync
        .mockReturnValueOnce('abc123\n') // First call for 'main' succeeds
        .mockImplementationOnce(() => {
          throw new Error('Branch does not exist'); // Local branch check fails
        })
        .mockImplementationOnce(() => {
          throw new Error('Remote branch does not exist'); // Remote branch check fails
        })
        .mockImplementationOnce(() => {
          throw new Error('Fetch failed'); // Fetch attempt fails
        });

      // The first call will test 'main' successfully, but the second call will fail on 'nonexistent'
      expect(() => gitOps.validateBranches(['main', 'nonexistent'])).toThrow(GitOperationError);

      // Reset and test again for the error message
      mockExecSync.mockReset();
      mockExecSync
        .mockReturnValueOnce('abc123\n') // First call for 'main' succeeds
        .mockImplementationOnce(() => {
          throw new Error('Branch does not exist'); // Local branch check fails
        })
        .mockImplementationOnce(() => {
          throw new Error('Remote branch does not exist'); // Remote branch check fails
        })
        .mockImplementationOnce(() => {
          throw new Error('Fetch failed'); // Fetch attempt fails
        });

      expect(() => gitOps.validateBranches(['main', 'nonexistent'])).toThrow(
        "Branch 'nonexistent' does not exist locally or on remote"
      );
    });
  });

  describe('commitChanges', () => {
    it('should commit changes when files are staged', () => {
      mockExecSync
        .mockReturnValueOnce('') // add file1
        .mockReturnValueOnce('') // add file2
        .mockImplementationOnce(() => {
          // diff --cached --exit-code
          throw new Error('Changes exist');
        })
        .mockReturnValueOnce('') // commit
        .mockReturnValueOnce('abc123def456\n'); // rev-parse HEAD

      const result = gitOps.commitChanges(['file1.txt', 'file2.txt'], 'test commit');

      expect(result).toBe('abc123def456');
      expect(mockExecSync).toHaveBeenCalledWith('git add "file1.txt"', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git add "file2.txt"', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git commit -m "test commit"', expect.any(Object));
      expect(mockCore.info).toHaveBeenCalledWith('✅ Committed changes: abc123d');
    });

    it('should return empty string when no changes to commit', () => {
      mockExecSync
        .mockReturnValueOnce('') // add file1
        .mockReturnValueOnce(''); // diff --cached --exit-code (no changes)

      const result = gitOps.commitChanges(['file1.txt'], 'test commit');

      expect(result).toBe('');
      expect(mockCore.info).toHaveBeenCalledWith('No changes to commit');
    });

    it('should throw error if commit fails', () => {
      mockExecSync
        .mockReturnValueOnce('') // add file1
        .mockImplementationOnce(() => {
          // diff --cached --exit-code
          throw new Error('Changes exist');
        })
        .mockImplementationOnce(() => {
          // commit
          throw new Error('Commit failed');
        });

      expect(() => gitOps.commitChanges(['file1.txt'], 'test commit')).toThrow(
        'Failed to commit changes'
      );
    });
  });

  describe('pushChanges', () => {
    it('should push changes to remote branch', () => {
      mockExecSync.mockReturnValueOnce(''); // push origin feature

      gitOps.pushChanges('feature');

      expect(mockExecSync).toHaveBeenCalledWith('git push origin feature', expect.any(Object));
      expect(mockCore.info).toHaveBeenCalledWith('✅ Pushed changes to feature');
    });

    it('should set upstream when requested', () => {
      mockExecSync.mockReturnValueOnce(''); // push --set-upstream origin feature

      gitOps.pushChanges('feature', true);

      expect(mockExecSync).toHaveBeenCalledWith(
        'git push --set-upstream origin feature',
        expect.any(Object)
      );
    });

    it('should throw error if push fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Push failed');
      });

      expect(() => gitOps.pushChanges('feature')).toThrow(GitOperationError);
      expect(() => gitOps.pushChanges('feature')).toThrow('Failed to push changes');
    });
  });

  describe('commitAndPush', () => {
    it('should commit and push when there are changes', () => {
      mockExecSync
        .mockReturnValueOnce('') // add file1
        .mockImplementationOnce(() => {
          // diff --cached --exit-code
          throw new Error('Changes exist');
        })
        .mockReturnValueOnce('') // commit
        .mockReturnValueOnce('abc123\n') // rev-parse HEAD
        .mockReturnValueOnce(''); // push

      const result = gitOps.commitAndPush(['file1.txt'], 'test commit', 'feature');

      expect(result).toBe('abc123');
      expect(mockExecSync).toHaveBeenCalledWith('git push origin feature', expect.any(Object));
    });

    it('should not push when no changes to commit', () => {
      mockExecSync
        .mockReturnValueOnce('') // add file1
        .mockReturnValueOnce(''); // diff --cached --exit-code (no changes)

      const result = gitOps.commitAndPush(['file1.txt'], 'test commit', 'feature');

      expect(result).toBe('');
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('push'),
        expect.any(Object)
      );
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', () => {
      mockExecSync.mockReturnValueOnce('main\n');

      const result = gitOps.getCurrentBranch();

      expect(result).toBe('main');
      expect(mockExecSync).toHaveBeenCalledWith('git branch --show-current', expect.any(Object));
    });

    it('should throw error if command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not in git repository');
      });

      expect(() => gitOps.getCurrentBranch()).toThrow(GitOperationError);
      expect(() => gitOps.getCurrentBranch()).toThrow('Failed to get current branch');
    });
  });

  describe('getLatestCommitSha', () => {
    it('should return latest commit SHA', () => {
      mockExecSync.mockReturnValueOnce('abc123def456\n');

      const result = gitOps.getLatestCommitSha();

      expect(result).toBe('abc123def456');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', expect.any(Object));
    });

    it('should throw error if command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not in git repository');
      });

      expect(() => gitOps.getLatestCommitSha()).toThrow(GitOperationError);
      expect(() => gitOps.getLatestCommitSha()).toThrow('Failed to get latest commit SHA');
    });
  });

  describe('isWorkingDirectoryClean', () => {
    it('should return true for clean working directory', () => {
      mockExecSync
        .mockReturnValueOnce('') // diff --exit-code
        .mockReturnValueOnce(''); // diff --cached --exit-code

      const result = gitOps.isWorkingDirectoryClean();

      expect(result).toBe(true);
    });

    it('should return false for dirty working directory', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Changes exist');
      });

      const result = gitOps.isWorkingDirectoryClean();

      expect(result).toBe(false);
    });
  });
});

describe('GitUtils', () => {
  describe('isValidBranchName', () => {
    it('should validate correct branch names', () => {
      expect(GitUtils.isValidBranchName('main')).toBe(true);
      expect(GitUtils.isValidBranchName('feature/new-feature')).toBe(true);
      expect(GitUtils.isValidBranchName('release/1.0.0')).toBe(true);
      expect(GitUtils.isValidBranchName('fix-123')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(GitUtils.isValidBranchName('-main')).toBe(false); // starts with dash
      expect(GitUtils.isValidBranchName('feature/')).toBe(false); // ends with slash
      expect(GitUtils.isValidBranchName('feature..name')).toBe(false); // double dots
      expect(GitUtils.isValidBranchName('feature*name')).toBe(false); // special characters
      expect(GitUtils.isValidBranchName('@')).toBe(false); // just @
      expect(GitUtils.isValidBranchName('feature@{name')).toBe(false); // @{
      expect(GitUtils.isValidBranchName('feature name')).toBe(false); // spaces
    });
  });

  describe('sanitizeBranchName', () => {
    it('should sanitize branch names', () => {
      expect(GitUtils.sanitizeBranchName('Feature Name!')).toBe('feature-name');
      expect(GitUtils.sanitizeBranchName('--start-end--')).toBe('start-end');
      expect(GitUtils.sanitizeBranchName('multiple---dashes')).toBe('multiple-dashes');
      expect(GitUtils.sanitizeBranchName('Mixed_CASE.name')).toBe('mixed_case.name');
    });
  });

  describe('formatCommitMessage', () => {
    it('should format conventional commit message without scope', () => {
      const result = GitUtils.formatCommitMessage('feat', undefined, 'add new feature');
      expect(result).toBe('feat: add new feature');
    });

    it('should format conventional commit message with scope', () => {
      const result = GitUtils.formatCommitMessage('fix', 'auth', 'resolve login issue');
      expect(result).toBe('fix(auth): resolve login issue');
    });

    it('should handle empty scope', () => {
      const result = GitUtils.formatCommitMessage('docs', '', 'update README');
      expect(result).toBe('docs: update README');
    });
  });

  describe('parseConventionalCommit', () => {
    it('should parse conventional commit without scope', () => {
      const result = GitUtils.parseConventionalCommit('feat: add new feature');
      expect(result).toEqual({
        type: 'feat',
        description: 'add new feature',
        isBreaking: false,
      });
    });

    it('should parse conventional commit with scope', () => {
      const result = GitUtils.parseConventionalCommit('fix(auth): resolve login issue');
      expect(result).toEqual({
        type: 'fix',
        scope: 'auth',
        description: 'resolve login issue',
        isBreaking: false,
      });
    });

    it('should detect breaking changes with !', () => {
      const result = GitUtils.parseConventionalCommit('feat!: breaking change');
      expect(result).toEqual({
        type: 'feat',
        description: 'breaking change',
        isBreaking: true,
      });
    });

    it('should detect breaking changes with BREAKING CHANGE:', () => {
      const result = GitUtils.parseConventionalCommit(
        'feat: add feature\\n\\nBREAKING CHANGE: removes old API'
      );
      expect(result).toEqual({
        type: 'feat',
        description: 'add feature\\n\\nBREAKING CHANGE: removes old API',
        isBreaking: true,
      });
    });

    it('should return null for invalid format', () => {
      expect(GitUtils.parseConventionalCommit('invalid commit message')).toBeNull();
      expect(GitUtils.parseConventionalCommit('feat add feature')).toBeNull(); // missing colon
      expect(GitUtils.parseConventionalCommit('')).toBeNull();
    });
  });
});

describe('GitOperationError', () => {
  it('should create error with message only', () => {
    const error = new GitOperationError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('GitOperationError');
    expect(error.command).toBeUndefined();
    expect(error.exitCode).toBeUndefined();
  });

  it('should create error with command and exit code', () => {
    const error = new GitOperationError('Git command failed', 'git status', 128);
    expect(error.message).toBe('Git command failed');
    expect(error.command).toBe('git status');
    expect(error.exitCode).toBe(128);
  });
});
