# Phase 1: Auth & RBAC - Research

**Researched:** 2026-03-17
**Domain:** Express.js JWT authentication, refresh token rotation, Drizzle schema, RBAC middleware, audit logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Refresh token: stored in **httpOnly Secure cookie** — XSS-proof, browser sends automatically
- Access token: returned in **response body JSON only** — client stores in memory, never localStorage
- Access token TTL: **15 minutes**
- Refresh token TTL: **30 days**
- Refresh tokens stored in DB — deactivating a user **immediately revokes all their refresh tokens**
- Next API call after deactivation returns 401 (no grace period)
- Admin sets a **temporary password** when creating a user
- User is **forced to change password on first login** (must_change_password flag on users table)
- No self-service "forgot password" — Admin resets temporary password manually
- Password minimum: **8 characters**, no complexity rules
- **Hardcoded role checks** per route middleware — no permission table for Phase 1
- 5 roles: Owner, Finance, Warehouse Staff, Cashier, Admin
- Role assigned at user creation, editable by Admin

### Claude's Discretion
- JWT library choice (jose vs jsonwebtoken)
- Exact Drizzle schema for users / refresh_tokens / audit_logs tables
- Middleware composition pattern for role guards
- bcrypt vs argon2 for password hashing
- Cookie SameSite and domain configuration

### Deferred Ideas (OUT OF SCOPE)
- Self-service password reset via email — requires SMTP, deferred to v2
- Multi-device session management UI (see active sessions, revoke individual) — v2
- OAuth / SSO login — out of scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User dapat login dengan email dan password | POST /auth/login endpoint, bcrypt/argon2 verify, JWT issue |
| AUTH-02 | Session dikelola dengan JWT access token + refresh token (access token expiry pendek) | jose SignJWT (15 min access), DB-backed refresh token in httpOnly cookie (30 days) |
| AUTH-03 | User dapat logout dan invalidate session | DELETE refresh token row from DB, clear cookie |
| AUTH-04 | RBAC diterapkan dengan 5 role: Owner, Finance, Warehouse Staff, Cashier, Admin | pgEnum role column, requireRole() middleware factory |
| AUTH-05 | Setiap endpoint diproteksi sesuai permission role yang sesuai | authenticate() + requireRole([...]) middleware chain on all routes |
| AUTH-06 | Admin dapat membuat, mengedit, dan menonaktifkan user — user immediately loses access | users.isActive flag; deactivation deletes all refresh_tokens rows for that user |
| AUTH-07 | Semua API endpoint menggunakan prefix /api/v1/ | Already in index.ts; auth routes mount under v1Router |
| AUTH-08 | Semua perubahan data penting tercatat di audit_logs dengan user_id, action, old_value, new_value, ip_address, timestamp | audit_logs table with jsonb columns, logAudit() helper called by all user management mutations |
</phase_requirements>

---

## Summary

Phase 1 introduces authentication and role-based access control into a running Express + Drizzle monorepo. The technical surface is narrow but the patterns established here (middleware composition, DB schema, audit logging) will be inherited by every subsequent phase. The key architectural insight is that refresh token storage in PostgreSQL is not optional overhead — it is the mechanism that enables instantaneous deactivation, satisfying AUTH-06 with zero grace period.

The recommended JWT library is **jose** (not jsonwebtoken). jose ships as tree-shakeable ESM with zero dependencies, is actively maintained (v6.x, March 2026), and works directly with the WebCrypto API meaning the secret is encoded via `new TextEncoder().encode(JWT_SECRET)` — no legacy Buffer manipulation. jsonwebtoken is CJS-only and unmaintained as an ESM module; it would require a workaround in the NodeNext ESM codebase.

The recommended password hashing algorithm is **argon2id** via the `argon2` npm package (v0.44.0, August 2025). Argon2id is the OWASP #1 recommendation for 2026, provides memory-hardness that defeats GPU attacks, and ships prebuilt binaries for Alpine Linux (confirmed from v0.26.0 onward), eliminating Docker build-time native compilation concerns. bcrypt remains viable but is now the second-best choice for new projects.

**Primary recommendation:** Use jose for JWT, argon2id for hashing, cookie-parser for httpOnly cookie handling, and a single `authenticate` + `requireRole` middleware pair that all routes compose.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jose | ^6.0.0 | JWT sign/verify (HS256) | ESM-native, zero deps, WebCrypto-based, actively maintained v6 (Mar 2026) |
| argon2 | ^0.44.0 | Password hashing (argon2id) | OWASP #1 rec 2026; prebuilt Alpine binaries; memory-hard vs GPU attacks |
| cookie-parser | ^1.4.7 | Parse httpOnly cookies in Express | Standard Express middleware; enables req.cookies access |
| drizzle-orm | ^0.30.0 | DB schema + queries | Already in package.json |
| drizzle-kit | ^0.20.0 | Migration generation | Already in package.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/cookie-parser | ^1.4.0 | TypeScript types for cookie-parser | Dev dep, needed for req.cookies typing |
| zod | ^3.x | Request body validation | Validate login/create-user payloads at boundary |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jose | jsonwebtoken | jsonwebtoken is CJS-only; ESM workarounds needed; less maintained for ESM |
| argon2 | bcrypt | bcrypt is safer than plain SHA but not memory-hard; argon2id is strictly better for new projects |
| cookie-parser | Manual header parsing | cookie-parser is the established standard; no reason to hand-roll |

**Installation:**
```bash
pnpm --filter @k21/api add jose argon2 cookie-parser
pnpm --filter @k21/api add -D @types/cookie-parser
```

---

## Architecture Patterns

### Recommended Module Structure
```
apps/api/src/
├── db/
│   ├── index.ts              # existing Drizzle client
│   └── schema/
│       ├── users.ts          # users table + pgEnum roles
│       ├── refresh-tokens.ts # refresh_tokens table
│       ├── audit-logs.ts     # audit_logs table
│       └── index.ts          # re-exports all tables
├── modules/
│   ├── auth/
│   │   ├── auth.router.ts    # POST /login, POST /refresh, POST /logout
│   │   ├── auth.service.ts   # login(), refresh(), logout() business logic
│   │   ├── auth.test.ts      # Vitest unit tests
│   │   └── index.ts          # barrel export
│   └── users/
│       ├── users.router.ts   # GET /users, POST /users, PATCH /users/:id, DELETE /users/:id (deactivate)
│       ├── users.service.ts  # createUser(), updateUser(), deactivateUser()
│       ├── users.test.ts
│       └── index.ts
├── middleware/
│   ├── authenticate.ts       # verifies JWT, attaches req.user
│   ├── require-role.ts       # requireRole(...roles) factory
│   └── audit.ts              # logAudit() helper called by services
└── index.ts                  # mounts authRouter and usersRouter on v1Router
```

### Pattern 1: JWT Middleware Chain
**What:** Two-step middleware — `authenticate` verifies the token and attaches `req.user`; `requireRole` checks the attached role. Applied as `[authenticate, requireRole('Admin')]`.
**When to use:** Every protected route uses this composition. Public routes (login, refresh) skip both.

```typescript
// Source: jose docs (SignJWT / jwtVerify)
// middleware/authenticate.ts
import { jwtVerify } from 'jose'
import type { RequestHandler } from 'express'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export const authenticate: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, data: null, error: 'Missing token' })
    return
  }
  try {
    const token = authHeader.slice(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    // Attach to request for downstream use
    req.user = payload as { sub: string; role: string; mustChangePassword: boolean }
    next()
  } catch {
    res.status(401).json({ success: false, data: null, error: 'Invalid or expired token' })
  }
}
```

```typescript
// middleware/require-role.ts
import type { RequestHandler } from 'express'

type Role = 'Owner' | 'Finance' | 'Warehouse Staff' | 'Cashier' | 'Admin'

export const requireRole = (...roles: Role[]): RequestHandler => (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, error: 'Unauthenticated' })
    return
  }
  if (!roles.includes(req.user.role as Role)) {
    res.status(403).json({ success: false, data: null, error: 'Forbidden' })
    return
  }
  next()
}
```

### Pattern 2: JWT Issuance (jose SignJWT)
**What:** Issue access token (15 min) and refresh token (UUID stored in DB, 30 days via cookie).
**When to use:** POST /auth/login and POST /auth/refresh.

```typescript
// Source: jose SignJWT docs / github.com/panva/jose discussions
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signAccessToken(userId: string, role: string, mustChangePassword: boolean) {
  return new SignJWT({ role, mustChangePassword })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET)
}
```

### Pattern 3: Refresh Token Cookie
**What:** Refresh token is a UUID stored in DB with expiry; the cookie is httpOnly + Secure + SameSite=Strict.
**When to use:** Set on login/refresh, cleared on logout.

```typescript
// In auth.service.ts / auth.router.ts
import { randomUUID } from 'crypto'

// Issue refresh token
const refreshToken = randomUUID()
await db.insert(refreshTokens).values({
  id: randomUUID(),
  userId,
  token: refreshToken,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
})

res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  path: '/api/v1/auth/refresh',      // scope to refresh endpoint only
})
```

### Pattern 4: Immediate Deactivation (AUTH-06)
**What:** Deactivating a user sets `users.isActive = false` AND deletes all their refresh_tokens rows in one transaction.
**When to use:** Admin calls PATCH /api/v1/users/:id with `{ isActive: false }`.

```typescript
// users.service.ts — deactivateUser()
// Source: Drizzle insert/delete docs + project requirement AUTH-06
await db.transaction(async (tx) => {
  await tx.update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, userId))

  await tx.delete(refreshTokens)
    .where(eq(refreshTokens.userId, userId))
})
// No grace period — next API call returns 401 because refresh token is gone
```

### Pattern 5: Audit Logging (AUTH-08)
**What:** Every CREATE/UPDATE/DELETE writes to `audit_logs` with old/new values as JSONB.
**When to use:** Called by service functions after each mutation.

```typescript
// middleware/audit.ts
export async function logAudit(params: {
  db: typeof import('../db/index.js').db
  userId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  tableName: string
  recordId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string
}) {
  await params.db.insert(auditLogs).values({
    id: randomUUID(),
    userId: params.userId,
    action: params.action,
    tableName: params.tableName,
    recordId: params.recordId,
    oldValue: params.oldValue,
    newValue: params.newValue,
    ipAddress: params.ipAddress,
    createdAt: new Date(),
  })
}
```

### Pattern 6: must_change_password Enforcement
**What:** If JWT payload contains `mustChangePassword: true`, all routes except `POST /auth/change-password` return 403 with a specific error code.
**When to use:** In the `authenticate` middleware, after verifying the token.

```typescript
// In authenticate.ts, after successful jwtVerify:
if (payload.mustChangePassword && req.path !== '/auth/change-password') {
  res.status(403).json({
    success: false,
    data: null,
    error: 'PASSWORD_CHANGE_REQUIRED',
  })
  return
}
```

### Anti-Patterns to Avoid
- **Storing access token in cookie:** Contradicts the locked decision — access token MUST be in response body JSON only
- **Storing refresh token in localStorage/memory:** httpOnly cookie is the locked decision; JS-accessible storage defeats XSS protection
- **Permission table in DB:** Locked out of scope for Phase 1 — use hardcoded role arrays in requireRole() calls
- **Soft-deleting refresh tokens on deactivation:** Must hard-DELETE rows so isActive check alone is not the gate
- **Skipping argon2 config:** Use `argon2.hash(password, { type: argon2.argon2id })` explicitly; don't rely on default type
- **Using req.body.ip:** Extract IP from `req.ip` or `req.headers['x-forwarded-for']` (Nginx proxy sets X-Forwarded-For)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT sign/verify | Custom HMAC logic | jose SignJWT + jwtVerify | Clock skew, alg confusion attacks, token structure edge cases |
| Password hashing | SHA256 + salt | argon2 | Memory hardness, timing attack resistance, GPU resistance |
| Cookie parsing | Manual header split | cookie-parser middleware | Encoding edge cases, multiple cookie parsing |
| UUID generation | Custom random string | `crypto.randomUUID()` (Node built-in) | RFC 4122 compliant, no dep needed |
| DB migrations | Manual SQL files | drizzle-kit generate + migrate | Schema diffing, snapshot tracking, rollback safety |
| Input validation | Manual type checks | zod `.parse()` at route boundary | Exhaustive type coercion, error messages, nested validation |

**Key insight:** The security-critical path (JWT + password hashing) has dozens of subtle failure modes. Libraries represent years of CVE fixes. Never hand-roll crypto primitives.

---

## Drizzle Schema

### users table
```typescript
// Source: Drizzle sql-schema-declaration docs + project constraints
import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('user_role', [
  'Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin'
])

export const users = pgTable('users', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  email:              varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:       varchar('password_hash', { length: 255 }).notNull(),
  role:               roleEnum('role').notNull(),
  isActive:           boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

### refresh_tokens table
```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     varchar('token', { length: 36 }).notNull().unique(), // UUID string
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### audit_logs table
```typescript
import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const actionEnum = pgEnum('audit_action', ['CREATE', 'UPDATE', 'DELETE'])

export const auditLogs = pgTable('audit_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull(),  // no FK — preserve logs if user deleted
  action:     actionEnum('action').notNull(),
  tableName:  varchar('table_name', { length: 100 }).notNull(),
  recordId:   uuid('record_id').notNull(),
  oldValue:   jsonb('old_value'),
  newValue:   jsonb('new_value'),
  ipAddress:  varchar('ip_address', { length: 45 }).notNull(), // IPv6 max 45 chars
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## Common Pitfalls

### Pitfall 1: NodeNext ESM — Missing .js Extension on Relative Imports
**What goes wrong:** TypeScript compilation succeeds but Node.js throws `ERR_MODULE_NOT_FOUND` at runtime.
**Why it happens:** NodeNext module resolution requires explicit `.js` extensions even though source files are `.ts`. The existing codebase already demonstrates this pattern (`./db/index.js`, `./queue/connection.js`).
**How to avoid:** All relative imports in `modules/auth/`, `modules/users/`, `middleware/` MUST use `.js` extension.
**Warning signs:** `Cannot find module './auth.service'` in test or runtime output.

### Pitfall 2: argon2 Native Addon in Docker
**What goes wrong:** `npm install` or `pnpm install` fails in Alpine-based Docker image because node-gyp compilation deps (python3, make, g++) are missing.
**Why it happens:** argon2 is a native C++ binding. Pre-v0.26.0 had no prebuilt binaries for Alpine.
**How to avoid:** argon2 v0.44.0 ships prebuilt Alpine binaries — `npm install` will download the prebuilt binary, skipping compilation. No change to Dockerfile needed. Confirm: `pnpm add argon2@^0.44.0`.
**Warning signs:** `node-gyp rebuild` errors in Docker build log. If seen, add `libc6-compat` or switch to `node:22-slim` (Debian) base image.

### Pitfall 3: cookie-parser Not Applied Before Route Handlers
**What goes wrong:** `req.cookies` is `undefined` in the refresh token endpoint.
**Why it happens:** cookie-parser must be registered as app-level middleware BEFORE routes are registered.
**How to avoid:** Add `app.use(cookieParser())` in `apps/api/src/index.ts` before `app.use('/api/v1', v1Router)`.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'refresh_token')`.

### Pitfall 4: Refresh Token Replay After Logout
**What goes wrong:** A stolen refresh token can generate new access tokens after the user logged out.
**Why it happens:** If logout only clears the cookie on the client side, the DB row is still valid.
**How to avoid:** Logout MUST delete the refresh_tokens row from the DB. The cookie clearing is secondary.
**Warning signs:** Refresh endpoint returns 200 after explicit logout.

### Pitfall 5: PgBouncer TRANSACTION Mode — No Session-Level Statements
**What goes wrong:** Drizzle `db.transaction()` fails silently or throws with PgBouncer.
**Why it happens:** PgBouncer TRANSACTION mode does not support server-side prepared statements. The existing `db/index.ts` already has `{ prepare: false }` — this covers all Drizzle queries.
**How to avoid:** Never use raw `SET` commands, advisory locks, or `pg_advisory_xact_lock()` inside Drizzle transactions (those require session mode). Standard `db.transaction(tx => ...)` works fine.
**Warning signs:** Sporadic `prepared statement does not exist` errors.

### Pitfall 6: IP Address Extraction Behind Nginx
**What goes wrong:** `req.ip` always shows `127.0.0.1` (the Docker network address of Nginx).
**Why it happens:** Express behind a reverse proxy needs trust proxy configured.
**How to avoid:** Add `app.set('trust proxy', 1)` in `index.ts`. Then `req.ip` returns the real client IP from `X-Forwarded-For`. Nginx already sets this header.
**Warning signs:** All audit_log rows have the same IP (`172.x.x.x`).

### Pitfall 7: mustChangePassword Bypass
**What goes wrong:** A user with `must_change_password: true` can call any endpoint, not just the change-password endpoint.
**Why it happens:** The check is easy to forget on non-auth routes.
**How to avoid:** Put the mustChangePassword enforcement in the `authenticate` middleware itself so it fires on ALL protected routes automatically.
**Warning signs:** User can access /api/v1/products before changing password.

---

## Code Examples

### Password Hashing (argon2id)
```typescript
// Source: github.com/ranisalt/node-argon2 README
import argon2 from 'argon2'

// Hash (on user create / password change)
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id })
}

// Verify (on login)
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
```

### Full Login Flow
```typescript
// auth.service.ts — login()
export async function login(email: string, password: string, res: Response) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user || !user.isActive) {
    throw new Error('INVALID_CREDENTIALS')  // same error for security; don't leak existence
  }
  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) throw new Error('INVALID_CREDENTIALS')

  const accessToken = await signAccessToken(user.id, user.role, user.mustChangePassword)

  const refreshToken = randomUUID()
  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth/refresh',
  })

  return { accessToken }
}
```

### Express Route Registration
```typescript
// index.ts additions
import cookieParser from 'cookie-parser'
import { authRouter } from './modules/auth/index.js'
import { usersRouter } from './modules/users/index.js'

app.set('trust proxy', 1)  // real IP from X-Forwarded-For (Nginx)
app.use(cookieParser())

// ...existing v1Router setup...
v1Router.use('/auth', authRouter)
v1Router.use('/users', usersRouter)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsonwebtoken (CJS) | jose (ESM) | 2022-2023 | jose is the modern ESM-compatible standard; jsonwebtoken requires CJS workarounds in ESM projects |
| bcrypt for all new projects | argon2id preferred | 2015 (PHC win) + OWASP 2025 | argon2id is memory-hard; bcrypt remains acceptable but no longer the top recommendation |
| Session cookies with server-side session store | Short-lived JWT + DB-backed refresh tokens | ~2019+ | Stateless access token + revocable refresh token is the current standard pattern |
| express-jwt middleware | Custom authenticate middleware wrapping jose | Ongoing | express-jwt supports CJS jsonwebtoken; wrapping jose directly is cleaner for ESM |

**Deprecated/outdated:**
- `jsonwebtoken`: No native ESM. For NodeNext ESM projects, requires `createRequire` workaround. Not recommended for new code.
- `passport.js` local strategy: Valid but adds abstraction overhead for a simple email/password system with custom token handling.
- `express-session` with Redis store: Session-based auth is an alternative but the project has already decided on JWT.

---

## Open Questions

1. **zod vs manual validation for request bodies**
   - What we know: The project has no validation library yet. `@k21/shared` is empty stub.
   - What's unclear: Whether zod should be added to `@k21/shared` or `@k21/api` only.
   - Recommendation: Add zod to `@k21/api` for now; move shared schemas to `@k21/shared` in Phase 2 when the first inter-package boundary appears.

2. **Cookie `path` scoping for refresh token**
   - What we know: Setting `path: '/api/v1/auth/refresh'` restricts the browser to only send the cookie on that endpoint.
   - What's unclear: Whether this creates usability issues if the refresh endpoint path ever changes.
   - Recommendation: Use the scoped path. It reduces the cookie's attack surface. Document the path in the codebase with a comment.

3. **Express type augmentation for req.user**
   - What we know: TypeScript requires `declare global { namespace Express { interface Request { user?: ... } } }` to type req.user.
   - What's unclear: Where to put this declaration (module-level in authenticate.ts or a shared types file).
   - Recommendation: Put in `apps/api/src/types/express.d.ts` so it's available across all route files.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.6.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm --filter @k21/api test` |
| Full suite command | `pnpm --filter @k21/api test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login with valid email+password returns 200 + access token | unit | `pnpm --filter @k21/api test -- src/modules/auth/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | Login with wrong password returns 401 | unit | same | ❌ Wave 0 |
| AUTH-01 | Login with deactivated user returns 401 | unit | same | ❌ Wave 0 |
| AUTH-02 | Refresh with valid cookie returns new access token | unit | `pnpm --filter @k21/api test -- src/modules/auth/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | Refresh with expired/missing token returns 401 | unit | same | ❌ Wave 0 |
| AUTH-03 | Logout deletes DB row and clears cookie | unit | same | ❌ Wave 0 |
| AUTH-04 | pgEnum values match 5 required roles | unit | `pnpm --filter @k21/api test -- src/db/schema` | ❌ Wave 0 |
| AUTH-05 | Protected route without Bearer token returns 401 | unit | `pnpm --filter @k21/api test -- src/middleware/authenticate.test.ts` | ❌ Wave 0 |
| AUTH-05 | Route with wrong role returns 403 | unit | `pnpm --filter @k21/api test -- src/middleware/require-role.test.ts` | ❌ Wave 0 |
| AUTH-06 | Deactivating user deletes all refresh_tokens rows | unit | `pnpm --filter @k21/api test -- src/modules/users/users.test.ts` | ❌ Wave 0 |
| AUTH-07 | All routes are prefixed /api/v1/ | integration | `pnpm --filter @k21/api test -- src/index.test.ts` | ❌ Wave 0 (extend existing) |
| AUTH-08 | CREATE user writes audit_log row with correct fields | unit | `pnpm --filter @k21/api test -- src/modules/users/users.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @k21/api test`
- **Per wave merge:** `pnpm --filter @k21/api test:coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/auth/auth.test.ts` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `apps/api/src/modules/users/users.test.ts` — covers AUTH-06, AUTH-08
- [ ] `apps/api/src/middleware/authenticate.test.ts` — covers AUTH-05 (401 path)
- [ ] `apps/api/src/middleware/require-role.test.ts` — covers AUTH-05 (403 path)
- [ ] `apps/api/src/db/schema/users.test.ts` — covers AUTH-04 (enum values)
- [ ] New packages to install: `pnpm --filter @k21/api add jose argon2 cookie-parser && pnpm --filter @k21/api add -D @types/cookie-parser`

---

## Sources

### Primary (HIGH confidence)
- `github.com/panva/jose` — ESM compatibility, v6.x release date (March 2026), SignJWT + jwtVerify API, TextEncoder secret encoding pattern
- `orm.drizzle.team/docs/sql-schema-declaration` — pgTable, pgEnum, uuid, timestamp, boolean, varchar, $inferSelect/$inferInsert patterns
- `orm.drizzle.team/docs/insert` — insert().values().returning() API, jsonb column usage
- `orm.drizzle.team/docs/migrations` — drizzle-kit generate + migrate workflow
- `github.com/ranisalt/node-argon2` — native addon, prebuilt Alpine binaries from v0.26.0+, hash()/verify() API, v0.44.0 (Aug 2025)
- Existing codebase: `apps/api/src/db/index.ts` — confirmed `{ prepare: false }` for PgBouncer, postgres.js driver
- Existing codebase: `apps/api/src/index.ts` — v1Router already mounted, cookie-parser insertion point confirmed
- Existing codebase: `vitest.config.ts` — confirmed test framework and commands

### Secondary (MEDIUM confidence)
- WebSearch (OWASP 2026 argon2id recommendation) — multiple sources confirm argon2id as #1 recommendation; aligned with argon2 package official docs
- WebSearch (jose SignJWT HS256 TextEncoder pattern) — confirmed from panva/jose GitHub discussions and docs

### Tertiary (LOW confidence)
- None — all critical claims verified against official sources or existing codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — jose v6 confirmed from GitHub (March 2026 release), argon2 confirmed from GitHub (Aug 2025), drizzle patterns from official docs
- Architecture: HIGH — patterns derived from existing codebase conventions (NodeNext .js extensions, fail-fast env vars, module structure)
- Pitfalls: HIGH — PgBouncer constraint from existing codebase comment; NodeNext import extension from existing test file; argon2 Docker concern verified against v0.44.0 release notes
- Schema design: HIGH — Drizzle column types from official docs; constraint logic from project requirements

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (jose, argon2, drizzle are stable; 30-day window is conservative)
