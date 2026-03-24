# K21 Project Instructions

Always read `.skills/SKILL.md` before making any code changes. It contains the full project architecture, database schema, conventions, and critical rules to prevent errors.

## Quick Reference
- **Monorepo**: pnpm workspace — `apps/web` (Next.js 14) + `apps/api` (Express + Drizzle)
- **DB**: PostgreSQL on localhost:5433, user `appuser`, db `k21`
- **DB Driver**: `postgres.js` (NOT `pg`)
- **Users table**: `is_active` (not `active`), has `name` (nullable)
- **Express routes**: static routes BEFORE parameterized routes
- **Frontend API**: `authFetch` (raw Response) or `apiGet/apiPost` ({ success, data, error }) — don't mix
- **Locale**: Indonesian (id-ID) everywhere
- **Roles**: Owner, Admin, Finance, Warehouse Staff, Cashier
