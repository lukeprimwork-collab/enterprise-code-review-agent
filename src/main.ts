import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError } from './utils/error-handler.js';

dotenv.config();

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function validateArguments(): {
  owner: string;
  repo: string;
  prNumber: number;
} {
  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    fail('Usage: npm run dev -- <owner> <repo> <pr-number>');
  }

  const prNumber = Number.parseInt(prStr, 10);
  if (!/^\d+$/.test(prStr) || !Number.isInteger(prNumber) || prNumber <= 0) {
    fail(`Invalid PR number "${prStr}". Provide a positive integer.`);
  }

  return { owner, repo, prNumber };
}

function validateEnvironment(): void {
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsAccessKey = Boolean(process.env.AWS_ACCESS_KEY_ID);
  const hasAwsSecret = Boolean(process.env.AWS_SECRET_ACCESS_KEY);
  const hasAws = hasAwsAccessKey && hasAwsSecret;

  if (!hasAnthropic && !hasAws) {
    fail(
      'No authentication configured. Set ANTHROPIC_API_KEY, or set both ' +
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for Bedrock.',
    );
  }

  if (hasAws && !process.env.AWS_REGION) {
    fail('AWS_REGION is required when using AWS Bedrock authentication.');
  }

  if (hasAnthropic) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.log('🔐 Using AWS Bedrock authentication');
  }

  if (!process.env.ANTHROPIC_MODEL) {
    fail(
      'ANTHROPIC_MODEL is required. Example Anthropic model: ' +
        'claude-sonnet-4-5-20250929. Example Bedrock model: ' +
        'us.anthropic.claude-sonnet-4-5-20250929-v1:0.',
    );
  }

  if (!process.env.PROJECT_ROOT) {
    fail('PROJECT_ROOT is required and must point to the project/starter directory.');
  }
}

async function saveReports(
  generator: ReportGenerator,
  report: Awaited<ReturnType<CodeReviewOrchestrator['reviewPullRequest']>>,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<void> {
  const reportsDir = join(process.env.PROJECT_ROOT!, 'reports');
  await mkdir(reportsDir, { recursive: true });

  const baseName = `${owner}_${repo}_${prNumber}`;
  const paths = {
    json: join(reportsDir, `${baseName}.json`),
    markdown: join(reportsDir, `${baseName}.md`),
    html: join(reportsDir, `${baseName}.html`),
  };

  await Promise.all([
    writeFile(paths.json, generator.generateJSONReport(report), 'utf8'),
    writeFile(paths.markdown, generator.generateMarkdownReport(report), 'utf8'),
    writeFile(paths.html, generator.generateHTMLReport(report), 'utf8'),
  ]);

  console.log('✅ Reports saved:');
  console.log(`   JSON:     ${paths.json}`);
  console.log(`   Markdown: ${paths.markdown}`);
  console.log(`   HTML:     ${paths.html}`);
}

async function main(): Promise<void> {
  const { owner, repo, prNumber } = validateArguments();
  validateEnvironment();

  console.log(`🔍 Reviewing ${owner}/${repo} PR #${prNumber}`);
  console.log(`🤖 Model: ${process.env.ANTHROPIC_MODEL}`);

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const generator = new ReportGenerator();
    await saveReports(generator, report, owner, repo, prNumber);

    console.log(
      `✅ Review complete: ${report.summary.totalFiles} file(s), overall score ${report.summary.overallScore}/100`,
    );
  } catch (error) {
    console.error(`❌ Review failed: ${formatError(error)}`);
    process.exitCode = 1;
  }
}

void main();
