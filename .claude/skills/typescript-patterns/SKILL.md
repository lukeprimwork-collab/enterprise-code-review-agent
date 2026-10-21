---
name: typescript-patterns
description: TypeScript review playbook for type safety, async correctness, API contracts, and maintainable TypeScript patterns.
---

# TypeScript Patterns

Use this skill when reviewing TypeScript (`.ts` or `.tsx`) changes.

## Review checklist

1. Check type correctness at public boundaries and avoid unsafe assertions where runtime data is untrusted.
2. Prefer explicit domain types, discriminated unions, type guards, and exhaustive handling where they reduce ambiguity.
3. Check async code for unhandled rejections, race conditions, missing cleanup, and incorrect Promise usage.
4. Check null/undefined handling and assumptions about external data.
5. Check API contracts for mismatched parameter/return types and unsafe casts.
6. Prefer clear, maintainable TypeScript over type-level complexity that does not improve safety.
7. Do not report stylistic preferences as defects unless they create a concrete maintenance or correctness risk.
8. Ground every finding in the exact changed file and line.

## Severity guidance

- critical: confirmed defect with severe security/data-loss impact or code that cannot safely compile/run.
- high: confirmed material correctness or reliability defect.
- medium: meaningful bounded type-safety or maintainability risk.
- low/info: localized improvement without material runtime risk.
