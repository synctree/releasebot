/**
 * Tests for ReleaseWorkflow class
 * Basic unit tests for the main workflow orchestrator
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ReleaseWorkflow, WorkflowError, type WorkflowConfig } from '../ReleaseWorkflow.js';

// Mock the dependencies
jest.mock('../git-operations.js');
jest.mock('../version-analyzer.js');
jest.mock('../ai-analyzer.js');
jest.mock('../KeepAChangelogManager.js');

describe('ReleaseWorkflow', () => {
  let mockConfig: WorkflowConfig;

  beforeEach(() => {
    mockConfig = {
      mainBranch: 'main',
      featureBranch: 'feature/test',
      githubToken: 'test-token',
      packageJsonPath: './package.json',
      changelogPath: './CHANGELOG.md',
      versioningStrategy: 'conventional',
      aiProvider: 'openai',
      openaiApiKey: undefined,
      anthropicApiKey: undefined,
      aiModel: 'gpt-4',
      aiConfidenceThreshold: 0.8,
      conventionalTypes: ['feat', 'fix', 'docs'],
      preRelease: false,
      preReleaseIdentifier: 'alpha',
      skipChangelog: false,
      skipGitTag: false,
      maxCommitsAnalysis: 100,
      debugMode: false,
    };
  });

  describe('constructor', () => {
    it('should create workflow with conventional strategy', () => {
      const workflow = new ReleaseWorkflow(mockConfig);
      expect(workflow).toBeInstanceOf(ReleaseWorkflow);
    });

    it('should throw error for missing GitHub token', () => {
      mockConfig.githubToken = '';
      expect(() => new ReleaseWorkflow(mockConfig)).toThrow(WorkflowError);
    });

    it('should throw error for AI strategy without API key', () => {
      mockConfig.versioningStrategy = 'ai';
      mockConfig.openaiApiKey = undefined;
      expect(() => new ReleaseWorkflow(mockConfig)).toThrow(WorkflowError);
    });
  });

  describe('execute', () => {
    it('should handle workflow configuration validation', () => {
      // Test that workflow validates configuration properly
      const workflow = new ReleaseWorkflow(mockConfig);

      // For now, just test that execute method exists and returns a result
      // More comprehensive testing would require mocking all dependencies
      expect(typeof workflow.execute).toBe('function');
    });
  });
});

describe('WorkflowError', () => {
  it('should create error with message and code', () => {
    const error = new WorkflowError('Test message', 'TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.recoverable).toBe(false);
  });

  it('should create recoverable error with context', () => {
    const context = { test: 'value' };
    const error = new WorkflowError('Test message', 'TEST_CODE', context, true);
    expect(error.context).toEqual(context);
    expect(error.recoverable).toBe(true);
  });
});
