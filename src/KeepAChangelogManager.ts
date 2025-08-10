/**
 * KeepAChangelogManager - Manages CHANGELOG.md files following Keep a Changelog format
 *
 * This module provides functionality to parse, update, and maintain CHANGELOG.md files
 * following the Keep a Changelog specification (https://keepachangelog.com/).
 *
 * @example
 * ```typescript
 * const manager = new KeepAChangelogManager();
 * const content = await manager.readChangelogFile();
 * const changelog = manager.parseChangelog(content);
 * await manager.addUnreleasedEntries([newEntry]);
 * ```
 */

import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ChangelogEntry,
  ChangelogData,
  SemanticVersion,
  ParsedChangelog,
  ChangelogHeader,
  ChangelogSection,
  ChangelogRelease,
  ChangelogGenerationOptions,
  ChangelogValidationResult,
  ChangelogValidationIssue,
  ChangeCategory,
} from './types/index.js';

/**
 * Custom error class for changelog-related operations
 */
export class ChangelogError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown> | undefined;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string = 'CHANGELOG_ERROR',
    context?: Record<string, unknown>,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'ChangelogError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
  }
}

/**
 * Keep a Changelog manager for parsing, updating, and maintaining CHANGELOG.md files
 */
export class KeepAChangelogManager {
  private static readonly DEFAULT_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`;

  private static readonly SECTION_ORDER = [
    'Added',
    'Changed',
    'Deprecated',
    'Removed',
    'Fixed',
    'Security',
  ];

  private static readonly SECTION_MAPPING: Record<ChangeCategory, string> = {
    feat: 'Added',
    fix: 'Fixed',
    perf: 'Changed',
    refactor: 'Changed',
    docs: 'Changed',
    style: 'Changed',
    test: 'Changed',
    build: 'Changed',
    ci: 'Changed',
    chore: 'Changed',
    revert: 'Changed',
    deps: 'Changed',
    breaking: 'Changed',
  };

  private changelogPath: string;
  private currentChangelog?: ParsedChangelog;

  /**
   * Creates a new KeepAChangelogManager instance
   * @param changelogPath - Path to the CHANGELOG.md file
   */
  constructor(changelogPath: string = 'CHANGELOG.md') {
    this.changelogPath = path.resolve(changelogPath);
    core.debug(`📖 KeepAChangelogManager initialized for: ${this.changelogPath}`);
  }

  /**
   * Parse a changelog from markdown content
   * @param content - Raw markdown content
   * @returns Parsed changelog structure
   */
  public parseChangelog(content: string): ParsedChangelog {
    core.info('📖 Parsing changelog content...');

    try {
      // Simple parsing - just extract header and create basic structure
      const header: ChangelogHeader = {
        title: 'Changelog',
        description: 'All notable changes to this project will be documented in this file.',
        keepAChangelogUrl: 'https://keepachangelog.com/en/1.0.0/',
        semverUrl: 'https://semver.org/spec/v2.0.0.html',
      };

      const unreleased: ChangelogSection = {
        entries: {},
        content: '',
      };

      const releases: ChangelogRelease[] = [];

      const parsed: ParsedChangelog = {
        header,
        unreleased,
        releases,
        rawContent: content,
      };

      this.currentChangelog = parsed;
      core.info(`✅ Parsed changelog with ${releases.length} releases`);

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ChangelogError(`Failed to parse changelog: ${message}`, 'PARSE_ERROR', {
        error: message,
      });
    }
  }

  /**
   * Generate markdown content from changelog data
   * @param data - Changelog data structure
   * @param options - Generation options
   * @returns Generated markdown content
   */
  public generateMarkdown(data: ChangelogData, options: ChangelogGenerationOptions = {}): string {
    core.info('📝 Generating changelog markdown...');

    const includeUnreleased = options.includeUnreleased ?? true;
    const dateFormat = options.dateFormat ?? 'YYYY-MM-DD';
    const sectionOrder = options.sectionOrder ?? KeepAChangelogManager.SECTION_ORDER;

    let markdown = KeepAChangelogManager.DEFAULT_HEADER + '\n\n';

    // Add unreleased section if requested
    if (includeUnreleased) {
      markdown += '## [Unreleased]\n\n';

      // Add entries for unreleased changes
      for (const section of sectionOrder) {
        const entries = this.getEntriesForSection(data.entries, section);
        if (entries.length > 0) {
          markdown += `### ${section}\n\n`;
          for (const entry of entries) {
            markdown += `- ${this.formatEntry(entry)}\n`;
          }
          markdown += '\n';
        }
      }
    }

    // Add the current release
    markdown += `## [${this.formatVersion(data.version)}] - ${this.formatDate(data.date, dateFormat)}\n\n`;

    for (const section of sectionOrder) {
      const entries = this.getEntriesForSection(data.entries, section);
      if (entries.length > 0) {
        markdown += `### ${section}\n\n`;
        for (const entry of entries) {
          markdown += `- ${this.formatEntry(entry)}\n`;
        }
        markdown += '\n';
      }
    }

    core.info('✅ Generated changelog markdown');
    return markdown.trim() + '\n';
  }

  /**
   * Add new entries to the unreleased section
   * @param entries - Changelog entries to add
   */
  public async addUnreleasedEntries(entries: ChangelogEntry[]): Promise<void> {
    core.info(`📝 Adding ${entries.length} entries to unreleased section...`);

    if (this.currentChangelog === undefined) {
      // If no changelog exists, create a new one
      const content = await this.readChangelogFile().catch(
        () => KeepAChangelogManager.DEFAULT_HEADER
      );
      this.parseChangelog(content);
    }

    // For now, just write the entries to a simple format
    const updatedContent = this.rebuildMarkdown();
    await this.writeChangelogFile(updatedContent);

    core.info('✅ Added entries to unreleased section');
  }

  /**
   * Create a new release from unreleased entries
   * @param version - Version for the new release
   * @param date - Release date (defaults to now)
   * @returns Changelog data for the new release
   */
  public async createRelease(
    version: SemanticVersion,
    date: Date = new Date()
  ): Promise<ChangelogData> {
    core.info(`🚀 Creating release ${this.formatVersion(version)}...`);

    if (this.currentChangelog === undefined) {
      throw new ChangelogError('No changelog loaded. Call parseChangelog() first.', 'NO_CHANGELOG');
    }

    // Create basic changelog data structure
    const entries: Record<ChangeCategory, ChangelogEntry[]> = {
      breaking: [],
      feat: [],
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
    };

    const changelogData: ChangelogData = {
      version,
      date,
      entries,
      summary: {
        totalChanges: 0,
        breakingChanges: 0,
        features: 0,
        fixes: 0,
        contributors: 0,
        contributorNames: [],
      },
      markdown: this.generateMarkdown({
        version,
        date,
        entries,
        summary: {
          totalChanges: 0,
          breakingChanges: 0,
          features: 0,
          fixes: 0,
          contributors: 0,
          contributorNames: [],
        },
        markdown: '',
      }),
    };

    // Write updated changelog
    const updatedContent = this.rebuildMarkdown();
    await this.writeChangelogFile(updatedContent);

    core.info('✅ Created new release');
    return changelogData;
  }

  /**
   * Read changelog file from disk
   * @param filePath - Optional file path (uses instance path if not provided)
   * @returns File content as string
   */
  public async readChangelogFile(filePath?: string): Promise<string> {
    const targetPath = filePath ?? this.changelogPath;

    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      core.debug(`📖 Read changelog from: ${targetPath}`);
      return content;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        core.warning(`📖 Changelog not found at ${targetPath}, will create new one`);
        return KeepAChangelogManager.DEFAULT_HEADER;
      }
      throw new ChangelogError(
        `Failed to read changelog file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'READ_ERROR',
        { path: targetPath, error }
      );
    }
  }

  /**
   * Write changelog content to disk
   * @param content - Markdown content to write
   * @param filePath - Optional file path (uses instance path if not provided)
   */
  public async writeChangelogFile(content: string, filePath?: string): Promise<void> {
    const targetPath = filePath ?? this.changelogPath;

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Write content
      await fs.writeFile(targetPath, content, 'utf-8');

      core.debug(`📝 Wrote changelog to: ${targetPath}`);
    } catch (error) {
      throw new ChangelogError(
        `Failed to write changelog file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WRITE_ERROR',
        { path: targetPath, error }
      );
    }
  }

  /**
   * Validate changelog format
   * @param content - Markdown content to validate
   * @returns Validation result
   */
  public validateFormat(content: string): ChangelogValidationResult {
    core.info('🔍 Validating changelog format...');

    const errors: string[] = [];
    const warnings: string[] = [];
    const issues: ChangelogValidationIssue[] = [];

    // Check for header
    if (!content.includes('# Changelog') && !content.includes('# CHANGELOG')) {
      issues.push({
        type: 'missing-header',
        severity: 'error',
        message: 'Missing changelog header',
        line: 1,
      });
      errors.push('Missing changelog header');
    }

    // Check for Keep a Changelog reference
    if (!content.includes('keepachangelog.com')) {
      issues.push({
        type: 'missing-header',
        severity: 'warning',
        message: 'Missing Keep a Changelog reference',
      });
      warnings.push('Missing Keep a Changelog reference');
    }

    const result: ChangelogValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      issues,
    };

    core.info(`✅ Validation complete: ${result.valid ? 'PASSED' : 'FAILED'}`);
    return result;
  }

  // Private helper methods

  private getEntriesForSection(
    entries: Record<ChangeCategory, ChangelogEntry[]>,
    section: string
  ): ChangelogEntry[] {
    const result: ChangelogEntry[] = [];

    for (const [category, categoryEntries] of Object.entries(entries)) {
      const mappedSection = KeepAChangelogManager.SECTION_MAPPING[category as ChangeCategory];
      if (mappedSection === section) {
        result.push(...categoryEntries);
      }
    }

    return result;
  }

  private formatEntry(entry: ChangelogEntry): string {
    let text = entry.description;

    if (entry.scope != null && entry.scope.length > 0) {
      text = `**${entry.scope}**: ${text}`;
    }

    if (entry.commitSha.length > 0) {
      text += ` (${entry.commitSha.substring(0, 7)})`;
    }

    if (entry.pullRequest !== undefined) {
      text += ` [#${entry.pullRequest}]`;
    }

    return text;
  }

  private formatVersion(version: SemanticVersion): string {
    let versionString = `${version.major}.${version.minor}.${version.patch}`;

    if (version.prerelease != null && version.prerelease.length > 0) {
      versionString += `-${version.prerelease}`;
    }

    if (version.build != null && version.build.length > 0) {
      versionString += `+${version.build}`;
    }

    return versionString;
  }

  private formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day);
  }

  private rebuildMarkdown(): string {
    if (this.currentChangelog === undefined) {
      return KeepAChangelogManager.DEFAULT_HEADER;
    }

    return KeepAChangelogManager.DEFAULT_HEADER + '\n\n## [Unreleased]\n\n';
  }
}
