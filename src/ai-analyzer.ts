/**
 * AI Analyzer Module
 * Integrates with OpenAI to analyze git diffs and categorize changes for intelligent release management
 */

import OpenAI from 'openai';
import * as core from '@actions/core';
import type {
  GitDiff,
  AIAnalysisResult,
  ChangelogEntry,
  BreakingChange,
  VersionBumpType,
  AnalysisMetadata,
  ReleaseConfig,
  VersioningStrategy,
  VersionAnalyzer,
} from './types/index.js';

/**
 * Configuration for the AI Analyzer
 */
export interface AIAnalyzerConfig {
  /** OpenAI API key */
  apiKey: string;
  /** OpenAI model to use */
  model?: string;
  /** Temperature for AI responses */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Confidence threshold for accepting AI results */
  confidenceThreshold?: number;
}

/**
 * Expected structure of AI response
 */
interface ParsedAIResponse {
  versionBump: string;
  confidence: number;
  reasoning: string[];
  changes: {
    category: string;
    description: string;
    commitSha?: string;
    author?: string;
    isBreaking?: boolean;
    scope?: string;
    confidence?: number;
    issues?: number[];
  }[];
  breakingChanges?: {
    description: string;
    migration?: string;
    affected: string[];
  }[];
}

/**
 * Error thrown when AI analysis fails
 */
export class AIAnalysisError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error,
    public readonly retryable: boolean = true,
    public readonly tokensUsed: number = 0
  ) {
    super(message);
    this.name = 'AIAnalysisError';
  }
}

/**
 * Retry configuration for API calls
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * AI-powered change analyzer using OpenAI
 */
export class AIAnalyzer implements VersionAnalyzer {
  private readonly openai: OpenAI;
  private readonly config: Required<AIAnalyzerConfig>;
  private readonly retryConfig: RetryConfig;
  private confidence: number = 0;

  constructor(config: AIAnalyzerConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens ?? 2000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
    };

    this.retryConfig = {
      maxRetries: this.config.maxRetries,
      baseDelay: this.config.retryDelay,
      maxDelay: this.config.retryDelay * 8,
    };

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
    });

    core.debug(`🤖 AIAnalyzer initialized with model: ${this.config.model}`);
  }

  /**
   * Analyze git changes using AI to determine version bump and changelog entries
   */
  async analyze(gitDiff: GitDiff): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    core.info('🔍 Starting AI analysis of changes...');

    try {
      // Validate input
      if (gitDiff.commits.length === 0) {
        throw new AIAnalysisError('No commits found in git diff');
      }

      // Prepare analysis context
      const analysisPrompt = this.buildAnalysisPrompt(gitDiff);

      // Execute AI analysis with retry logic
      const rawResponse = await this.executeWithRetry(async () => this.callOpenAI(analysisPrompt));

      // Parse and validate AI response
      const parsedResult = this.parseAIResponse(rawResponse);

      // Calculate confidence based on response quality
      this.confidence = this.calculateConfidence(parsedResult, gitDiff);

      // Build comprehensive analysis result
      const analysisResult: AIAnalysisResult = {
        versionBump: parsedResult.versionBump,
        confidence: this.confidence,
        reasoning: parsedResult.reasoning,
        changes: parsedResult.changes,
        metadata: this.buildAnalysisMetadata(gitDiff, startTime),
        strategy: 'ai',
        executionTime: Date.now() - startTime,
        // AI-specific fields
        model: this.config.model,
        prompt: analysisPrompt,
        rawResponse: rawResponse.content,
        tokensUsed: rawResponse.tokensUsed,
        estimatedCost: this.calculateCost(rawResponse.tokensUsed),
        temperature: this.config.temperature,
      };

      core.info(`✅ AI analysis completed with ${this.confidence.toFixed(2)} confidence`);
      core.info(`📊 Determined ${analysisResult.versionBump.toUpperCase()} version bump`);

      return analysisResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      core.error(
        `❌ AI analysis failed after ${executionTime}ms: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof AIAnalysisError) {
        throw error;
      }

      throw new AIAnalysisError(
        `AI analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
        true
      );
    }
  }

  /**
   * Get the current confidence level
   */
  getConfidence(): number {
    return this.confidence;
  }

  /**
   * Get the strategy name
   */
  getStrategy(): VersioningStrategy {
    return 'ai';
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ReleaseConfig): boolean {
    if (
      config.openaiApiKey === undefined ||
      config.openaiApiKey === null ||
      config.openaiApiKey === ''
    ) {
      core.error('OpenAI API key is required for AI analysis');
      return false;
    }

    if (
      config.confidenceThreshold !== undefined &&
      (config.confidenceThreshold < 0 || config.confidenceThreshold > 1)
    ) {
      core.error('AI confidence threshold must be between 0 and 1');
      return false;
    }

    return true;
  }

  /**
   * Build the analysis prompt for OpenAI
   */
  private buildAnalysisPrompt(gitDiff: GitDiff): string {
    const commitSummaries = gitDiff.commits
      .map(commit => {
        const filesSummary =
          commit.files.length > 0
            ? `Files: ${commit.files.map(f => `${f.path} (${f.status})`).join(', ')}`
            : 'No file changes';

        return `- ${commit.message} (${commit.sha.substring(0, 7)})\n  ${filesSummary}`;
      })
      .join('\n');

    const fileChangesSummary = gitDiff.fileChanges
      .map(change => `${change.path}: ${change.status} (+${change.additions}/-${change.deletions})`)
      .join('\n');

    return `You are an expert software release manager analyzing code changes for semantic versioning and changelog generation.

TASK: Analyze the following git changes and provide a structured analysis for release management.

COMMITS (${gitDiff.commits.length} total):
${commitSummaries}

FILE CHANGES (${gitDiff.fileChanges.length} files):
${fileChangesSummary}

STATISTICS:
- Total additions: ${gitDiff.totalAdditions}
- Total deletions: ${gitDiff.totalDeletions}
- Contributors: ${gitDiff.contributors.length}

INSTRUCTIONS:
1. Determine the appropriate semantic version bump (major, minor, patch)
2. Categorize changes using these types: breaking, feat, fix, perf, refactor, docs, style, test, build, ci, chore, revert, deps
3. Identify any breaking changes that affect API compatibility
4. Generate human-readable descriptions for changelog entries
5. Provide clear reasoning for your decisions

Respond with valid JSON in this exact format:
{
  "versionBump": "major|minor|patch",
  "confidence": 0.0-1.0,
  "reasoning": ["reason 1", "reason 2", "..."],
  "changes": [
    {
      "category": "feat|fix|breaking|...",
      "description": "Human-readable description",
      "commitSha": "commit_sha",
      "author": "author_name",
      "isBreaking": true|false,
      "scope": "optional_scope",
      "confidence": 0.0-1.0
    }
  ],
  "breakingChanges": [
    {
      "description": "Description of breaking change",
      "migration": "Optional migration guide",
      "affected": ["area1", "area2"]
    }
  ]
}`;
  }

  /**
   * Call OpenAI API with the analysis prompt
   */
  private async callOpenAI(prompt: string): Promise<{ content: string; tokensUsed: number }> {
    core.debug('🚀 Sending request to OpenAI...');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert software release manager. Always respond with valid JSON that matches the requested format exactly.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        // Only use response_format for models that explicitly support it
        // Based on OpenAI docs: GPT-4o, GPT-4 Turbo, and GPT-3.5 Turbo support response_format
        // Regular GPT-4 models (gpt-4, gpt-4-0613, etc.) do NOT support it
        // gpt-3.5-turbo-instruct is a legacy model that also doesn't support it
        ...(this.config.model.startsWith('gpt-4o') ||
        this.config.model.includes('gpt-4-turbo') ||
        (this.config.model.startsWith('gpt-3.5-turbo') && !this.config.model.includes('instruct'))
          ? { response_format: { type: 'json_object' } }
          : {}),
      });

      const choice = response.choices[0];
      if (
        choice?.message?.content === undefined ||
        choice.message.content === null ||
        choice.message.content === ''
      ) {
        throw new AIAnalysisError('Empty response from OpenAI');
      }

      const tokensUsed = response.usage?.total_tokens ?? 0;
      core.debug(`📊 OpenAI response received (${tokensUsed} tokens)`);

      return {
        content: choice.message.content,
        tokensUsed,
      };
    } catch (error) {
      if (error instanceof AIAnalysisError) {
        throw error;
      }

      // Handle OpenAI-specific errors
      if (error instanceof Error && 'status' in error) {
        const openaiError = error as Error & { status: number };
        const retryable = openaiError.status === 429 || openaiError.status >= 500;

        throw new AIAnalysisError(
          `OpenAI API error (${openaiError.status}): ${openaiError.message}`,
          openaiError,
          retryable
        );
      }

      throw new AIAnalysisError(
        `Failed to call OpenAI: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
        true
      );
    }
  }

  /**
   * Parse and validate AI response
   */
  private parseAIResponse(response: { content: string; tokensUsed: number }): {
    versionBump: VersionBumpType;
    confidence: number;
    reasoning: string[];
    changes: ChangelogEntry[];
    breakingChanges?: BreakingChange[];
  } {
    try {
      const parsed: unknown = JSON.parse(response.content);

      // Type guard for parsed response
      if (!this.isValidParsedResponse(parsed)) {
        throw new AIAnalysisError('Invalid response format from AI');
      }

      // Validate version bump
      if (!['major', 'minor', 'patch'].includes(parsed.versionBump)) {
        throw new AIAnalysisError('Invalid or missing versionBump in AI response');
      }

      // Validate confidence
      if (parsed.confidence < 0 || parsed.confidence > 1) {
        throw new AIAnalysisError('Invalid confidence score in AI response');
      }

      // Validate and map changes
      const changes: ChangelogEntry[] = parsed.changes.map((change, index: number) => {
        if (change.category === '' || change.description === '') {
          throw new AIAnalysisError(`Invalid change entry at index ${index}`);
        }

        return {
          category: change.category as ChangelogEntry['category'],
          description: change.description,
          commitSha: change.commitSha ?? '',
          author: change.author ?? 'Unknown',
          isBreaking: change.isBreaking ?? false,
          scope: change.scope,
          confidence: change.confidence ?? 0.5,
          issues: change.issues ?? [],
        } as ChangelogEntry;
      });

      // Map breaking changes if present
      const breakingChanges: BreakingChange[] = (parsed.breakingChanges ?? []).map(bc => ({
        description: bc.description ?? '',
        migration: bc.migration ?? '',
        affected: Array.isArray(bc.affected) ? bc.affected : [],
        commit: {
          sha: '',
          message: '',
          author: {
            name: '',
            email: '',
            date: new Date(),
          },
          committer: {
            name: '',
            email: '',
            date: new Date(),
          },
          parents: [],
          files: [],
        },
      }));

      return {
        versionBump: parsed.versionBump as VersionBumpType,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        changes,
        breakingChanges,
      };
    } catch (error) {
      if (error instanceof AIAnalysisError) {
        throw error;
      }

      throw new AIAnalysisError(
        `Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
        false
      );
    }
  }

  /**
   * Type guard for validating parsed AI response
   */
  private isValidParsedResponse(parsed: unknown): parsed is ParsedAIResponse {
    if (parsed === null || typeof parsed !== 'object' || parsed === undefined) {
      return false;
    }

    const obj = parsed as Record<string, unknown>;

    return (
      typeof obj['versionBump'] === 'string' &&
      typeof obj['confidence'] === 'number' &&
      Array.isArray(obj['reasoning']) &&
      Array.isArray(obj['changes']) &&
      obj['reasoning'].every((r: unknown): r is string => typeof r === 'string') &&
      obj['changes'].every((c: unknown): boolean => {
        if (c === null || typeof c !== 'object' || c === undefined) {
          return false;
        }
        const change = c as Record<string, unknown>;
        return typeof change['category'] === 'string' && typeof change['description'] === 'string';
      })
    );
  }

  /**
   * Calculate confidence based on response quality and consistency
   */
  private calculateConfidence(
    parsedResult: {
      versionBump: VersionBumpType;
      confidence: number;
      reasoning: string[];
      changes: ChangelogEntry[];
      breakingChanges?: BreakingChange[];
    },
    gitDiff: GitDiff
  ): number {
    let confidence = parsedResult.confidence;

    // Adjust confidence based on response completeness
    if (parsedResult.reasoning.length === 0) {
      confidence *= 0.8;
    }

    if (parsedResult.changes.length === 0 && gitDiff.commits.length > 0) {
      confidence *= 0.7;
    }

    // Adjust based on commit/change ratio
    const commitToChangeRatio =
      gitDiff.commits.length > 0 ? parsedResult.changes.length / gitDiff.commits.length : 0;

    if (commitToChangeRatio < 0.5 || commitToChangeRatio > 2) {
      confidence *= 0.9;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Build analysis metadata
   */
  private buildAnalysisMetadata(gitDiff: GitDiff, _startTime: number): AnalysisMetadata {
    return {
      timestamp: new Date(),
      commitsAnalyzed: gitDiff.commits.length,
      filesChanged: gitDiff.fileChanges.length,
      aiModel: this.config.model,
      tokensUsed: 0, // Will be set by caller
      estimatedCost: 0, // Will be set by caller
      warnings: [],
      context: {
        totalAdditions: gitDiff.totalAdditions,
        totalDeletions: gitDiff.totalDeletions,
        contributors: gitDiff.contributors.length,
      },
    };
  }

  /**
   * Calculate estimated cost for OpenAI API usage
   */
  private calculateCost(tokensUsed: number): number {
    // GPT-4o-mini pricing (as of August 2025)
    const inputCostPer1k = 0.00015; // $0.15 per 1K input tokens
    const outputCostPer1k = 0.0006; // $0.60 per 1K output tokens

    // Estimate roughly 70% input, 30% output
    const inputTokens = tokensUsed * 0.7;
    const outputTokens = tokensUsed * 0.3;

    return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (error instanceof AIAnalysisError && !error.retryable) {
          throw error;
        }

        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );

        core.warning(`🔄 Attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new AIAnalysisError(
      `Operation failed after ${this.retryConfig.maxRetries} attempts: ${lastError?.message}`,
      lastError,
      false
    );
  }
}
