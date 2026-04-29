# Enforesight API — Comprehensive Code Review & VAPT Report

**Date:** March 8, 2026  
**Reviewer:** GitHub Copilot (Claude Sonnet 4.6)  
**Scope:** Full codebase audit — security vulnerabilities, unused packages/dead code, coding standards, VAPT findings, production readiness  

---

## Table of Contents

1. [Critical Security Vulnerabilities (VAPT)](#1-critical-security-vulnerabilities-vapt)
2. [Weak Cryptographic Practices](#2-weak-cryptographic-practices)
3. [Missing Security Controls](#3-missing-security-controls)
4. [Unused / Dead Packages & Code](#4-unused--dead-packages--code)
5. [Coding Standards & Quality Issues](#5-coding-standards--quality-issues)
6. [Production Readiness Gaps](#6-production-readiness-gaps)
7. [Priority Fix Order](#7-priority-fix-order)

---

## 1. Critical Security Vulnerabilities (VAPT)

### 1.1 JWT Token Not Verified in Chat Routes
- **File:** `src/routes/chat.ts` (line ~37)
- **Severity:** 🔴 CRITICAL
- **Issue:** The local auth handler in this file uses `jwt.decode(token)` instead of `jwt.verify()`. This means any JWT — forged, expired, or unsigned — is accepted. An attacker can fabricate a token with any `userId` and access any user's conversations.
- **Fix:** Replace `jwt.decode()` with `jwt.verify(token, secret)` using the verified `JWT_SECRET`. Alternatively, reuse the existing `flexibleAuth` middleware from `src/middleware/flexibleAuth.ts` which already performs proper verification.

---

### 1.2 Hardcoded JWT Secret Fallback
- **Files:** `src/utils/auth.ts` (line ~6), `src/admin/utils/auth.ts` (line ~6)
- **Severity:** 🔴 CRITICAL
- **Issue:** Both files contain:
  ```typescript
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
  ```
  If the env var is missing, the fallback is a publicly known string. Any attacker can forge valid admin tokens.
- **Fix:** Throw a startup error if the secret is absent:
  ```typescript
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  ```

---

### 1.3 Unprotected Conversation History & PDF Export Endpoints
- **File:** `src/routes/ai-chat.ts` (lines ~325, ~606, ~692)
- **Severity:** 🔴 CRITICAL
- **Issue:** Multiple endpoints have auth intentionally commented out with TODO notes:
  - `GET /chat/history/:id` — marked `"TEMPORARY: Unprotected for testing"` (line ~325)
  - `GET /chat/export/:conversationId` — `requireClerkAuth` is commented out (line ~606)
  - `DELETE /chat/export/...` — same pattern (line ~692)
- **Impact:** Any unauthenticated user can read or export any conversation by ID (IDOR vulnerability).
- **Fix:** Re-enable `requireClerkAuth` on all three endpoints immediately. Remove the "TEMPORARY" comment.

---

### 1.4 Debug Endpoints Bypass Authentication
- **File:** `src/routes/admin.ts` (line ~46)
- **Severity:** 🔴 CRITICAL
- **Issue:** `/debug/dev-test` bypasses all auth when `NODE_ENV !== 'production'`, querying the entire database. Additional routes (`/debug/token`, `/debug/me`, `/debug/auth-only`) also leak sensitive information. Any misconfiguration of `NODE_ENV` exposes full data.
- **Fix:** Remove all debug routes. If needed during development, gate them behind `requireJWTAuth` + `requireAdmin` middleware regardless of environment.

---

### 1.5 Auth Debug Endpoint Exposes Server Configuration
- **File:** `src/routes/api.ts` (line ~59)
- **Severity:** 🟡 HIGH
- **Issue:** `GET /api/auth-debug` is completely unprotected and reveals whether Clerk keys, JWT keys, and webhook secrets are configured, along with the full CORS allowlist.
- **Fix:** Remove entirely or protect with admin auth middleware.

---

### 1.6 `eval()` Usage in PDF Utilities
- **File:** `src/utils/pdfUtils.ts` (line ~102)
- **Severity:** 🟡 HIGH
- **Issue:** Uses:
  ```typescript
  eval('import("pdfjs-dist/legacy/build/pdf.mjs")')
  ```
  to force a dynamic import. While the string is currently static, `eval()` is a significant security risk and is flagged by all SAST scanners. Any future refactor introducing a variable into this call opens a code injection vector.
- **Fix:** Use a direct dynamic import:
  ```typescript
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  ```
  If this fails due to bundler/CommonJS issues, adjust `tsconfig.json` module settings or use `createRequire`.

---

### 1.7 TLS Certificate Verification Disabled
- **File:** `src/services/email.service.ts` (line ~17)
- **Severity:** 🟡 HIGH
- **Issue:** The nodemailer transport is configured as:
  ```typescript
  tls: { rejectUnauthorized: false }
  ```
  This allows man-in-the-middle attacks on all SMTP connections. Email credentials and plaintext passwords sent via email can be intercepted.
- **Fix:** Remove the `tls` override entirely (Node.js defaults to `rejectUnauthorized: true`) or explicitly set it to `true`.

---

### 1.8 TEST_MODE Auth Bypass in Production Code
- **Files:** `src/middleware/flexibleAuth.ts` (line ~33), `src/middleware/clerkAuth.ts` (line ~56), `src/routes/chat.ts` (line ~16)
- **Severity:** 🟡 HIGH
- **Issue:** All three auth middlewares check `process.env.TEST_MODE === 'true'` and bypass authentication entirely. If this env var is accidentally set in a staging or production environment, all authentication is disabled.
- **Fix:** Add a double guard:
  ```typescript
  if (process.env.NODE_ENV !== 'production' && process.env.TEST_MODE === 'true')
  ```
  Or strip TEST_MODE from production-deployed code entirely.

---

### 1.9 Activation Code Exposed in GET Request
- **File:** `src/routes/` (user activation endpoint)
- **Severity:** 🟠 MEDIUM
- **Issue:** Activation codes are passed as URL path or query parameters in GET requests. These are logged in web server access logs, browser history, proxy logs, and referrer headers.
- **Fix:** Move activation to a POST request with the code in the request body.

---

### 1.10 Python Subprocess with User-Supplied Input
- **File:** `src/routes/ai-chat.ts`
- **Severity:** 🟠 MEDIUM
- **Issue:** User input is passed as arguments when spawning a Python subprocess for AI processing. JSON.stringify mitigates classic shell injection but does not protect against argument injection if argument parsing is unsafe in the Python side.
- **Fix:** Validate and sanitize all subprocess arguments. Prefer communicating via stdin (pipe) rather than command-line arguments.

---

## 2. Weak Cryptographic Practices

### 2.1 Weak Auto-Generated Password
- **File:** `src/admin/controllers/users.controller.ts` (line ~28)
- **Severity:** 🟡 HIGH
- **Issue:** Auto-generated passwords are 6 characters long, using only lowercase letters and digits (character space of 36). That is only ~2.2 billion combinations — easily brute-forced. `Math.random()` is also not a cryptographically secure RNG.
- **Fix:**
  ```typescript
  import { randomBytes } from 'crypto';
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const password = Array.from(randomBytes(16))
    .map(b => charset[b % charset.length])
    .join('');
  ```
  Minimum 12 characters with mixed character classes.

---

### 2.2 Plaintext Passwords Sent via Email
- **File:** `src/services/email.service.ts` (line ~74) — `sendActivationEmailWithPassword()`
- **Severity:** 🟡 HIGH
- **Issue:** The generated password is included verbatim in the HTML email body. Email is not a secure channel (plaintext in transit in many providers, stored in mail servers, visible to admins).
- **Fix:** Remove the password from the email. Send only the activation link. The activation flow already exists — let users set their own password during activation.

---

### 2.3 Hardcoded Default Admin Credentials
- **File:** `convex/seedAdminAction.ts` (line ~16)
- **Severity:** 🟠 MEDIUM
- **Issue:** The default admin password `Admin@123` is hardcoded in source code and returned in the response payload.
- **Fix:** Accept the password as an action argument, or immediately force a password-change flag on the seeded account.

---

## 3. Missing Security Controls

### 3.1 No Rate Limiting on Any Endpoint
- **Severity:** 🟡 HIGH
- **Issue:** Zero rate limiting is implemented anywhere. Login, activation, password reset, and all AI chat endpoints are completely unthrottled. This is even acknowledged in the docs: *"Currently no rate limiting is implemented."*
- **Endpoints at highest risk:**
  - `POST /api/admin/users/login` — brute-force password attacks
  - Activation/password reset endpoints — token enumeration
  - AI chat endpoints — OpenAI API cost drain
  - File upload endpoints — storage exhaustion
- **Fix:** Add `express-rate-limit`:
  ```typescript
  import rateLimit from 'express-rate-limit';
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  app.use('/api/admin/users/login', loginLimiter);
  ```

---

### 3.2 No CSRF Protection
- **Severity:** 🟠 MEDIUM
- **Issue:** While the API is primarily token-based, any cookie-based auth flows lack CSRF tokens.
- **Fix:** Use `csurf` or `@fastify/csrf-protection` (equivalent for Express). At minimum, enforce `SameSite=Strict` on any auth cookies.

---

### 3.3 Overly Permissive Request Body Size
- **Severity:** 🟠 MEDIUM
- **Issue:** Global body limit is 10MB (`express.json({ limit: '10mb' })`). AI chat endpoints accepting user text should have a much smaller limit (e.g., 64KB) to prevent abuse.
- **Fix:** Apply a tighter limit specifically to text-only routes before the global middleware.

---

### 3.4 Static Files Served Without Authentication
- **Severity:** 🟠 MEDIUM
- **Issue:** The `uploads/` directory (containing client-uploaded PDFs, images, and enforcement documents) is served via `express.static()` without any authentication check. Any URL-guessing attacker can access any uploaded file.
- **Fix:** Add auth middleware before the static file route, or serve files via signed URL if using cloud storage.

---

## 4. Unused / Dead Packages & Code

### 4.1 Unused npm Packages

| Package | Version | Status | Evidence |
|---------|---------|--------|----------|
| `cheerio` | ^1.2.0 | **Remove** | Zero imports in any `src/**/*.ts` file |
| `node-fetch` | ^3.3.2 | **Remove** | Zero imports; Node 18+ has native `fetch` built-in |
| `pdf-parse` | ^2.4.5 | **Remove** | Zero imports; `pdfjs-dist` is used instead |
| `@clerk/clerk-sdk-node` | ^5.1.6 | **Migrate** | EOL/deprecated by Clerk; only used in `src/middleware/flexibleAuth.ts` |
| `tsx` | ^4.21.0 | **Remove** | Not referenced anywhere; `ts-node` is used for dev |

**To remove:**
```bash
npm uninstall cheerio node-fetch pdf-parse tsx
```

**To migrate Clerk SDK:**  
Replace `@clerk/clerk-sdk-node` imports in `flexibleAuth.ts` with `@clerk/backend` (already a dependency).

---

### 4.2 Duplicate auth.ts Files
- `src/utils/auth.ts`
- `src/admin/utils/auth.ts`

These two files are **100% identical** — same exports, same logic, same hardcoded fallback secret. This is a DRY violation and means bugs or security fixes applied to one file may be missed in the other (as happened with the hardcoded secret).

**Fix:** Delete `src/admin/utils/auth.ts` and update imports in `src/admin/middleware/auth.ts` and `src/admin/controllers/users.controller.ts` to point to `../../utils/auth`.

---

### 4.3 Duplicate `ApiResponse<T>` Type
- Defined in `src/types/index.ts`
- Also defined in `src/types/chat.ts`

**Fix:** Keep the definition only in `src/types/index.ts` and import from there in `chat.ts`.

---

### 4.4 Redundant Three-File Auth Middleware
- `src/middleware/auth.ts` — Clerk auth with complex token resolution
- `src/middleware/clerkAuth.ts` — Another Clerk auth variant with `TEST_MODE` and `getClerkIssuer()` (hardcoded fallback domain: `https://oriented-mite-9.clerk.accounts.dev`)
- `src/middleware/flexibleAuth.ts` — Combines Clerk + JWT with `TEST_MODE`

These three files have overlapping responsibilities. `clerkAuth.ts` still contains a hardcoded staging Clerk domain.

**Fix:** Consolidate into a single `src/middleware/auth.ts` that handles both Clerk (customer portal) and JWT (admin) based on route context.

---

### 4.5 Dead Test Setup File
- `src/__tests__/setup.ts` — Entirely commented out. Does nothing.

**Fix:** Either populate it with actual global test setup (jest environment, mock cleanup) or delete the file and remove the `setupFilesAfterFramework` reference in `jest.config.js`.

---

### 4.6 Debug and Placeholder Routes
- `src/routes/admin.ts` — ~80 lines of debug-only routes with no business value in production
- `src/routes/demo.ts` — Appears to be demo/staging routes that should not be in production

**Fix:** Remove these files or exclude them from the production build.

---

## 5. Coding Standards & Quality Issues

### 5.1 50+ Console.log Statements in Production Code
Scattered `console.log`, `console.error`, and `console.warn` calls log sensitive data:
- Full JWT payloads logged in `src/routes/admin.ts`
- Auth header values logged in `src/routes/admin.ts`
- Clerk key presence logged at startup in `src/middleware/auth.ts`
- Database query results logged in multiple route files

**Fix:** Replace all `console.*` calls with a structured logger:
```bash
npm install pino pino-http
```
```typescript
import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
```
This provides structured JSON logs, log levels, and redaction of sensitive fields.

---

### 5.2 Widespread `any` Type Usage
Despite `strict: true` in `tsconfig.json`, there is heavy use of `any`:
- `verifyToken()` returns `any` in both auth utilities
- All parameters in `aggregation.service.ts` are typed `any`
- `catch (error: any)` pattern used everywhere instead of proper `unknown` narrowing
- `contentService.ts` API call responses cast to `any`

**Fix:** Replace `any` with proper types. For catch blocks:
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
}
```

---

### 5.3 Inconsistent API Response Shape
- Some endpoints return `{ success: true, data: ... }`
- Others return `{ data: ... }` directly
- Others return `{ message: "...", error: "..." }`
- Error responses are inconsistently structured

**Fix:** Define and enforce a single response envelope:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

### 5.4 Business Logic Embedded in Route Files
`src/routes/chat.ts` and `src/routes/ai-chat.ts` contain:
- Direct OpenAI API calls
- Python subprocess management
- PDF generation logic
- Database queries

None of this belongs in route files. It creates untestable, unmaintainable code bloat.

**Fix:** Extract into service classes (e.g., `ChatService`, `AiChatService`) following the pattern already used by `aggregation.service.ts`, `contentService.ts`, etc.

---

### 5.5 Fragile Dynamic Convex API Import Pattern
The following pattern is repeated in 10+ files:
```typescript
let api: any;
try {
  api = require('../../convex/_generated/api');
} catch {
  api = require('../convex/_generated/api');
}
```
This is fragile, suppresses errors silently, and bypasses TypeScript's module resolution.

**Fix:** Centralize into the existing `src/convex/api.ts` module (which already exists) and import from there everywhere. Update the build script to ensure the generated files are always in the correct location.

---

### 5.6 Hardcoded Reference Data in Route Files
Country lists, currency lists, sector lists, and enforcement action types are defined as large inline arrays in route files (`src/routes/countries.ts`, `src/routes/currencies.ts`, `src/routes/sectors.ts`).

**Fix:** Move to a `src/constants/` directory or database-backed configuration. This avoids route file bloat and allows updates without deployments.

---

### 5.7 Synchronous File I/O Blocking Event Loop
- `src/utils/pdfUtils.ts` uses `fs.readFileSync()` for reading PDF worker scripts.

**Fix:** Replace with `await fs.promises.readFile()`.

---

## 6. Production Readiness Gaps

| Area | Current Status | Recommendation |
|------|---------------|----------------|
| **Rate Limiting** | ❌ None | Add `express-rate-limit` on login, activation, AI chat endpoints |
| **Structured Logging** | ❌ Only `console.log` | Replace with `pino` or `winston` |
| **Health Check Depth** | ⚠️ Returns `{status: 'OK'}` only | Add Convex DB connectivity check |
| **Graceful Shutdown** | ❌ Missing | Add `SIGTERM`/`SIGINT` handlers to drain connections |
| **Request Correlation IDs** | ❌ Missing | Add `express-request-id` or UUID middleware |
| **API Versioning** | ❌ No `/v1/` prefix | Add versioning to avoid breaking changes |
| **Request Timeout** | ❌ No timeout middleware | Add `connect-timeout` for long-running operations |
| **Response Compression** | ❌ No `compression` middleware | Add `compression` package |
| **OpenAPI/Swagger Docs** | ❌ None | Generate from Zod schemas with `zod-to-openapi` |
| **OpenAI Cost Controls** | ❌ None | Add token counting + max input length before LLM calls |
| **File Upload Virus Scan** | ❌ None | Integrate ClamAV or a cloud scanning service |
| **Static File Auth** | ❌ Unprotected | Gate `/uploads` behind auth middleware |
| **ENV Var Validation at Startup** | ❌ None | Add a `validateEnv()` call at startup using `zod` |
| **Debug Endpoints** | ❌ In production code | Remove or guard behind auth + `NODE_ENV` checks |
| **TEST_MODE in Production** | ❌ Not guarded | Add `NODE_ENV !== 'production'` guard |
| **Deprecated Clerk SDK** | ⚠️ `clerk-sdk-node` EOL | Migrate to `@clerk/backend` |

### 6.1 Startup Environment Validation (Recommended Pattern)
```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  JWT_SECRET: z.string().min(32),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  CONVEX_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
});

export const env = envSchema.parse(process.env); // throws at startup if invalid
```

### 6.2 Graceful Shutdown Pattern
```typescript
const server = app.listen(PORT);

process.on('SIGTERM', () => {
  server.close(() => {
    logger.info('Server shut down gracefully');
    process.exit(0);
  });
});
```

---

## 7. Priority Fix Order

### P0 — Fix Immediately (Deployment Blockers)

| # | Issue | File | Effort |
|---|-------|------|--------|
| 1 | Replace `jwt.decode()` with `jwt.verify()` | `src/routes/chat.ts` | ~10 min |
| 2 | Remove hardcoded JWT secret fallback | `src/utils/auth.ts`, `src/admin/utils/auth.ts` | ~10 min |
| 3 | Re-enable auth on ai-chat history/export endpoints | `src/routes/ai-chat.ts` | ~5 min |
| 4 | Remove or protect all debug routes | `src/routes/admin.ts`, `src/routes/api.ts` | ~15 min |

### P1 — Fix Before Production Launch

| # | Issue | File | Effort |
|---|-------|------|--------|
| 5 | Add rate limiting (login + AI + upload) | `src/index.ts` | ~30 min |
| 6 | Remove `eval()` in pdfUtils | `src/utils/pdfUtils.ts` | ~10 min |
| 7 | Enable TLS cert verification on SMTP | `src/services/email.service.ts` | ~5 min |
| 8 | Guard `TEST_MODE` with `NODE_ENV !== 'production'` | 3 middleware files | ~10 min |
| 9 | Strengthen auto-generated password (12+ chars, `crypto`) | `src/admin/controllers/users.controller.ts` | ~15 min |
| 10 | Remove plaintext password from activation email | `src/services/email.service.ts` | ~20 min |
| 11 | Add startup env var validation | New `src/config/env.ts` | ~30 min |
| 12 | Add graceful shutdown | `src/index.ts` | ~15 min |

### P2 — Code Quality (Sprint Work)

| # | Issue | Effort |
|---|-------|--------|
| 13 | Remove unused packages (`cheerio`, `node-fetch`, `pdf-parse`, `tsx`) | ~10 min |
| 14 | Deduplicate `auth.ts` (delete admin copy) | ~15 min |
| 15 | Migrate from `@clerk/clerk-sdk-node` to `@clerk/backend` | ~30 min |
| 16 | Replace all `console.log` calls with `pino` logger | ~1–2 hrs |
| 17 | Extract business logic from chat route files into services | ~2–3 hrs |
| 18 | Fix `any` types across services and utilities | ~2–3 hrs |

### P3 — Production Hardening (Backlog)

| # | Issue | Effort |
|---|-------|--------|
| 19 | Add request correlation IDs | ~30 min |
| 20 | Add API versioning (`/v1/` prefix) | ~1 hr |
| 21 | Add deep health check (DB connectivity) | ~30 min |
| 22 | Secure static file serving for `/uploads` | ~1 hr |
| 23 | Add response compression middleware | ~15 min |
| 24 | Generate OpenAPI/Swagger documentation | ~2–4 hrs |
| 25 | Add OpenAI token/cost budget controls | ~1–2 hrs |

---

## Appendix A: Files to Delete

| File | Reason |
|------|--------|
| `src/admin/utils/auth.ts` | 100% duplicate of `src/utils/auth.ts` |
| `src/__tests__/setup.ts` | Entirely commented out, does nothing |

## Appendix B: `.env.example` Issues

- `CONVEX_DEPLOYMENT=dev:qualified-labrador-723` — Contains a real deployment identifier. Replace with a placeholder value.
- Missing entries for: `LOG_LEVEL`, `MAX_FILE_SIZE`, `CORS_ORIGINS`

## Appendix C: Convex-Specific Notes

Fixes already applied in this session:
- Added `'use node'` directive to `convex/userCleanup.ts`
- Switched `seedAdminAction.ts` and `userCleanup.ts` from static `import bcrypt` to `await import('bcrypt')` (required for Convex ARM64 bundler)
- Extracted `replaceUserDocument` mutation into new `convex/userCleanupMutations.ts` (Convex does not allow mutations in `'use node'` files)
