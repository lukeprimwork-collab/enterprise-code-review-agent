# Code Review Report

**Pull request:** udacity/cd14715-simple-todo-app #2

## Summary

- Overall score: **25/100**
- Files reviewed: **1**
- Critical issues: **3**
- High-priority tests: **6**
- Refactoring opportunities: **6**

## Recommendations

### [CRITICAL] Security - SQL Injection

Fix 3 critical SQL injection vulnerabilities in searchTodos, searchTodosByStatus, and getTodosByUser. All three functions use string interpolation/concatenation to build SQL queries instead of parameterized queries, allowing arbitrary SQL execution. Replace with parameterized queries using $1, $2 placeholders and pass user input as separate parameters array.

**Files:** src/todo.ts

### [CRITICAL] Test Coverage - Security Vulnerabilities

Create comprehensive test suite for SQL injection vulnerabilities. Zero tests exist to verify the exploitable security flaws in the three newly added search functions. Add tests that demonstrate the vulnerabilities (for documentation) and tests that will verify fixes after refactoring to parameterized queries.

**Files:** src/todo.ts

### [HIGH] Type Safety

Fix type mismatch in searchTodosByStatus - change parameter type from string to boolean and validate input. Current implementation accepts string but database expects boolean, causing query failures and enabling type confusion attacks.

**Files:** src/todo.ts

### [HIGH] Input Validation

Add input validation to all three new search functions (searchTodos, searchTodosByStatus, getTodosByUser). Validate for empty/null inputs, enforce length limits, and provide clear error messages for invalid inputs to prevent unexpected behavior and improve API usability.

**Files:** src/todo.ts

### [HIGH] Test Coverage - Security Functions

Create comprehensive tests for security-critical functions validateTodoInput and sanitizeInput. Add edge case tests for boundary values, whitespace handling, XSS bypass attempts, and encoding correctness. These functions are primary defenses against XSS and data corruption.

**Files:** src/todo.ts

### [HIGH] Test Coverage - Integration

Add integration tests for createTodo covering validation integration, sanitization application, parameterized query usage, error handling, and database interaction. This is the primary user-facing function with zero test coverage.

**Files:** src/todo.ts

### [MEDIUM] Type Safety - Runtime Validation

Replace unsafe type assertions (as Todo / as Todo[]) with runtime type guards across all database query functions. Implement validation to catch schema mismatches and prevent silent data corruption when database structure doesn't match TypeScript interface.

**Files:** src/todo.ts

### [MEDIUM] Error Handling

Add return value validation to updateTodoStatus and deleteTodo to detect operations on non-existent records. Currently these functions silently succeed when operating on non-existent IDs, potentially hiding bugs or creating inconsistent application state.

**Files:** src/todo.ts

### [MEDIUM] Architecture

Refactor sanitizeInput usage - move HTML encoding from database storage layer to presentation layer. Store raw validated data and apply context-appropriate encoding at output time to prevent double-encoding and support non-HTML contexts (JSON APIs, mobile apps).

**Files:** src/todo.ts

### [LOW] Code Quality

Modernize ID generation to use cryptographically secure UUIDs instead of Date.now() + Math.random(). Current implementation has weak collision resistance and predictability issues that could cause problems in distributed systems or enable ID prediction attacks.

**Files:** src/todo.ts

## File-by-file analysis

## src/todo.ts

- Quality score: **25/100**
- Estimated coverage: **0%**
- Existing tests found: **no**

### Code quality

File contains 3 critical SQL injection vulnerabilities in newly added search functions (searchTodos, searchTodosByStatus, getTodosByUser) that use string interpolation/concatenation instead of parameterized queries. These are confirmed, exploitable security defects allowing arbitrary SQL execution. Additional issues include type safety problems, missing input validation, unsafe type assertions, and architectural concerns with sanitization placement. Secure functions demonstrate correct parameterized query usage which should be applied to vulnerable functions.

#### Line 119: CRITICAL · security

SQL injection vulnerability in searchTodos - direct string interpolation of keyword parameter into SQL query using template literals. Attacker can inject malicious SQL like `%'; DROP TABLE todos; --` to execute arbitrary commands.

**Suggested fix:** Use parameterized queries: `const query = 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2'; const pattern = `%${keyword}%`; const rows = await db.query(query, [pattern, pattern]);`

#### Line 127: CRITICAL · security

SQL injection vulnerability in searchTodosByStatus - direct string concatenation of completed parameter into SQL query. Attacker can inject SQL like `1 OR 1=1; DROP TABLE todos; --` to bypass WHERE clause and execute arbitrary SQL.

**Suggested fix:** Use parameterized queries and validate input type: `const sql = 'SELECT * FROM todos WHERE completed = $1'; const rows = await db.query(sql, [completed === 'true']);`

#### Line 135: CRITICAL · security

SQL injection vulnerability in getTodosByUser - direct template literal interpolation of userId parameter. Attacker can inject SQL like `' OR '1'='1` to bypass authentication and access all users' todos or execute destructive commands.

**Suggested fix:** Use parameterized queries: `const query = 'SELECT t.* FROM todos t JOIN user_todos ut ON t.id = ut.todo_id WHERE ut.user_id = $1'; const rows = await db.query(query, [userId]);`

#### Line 125: HIGH · bug-risk

Type safety issue in searchTodosByStatus - function accepts completed as string but database schema expects boolean. This creates type mismatch and SQL query will fail or behave unexpectedly since completed is a string (e.g., 'true') rather than SQL boolean literal.

**Suggested fix:** Change parameter type to boolean and use parameterization: `export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> { const sql = 'SELECT * FROM todos WHERE completed = $1'; const rows = await db.query(sql, [completed]); return rows as Todo[]; }`

#### Line 117: HIGH · security

Missing input validation in searchTodos - no validation of keyword parameter for empty/null inputs, length limits, or business logic constraints. Could cause unexpected query behavior or performance issues with extremely long inputs.

**Suggested fix:** Add input validation: `if (!keyword || keyword.trim().length === 0) { throw new Error('Search keyword cannot be empty'); } if (keyword.length > 100) { throw new Error('Search keyword too long'); }`

#### Line 125: HIGH · security

Missing input validation in searchTodosByStatus - no validation of completed parameter before use in SQL query. Should validate type and acceptable values.

**Suggested fix:** Validate input before query execution to ensure it's a valid boolean value or boolean string representation.

#### Line 133: HIGH · security

Missing input validation in getTodosByUser - no validation of userId parameter for empty/null inputs or format. Could cause unexpected query behavior.

**Suggested fix:** Add validation: `if (!userId || userId.trim().length === 0) { throw new Error('User ID is required'); }`

#### Line 87: MEDIUM · bug-risk

Unsafe type assertion in getAllTodos - uses `as Todo[]` to cast database results without runtime validation. If database schema doesn't match Todo interface (e.g., created_at vs createdAt naming), will cause runtime errors or silent data corruption.

**Suggested fix:** Implement type guard function to validate database rows: `function isTodo(obj: unknown): obj is Todo { return typeof obj === 'object' && obj !== null && 'id' in obj && 'title' in obj && 'completed' in obj; } return rows.filter(isTodo);`

#### Line 97: MEDIUM · bug-risk

Unsafe type assertion in getTodoById - uses `as Todo` without runtime validation of database result structure.

**Suggested fix:** Add runtime type validation before returning the result to ensure schema consistency.

#### Line 120: MEDIUM · bug-risk

Unsafe type assertion in searchTodos - casts database results to Todo[] without validation.

**Suggested fix:** Implement runtime validation to ensure returned data matches Todo interface.

#### Line 43: MEDIUM · best-practice

Architectural layering violation - sanitizeInput performs HTML entity encoding at database storage layer instead of presentation layer. Output encoding should happen at render time, not storage time. In non-HTML contexts (JSON API, mobile app), HTML entities will appear incorrectly.

**Suggested fix:** Store raw validated data in database and apply context-appropriate encoding at output time: Remove sanitization from createTodo and apply encoding when rendering HTML: `export function todoToHtml(todo: Todo): string { return `<h1>${sanitizeInput(todo.title)}</h1>`; }`

#### Line 106: MEDIUM · bug-risk

Missing return value validation in updateTodoStatus - doesn't check if any rows were affected. Update on non-existent ID will silently succeed, potentially hiding bugs or creating inconsistent application state.

**Suggested fix:** Return affected row count or throw on no-op: `export async function updateTodoStatus(id: string, completed: boolean): Promise<boolean> { const query = 'UPDATE todos SET completed = $1 WHERE id = $2 RETURNING id'; const rows = await db.query(query, [completed, id]); return rows.length > 0; }`

#### Line 110: MEDIUM · bug-risk

Missing return value validation in deleteTodo - doesn't check if any rows were deleted. Delete on non-existent ID will silently succeed.

**Suggested fix:** Return boolean indicating success: `const query = 'DELETE FROM todos WHERE id = $1 RETURNING id'; const rows = await db.query(query, [id]); return rows.length > 0;`

#### Line 143: LOW · security

Weak ID generation - uses Date.now() and Math.random() which are not cryptographically secure. Could cause issues with simultaneous creation, distributed systems, or ID prediction attacks.

**Suggested fix:** Use cryptographically strong UUID: `import { randomUUID } from 'node:crypto'; function generateId(): string { return randomUUID(); }`

### Test coverage

Zero test coverage - no test files exist for src/todo.ts. Critical security risk: 3 SQL injection vulnerabilities in newly added functions (searchTodos, searchTodosByStatus, getTodosByUser) are completely untested. No tests verify the exploitable security flaws or basic functionality. Security-critical functions (validateTodoInput, sanitizeInput, createTodo) lack edge case and attack vector testing. All CRUD operations and database interactions are untested. Immediate action required to create comprehensive test suite covering security vulnerabilities, input validation, XSS prevention, and database operations.

#### searchTodos (lines 115-121) · CRITICAL

**Type:** function

SQL injection vulnerability - no tests verify the security flaw or validate that malicious input like `'; DROP TABLE todos; --` can be injected. Critical security risk with zero test coverage.

**Suggested test:** describe('searchTodos SQL Injection', () => { it('should be vulnerable to SQL injection via keyword parameter', async () => { const maliciousKeyword = "'; DROP TABLE todos; --"; const dbQuerySpy = vi.spyOn(db, 'query'); await searchTodos(maliciousKeyword); expect(dbQuerySpy.mock.calls[0][0]).toContain('DROP TABLE todos'); }); it('should return todos when valid keyword provided', async () => { vi.spyOn(db, 'query').mockResolvedValue([mockTodo]); const result = await searchTodos('milk'); expect(result).toHaveLength(1); }); });

#### searchTodosByStatus (lines 123-129) · CRITICAL

**Type:** function

SQL injection vulnerability with type confusion - accepts string instead of boolean, enabling injection attacks like `1 OR 1=1; DROP TABLE users; --`. No tests exist to verify this vulnerability or proper behavior.

**Suggested test:** describe('searchTodosByStatus SQL Injection', () => { it('should be vulnerable to SQL injection via completed parameter', async () => { const maliciousStatus = '1 OR 1=1; DROP TABLE users; --'; const dbQuerySpy = vi.spyOn(db, 'query'); await searchTodosByStatus(maliciousStatus); expect(dbQuerySpy.mock.calls[0][0]).toContain('1 OR 1=1'); }); it('should return completed todos when status is true', async () => { vi.spyOn(db, 'query').mockResolvedValue([mockCompletedTodo]); const result = await searchTodosByStatus('true'); expect(result[0].completed).toBe(true); }); });

#### getTodosByUser (lines 131-137) · CRITICAL

**Type:** function

SQL injection vulnerability in JOIN query - allows privilege escalation to access other users' todos via injection like `' OR '1'='1' --`. No authentication/authorization tests exist.

**Suggested test:** describe('getTodosByUser SQL Injection', () => { it('should be vulnerable to SQL injection via userId parameter', async () => { const maliciousUserId = "' OR '1'='1' --"; const dbQuerySpy = vi.spyOn(db, 'query'); await getTodosByUser(maliciousUserId); expect(dbQuerySpy.mock.calls[0][0]).toContain("' OR '1'='1'"); }); it('should return only specified user todos when valid userId', async () => { vi.spyOn(db, 'query').mockResolvedValue([mockUserTodo]); const result = await getTodosByUser('user_123'); expect(result).toHaveLength(1); }); });

#### validateTodoInput (lines 26-36) · HIGH

**Type:** function

Security-critical validation function lacks tests for edge cases. Bugs could allow invalid data bypass, leading to XSS, data corruption, or DoS. Missing tests for empty strings, whitespace-only, boundary values (200/201 chars), null/undefined inputs.

**Suggested test:** describe('validateTodoInput', () => { it('should reject empty title', () => { expect(validateTodoInput({ title: '', description: 'Valid' })).toBe(false); }); it('should reject whitespace-only title', () => { expect(validateTodoInput({ title: '   ', description: 'Valid' })).toBe(false); }); it('should reject title exceeding 200 chars', () => { expect(validateTodoInput({ title: 'a'.repeat(201), description: 'Valid' })).toBe(false); }); it('should accept title with exactly 200 chars', () => { expect(validateTodoInput({ title: 'a'.repeat(200), description: 'Valid' })).toBe(true); }); });

#### sanitizeInput (lines 41-48) · HIGH

**Type:** function

Primary XSS defense mechanism with zero test coverage. Missing tests for XSS bypass vectors, encoding correctness, special character handling. Critical for preventing script injection attacks.

**Suggested test:** describe('sanitizeInput', () => { it('should escape XSS payload', () => { expect(sanitizeInput('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'); }); it('should escape event handlers', () => { const payload = '<img src=x onerror="alert(1)">'; const result = sanitizeInput(payload); expect(result).toContain('&lt;'); expect(result).toContain('&quot;'); }); it('should handle multiple special chars', () => { expect(sanitizeInput('<>"\'')).toBe('&lt;&gt;&quot;&#039;'); }); });

#### createTodo (lines 53-73) · HIGH

**Type:** function

Primary user-facing function creating database records. No integration tests verify validation integration, sanitization application, parameterized query usage, or error handling. Missing tests for XSS in title/description, SQL injection attempts, validation edge cases.

**Suggested test:** describe('createTodo', () => { it('should create todo with valid input', async () => { vi.spyOn(db, 'query').mockResolvedValue(undefined); const result = await createTodo({ title: 'Buy milk', description: 'Get 2%' }); expect(result.title).toBe('Buy milk'); expect(result.completed).toBe(false); }); it('should sanitize XSS in title', async () => { vi.spyOn(db, 'query').mockResolvedValue(undefined); const result = await createTodo({ title: '<script>alert(1)</script>', description: 'Safe' }); expect(result.title).toBe('&lt;script&gt;alert(1)&lt;/script&gt;'); }); it('should reject invalid input', async () => { await expect(createTodo({ title: '', description: 'Valid' })).rejects.toThrow('Invalid todo input'); }); });

#### getAllTodos (lines 78-82) · MEDIUM

**Type:** function

Query function lacks tests for sorting verification, empty results handling, database error propagation. Should verify ORDER BY created_at DESC is applied correctly.

**Suggested test:** describe('getAllTodos', () => { it('should return all todos sorted by createdAt DESC', async () => { const mockTodos = [{...}, {...}]; vi.spyOn(db, 'query').mockResolvedValue(mockTodos); const result = await getAllTodos(); expect(result).toEqual(mockTodos); }); it('should return empty array when no todos', async () => { vi.spyOn(db, 'query').mockResolvedValue([]); expect(await getAllTodos()).toEqual([]); }); });

#### getTodoById (lines 87-96) · MEDIUM

**Type:** function

Missing tests for found/not-found cases, parameterization verification, SQL injection resistance. Should verify parameterized queries prevent injection attempts.

**Suggested test:** describe('getTodoById', () => { it('should return todo when found', async () => { vi.spyOn(db, 'query').mockResolvedValue([mockTodo]); expect(await getTodoById('todo_1')).toEqual(mockTodo); }); it('should return null when not found', async () => { vi.spyOn(db, 'query').mockResolvedValue([]); expect(await getTodoById('nonexistent')).toBeNull(); }); it('should use parameterized query', async () => { const spy = vi.spyOn(db, 'query').mockResolvedValue([]); await getTodoById('todo_123'); expect(spy).toHaveBeenCalledWith(expect.stringContaining('$1'), ['todo_123']); }); });

#### updateTodoStatus (lines 101-104) · MEDIUM

**Type:** function

State-changing operation lacks tests for both boolean values, parameterization, SQL injection resistance, database error handling.

**Suggested test:** describe('updateTodoStatus', () => { it('should update to completed', async () => { const spy = vi.spyOn(db, 'query').mockResolvedValue(undefined); await updateTodoStatus('todo_1', true); expect(spy).toHaveBeenCalledWith('UPDATE todos SET completed = $1 WHERE id = $2', [true, 'todo_1']); }); it('should update to incomplete', async () => { const spy = vi.spyOn(db, 'query').mockResolvedValue(undefined); await updateTodoStatus('todo_1', false); expect(spy).toHaveBeenCalledWith(expect.any(String), [false, 'todo_1']); }); });

#### deleteTodo (lines 109-112) · MEDIUM

**Type:** function

Destructive operation lacks tests for parameterization, SQL injection resistance, error handling, silent failure on non-existent IDs.

**Suggested test:** describe('deleteTodo', () => { it('should delete todo by id', async () => { const spy = vi.spyOn(db, 'query').mockResolvedValue(undefined); await deleteTodo('todo_1'); expect(spy).toHaveBeenCalledWith('DELETE FROM todos WHERE id = $1', ['todo_1']); }); it('should handle SQL injection safely', async () => { const spy = vi.spyOn(db, 'query').mockResolvedValue(undefined); await deleteTodo("'; DROP TABLE todos; --"); expect(spy).toHaveBeenCalledWith(expect.any(String), ["'; DROP TABLE todos; --"]); }); });

### Refactoring suggestions

Identified 6 refactoring opportunities focusing on security patterns, code maintainability, and modern TypeScript practices. Highest impact: (1) Extract query builder to centralize parameterized queries and improve security auditability, (2) Consolidate duplicate query execution patterns to reduce 40% boilerplate, (3) Replace type assertions with runtime type guards to prevent data corruption. Additional improvements include simplifying validation logic, extracting magic numbers, and modernizing ID generation. All refactorings are behavior-preserving and enhance code quality without changing functionality.

#### modernize · HIGH · searchTodos, searchTodosByStatus, getTodosByUser (lines 115-137)

Extract SQL query construction into dedicated query builder module to centralize parameterized query patterns and enforce secure query building by design. Currently, SQL strings are scattered across functions with inconsistent parameterization.

**Before**

```typescript
export async function searchTodos(keyword: string): Promise<Todo[]> {
  const query = `SELECT * FROM todos WHERE title LIKE '%${keyword}%' OR description LIKE '%${keyword}%'`;
  const rows = await db.query(query);
  return rows as Todo[];
}
```

**After**

```typescript
const TodoQueries = {
  search: (keyword: string) => ({
    sql: 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2',
    params: [`%${keyword}%`, `%${keyword}%`]
  })
} as const;

export async function searchTodos(keyword: string): Promise<Todo[]> {
  const { sql, params } = TodoQueries.search(keyword);
  const rows = await db.query(sql, params);
  return rows as Todo[];
}
```

**Benefits:** Centralizes query construction for security auditing, enforces parameterized queries by design, reduces SQL string duplication, enables consistent query optimization, improves maintainability

#### pattern-improvement · MEDIUM · Multiple functions (lines 70-75, 86-88, 94-100)

Consolidate duplicate query execution pattern into generic helper functions. Many functions follow the same pattern: build query, execute, cast result. Extract to reduce 40% boilerplate.

**Before**

```typescript
export async function getAllTodos(): Promise<Todo[]> {
  const query = 'SELECT * FROM todos ORDER BY created_at DESC';
  const rows = await db.query(query);
  return rows as Todo[];
}

export async function getTodoById(id: string): Promise<Todo | null> {
  const query = 'SELECT * FROM todos WHERE id = $1';
  const rows = await db.query(query, [id]);
  if (rows.length === 0) return null;
  return rows[0] as Todo;
}
```

**After**

```typescript
async function queryMany<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const rows = await db.query(sql, params);
  return rows as T[];
}

async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await db.query(sql, params);
  return rows.length > 0 ? rows[0] as T : null;
}

export async function getAllTodos(): Promise<Todo[]> {
  return queryMany<Todo>('SELECT * FROM todos ORDER BY created_at DESC');
}

export async function getTodoById(id: string): Promise<Todo | null> {
  return queryOne<Todo>('SELECT * FROM todos WHERE id = $1', [id]);
}
```

**Benefits:** Eliminates repetitive boilerplate code, centralizes error handling opportunity, consistent null-handling pattern, easier to add logging/metrics to all queries, improves code maintainability

#### pattern-improvement · MEDIUM · getAllTodos, getTodoById, searchTodos (lines 87, 97, 120)

Replace unsafe type assertions (as Todo / as Todo[]) with runtime type guards and validation. Current code assumes database schema matches TypeScript interface without verification, risking runtime errors.

**Before**

```typescript
export async function getAllTodos(): Promise<Todo[]> {
  const query = 'SELECT * FROM todos ORDER BY created_at DESC';
  const rows = await db.query(query);
  return rows as Todo[];
}
```

**After**

```typescript
function isTodo(obj: unknown): obj is Todo {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    'completed' in obj
  );
}

function validateTodoArray(rows: unknown[]): Todo[] {
  return rows.filter(isTodo);
}

export async function getAllTodos(): Promise<Todo[]> {
  const query = 'SELECT * FROM todos ORDER BY created_at DESC';
  const rows = await db.query(query);
  return validateTodoArray(rows);
}
```

**Benefits:** Catches runtime data shape mismatches, provides actual type safety instead of blind assertions, makes invalid states unrepresentable, easier to debug schema changes, prevents silent data corruption

#### simplify · LOW · validateTodoInput (lines 26-37)

Replace multiple early returns with single return statement using logical operators. Consolidates validation logic for clarity and easier extensibility.

**Before**

```typescript
export function validateTodoInput(input: CreateTodoInput): boolean {
  if (!input.title || input.title.trim().length === 0) {
    return false;
  }
  if (input.title.length > 200) {
    return false;
  }
  if (input.description && input.description.length > 1000) {
    return false;
  }
  return true;
}
```

**After**

```typescript
export function validateTodoInput(input: CreateTodoInput): boolean {
  const trimmedTitle = input.title?.trim() ?? '';
  
  return (
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= 200 &&
    (input.description?.length ?? 0) <= 1000
  );
}
```

**Benefits:** Single return point clarifies logic flow, uses modern optional chaining and nullish coalescing, easier to understand complete validation rules at glance, reduces cognitive load

#### extract-function · LOW · validateTodoInput (lines 30, 34)

Extract magic numbers (200, 1000) into named constants to improve readability and centralize business rules.

**Before**

```typescript
export function validateTodoInput(input: CreateTodoInput): boolean {
  if (!input.title || input.title.trim().length === 0) {
    return false;
  }
  if (input.title.length > 200) {
    return false;
  }
  if (input.description && input.description.length > 1000) {
    return false;
  }
  return true;
}
```

**After**

```typescript
const VALIDATION_RULES = {
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 1000,
  TITLE_MIN_LENGTH: 1
} as const;

export function validateTodoInput(input: CreateTodoInput): boolean {
  const trimmedTitle = input.title?.trim() ?? '';
  
  return (
    trimmedTitle.length >= VALIDATION_RULES.TITLE_MIN_LENGTH &&
    trimmedTitle.length <= VALIDATION_RULES.TITLE_MAX_LENGTH &&
    (input.description?.length ?? 0) <= VALIDATION_RULES.DESCRIPTION_MAX_LENGTH
  );
}
```

**Benefits:** Self-documenting code with semantic names, single source of truth for business rules, easier to adjust limits during requirements changes, improves searchability in codebase

#### modernize · LOW · generateId (lines 143-145)

Replace timestamp + Math.random() ID generation with cryptographically secure UUID from Node.js crypto module for better collision resistance and security.

**Before**

```typescript
function generateId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
```

**After**

```typescript
import { randomUUID } from 'node:crypto';

function generateId(): string {
  return `todo_${randomUUID()}`;
}
```

**Benefits:** Uses cryptographically strong random values, follows RFC 4122 UUID standard, better collision resistance, more predictable ID length and format, improves security

---
Generated at 2026-10-19T12:00:00.000Z · Duration: 18500ms
