/**
 * Git Operations Module
 * Handles git repository operations including branch management, diff generation, and commit operations
 */

import { execSync } from 'child_process';
import * as core from '@actions/core';
import type { GitDiff, GitFileChange, CommitInfo, RepositoryInfo } from './types/index.js';

/**
 * Error thrown when git operations fail
 */
export class GitOperationError extends Error {
  constructor(
    message: string,
    public readonly command?: string,
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'GitOperationError';
  }
}

/**
 * Git operations class for handling repository interactions
 */
export class GitOperations {
  private readonly workingDirectory: string;

  constructor(workingDirectory: string = process.cwd(), githubToken?: string) {
    this.workingDirectory = workingDirectory;

    // Configure git remote authentication if GitHub token is provided
    if (githubToken !== undefined && githubToken !== '') {
      this.configureGitAuthentication(githubToken);
    }
  }

  /**
   * Configure git authentication for GitHub
   */
  private configureGitAuthentication(githubToken: string): void {
    try {
      // Get current remote URL
      const remoteUrl = this.executeGitCommand('remote get-url origin').trim();

      // Skip configuration if URL is already authenticated or masked
      if (remoteUrl.includes('@') && remoteUrl.includes('github.com')) {
        core.debug('Git remote URL already appears to be authenticated, skipping configuration');
        return;
      }

      // Skip configuration if URL appears to be masked (contains ***)
      if (remoteUrl.includes('***')) {
        core.debug('Git remote URL appears to be masked, skipping authentication configuration');
        return;
      }

      // Convert to authenticated URL if it's not already
      let authUrl: string;
      if (remoteUrl.startsWith('https://github.com/')) {
        // Already HTTPS, just add token
        authUrl = remoteUrl.replace(
          'https://github.com/',
          `https://x-access-token:${githubToken}@github.com/`
        );
      } else if (remoteUrl.startsWith('git@github.com:')) {
        // Convert SSH to HTTPS with token
        const sshPattern = /git@github\.com:([^/]+)\/(.+)\.git$/;
        const match = sshPattern.exec(remoteUrl);
        if (
          match?.[1] !== undefined &&
          match[1] !== '' &&
          match[2] !== undefined &&
          match[2] !== ''
        ) {
          authUrl = `https://x-access-token:${githubToken}@github.com/${match[1]}/${match[2]}.git`;
        } else {
          throw new Error('Unable to parse SSH URL');
        }
      } else {
        core.debug(`Skipping authentication for unsupported URL format: ${remoteUrl}`);
        return;
      }

      // Update remote URL with authentication
      this.executeGitCommand(`remote set-url origin "${authUrl}"`);
      core.debug('✅ Configured git authentication with GitHub token');
    } catch (error) {
      core.warning(
        `Failed to configure git authentication: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate repository state and permissions
   */
  validateRepository(): RepositoryInfo {
    try {
      // Check if we're in a git repository
      this.executeGitCommand('rev-parse --git-dir');

      // Get repository information
      const remoteUrl = this.executeGitCommand('remote get-url origin').trim();

      // For the default branch, we'll use a simple fallback approach
      // since the exact default branch isn't critical for most operations
      let defaultBranch = 'main'; // Safe fallback
      try {
        // Try to get the current branch if available
        const currentBranch = this.executeGitCommand('rev-parse --abbrev-ref HEAD').trim();
        if (currentBranch !== '' && currentBranch !== 'HEAD') {
          defaultBranch = currentBranch;
        }
      } catch {
        // If we can't get current branch, stick with 'main' fallback
        core.debug('Could not determine current branch, using "main" as default');
      }

      // Parse repository info from remote URL
      const repoInfo = this.parseRepositoryUrl(remoteUrl);

      return {
        owner: repoInfo.owner,
        name: repoInfo.name,
        defaultBranch,
        topics: [],
        languages: {},
        size: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new GitOperationError(
        `Repository validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a release branch from the base branch
   */
  createReleaseBranch(version: string, baseBranch: string = 'main'): string {
    const branchName = `release/${version}`;

    try {
      // Ensure we're on the latest base branch
      this.executeGitCommand(`checkout ${baseBranch}`);
      this.executeGitCommand('pull origin ' + baseBranch);

      // Check if branch already exists locally
      let localExists = false;
      try {
        this.executeGitCommand(`rev-parse --verify ${branchName}`);
        localExists = true;
        core.info(`📋 Local branch ${branchName} already exists, checking out`);
        this.executeGitCommand(`checkout ${branchName}`);
      } catch {
        localExists = false;
      }

      // Check if branch exists on remote
      let remoteExists = false;
      try {
        this.executeGitCommand(`ls-remote --exit-code origin ${branchName}`);
        remoteExists = true;
        core.info(`📋 Remote branch ${branchName} already exists`);
      } catch {
        remoteExists = false;
      }

      // Handle different scenarios
      if (localExists && remoteExists) {
        // Both exist, pull latest changes
        core.info(`🔄 Pulling latest changes from remote ${branchName}`);
        this.executeGitCommand(`pull origin ${branchName}`);
      } else if (!localExists && remoteExists) {
        // Remote exists but not local, checkout from remote
        core.info(`📥 Checking out existing remote branch ${branchName}`);
        this.executeGitCommand(`checkout --track origin/${branchName}`);
      } else if (!localExists && !remoteExists) {
        // Neither exists, create new branch
        core.info(`🌱 Creating new branch ${branchName}`);
        this.executeGitCommand(`checkout -b ${branchName}`);
        core.info(`✅ Created release branch: ${branchName}`);
      }
      // If localExists && !remoteExists, we're already on the local branch

      return branchName;
    } catch (error) {
      throw new GitOperationError(
        `Failed to create release branch: ${error instanceof Error ? error.message : String(error)}`,
        `git checkout -b ${branchName}`
      );
    }
  }

  /**
   * Generate diff between two branches
   */
  generateDiff(baseBranch: string, featureBranch: string): GitDiff {
    try {
      // Validate both branches exist
      this.validateBranches([baseBranch, featureBranch]);

      // Resolve branch references (handles local vs remote branches)
      const baseRef = this.resolveBranchRef(baseBranch);
      const featureRef = this.resolveBranchRef(featureBranch);

      // Get commit range
      const commits = this.getCommitsBetweenBranches(baseRef, featureRef);

      // Get file changes
      const fileChanges = this.getFileChangesBetweenBranches(baseRef, featureRef);

      // Calculate totals
      const totalAdditions = fileChanges.reduce((sum, change) => sum + change.additions, 0);
      const totalDeletions = fileChanges.reduce((sum, change) => sum + change.deletions, 0);

      // Get contributors
      const contributors = [...new Set(commits.map(commit => commit.author.email))];

      // Create date range
      const dateRange = {
        from:
          commits.length > 0
            ? (commits[commits.length - 1]?.author.date ?? new Date())
            : new Date(),
        to: commits.length > 0 ? (commits[0]?.author.date ?? new Date()) : new Date(),
      };

      return {
        commits,
        fileChanges,
        totalAdditions,
        totalDeletions,
        dateRange,
        contributors,
      };
    } catch (error) {
      throw new GitOperationError(
        `Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`,
        `git diff ${baseBranch}..${featureBranch}`
      );
    }
  }

  /**
   * Resolve branch name to a git reference (handles both local and remote branches)
   */
  private resolveBranchRef(branch: string): string {
    try {
      // First try local branch
      this.executeGitCommand(`rev-parse --verify ${branch}`);
      return branch;
    } catch {
      try {
        // Try remote branch
        this.executeGitCommand(`rev-parse --verify origin/${branch}`);
        return `origin/${branch}`;
      } catch {
        // If remote branch doesn't exist either, try to fetch latest remote refs
        try {
          this.executeGitCommand('fetch origin --prune');
          core.debug(`Fetched latest remote references`);
          // Try remote branch again after fetch
          this.executeGitCommand(`rev-parse --verify origin/${branch}`);
          return `origin/${branch}`;
        } catch {
          // If all attempts fail, return original name and let git handle the error
          return branch;
        }
      }
    }
  }

  /**
   * Validate that specified branches exist
   */
  validateBranches(branches: string[]): void {
    for (const branch of branches) {
      try {
        // First try to verify local branch
        this.executeGitCommand(`rev-parse --verify ${branch}`);
        core.debug(`Branch '${branch}' found locally`);
      } catch {
        try {
          // If local branch doesn't exist, try remote branch
          this.executeGitCommand(`rev-parse --verify origin/${branch}`);
          core.debug(`Branch '${branch}' found as remote branch 'origin/${branch}'`);
        } catch {
          // If remote branch doesn't exist either, try to fetch it
          try {
            // First, fetch all remote refs to ensure we have the latest information
            this.executeGitCommand('fetch origin --prune');
            core.debug(`Fetched latest remote references`);

            // Try remote branch again after fetch
            this.executeGitCommand(`rev-parse --verify origin/${branch}`);
            core.debug(`Branch '${branch}' found as remote branch 'origin/${branch}' after fetch`);
          } catch {
            // As a last resort, try to fetch the specific branch
            try {
              this.executeGitCommand(`fetch origin ${branch}`);
              core.debug(`Fetched specific branch '${branch}' from remote`);

              // Verify it exists as a remote branch now
              this.executeGitCommand(`rev-parse --verify origin/${branch}`);
              core.debug(`Branch '${branch}' verified as remote branch after specific fetch`);
            } catch {
              throw new GitOperationError(`Branch '${branch}' does not exist locally or on remote`);
            }
          }
        }
      }
    }
  }

  /**
   * Commit changes to the current branch
   */
  commitChanges(files: string[], message: string): string {
    try {
      // Add specified files
      for (const file of files) {
        this.executeGitCommand(`add "${file}"`);
      }

      // Check if there are changes to commit
      try {
        this.executeGitCommand('diff --cached --exit-code');
        core.info('No changes to commit');
        return '';
      } catch {
        // There are staged changes, proceed with commit
      }

      // Commit changes - use single quotes and simpler escaping for multi-line messages
      // Single quotes prevent shell interpretation of newlines and special characters
      const safeMessage = message.replace(/'/g, "'\"'\"'"); // Escape single quotes safely
      this.executeGitCommand(`commit -m '${safeMessage}'`);
      const commitSha = this.executeGitCommand('rev-parse HEAD').trim();

      core.info(`✅ Committed changes: ${commitSha.substring(0, 7)}`);
      return commitSha;
    } catch (error) {
      throw new GitOperationError(
        `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`,
        'git commit'
      );
    }
  }

  /**
   * Push commits to remote repository
   */
  pushChanges(branchName: string, setUpstream: boolean = false): void {
    try {
      // Check if the remote branch already exists
      let remoteExists = false;
      try {
        this.executeGitCommand(`ls-remote --exit-code origin ${branchName}`);
        remoteExists = true;
        core.debug(`Remote branch ${branchName} already exists`);
      } catch {
        remoteExists = false;
        core.debug(`Remote branch ${branchName} does not exist`);
      }

      // Use appropriate push command based on remote branch existence
      let pushCommand: string;
      if (remoteExists) {
        // Branch exists remotely, just push normally
        pushCommand = `push origin ${branchName}`;
      } else if (setUpstream) {
        // New branch, set upstream
        pushCommand = `push --set-upstream origin ${branchName}`;
      } else {
        // Regular push
        pushCommand = `push origin ${branchName}`;
      }

      this.executeGitCommand(pushCommand);
      core.info(`✅ Pushed changes to ${branchName}`);
    } catch (error) {
      throw new GitOperationError(
        `Failed to push changes: ${error instanceof Error ? error.message : String(error)}`,
        `git push origin ${branchName}`
      );
    }
  }

  /**
   * Commit and push changes in one operation
   */
  commitAndPush(
    files: string[],
    message: string,
    branchName: string,
    setUpstream: boolean = false
  ): string {
    const commitSha = this.commitChanges(files, message);
    if (commitSha !== '') {
      this.pushChanges(branchName, setUpstream);
    }
    return commitSha;
  }

  /**
   * Get the current branch name
   */
  getCurrentBranch(): string {
    try {
      return this.executeGitCommand('branch --show-current').trim();
    } catch (error) {
      throw new GitOperationError(
        `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the latest commit SHA
   */
  getLatestCommitSha(): string {
    try {
      return this.executeGitCommand('rev-parse HEAD').trim();
    } catch (error) {
      throw new GitOperationError(
        `Failed to get latest commit SHA: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if working directory is clean
   */
  isWorkingDirectoryClean(): boolean {
    try {
      this.executeGitCommand('diff --exit-code');
      this.executeGitCommand('diff --cached --exit-code');
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods

  /**
   * Execute a git command and return output
   */
  private executeGitCommand(command: string): string {
    try {
      const fullCommand = `git ${command}`;
      core.debug(`Executing: ${fullCommand}`);

      const result = execSync(fullCommand, {
        cwd: this.workingDirectory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      return result;
    } catch (error) {
      const execError = error as { status?: number; stderr?: Buffer };
      throw new GitOperationError(`Git command failed: ${command}`, command, execError.status);
    }
  }

  /**
   * Parse repository URL to extract owner and name
   */
  private parseRepositoryUrl(url: string): { owner: string; name: string } {
    // Handle masked URLs first (GitHub Actions may mask tokens)
    if (url.includes('***')) {
      // Try to extract from a masked URL pattern like: ***github.com/owner/repo
      const maskedPattern = /\*{3}github\.com\/([^/]+)\/([^/\s]+)/;
      const maskedMatch = maskedPattern.exec(url);
      if (
        maskedMatch?.[1] !== undefined &&
        maskedMatch[1] !== '' &&
        maskedMatch[2] !== undefined &&
        maskedMatch[2] !== ''
      ) {
        return {
          owner: maskedMatch[1],
          name: maskedMatch[2].replace(/\.git$/, ''), // Remove .git if present
        };
      }
    }

    // Handle authenticated HTTPS URLs, SSH URLs, and regular URLs
    const patterns = [
      // Authenticated HTTPS: https://token@github.com/owner/repo.git
      /https:\/\/[^@]+@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
      // Regular HTTPS: https://github.com/owner/repo.git
      /https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
      // SSH: git@github.com:owner/repo.git
      /git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(url);
      if (
        match?.[1] !== undefined &&
        match[1] !== '' &&
        match[2] !== undefined &&
        match[2] !== ''
      ) {
        return {
          owner: match[1],
          name: match[2],
        };
      }
    }

    throw new GitOperationError(`Unable to parse repository URL: ${url}`);
  }

  /**
   * Get commits between two branches
   */
  private getCommitsBetweenBranches(baseBranch: string, featureBranch: string): CommitInfo[] {
    try {
      const logFormat = '%H|%s|%an|%ae|%at|%cn|%ce|%ct';
      const logOutput = this.executeGitCommand(
        `log --pretty=format:"${logFormat}" ${baseBranch}..${featureBranch}`
      );

      if (logOutput.trim() === '') {
        return [];
      }

      const commits: CommitInfo[] = [];
      const lines = logOutput.trim().split('\n');

      for (const line of lines) {
        const [
          sha,
          message,
          authorName,
          authorEmail,
          authorDate,
          committerName,
          committerEmail,
          committerDate,
        ] = line.split('|');

        if (sha !== undefined && sha !== '' && message !== undefined && message !== '') {
          // Get files changed in this commit
          const files = this.getFilesChangedInCommit(sha);

          // Get parent commits
          const parents = this.executeGitCommand(`rev-list --parents -n 1 ${sha}`)
            .trim()
            .split(' ')
            .slice(1);

          commits.push({
            sha,
            message,
            author: {
              name: authorName ?? 'Unknown',
              email: authorEmail ?? 'unknown@unknown.com',
              date: new Date(parseInt(authorDate ?? '0', 10) * 1000),
            },
            committer: {
              name: committerName ?? 'Unknown',
              email: committerEmail ?? 'unknown@unknown.com',
              date: new Date(parseInt(committerDate ?? '0', 10) * 1000),
            },
            files,
            parents,
          });
        }
      }

      return commits;
    } catch (error) {
      throw new GitOperationError(
        `Failed to get commits: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get file changes between two branches
   */
  private getFileChangesBetweenBranches(
    baseBranch: string,
    featureBranch: string
  ): GitFileChange[] {
    try {
      const diffOutput = this.executeGitCommand(`diff --numstat ${baseBranch}..${featureBranch}`);

      if (diffOutput.trim() === '') {
        return [];
      }

      const fileChanges: GitFileChange[] = [];
      const lines = diffOutput.trim().split('\n');

      for (const line of lines) {
        const [additions, deletions, path] = line.split('\t');

        if (path !== undefined && path !== '') {
          // Determine status
          let status: GitFileChange['status'] = 'modified';
          if (additions !== '0' && deletions === '0') {
            status = 'added';
          } else if (additions === '0' && deletions !== '0') {
            status = 'deleted';
          }

          fileChanges.push({
            path,
            status,
            additions: parseInt(additions ?? '0', 10),
            deletions: parseInt(deletions ?? '0', 10),
          });
        }
      }

      return fileChanges;
    } catch (error) {
      throw new GitOperationError(
        `Failed to get file changes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get files changed in a specific commit
   */
  private getFilesChangedInCommit(sha: string): GitFileChange[] {
    try {
      const diffOutput = this.executeGitCommand(`show --numstat --format="" ${sha}`);

      if (diffOutput.trim() === '') {
        return [];
      }

      const fileChanges: GitFileChange[] = [];
      const lines = diffOutput.trim().split('\n');

      for (const line of lines) {
        const [additions, deletions, path] = line.split('\t');

        if (path !== undefined && path !== '') {
          fileChanges.push({
            path,
            status: 'modified', // Simplified for now
            additions: parseInt(additions ?? '0', 10),
            deletions: parseInt(deletions ?? '0', 10),
          });
        }
      }

      return fileChanges;
    } catch (error) {
      // If we can't get file changes for a commit, return empty array
      core.debug(`Could not get file changes for commit ${sha}: ${String(error)}`);
      return [];
    }
  }
}

/**
 * Utility functions for git operations
 */
export const GitUtils = {
  /**
   * Validate branch name format
   */
  isValidBranchName(branchName: string): boolean {
    // Git branch naming rules
    const invalidPatterns = [
      /^-/, // Cannot start with dash
      /\/$/, // Cannot end with slash
      /\.\./, // Cannot contain double dots
      /[[\]~^:?*\\]/, // Cannot contain special characters
      /^@$/, // Cannot be just @
      /@{/, // Cannot contain @{
      /\s/, // Cannot contain spaces
    ];

    return !invalidPatterns.some(pattern => pattern.test(branchName));
  },

  /**
   * Sanitize branch name
   */
  sanitizeBranchName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  /**
   * Format commit message according to conventional commits
   */
  formatCommitMessage(type: string, scope: string | undefined, description: string): string {
    const scopePart = scope !== undefined && scope !== '' ? `(${scope})` : '';
    return `${type}${scopePart}: ${description}`;
  },

  /**
   * Parse conventional commit message
   */
  parseConventionalCommit(message: string): {
    type: string;
    scope?: string;
    description: string;
    isBreaking: boolean;
  } | null {
    const conventionalPattern = /^(\w+)(\(([^)]+)\))?(!?):\s*(.+)$/;
    const match = conventionalPattern.exec(message);

    if (match === null) {
      return null;
    }

    const [, type, , scope, breaking, description] = match;

    if (type === undefined || description === undefined) {
      return null;
    }

    const result: {
      type: string;
      scope?: string;
      description: string;
      isBreaking: boolean;
    } = {
      type,
      description,
      isBreaking: breaking === '!' || message.includes('BREAKING CHANGE:'),
    };

    if (scope !== undefined && scope !== '') {
      result.scope = scope;
    }

    return result;
  },
};
