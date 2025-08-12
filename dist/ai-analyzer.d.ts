/**
 * AI Analyzer Module
 * Integrates with OpenAI to analyze git diffs and categorize changes for intelligent release management
 */
import type { GitDiff, AIAnalysisResult, ReleaseConfig, VersioningStrategy, VersionAnalyzer } from './types/index.js';
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
 * Error thrown when AI analysis fails
 */
export declare class AIAnalysisError extends Error {
    readonly cause?: Error | undefined;
    readonly retryable: boolean;
    readonly tokensUsed: number;
    constructor(message: string, cause?: Error | undefined, retryable?: boolean, tokensUsed?: number);
}
/**
 * AI-powered change analyzer using OpenAI
 */
export declare class AIAnalyzer implements VersionAnalyzer {
    private readonly openai;
    private readonly config;
    private readonly retryConfig;
    private confidence;
    constructor(config: AIAnalyzerConfig);
    /**
     * Analyze git changes using AI to determine version bump and changelog entries
     */
    analyze(gitDiff: GitDiff): Promise<AIAnalysisResult>;
    /**
     * Get the current confidence level
     */
    getConfidence(): number;
    /**
     * Get the strategy name
     */
    getStrategy(): VersioningStrategy;
    /**
     * Validate configuration
     */
    validateConfig(config: ReleaseConfig): boolean;
    /**
     * Build the analysis prompt for OpenAI
     */
    private buildAnalysisPrompt;
    /**
     * Call OpenAI API with the analysis prompt
     */
    private callOpenAI;
    /**
     * Parse and validate AI response
     */
    private parseAIResponse;
    /**
     * Type guard for validating parsed AI response
     */
    private isValidParsedResponse;
    /**
     * Calculate confidence based on response quality and consistency
     */
    private calculateConfidence;
    /**
     * Build analysis metadata
     */
    private buildAnalysisMetadata;
    /**
     * Calculate estimated cost for OpenAI API usage
     */
    private calculateCost;
    /**
     * Execute operation with exponential backoff retry logic
     */
    private executeWithRetry;
}
