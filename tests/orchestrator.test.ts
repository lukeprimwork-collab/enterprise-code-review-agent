import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReviewReportSchema } from '../src/types/report-types.js';

/**
 * Contract tests for the orchestrator-facing ReviewReport schema.
 * The live Claude/MCP integration remains opt-in because it requires credentials.
 */
describe('CodeReviewOrchestrator', () => {
  const originalModel = process.env.ANTHROPIC_MODEL;

  beforeEach(() => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
  });

  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = originalModel;
    }
  });

  describe('ReviewReport schema contract', () => {
    it('accepts a populated report object', () => {
      const candidate = {
        pullRequest: {
          owner: 'udacity',
          repo: 'cd14715-simple-todo-app',
          number: 1,
        },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 100,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0,
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 1,
          agentVersions: {},
        },
      };

      const parsed = ReviewReportSchema.safeParse(candidate);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid report data', () => {
      const invalid = {
        pullRequest: {
          owner: 'udacity',
          repo: 'cd14715-simple-todo-app',
          number: 1,
        },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 'invalid-score',
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0,
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 1,
          agentVersions: {},
        },
      };

      const parsed = ReviewReportSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      // Run manually when Anthropic/Vocareum and MCP credentials are available.
    });
  });
});
