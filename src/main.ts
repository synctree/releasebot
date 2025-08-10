import * as core from '@actions/core';
import { ReleaseWorkflow, type WorkflowConfig } from './ReleaseWorkflow.js';

/**
 * Main entry point for the AI Release Tool
 */
async function run(): Promise<void> {
  try {
    core.info('🚀 AI Release Tool starting...');

    // Get and validate required inputs
    const inputs = getActionInputs();
    validateInputs(inputs);

    core.info(`📊 Using strategy: ${inputs.versioningStrategy}`);
    core.info(`🎯 Analyzing changes from ${inputs.mainBranch} to ${inputs.featureBranch}`);

    // Create workflow configuration
    const workflowConfig: WorkflowConfig = {
      mainBranch: inputs.mainBranch,
      featureBranch: inputs.featureBranch,
      githubToken: inputs.githubToken,
      packageJsonPath: inputs.packageJsonPath,
      changelogPath: inputs.changelogPath,
      versioningStrategy: inputs.versioningStrategy,
      aiProvider: inputs.aiProvider,
      openaiApiKey: inputs.openaiApiKey,
      anthropicApiKey: inputs.anthropicApiKey,
      aiModel: inputs.aiModel,
      aiConfidenceThreshold: inputs.aiConfidenceThreshold,
      conventionalTypes: inputs.conventionalTypes,
      preRelease: inputs.preRelease,
      preReleaseIdentifier: inputs.preReleaseIdentifier,
      skipChangelog: inputs.skipChangelog,
      skipGitTag: inputs.skipGitTag,
      maxCommitsAnalysis: inputs.maxCommitsAnalysis,
      debugMode: inputs.debugMode,
    };

    // Execute the release workflow
    const workflow = new ReleaseWorkflow(workflowConfig);
    const result = await workflow.execute();

    // Set action outputs
    core.setOutput('version', result.version);
    core.setOutput('release-branch', result.releaseBranch);
    core.setOutput('version-bump', result.versionBump);
    core.setOutput('changelog-entry', result.changelogEntry);
    core.setOutput('analysis-strategy', result.analysisStrategy);
    core.setOutput('ai-confidence', result.aiConfidence?.toString() ?? '');
    core.setOutput('reasoning', result.reasoning.join('\n'));
    core.setOutput('commit-count', result.commitCount.toString());
    core.setOutput('breaking-changes', result.breakingChanges.toString());

    if (result.changelogData !== undefined) {
      core.setOutput('changelog-data', JSON.stringify(result.changelogData));
    }

    core.info('✅ AI Release Tool completed successfully');
    core.info(`📦 New version: ${result.version}`);
    core.info(`🌟 Release branch: ${result.releaseBranch}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`❌ AI Release Tool failed: ${errorMessage}`);
  }
}

/**
 * Extract and parse action inputs
 */
function getActionInputs() {
  return {
    // Core Configuration
    mainBranch: core.getInput('main-branch'),
    featureBranch: core.getInput('feature-branch'),
    githubToken: core.getInput('github-token'),

    // File Paths
    packageJsonPath: core.getInput('package-json-path'),
    changelogPath: core.getInput('changelog-path'),

    // Multi-Strategy Configuration
    versioningStrategy: core.getInput('versioning-strategy') as 'conventional' | 'ai' | 'hybrid',
    aiProvider: core.getInput('ai-provider') as 'openai' | 'anthropic',
    openaiApiKey: core.getInput('openai-api-key'),
    anthropicApiKey: core.getInput('anthropic-api-key'),

    // AI Configuration
    aiModel: core.getInput('ai-model'),
    aiConfidenceThreshold: parseFloat(core.getInput('ai-confidence-threshold')),

    // Conventional Commits Configuration
    conventionalTypes: core
      .getInput('conventional-types')
      .split(',')
      .map(t => t.trim()),

    // Changelog Configuration
    changelogFormat: core.getInput('changelog-format') as 'keepachangelog' | 'custom',
    changelogTemplate: core.getInput('changelog-template'),

    // Release Configuration
    preRelease: core.getInput('pre-release') === 'true',
    preReleaseIdentifier: core.getInput('pre-release-identifier'),
    skipChangelog: core.getInput('skip-changelog') === 'true',
    skipGitTag: core.getInput('skip-git-tag') === 'true',

    // Advanced Configuration
    maxCommitsAnalysis: parseInt(core.getInput('max-commits-analysis')),
    enableCaching: core.getInput('enable-caching') === 'true',
    debugMode: core.getInput('debug-mode') === 'true',
  };
}

/**
 * Validate required inputs and configuration
 */
function validateInputs(inputs: ReturnType<typeof getActionInputs>): void {
  if (inputs.featureBranch === '') {
    throw new Error('feature-branch input is required');
  }

  if (!['conventional', 'ai', 'hybrid'].includes(inputs.versioningStrategy)) {
    throw new Error('versioning-strategy must be one of: conventional, ai, hybrid');
  }

  if (!['openai', 'anthropic'].includes(inputs.aiProvider)) {
    throw new Error('ai-provider must be one of: openai, anthropic');
  }

  // Validate AI configuration when AI strategy is used
  if (inputs.versioningStrategy === 'ai' || inputs.versioningStrategy === 'hybrid') {
    if (
      inputs.aiProvider === 'openai' &&
      (inputs.openaiApiKey === '' || inputs.openaiApiKey == null)
    ) {
      throw new Error('openai-api-key is required when using OpenAI provider');
    }
    if (
      inputs.aiProvider === 'anthropic' &&
      (inputs.anthropicApiKey === '' || inputs.anthropicApiKey == null)
    ) {
      throw new Error('anthropic-api-key is required when using Anthropic provider');
    }
  }

  if (inputs.aiConfidenceThreshold < 0 || inputs.aiConfidenceThreshold > 1) {
    throw new Error('ai-confidence-threshold must be between 0.0 and 1.0');
  }

  if (!['keepachangelog', 'custom'].includes(inputs.changelogFormat)) {
    throw new Error('changelog-format must be one of: keepachangelog, custom');
  }

  if (
    inputs.changelogFormat === 'custom' &&
    (inputs.changelogTemplate === '' || inputs.changelogTemplate == null)
  ) {
    throw new Error('changelog-template is required when using custom format');
  }

  if (inputs.debugMode) {
    core.info('🔍 Debug mode enabled - detailed logging will be provided');
  }
}

// Run the action
void run();
