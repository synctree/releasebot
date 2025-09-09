/**
 * Diff Processing Utilities
 * Smart filtering and compression of git diffs for AI analysis
 */

import * as core from '@actions/core';
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
export const DEFAULT_DIFF_CONFIG: DiffProcessorConfig = {
  maxFiles: 50, // Reasonable limit for AI analysis
  excludePatterns: [
    '*.lock',
    '*.log',
    '*.min.js',
    '*.map',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '*.test.ts',
    '*.test.js',
    '*.spec.ts',
    '*.spec.js',
    '__tests__/**',
    'tests/**',
    'test/**',
    '*.md',
    'docs/**',
    '.github/**',
    'dist/**',
    'build/**',
    'node_modules/**',
  ],
  priorityPatterns: [
    'src/**/*.ts',
    'src/**/*.js',
    'lib/**/*.ts',
    'lib/**/*.js',
    'index.ts',
    'index.js',
    'package.json',
    '*.ts',
    '*.js',
  ],
  maxTotalChanges: 2000,
};

/**
 * Checks if file matches any pattern
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.');
    return new RegExp(`^${regexPattern}$`).test(filePath);
  });
}

/**
 * Filters and prioritizes file changes for AI analysis
 */
export function filterFileChanges(
  fileChanges: GitFileChange[],
  config: DiffProcessorConfig = DEFAULT_DIFF_CONFIG
): GitFileChange[] {
  // Filter out excluded files
  const filtered = fileChanges.filter(file => !matchesPattern(file.path, config.excludePatterns));

  // Sort by priority (priority files first, then by impact)
  const sorted = filtered.sort((a, b) => {
    const aIsPriority = matchesPattern(a.path, config.priorityPatterns);
    const bIsPriority = matchesPattern(b.path, config.priorityPatterns);

    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;

    // Secondary sort by change impact (additions + deletions)
    const aImpact = a.additions + a.deletions;
    const bImpact = b.additions + b.deletions;
    return bImpact - aImpact;
  });

  core.debug(`📊 Filtered ${fileChanges.length} files to ${sorted.length} for AI analysis`);
  return sorted;
}

/**
 * Compresses file changes to fit within limits
 */
export function compressFileChanges(
  fileChanges: GitFileChange[],
  config: DiffProcessorConfig = DEFAULT_DIFF_CONFIG
): GitFileChange[] {
  const filtered = filterFileChanges(fileChanges, config);
  let currentChanges = 0;
  const result: GitFileChange[] = [];

  for (const file of filtered) {
    const fileChanges = file.additions + file.deletions;

    if (currentChanges + fileChanges <= config.maxTotalChanges && result.length < config.maxFiles) {
      result.push(file);
      currentChanges += fileChanges;
    } else {
      // Stop if we've reached limits
      break;
    }
  }

  if (result.length < filtered.length) {
    core.warning(
      `📦 Compressed diff from ${filtered.length} to ${result.length} files to fit analysis limits`
    );
  }

  return result;
}

/**
 * Creates a smart summary of excluded files
 */
export function createExcludedFilesSummary(
  originalFiles: GitFileChange[],
  includedFiles: GitFileChange[]
): string {
  const excludedFiles = originalFiles.filter(
    file => !includedFiles.some(included => included.path === file.path)
  );

  if (excludedFiles.length === 0) {
    return '';
  }

  // Group by file type/category
  const categories = new Map<string, GitFileChange[]>();

  excludedFiles.forEach(file => {
    const ext = file.path.split('.').pop() ?? 'other';
    const category = categories.get(ext) ?? [];
    category.push(file);
    categories.set(ext, category);
  });

  let summary = `\nEXCLUDED FILES SUMMARY (${excludedFiles.length} files):\n`;

  for (const [category, files] of categories) {
    const totalChanges = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
    summary += `- ${category}: ${files.length} files, ${totalChanges} lines changed\n`;
  }

  return summary;
}

/**
 * Processes a GitDiff to fit within constraints for AI analysis
 */
export function processGitDiff(
  gitDiff: GitDiff,
  config: DiffProcessorConfig = DEFAULT_DIFF_CONFIG
): GitDiff {
  const processedFiles = compressFileChanges(gitDiff.fileChanges, config);
  const excludedSummary = createExcludedFilesSummary(gitDiff.fileChanges, processedFiles);

  // Recalculate totals based on included files
  const totalAdditions = processedFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = processedFiles.reduce((sum, file) => sum + file.deletions, 0);

  // Special handling for when ALL files are filtered out
  let enhancedCommits = gitDiff.commits;
  if (processedFiles.length === 0 && gitDiff.fileChanges.length > 0) {
    core.warning('🚨 All file changes were filtered out - analyzing based on commit messages only');

    // Enhance the first commit message with detailed context
    enhancedCommits = gitDiff.commits.map((commit, index) => {
      if (index === 0) {
        const contextualInfo = analyzeFilteredChanges(gitDiff.fileChanges);
        return {
          ...commit,
          message: `${commit.message}${excludedSummary}\n\nCONTEXT: ${contextualInfo}`,
        };
      }
      return commit;
    });
  } else if (excludedSummary !== '') {
    // Normal case - just add excluded files summary
    enhancedCommits = gitDiff.commits.map((commit, index) =>
      index === 0 ? { ...commit, message: commit.message + excludedSummary } : commit
    );
  }

  return {
    ...gitDiff,
    fileChanges: processedFiles,
    totalAdditions,
    totalDeletions,
    commits: enhancedCommits,
  };
}

/**
 * Analyzes filtered changes to provide context when all files are excluded
 */
function analyzeFilteredChanges(filteredFiles: GitFileChange[]): string {
  const lockFiles = filteredFiles.filter(
    f => f.path.includes('lock') || f.path.endsWith('-lock.json') || f.path.endsWith('.lock')
  );

  const docFiles = filteredFiles.filter(
    f =>
      f.path.toLowerCase().includes('readme') ||
      f.path.toLowerCase().includes('doc') ||
      f.path.endsWith('.md')
  );

  const testFiles = filteredFiles.filter(
    f => f.path.includes('test') || f.path.includes('spec') || f.path.includes('__tests__')
  );

  const configFiles = filteredFiles.filter(
    f =>
      f.path.includes('config') ||
      f.path.startsWith('.') ||
      f.path.includes('.json') ||
      f.path.includes('.yml') ||
      f.path.includes('.yaml')
  );

  const contexts = [];

  if (lockFiles.length > 0) {
    contexts.push(`Dependency lock files updated (${lockFiles.length} files)`);
  }

  if (docFiles.length > 0) {
    contexts.push(`Documentation changes (${docFiles.length} files)`);
  }

  if (testFiles.length > 0) {
    contexts.push(`Test-related changes (${testFiles.length} files)`);
  }

  if (configFiles.length > 0) {
    contexts.push(`Configuration updates (${configFiles.length} files)`);
  }

  return contexts.length > 0
    ? contexts.join(', ')
    : 'Infrastructure or build-related changes detected';
}
