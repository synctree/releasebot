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
import type { ChangelogEntry, ChangelogData, SemanticVersion, ParsedChangelog, ChangelogGenerationOptions, ChangelogValidationResult } from './types/index.js';
/**
 * Custom error class for changelog-related operations
 */
export declare class ChangelogError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown> | undefined;
    readonly recoverable: boolean;
    constructor(message: string, code?: string, context?: Record<string, unknown>, recoverable?: boolean);
}
/**
 * Keep a Changelog manager for parsing, updating, and maintaining CHANGELOG.md files
 */
export declare class KeepAChangelogManager {
    private static readonly DEFAULT_HEADER;
    private static readonly SECTION_ORDER;
    private static readonly SECTION_MAPPING;
    private changelogPath;
    private currentChangelog?;
    /**
     * Creates a new KeepAChangelogManager instance
     * @param changelogPath - Path to the CHANGELOG.md file
     */
    constructor(changelogPath?: string);
    /**
     * Parse a changelog from markdown content
     * @param content - Raw markdown content
     * @returns Parsed changelog structure
     */
    parseChangelog(content: string): ParsedChangelog;
    /**
     * Generate markdown content from changelog data
     * @param data - Changelog data structure
     * @param options - Generation options
     * @returns Generated markdown content
     */
    generateMarkdown(data: ChangelogData, options?: ChangelogGenerationOptions): string;
    /**
     * Add new entries to the unreleased section
     * @param entries - Changelog entries to add
     */
    addUnreleasedEntries(entries: ChangelogEntry[]): Promise<void>;
    /**
     * Create a new release from unreleased entries
     * @param version - Version for the new release
     * @param date - Release date (defaults to now)
     * @returns Changelog data for the new release
     */
    createRelease(version: SemanticVersion, date?: Date): Promise<ChangelogData>;
    /**
     * Read changelog file from disk
     * @param filePath - Optional file path (uses instance path if not provided)
     * @returns File content as string
     */
    readChangelogFile(filePath?: string): Promise<string>;
    /**
     * Write changelog content to disk
     * @param content - Markdown content to write
     * @param filePath - Optional file path (uses instance path if not provided)
     */
    writeChangelogFile(content: string, filePath?: string): Promise<void>;
    /**
     * Validate changelog format
     * @param content - Markdown content to validate
     * @returns Validation result
     */
    validateFormat(content: string): ChangelogValidationResult;
    private getEntriesForSection;
    private formatEntry;
    private formatVersion;
    private formatDate;
    private rebuildMarkdown;
}
