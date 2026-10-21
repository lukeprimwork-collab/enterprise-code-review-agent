# Multi-Agent Code Review System

Production-oriented pull request review system built with the Claude Agent SDK, Model Context Protocol (MCP), TypeScript, and Zod.

The application analyzes a GitHub pull request with three specialized subagents and aggregates their findings into a validated `ReviewReport`. It generates JSON, Markdown, and HTML reports suitable for automated review workflows and human inspection.

## Architecture

The main orchestrator coordinates three specialized agents:

- **Code Quality Analyzer** - reviews security, correctness, performance, maintainability, and best-practice issues.
- **Test Coverage Analyzer** - identifies untested functions, branches, edge cases, and proposes actionable tests.
- **Refactoring Suggester** - identifies behavior-preserving refactoring and modernization opportunities with before/after examples.

External tools are provided through MCP:

- **GitHub MCP server** - pull request metadata, changed files, diffs, and repository content.
- **ESLint MCP server** - linting and style-analysis integration.

Structured output is validated with Zod before reports are generated.

## Project Structure

```text
starter/
├── src/
│   ├── agents/
│   │   ├── code-quality-analyzer.ts
│   │   ├── test-coverage-analyzer.ts
│   │   ├── refactoring-suggester.ts
│   │   └── index.ts
│   ├── prompts/
│   │   ├── orchestrator.prompt.ts
│   │   ├── code-quality-analyzer.prompt.ts
│   │   ├── test-coverage-analyzer.prompt.ts
│   │   ├── refactoring-suggester.prompt.ts
│   │   └── index.ts
│   ├── config/
│   │   └── mcp.config.ts
│   ├── types/
│   │   ├── analysis-results.ts
│   │   ├── report-types.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── error-handler.ts
│   │   ├── rate-limiter.ts
│   │   ├── logger.ts
│   │   ├── report-generator.ts
│   │   └── index.ts
│   ├── orchestrator.ts
│   └── main.ts
├── tests/
├── reports/
├── .claude/skills/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- Node.js and npm
- Anthropic API credentials, or the credentials preconfigured by the Vocareum workspace
- `ANTHROPIC_MODEL`
- Absolute `PROJECT_ROOT`
- Optional `GITHUB_TOKEN` for higher GitHub API limits

## Installation

From the project directory:

```bash
npm install
```

## Environment Configuration

Create the project environment file from the provided template:

```bash
cp .env.example .env
```

For the Vocareum workspace, the project-specific configuration is:

```dotenv
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
PROJECT_ROOT=/absolute/path/to/cd14715-claude-code-classroom/project/starter
LOG_LEVEL=info
```

The Vocareum environment provides `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL`; they do not need to be copied into `.env`.

For local development with Anthropic credentials, configure the required credentials in the local environment. Do not commit secrets to source control.

A GitHub Personal Access Token can optionally be configured:

```dotenv
GITHUB_TOKEN=your-token-here
```

`.env` must not be included in the submission archive or committed to source control.

## Build

Compile the TypeScript project:

```bash
npm run build
```

A successful build completes with no TypeScript errors.

## Tests

Run the automated test suite:

```bash
npm test
```

The live integration test is intentionally skipped because it requires live Claude/MCP credentials. The remaining tests must pass.

## Usage

The CLI accepts three arguments:

```text
owner repository pull-request-number
```

Run a review with:

```bash
npm run dev -- <owner> <repo> <pr-number>
```

Example:

```bash
npm run dev -- udacity cd14715-simple-todo-app 1
```

The CLI validates arguments and environment configuration, runs the multi-agent review, validates the structured result, and generates three report formats in `reports/`.

## Required Submission Reports

The project submission includes analyses for the three required pull requests in `udacity/cd14715-simple-todo-app`.

Generate them with:

```bash
npm run dev -- udacity cd14715-simple-todo-app 1
npm run dev -- udacity cd14715-simple-todo-app 2
npm run dev -- udacity cd14715-simple-todo-app 3
```

The `reports/` directory must contain exactly these nine deliverables:

```text
reports/
├── udacity_cd14715-simple-todo-app_1.json
├── udacity_cd14715-simple-todo-app_1.md
├── udacity_cd14715-simple-todo-app_1.html
├── udacity_cd14715-simple-todo-app_2.json
├── udacity_cd14715-simple-todo-app_2.md
├── udacity_cd14715-simple-todo-app_2.html
├── udacity_cd14715-simple-todo-app_3.json
├── udacity_cd14715-simple-todo-app_3.md
└── udacity_cd14715-simple-todo-app_3.html
```

Each report includes:

- pull request identification
- file-by-file review results
- code-quality findings with file paths, line numbers, severity, descriptions, and suggested fixes
- test coverage gaps with actionable test suggestions
- refactoring opportunities with before/after examples
- aggregate scores and recommendation priorities

The HTML and Markdown outputs contain the detailed file-by-file analysis rather than only a summary.

## Error Handling

`src/utils/error-handler.ts` provides:

- retry handling with exponential backoff and jitter
- timeout handling with `Promise.race`
- structured `ReviewError` error codes

## Rate Limiting

`src/utils/rate-limiter.ts` provides:

- a 60-second sliding request window
- request-per-minute tracking
- token-per-minute tracking
- maximum concurrent request management
- queued request handling

## Security Notes

- Never commit `.env`.
- Never hardcode Anthropic, GitHub, or AWS credentials in source files.
- Keep generated reports free of credentials and tokens.
- Use environment variables for authentication and project-specific configuration.

## Final Validation

Before submission, run:

```bash
npm run build
npm test
find reports -maxdepth 1 -type f | wc -l
find reports -maxdepth 1 -type f -printf '%f\n' | sort
```

Expected submission state:

- TypeScript compilation succeeds.
- Unit tests pass; the credential-dependent live integration test may remain skipped.
- `reports/` contains 9 report files.
- Source code contains no hardcoded secrets.
- This README contains setup and usage instructions.

## Submission Packaging

Submit the complete project source together with `reports/`. Do not package generated dependencies, credentials, or build output.

A suitable archive can be created from the parent `project` directory with:

```bash
zip -r starter-submission.zip starter \
  -x "starter/node_modules/*" \
  -x "starter/.env" \
  -x "starter/dist/*"
```

The resulting submission archive should include the source code, tests, README, configuration/templates, skills, and all nine reports.
