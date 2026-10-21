import type { ReviewReport } from '../types/report-types.js';

const escapeHtml = (value: unknown): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const fence = (value: string): string => `\n\`\`\`typescript\n${value}\n\`\`\`\n`;

export class ReportGenerator {
  generateJSONReport(report: ReviewReport): string {
    return JSON.stringify(report, null, 2);
  }

  generateMarkdownReport(report: ReviewReport): string {
    const out: string[] = [
      '# Code Review Report',
      '',
      `**Pull request:** ${report.pullRequest.owner}/${report.pullRequest.repo} #${report.pullRequest.number}`,
      '',
      '## Summary',
      '',
      `- Overall score: **${report.summary.overallScore}/100**`,
      `- Files reviewed: **${report.summary.totalFiles}**`,
      `- Critical issues: **${report.summary.criticalIssues}**`,
      `- High-priority tests: **${report.summary.highPriorityTests}**`,
      `- Refactoring opportunities: **${report.summary.refactoringOpportunities}**`,
      '',
      '## Recommendations',
      '',
    ];

    if (report.recommendations.length === 0) out.push('_No recommendations._', '');
    for (const rec of report.recommendations) {
      out.push(
        `### [${rec.priority.toUpperCase()}] ${rec.category}`,
        '',
        rec.description,
        '',
        `**Files:** ${rec.files.join(', ')}`,
        '',
      );
    }

    out.push('## File-by-file analysis', '');
    for (const review of report.fileReviews) {
      out.push(
        `## ${review.file}`,
        '',
        `- Quality score: **${review.codeQuality.overallScore}/100**`,
        `- Estimated coverage: **${review.testCoverage.coverageEstimate}%**`,
        `- Existing tests found: **${review.testCoverage.hasTests ? 'yes' : 'no'}**`,
        '',
        '### Code quality',
        '',
        review.codeQuality.summary,
        '',
      );
      if (review.codeQuality.issues.length === 0) out.push('_No issues found._', '');
      for (const issue of review.codeQuality.issues) {
        out.push(
          `#### Line ${issue.line}: ${issue.severity.toUpperCase()} · ${issue.category}`,
          '',
          issue.description,
          '',
          `**Suggested fix:** ${issue.suggestion}`,
          '',
        );
      }

      out.push('### Test coverage', '', review.testCoverage.summary, '');
      if (review.testCoverage.testFiles.length > 0) {
        out.push(`**Test files:** ${review.testCoverage.testFiles.join(', ')}`, '');
      }
      if (review.testCoverage.untestedPaths.length === 0) out.push('_No test gaps found._', '');
      for (const gap of review.testCoverage.untestedPaths) {
        out.push(
          `#### ${gap.location} · ${gap.priority.toUpperCase()}`,
          '',
          `**Type:** ${gap.type}`,
          '',
          gap.reasoning,
          '',
          `**Suggested test:** ${gap.suggestedTest}`,
          '',
        );
      }

      out.push('### Refactoring suggestions', '', review.refactorings.summary, '');
      if (review.refactorings.suggestions.length === 0) out.push('_No refactorings suggested._', '');
      for (const suggestion of review.refactorings.suggestions) {
        out.push(
          `#### ${suggestion.type} · ${suggestion.impact.toUpperCase()} · ${suggestion.location}`,
          '',
          suggestion.description,
          '',
          '**Before**',
          fence(suggestion.before),
          '**After**',
          fence(suggestion.after),
          `**Benefits:** ${suggestion.benefits}`,
          '',
        );
      }
    }

    out.push(
      '---',
      `Generated at ${report.metadata.analyzedAt} · Duration: ${report.metadata.duration}ms`,
      '',
    );
    return out.join('\n');
  }

  generateHTMLReport(report: ReviewReport): string {
    const recommendations = report.recommendations.map((rec) => `
      <article class="card rec-${escapeHtml(rec.priority)}">
        <h3>[${escapeHtml(rec.priority).toUpperCase()}] ${escapeHtml(rec.category)}</h3>
        <p>${escapeHtml(rec.description)}</p>
        <p><strong>Files:</strong> ${escapeHtml(rec.files.join(', '))}</p>
      </article>`).join('');

    const files = report.fileReviews.map((review) => {
      const issues = review.codeQuality.issues.map((issue) => `
        <article class="item severity-${escapeHtml(issue.severity)}">
          <h4>Line ${issue.line}: ${escapeHtml(issue.severity).toUpperCase()} · ${escapeHtml(issue.category)}</h4>
          <p>${escapeHtml(issue.description)}</p>
          <p><strong>Suggested fix:</strong> ${escapeHtml(issue.suggestion)}</p>
        </article>`).join('') || '<p>No issues found.</p>';
      const gaps = review.testCoverage.untestedPaths.map((gap) => `
        <article class="item">
          <h4>${escapeHtml(gap.location)} · ${escapeHtml(gap.priority).toUpperCase()}</h4>
          <p><strong>Type:</strong> ${escapeHtml(gap.type)}</p>
          <p>${escapeHtml(gap.reasoning)}</p>
          <p><strong>Suggested test:</strong> ${escapeHtml(gap.suggestedTest)}</p>
        </article>`).join('') || '<p>No test gaps found.</p>';
      const refactorings = review.refactorings.suggestions.map((item) => `
        <article class="item">
          <h4>${escapeHtml(item.type)} · ${escapeHtml(item.impact).toUpperCase()} · ${escapeHtml(item.location)}</h4>
          <p>${escapeHtml(item.description)}</p>
          <h5>Before</h5><pre><code>${escapeHtml(item.before)}</code></pre>
          <h5>After</h5><pre><code>${escapeHtml(item.after)}</code></pre>
          <p><strong>Benefits:</strong> ${escapeHtml(item.benefits)}</p>
        </article>`).join('') || '<p>No refactorings suggested.</p>';

      return `
      <section class="file">
        <h2>${escapeHtml(review.file)}</h2>
        <div class="metrics"><span>Quality: <b>${review.codeQuality.overallScore}/100</b></span><span>Coverage: <b>${review.testCoverage.coverageEstimate}%</b></span></div>
        <h3>Code quality</h3><p>${escapeHtml(review.codeQuality.summary)}</p>${issues}
        <h3>Test coverage</h3><p>${escapeHtml(review.testCoverage.summary)}</p>${gaps}
        <h3>Refactoring suggestions</h3><p>${escapeHtml(review.refactorings.summary)}</p>${refactorings}
      </section>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Code Review Report</title><style>
body{font-family:Arial,sans-serif;max-width:1100px;margin:auto;padding:24px;background:#f6f8fa;color:#24292f}h1,h2{border-bottom:1px solid #d0d7de;padding-bottom:8px}.summary,.metrics{display:flex;flex-wrap:wrap;gap:12px}.metric,.metrics span,.card,.item,.file{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:16px;margin:12px 0}.metric{min-width:145px}.metric b{font-size:24px;display:block}.rec-critical,.severity-critical{border-left:5px solid #cf222e}.rec-high,.severity-high{border-left:5px solid #bf8700}.severity-medium{border-left:5px solid #0969da}.severity-low,.severity-info{border-left:5px solid #1a7f37}pre{overflow:auto;background:#0d1117;color:#e6edf3;padding:14px;border-radius:6px}code{white-space:pre-wrap}footer{margin-top:30px;color:#57606a}
</style></head><body>
<h1>Code Review Report</h1><p><strong>Pull request:</strong> ${escapeHtml(report.pullRequest.owner)}/${escapeHtml(report.pullRequest.repo)} #${report.pullRequest.number}</p>
<section class="summary"><div class="metric"><b>${report.summary.overallScore}</b>Overall score</div><div class="metric"><b>${report.summary.totalFiles}</b>Files</div><div class="metric"><b>${report.summary.criticalIssues}</b>Critical issues</div><div class="metric"><b>${report.summary.highPriorityTests}</b>High-priority tests</div><div class="metric"><b>${report.summary.refactoringOpportunities}</b>Refactorings</div></section>
<h2>Recommendations</h2>${recommendations || '<p>No recommendations.</p>'}
<h2>File-by-file analysis</h2>${files}
<footer>Generated at ${escapeHtml(report.metadata.analyzedAt)} · Duration: ${report.metadata.duration}ms</footer>
</body></html>`;
  }
}
