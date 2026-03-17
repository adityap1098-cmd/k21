# Phase 1: Auth & RBAC - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure login with email+password, JWT session management, role-based access control for 5 roles, admin user management (create/edit/deactivate), and audit logging on all mutations. No self-registration, no email infra, no password reset email links.

</domain>

<decisions>
## Implementation Decisions

### Token Storage & Delivery
- Refresh token: stored in **httpOnly Secure cookie** — XSS-proof, browser sends automatically
- Access token: returned in **response body JSON only** — client stores in memory, never localStorage
- Access token TTL: **15 minutes**
- Refresh token TTL: **30 days**

### Session Invalidation
- Refresh tokens stored in DB — deactivating a user **immediately revokes all their refresh tokens**
- Next API call after deactivation returns 401 (no grace period)
- This satisfies AUTH-06: "user immediately loses access"

### First-Login & Password Management
- Admin sets a **temporary password** when creating a user
- User is **forced to change password on first login** (must_change_password flag on users table)
- No self-service "forgot password" — Admin resets temporary password manually if user forgets
- Password minimum: **8 characters**, no complexity rules

### Role Permission Model
- **Hardcoded role checks** per route middleware — no permission table for Phase 1
- 5 roles: Owner, Finance, Warehouse Staff, Cashier, Admin
- Role assigned at user creation, editable by Admin

### Claude's Discretion
- JWT library choice (jose vs jsonwebtoken)
- Exact Drizzle schema for users / refresh_tokens / audit_logs tables
- Middleware composition pattern for role guards
- bcrypt vs argon2 for password hashing
- Cookie SameSite and domain configuration

</decisions>

<specifics>
## Specific Ideas

- No email infrastructure — system is fully operable without SMTP
- Admin-only user management keeps complexity low for a ~10 person team
- Deactivation must be instant because this is an internal ERP (terminated employee scenario)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/index.ts`: Express app with `/api/v1` router already registered — auth routes slot directly under it
- `apps/api/src/db/index.ts`: Drizzle + postgres.js client ready — auth schema tables go here
- `apps/api/src/modules/`: empty directory — auth module is the first module to populate this

### Established Patterns
- Module structure: `apps/api/src/modules/` — new `auth/` and `users/` modules follow this
- TypeScript NodeNext ESM — explicit `.js` extensions on relative imports required
- `postgres.js` driver (no prepared statements) — Drizzle queries use postgres.js connection from db/index.ts
- Fail-fast env var checks at startup — add JWT_SECRET, COOKIE_SECRET checks alongside DATABASE_URL

### Integration Points
- `v1Router` in `apps/api/src/index.ts` — mount `authRouter` and `usersRouter` here
- All subsequent phases (POS, Marketplace, etc.) will depend on the `requireRole()` middleware created in this phase
- `audit_logs` table created here is used by every future phase for mutation logging

</code_context>

<deferred>
## Deferred Ideas

- Self-service password reset via email — requires SMTP, deferred to v2
- Multi-device session management UI (see active sessions, revoke individual) — v2
- OAuth / SSO login — out of scope

</deferred>

---

*Phase: 01-auth-rbac*
*Context gathered: 2026-03-17*
