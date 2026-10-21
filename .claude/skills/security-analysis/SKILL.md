---
name: security-analysis
description: Security review playbook for SQL injection, authorization, secrets, payment data, user input, and sensitive data flows.
---

# Security Analysis

Use this skill when changed code handles SQL/database access, authentication, authorization, secrets, payments, user-controlled input, HTML output, or another security-sensitive data flow.

## Review checklist

1. Trace user-controlled input to a security-sensitive sink before reporting a vulnerability.
2. For SQL, distinguish parameter values from SQL text. Report injection only when untrusted input can alter SQL syntax.
3. Check authentication and authorization decisions, especially ownership and cross-user data access.
4. Check secrets and sensitive data for unsafe persistence, transmission, or logging. Do not infer exposure without code evidence.
5. For payment code, distinguish handling raw card data from storing it; recommend tokenization where raw card handling expands security/compliance scope.
6. Check error handling for accidental disclosure of sensitive values.
7. Do not confuse validation with output encoding or SQL parameterization.
8. Deduplicate findings with the same root cause.
9. Every security finding must cite the exact changed line and concrete risk path visible in the code.

## Severity guidance

Reserve critical severity for confirmed severe vulnerabilities such as exploitable injection, authentication/authorization bypass, exposed secrets, or demonstrated sensitive-data exposure. Use lower severity for hardening where the exploit path is not demonstrated.
