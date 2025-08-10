/**
 * ReleaseWorkflow - Main orchestrator for the AI Release Tool
 *
 * This class coordinates all the core modules to execute a complete release workflow:
 * 1. Git operations - analyze changes and commits
 * 2. Version analysis - determine appropriate version bump
 * 3. AI analysis - categorize changes and generate descriptions
 * 4. Changelog management - update CHANGELOG.md
 * 5. Git operations - create release branch and commit changes
 */

import * as core from '@actions/core';
import { GitOperations } from './git-operations.js';
import { VersionAnalyzer } from './version-analyzer.js';
import { AIAnalyzer } from './ai-analyzer.js';
import { KeepAChangelogManager } from './KeepAChangelogManager.js';
import { parseConventionalCommit } from './utils/conventionalCommits.js';
import type {
  ChangelogEntry,
  SemanticVersion,
  VersionBumpType,
  ChangelogData,
  GitDiff,
  CommitInfo,
} from './types/index.js';

/**
 * Configuration for the release workflow
 */
export interface WorkflowConfig {
  // Core Configuration
  mainBranch: string;
  featureBranch: string;
  githubToken: string;

  // File Paths
  packageJsonPath: string;
  changelogPath: string;

  // Strategy Configuration
  versioningStrategy: 'conventional' | 'ai' | 'hybrid';
  aiProvider: 'openai' | 'anthropic';
  openaiApiKey?: string;
  anthropicApiKey?: string;

  // AI Configuration
  aiModel: string;
  aiConfidenceThreshold: number;

  // Conventional Commits Configuration
  conventionalTypes: string[];

  // Release Configuration
  preRelease: boolean;
  preReleaseIdentifier: string;
  skipChangelog: boolean;
  skipGitTag: boolean;

  // Advanced Configuration
  maxCommitsAnalysis: number;
  debugMode: boolean;
}

/**
 * Git analysis data structure
 */
interface GitAnalysisData {
  diff: GitDiff;
  commitCount: number;
}

/**
 * Version analysis data structure
 */
interface VersionAnalysisData {
  currentVersion: SemanticVersion;
  newVersion: SemanticVersion;
  versionBump: VersionBumpType;
}

/**
 * Change analysis data structure
 */
interface ChangeAnalysisData {
  entries: ChangelogEntry[];
  aiConfidence: number | undefined;
  reasoning: string[];
  breakingChanges: boolean;
}

/**
 * Result of the release workflow execution
 */
export interface ReleaseResult {
  version: string;
  releaseBranch: string;
  versionBump: VersionBumpType;
  changelogEntry: string;
  analysisStrategy: string;
  aiConfidence: number | undefined;
  reasoning: string[];
  commitCount: number;
  breakingChanges: boolean;
  changelogData: ChangelogData | undefined;
}

/**
 * Release data structure for final steps
 */
interface ReleaseData {
  releaseBranch: string;
  tagName: string;
  commitSha: string;
}

/**
 * Custom error class for workflow-related operations
 */
export class WorkflowError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown> | undefined;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.context = context;
    this.recoverable = recoverable;
  }
}

/**
 * Main Release Workflow Class
 *
 * Orchestrates the complete release process by coordinating git operations,
 * version analysis, AI-powered change categorization, and changelog management.
 */
export class ReleaseWorkflow {
  private readonly gitOps: GitOperations;
  private readonly versionAnalyzer: VersionAnalyzer;
  private readonly aiAnalyzer: AIAnalyzer | null;
  private readonly changelogManager: KeepAChangelogManager | null;

  constructor(private readonly config: WorkflowConfig) {
    // Initialize core modules
    this.gitOps = new GitOperations(process.cwd());

    this.versionAnalyzer = new VersionAnalyzer();

    // Initialize AI analyzer if strategy requires it
    this.aiAnalyzer = this.shouldUseAI() ? this.createAIAnalyzer() : null;

    // Initialize changelog manager unless skipped
    this.changelogManager = config.skipChangelog
      ? null
      : new KeepAChangelogManager(config.changelogPath);

    this.validateConfiguration();
  }

  /**
   * Execute the complete release workflow
   */
  async execute(): Promise<ReleaseResult> {
    try {
      core.info('🚀 Starting release workflow...');

      // Step 1: Analyze git changes
      const gitData = this.analyzeChanges();

      // Step 2: Determine version bump
      const versionData = this.analyzeVersion(gitData);

      // Step 3: Analyze changes with AI (if enabled)
      const changeData = await this.analyzeWithAI(gitData, versionData);

      // Step 4: Update changelog
      const changelogData = await this.updateChangelog(changeData, versionData);

      // Step 5: Create release branch and finalize
      const releaseData = this.createReleaseBranch(versionData, changelogData);

      core.info('✅ Release workflow completed successfully!');

      return {
        version: this.formatVersion(versionData.newVersion),
        releaseBranch: releaseData.releaseBranch,
        versionBump: versionData.versionBump,
        changelogEntry: changelogData?.markdown ?? '',
        analysisStrategy: this.config.versioningStrategy,
        aiConfidence: changeData.aiConfidence,
        reasoning: changeData.reasoning,
        commitCount: gitData.commitCount,
        breakingChanges: changeData.breakingChanges,
        changelogData: changelogData ?? undefined,
      };
    } catch (error) {
      const workflowError =
        error instanceof WorkflowError
          ? error
          : new WorkflowError(
              error instanceof Error ? error.message : 'Unknown workflow error',
              'WORKFLOW_ERROR'
            );

      core.setFailed(workflowError.message);

      return {
        version: '0.0.0',
        releaseBranch: '',
        versionBump: 'patch',
        changelogEntry: '',
        analysisStrategy: this.config.versioningStrategy,
        aiConfidence: undefined,
        reasoning: [workflowError.message],
        commitCount: 0,
        breakingChanges: false,
        changelogData: undefined,
      };
    }
  }

  /**
   * Step 1: Analyze repository changes and commits
   */
  private analyzeChanges(): GitAnalysisData {
    try {
      // Validate repository state
      this.gitOps.validateRepository();

      // Generate diff between branches (includes commits)
      const diff = this.gitOps.generateDiff(this.config.mainBranch, this.config.featureBranch);

      core.info(
        `📊 Analyzed ${diff.commits.length} commits with ${diff.fileChanges.length} changed files`
      );

      return {
        diff,
        commitCount: diff.commits.length,
      };
    } catch (error) {
      throw new WorkflowError(
        `Failed to analyze repository changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GIT_ANALYSIS_ERROR',
        { mainBranch: this.config.mainBranch, featureBranch: this.config.featureBranch }
      );
    }
  }

  /**
   * Step 2: Determine version bump using conventional commits analysis
   */
  private analyzeVersion(gitData: GitAnalysisData): VersionAnalysisData {
    try {
      // Parse current version
      const currentVersion = this.versionAnalyzer.parseVersion(this.config.packageJsonPath);

      // Determine version bump based on git diff
      const versionBump = this.versionAnalyzer.determineVersionBump(gitData.diff);

      // Calculate new version (incrementVersion only takes 2 parameters)
      const newVersion = this.versionAnalyzer.incrementVersion(currentVersion, versionBump);

      core.info(
        `📈 Version bump: ${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch} → ${this.formatVersion(newVersion)} (${versionBump})`
      );

      return {
        currentVersion,
        newVersion,
        versionBump,
      };
    } catch (error) {
      throw new WorkflowError(
        `Failed to analyze version: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERSION_ANALYSIS_ERROR',
        { packageJsonPath: this.config.packageJsonPath }
      );
    }
  }

  /**
   * Step 3: Analyze changes with AI (if strategy requires it)
   */
  private async analyzeWithAI(
    gitData: GitAnalysisData,
    versionData: VersionAnalysisData
  ): Promise<ChangeAnalysisData> {
    const useAI =
      this.config.versioningStrategy === 'ai' || this.config.versioningStrategy === 'hybrid';

    if (!useAI || this.aiAnalyzer === null) {
      core.info('🤖 Skipping AI analysis (conventional strategy)');
      return {
        entries: this.createBasicChangelogEntries(gitData.diff.commits),
        aiConfidence: undefined,
        reasoning: ['Using conventional commits analysis'],
        breakingChanges: versionData.versionBump === 'major',
      };
    }

    try {
      // Analyze changes with AI
      const analysis = await this.aiAnalyzer.analyze(gitData.diff);

      // Check if AI confidence is sufficient
      const aiConfidenceOk = analysis.confidence >= this.config.aiConfidenceThreshold;

      if (this.config.versioningStrategy === 'hybrid' && !aiConfidenceOk) {
        core.warning(
          `🤖 AI confidence (${analysis.confidence}) below threshold (${this.config.aiConfidenceThreshold}), using conventional analysis`
        );
        return {
          entries: this.createBasicChangelogEntries(gitData.diff.commits),
          aiConfidence: analysis.confidence,
          reasoning: analysis.reasoning.concat([
            'Confidence below threshold, using conventional analysis',
          ]),
          breakingChanges: versionData.versionBump === 'major',
        };
      }

      core.info(`🤖 AI analysis completed with confidence: ${analysis.confidence}`);

      // Convert AI analysis changes to changelog entries
      const changelogEntries = analysis.changes;

      return {
        entries: changelogEntries,
        aiConfidence: analysis.confidence,
        reasoning: analysis.reasoning,
        breakingChanges: analysis.changes.some(change => change.isBreaking),
      };
    } catch (error) {
      if (this.config.versioningStrategy === 'hybrid') {
        core.warning(
          `🤖 AI analysis failed, falling back to conventional: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        return {
          entries: this.createBasicChangelogEntries(gitData.diff.commits),
          aiConfidence: 0,
          reasoning: ['AI analysis failed, using conventional fallback'],
          breakingChanges: versionData.versionBump === 'major',
        };
      } else {
        throw new WorkflowError(
          `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'AI_ANALYSIS_ERROR',
          { strategy: this.config.versioningStrategy }
        );
      }
    }
  }

  /**
   * Step 4: Update changelog with analyzed changes
   */
  private async updateChangelog(
    changeData: ChangeAnalysisData,
    versionData: VersionAnalysisData
  ): Promise<ChangelogData | undefined> {
    if (this.config.skipChangelog || this.changelogManager === null) {
      core.info('📝 Skipping changelog update');
      return undefined;
    }

    try {
      // Add unreleased entries first
      await this.changelogManager.addUnreleasedEntries(changeData.entries);

      // Create release
      const changelogData = await this.changelogManager.createRelease(versionData.newVersion);

      core.info(`📝 Updated changelog with ${changeData.entries.length} entries`);
      return changelogData;
    } catch (error) {
      throw new WorkflowError(
        `Failed to update changelog: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CHANGELOG_ERROR',
        { changelogPath: this.config.changelogPath }
      );
    }
  }

  /**
   * Step 5: Create release branch and commit changes
   */
  private createReleaseBranch(
    versionData: VersionAnalysisData,
    changelogData?: ChangelogData
  ): ReleaseData {
    try {
      const tagName = `v${this.formatVersion(versionData.newVersion)}`;

      // Create release branch using GitOperations method
      const branchName = this.gitOps.createReleaseBranch(
        this.formatVersion(versionData.newVersion),
        this.config.mainBranch
      );
      core.info(`🌿 Created release branch: ${branchName}`);

      // Commit changelog changes if applicable
      let commitSha = '';
      if (changelogData !== undefined && !this.config.skipChangelog) {
        commitSha = this.gitOps.commitChanges(
          [this.config.changelogPath, this.config.packageJsonPath],
          `chore(release): ${this.formatVersion(versionData.newVersion)}\n\nRelease ${this.formatVersion(versionData.newVersion)}`
        );
        core.info(`📦 Committed changes: ${commitSha}`);
      }

      // Note: Git tag creation is not yet implemented in GitOperations
      // TODO: Implement git tag creation in GitOperations class
      // This will be addressed in a future enhancement issue
      // For now, the tagName is prepared but not created

      return {
        releaseBranch: branchName,
        tagName,
        commitSha,
      };
    } catch (error) {
      throw new WorkflowError(
        `Failed to create release branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RELEASE_BRANCH_ERROR',
        { version: this.formatVersion(versionData.newVersion) }
      );
    }
  }

  /**
   * Helper: Create basic changelog entries from commits using conventional commit analysis
   */
  private createBasicChangelogEntries(commits: CommitInfo[]): ChangelogEntry[] {
    return commits.map(commit => {
      const parsed = parseConventionalCommit(commit.message);

      const entry: ChangelogEntry = {
        category: parsed.type,
        description: parsed.description,
        isBreaking: parsed.isBreaking,
        author: commit.author.name,
        commitSha: commit.sha,
        confidence: 1.0, // High confidence for conventional commits
      };

      // Only add optional properties if they have values
      if (parsed.scope !== undefined) {
        entry.scope = parsed.scope;
      }
      if (commit.pullRequest?.number !== undefined) {
        entry.pullRequest = commit.pullRequest.number;
      }

      return entry;
    });
  }

  /**
   * Helper: Check if AI should be used based on strategy
   */
  private shouldUseAI(): boolean {
    return this.config.versioningStrategy === 'ai' || this.config.versioningStrategy === 'hybrid';
  }

  /**
   * Helper: Create AI analyzer instance
   */
  private createAIAnalyzer(): AIAnalyzer | null {
    if (
      this.config.aiProvider === 'openai' &&
      this.config.openaiApiKey !== undefined &&
      this.config.openaiApiKey !== ''
    ) {
      return new AIAnalyzer({
        apiKey: this.config.openaiApiKey,
        model: this.config.aiModel,
        confidenceThreshold: this.config.aiConfidenceThreshold,
      });
    }

    // TODO: Add Anthropic support
    return null;
  }

  /**
   * Helper: Validate workflow configuration
   */
  private validateConfiguration(): void {
    if (this.config.githubToken === '' || this.config.githubToken === undefined) {
      throw new WorkflowError('GitHub token is required', 'CONFIG_ERROR');
    }

    if (this.shouldUseAI() && this.aiAnalyzer === null) {
      throw new WorkflowError(
        `AI strategy requires valid API key for ${this.config.aiProvider}`,
        'CONFIG_ERROR'
      );
    }
  }

  /**
   * Helper: Format semantic version object to string
   */
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
}
