import { query } from '@anthropic-ai/claude-agent-sdk';
import { mcpServersConfig } from './config/mcp.config.js';
import {
  codeQualityAnalyzer,
  refactoringSuggester,
  testCoverageAnalyzer,
} from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import {
  ReviewReportJSONSchema,
  ReviewReportSchema,
  type ReviewReport,
} from './types/report-types.js';
import {
  globalRateLimiter,
  withRetry,
  withTimeout,
} from './utils/index.js';

export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

async function* generateMessages(userMessage: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content: userMessage },
    parent_tool_use_id: null,
    session_id: 'code-review-orchestrator',
  };
}

function normalizeReportAggregates(report: ReviewReport): ReviewReport {
  const criticalIssues = report.fileReviews.reduce(
    (total, review) =>
      total + review.codeQuality.issues.filter(
        (issue) => issue.severity === 'critical',
      ).length,
    0,
  );
  const highPriorityTests = report.fileReviews.reduce(
    (total, review) =>
      total + review.testCoverage.untestedPaths.filter(
        (path) => path.priority === 'critical' || path.priority === 'high',
      ).length,
    0,
  );
  const refactoringOpportunities = report.fileReviews.reduce(
    (total, review) => total + review.refactorings.suggestions.length,
    0,
  );
  const overallScore = report.fileReviews.length === 0
    ? 0
    : Math.round(
        report.fileReviews.reduce(
          (total, review) => total + review.codeQuality.overallScore,
          0,
        ) / report.fileReviews.length,
      );

  return {
    ...report,
    summary: {
      ...report.summary,
      totalFiles: report.fileReviews.length,
      overallScore,
      criticalIssues,
      highPriorityTests,
      refactoringOpportunities,
    },
  };
}

export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly maxTurns: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;

  constructor(options: OrchestratorOptions = {}) {
    const model = options.model ?? process.env.ANTHROPIC_MODEL;
    if (!model) throw new Error('ANTHROPIC_MODEL environment variable is required');
    this.model = model;
    this.maxTurns = options.maxTurns ?? 40;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 600000;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<ReviewReport> {
    if (!owner.trim() || !repo.trim()) {
      throw new Error('Repository owner and name are required');
    }
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error('Pull request number must be a positive integer');
    }

    const projectRoot = process.env.PROJECT_ROOT;
    if (!projectRoot) {
      throw new Error('PROJECT_ROOT environment variable is required');
    }

    const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

    const runReviewOnce = async (): Promise<ReviewReport> => {
      let validationMessage: string | undefined;

      for await (const message of query({
        prompt: generateMessages(prompt),
        options: {
          model: this.model,
          maxTurns: this.maxTurns,
          cwd: projectRoot,
          settingSources: ['project'],
          permissionMode: 'bypassPermissions',
          allowedTools: [
            'Task',
            'Skill',
            'Read',
            'Grep',
            'Glob',
            'mcp__github__*',
            'mcp__eslint__*',
          ],
          agents: {
            'code-quality-analyzer': codeQualityAnalyzer,
            'test-coverage-analyzer': testCoverageAnalyzer,
            'refactoring-suggester': refactoringSuggester,
          },
          mcpServers: mcpServersConfig,
          outputFormat: {
            type: 'json_schema',
            schema: ReviewReportJSONSchema,
          },
        },
      })) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'tool_use' && (block.name === 'Task' || block.name === 'Skill')) {
              console.log(`[orchestrator] ${block.name} invocation:`, block.input);
            }
          }
        }

        if (message.type === 'result' && message.subtype === 'success') {
          if (!('structured_output' in message) || message.structured_output == null) {
            continue;
          }
          const parsed = ReviewReportSchema.safeParse(message.structured_output);
          if (parsed.success) return normalizeReportAggregates(parsed.data);
          validationMessage = parsed.error.message;
        }
      }

      if (validationMessage) {
        throw new Error(`Review report failed schema validation: ${validationMessage}`);
      }
      throw new Error('Code review completed without a valid structured report');
    };

    await globalRateLimiter.acquire(1000);
    try {
      return await withTimeout(
        () => withRetry(runReviewOnce, this.maxRetries, this.retryDelayMs),
        this.timeoutMs,
        `Pull request review timed out after ${this.timeoutMs}ms`,
      );
    } finally {
      globalRateLimiter.release();
    }
  }
}
