/**
 * @jest-environment node
 */

import * as core from '@actions/core';
import { AIAnalyzer, AIAnalysisError } from '../ai-analyzer';
import type { GitDiff, ReleaseConfig } from '../types/index.js';

// Mock OpenAI and @actions/core
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

jest.mock('@actions/core');

const mockCore = core as jest.Mocked<typeof core>;

describe('AIAnalyzer', () => {
  let analyzer: AIAnalyzer;
  let mockOpenAICreate: jest.Mock;

  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 2000,
    maxRetries: 3,
    retryDelay: 10, // Use 10ms instead of 1000ms for fast tests
    confidenceThreshold: 0.7,
  };

  const mockGitDiff: GitDiff = {
    commits: [
      {
        sha: 'abc123',
        message: 'feat: add new feature',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: new Date('2025-08-09T10:00:00Z'),
        },
        committer: {
          name: 'Test Author',
          email: 'test@example.com',
          date: new Date('2025-08-09T10:00:00Z'),
        },
        parents: ['def456'],
        files: [
          {
            path: 'src/feature.ts',
            status: 'added',
            additions: 50,
            deletions: 0,
          },
        ],
      },
    ],
    fileChanges: [
      {
        path: 'src/feature.ts',
        status: 'added',
        additions: 50,
        deletions: 0,
      },
    ],
    totalAdditions: 50,
    totalDeletions: 0,
    contributors: ['Test Author'],
    dateRange: {
      from: new Date('2025-08-09T09:00:00Z'),
      to: new Date('2025-08-09T11:00:00Z'),
    },
  };

  const mockAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            versionBump: 'minor',
            confidence: 0.9,
            reasoning: ['New feature added'],
            changes: [
              {
                category: 'feat',
                description: 'Add new feature',
                commitSha: 'abc123',
                author: 'Test Author',
                isBreaking: false,
                scope: 'feature',
                confidence: 0.9,
              },
            ],
            breakingChanges: [],
          }),
        },
      },
    ],
    usage: {
      total_tokens: 150,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup core mocks
    mockCore.debug = jest.fn();
    mockCore.info = jest.fn();
    mockCore.warning = jest.fn();
    mockCore.error = jest.fn();

    // Create analyzer which will create OpenAI instance
    analyzer = new AIAnalyzer(mockConfig);

    // Get reference to the mocked create method
    const OpenAI = jest.requireMock('openai').default;
    const instance = OpenAI.mock.results[OpenAI.mock.results.length - 1].value;
    mockOpenAICreate = instance.chat.completions.create;
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const minimalConfig = { apiKey: 'test-key' };
      const newAnalyzer = new AIAnalyzer(minimalConfig);

      expect(newAnalyzer.getStrategy()).toBe('ai');
      expect(mockCore.debug).toHaveBeenCalledWith(
        '🤖 AIAnalyzer initialized with model: gpt-4o-mini'
      );
    });

    it('should initialize with custom configuration', () => {
      expect(analyzer.getStrategy()).toBe('ai');
      expect(mockCore.debug).toHaveBeenCalledWith(
        '🤖 AIAnalyzer initialized with model: gpt-4o-mini'
      );
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config: Partial<ReleaseConfig> = {
        strategy: 'ai',
        openaiApiKey: 'test-key',
        confidenceThreshold: 0.8,
      };

      const result = analyzer.validateConfig(config as ReleaseConfig);

      expect(result).toBe(true);
    });

    it('should reject missing API key', () => {
      const config: Partial<ReleaseConfig> = {
        strategy: 'ai',
        openaiApiKey: '',
        confidenceThreshold: 0.8,
      };

      const result = analyzer.validateConfig(config as ReleaseConfig);

      expect(result).toBe(false);
      expect(mockCore.error).toHaveBeenCalledWith('OpenAI API key is required for AI analysis');
    });

    it('should reject invalid confidence threshold', () => {
      const config: Partial<ReleaseConfig> = {
        strategy: 'ai',
        openaiApiKey: 'test-key',
        confidenceThreshold: 1.5,
      };

      const result = analyzer.validateConfig(config as ReleaseConfig);

      expect(result).toBe(false);
      expect(mockCore.error).toHaveBeenCalledWith(
        'AI confidence threshold must be between 0 and 1'
      );
    });
  });

  describe('analyze', () => {
    beforeEach(() => {
      mockOpenAICreate.mockResolvedValue(mockAIResponse);
    });

    it('should successfully analyze git diff', async () => {
      const result = await analyzer.analyze(mockGitDiff);

      expect(result).toEqual({
        versionBump: 'minor',
        confidence: expect.any(Number),
        reasoning: ['New feature added'],
        changes: [
          {
            category: 'feat',
            description: 'Add new feature',
            commitSha: 'abc123',
            author: 'Test Author',
            isBreaking: false,
            scope: 'feature',
            confidence: 0.9,
            issues: [],
          },
        ],
        metadata: expect.objectContaining({
          timestamp: expect.any(Date),
          commitsAnalyzed: 1,
          filesChanged: 1,
          aiModel: 'gpt-4o-mini',
        }),
        strategy: 'ai',
        executionTime: expect.any(Number),
        model: 'gpt-4o-mini',
        prompt: expect.any(String),
        rawResponse: expect.any(String),
        tokensUsed: 150,
        estimatedCost: expect.any(Number),
        temperature: 0.1,
      });

      expect(mockCore.info).toHaveBeenCalledWith('🔍 Starting AI analysis of changes...');
      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ AI analysis completed')
      );
    });

    it('should throw error for empty commits', async () => {
      const emptyGitDiff: GitDiff = {
        ...mockGitDiff,
        commits: [],
      };

      await expect(analyzer.analyze(emptyGitDiff)).rejects.toThrow(
        new AIAnalysisError('No commits found in git diff')
      );
    });

    it('should handle OpenAI API errors with retry', async () => {
      const apiError = new Error('API temporarily unavailable') as Error & { status: number };
      apiError.status = 503;

      mockOpenAICreate
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce(mockAIResponse);

      const result = await analyzer.analyze(mockGitDiff);

      expect(result.versionBump).toBe('minor');
      expect(mockCore.warning).toHaveBeenCalledTimes(2); // Two retry warnings
    });

    it('should throw non-retryable errors immediately', async () => {
      const apiError = new Error('Invalid API key') as Error & { status: number };
      apiError.status = 401;

      mockOpenAICreate.mockRejectedValue(apiError);

      await expect(analyzer.analyze(mockGitDiff)).rejects.toThrow(AIAnalysisError);
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid JSON response', async () => {
      const invalidResponse = {
        ...mockAIResponse,
        choices: [
          {
            message: {
              content: 'invalid json',
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValue(invalidResponse);

      await expect(analyzer.analyze(mockGitDiff)).rejects.toThrow(AIAnalysisError);
    });

    it('should calculate cost correctly', async () => {
      const result = await analyzer.analyze(mockGitDiff);

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.tokensUsed).toBe(150);
    });

    it('should build comprehensive prompt', async () => {
      await analyzer.analyze(mockGitDiff);

      const createCall = mockOpenAICreate.mock.calls[0]?.[0];
      const userMessage = createCall?.messages?.find((m: any) => m.role === 'user');

      expect(userMessage?.content).toContain('COMMITS (1 total)');
      expect(userMessage?.content).toContain('feat: add new feature');
      expect(userMessage?.content).toContain('src/feature.ts: added');
      expect(userMessage?.content).toContain('Total additions: 50');
    });

    it('should adjust confidence based on response quality', async () => {
      // Test with empty reasoning
      const lowQualityResponse = {
        ...mockAIResponse,
        choices: [
          {
            message: {
              content: JSON.stringify({
                versionBump: 'minor',
                confidence: 0.9,
                reasoning: [], // Empty reasoning should lower confidence
                changes: [],
              }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValue(lowQualityResponse);

      const result = await analyzer.analyze(mockGitDiff);

      expect(result.confidence).toBeLessThan(0.9); // Should be adjusted down
    });
  });

  describe('getters', () => {
    it('should return correct strategy', () => {
      expect(analyzer.getStrategy()).toBe('ai');
    });

    it('should return initial confidence of 0', () => {
      expect(analyzer.getConfidence()).toBe(0);
    });

    it('should return updated confidence after analysis', async () => {
      mockOpenAICreate.mockResolvedValue(mockAIResponse);

      await analyzer.analyze(mockGitDiff);

      expect(analyzer.getConfidence()).toBeGreaterThan(0);
    });
  });

  describe('AIAnalysisError', () => {
    it('should create error with all properties', () => {
      const cause = new Error('Original error');
      const error = new AIAnalysisError('Test error', cause, false, 100);

      expect(error.message).toBe('Test error');
      expect(error.cause).toBe(cause);
      expect(error.retryable).toBe(false);
      expect(error.tokensUsed).toBe(100);
      expect(error.name).toBe('AIAnalysisError');
    });

    it('should create error with default values', () => {
      const error = new AIAnalysisError('Test error');

      expect(error.retryable).toBe(true);
      expect(error.tokensUsed).toBe(0);
      expect(error.cause).toBeUndefined();
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded') as Error & { status: number };
      rateLimitError.status = 429;

      mockOpenAICreate.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(mockAIResponse);

      const result = await analyzer.analyze(mockGitDiff);

      expect(result.versionBump).toBe('minor');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Attempt 1 failed, retrying')
      );
    });

    it('should retry on 5xx server errors', async () => {
      const serverError = new Error('Internal server error') as Error & { status: number };
      serverError.status = 500;

      mockOpenAICreate.mockRejectedValueOnce(serverError).mockResolvedValueOnce(mockAIResponse);

      const result = await analyzer.analyze(mockGitDiff);

      expect(result.versionBump).toBe('minor');
      expect(mockCore.warning).toHaveBeenCalled();
    });

    it('should fail after max retries', async () => {
      const serverError = new Error('Server error') as Error & { status: number };
      serverError.status = 503;

      mockOpenAICreate.mockRejectedValue(serverError);

      await expect(analyzer.analyze(mockGitDiff)).rejects.toThrow(AIAnalysisError);

      expect(mockOpenAICreate).toHaveBeenCalledTimes(3);
    });
  });
});
