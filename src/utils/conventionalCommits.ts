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
export function parseConventionalCommit(message: string): ConventionalCommit {
  const type = categorizeCommitType(message);
  const scope = extractScope(message);
  const description = cleanCommitMessage(message);
  const isBreaking = message.includes('BREAKING CHANGE') || message.includes('!:');

  return {
    type,
    scope,
    description,
    isBreaking,
    rawMessage: message,
  };
}

/**
 * Categorize commit type based on conventional commits
 */
export function categorizeCommitType(message: string): ChangeCategory {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.startsWith('feat')) return 'feat';
  if (lowerMessage.startsWith('fix')) return 'fix';
  if (lowerMessage.startsWith('docs')) return 'docs';
  if (lowerMessage.startsWith('style')) return 'style';
  if (lowerMessage.startsWith('refactor')) return 'refactor';
  if (lowerMessage.startsWith('perf')) return 'perf';
  if (lowerMessage.startsWith('test')) return 'test';
  if (lowerMessage.startsWith('build')) return 'build';
  if (lowerMessage.startsWith('ci')) return 'ci';
  if (lowerMessage.startsWith('chore')) return 'chore';
  if (lowerMessage.startsWith('revert')) return 'revert';

  return 'chore'; // Default fallback
}

/**
 * Extract scope from conventional commit message
 */
export function extractScope(message: string): string | undefined {
  const regex = /^[a-z]+\(([^)]+)\):/;
  const scopeMatch = regex.exec(message);
  return scopeMatch !== null ? scopeMatch[1] : undefined;
}

/**
 * Clean and extract description from commit message
 */
export function cleanCommitMessage(message: string): string {
  // Remove conventional commit prefix
  const cleaned = message.replace(/^[a-z]+(\([^)]+\))?!?:\s*/, '');

  // Take only the first line and trim
  const firstLine = cleaned.split('\n')[0];
  return firstLine !== undefined ? firstLine.trim() : '';
}

/**
 * Check if a commit message follows conventional commit format
 */
export function isConventionalCommit(message: string): boolean {
  const conventionalPattern = /^[a-z]+(\([^)]+\))?!?:\s*.+/;
  return conventionalPattern.test(message.toLowerCase());
}

/**
 * Determine if a commit represents a breaking change
 */
export function isBreakingChange(message: string): boolean {
  return (
    message.includes('BREAKING CHANGE') ||
    message.includes('!:') ||
    /^[a-z]+(\([^)]+\))?!:/.test(message)
  );
}
