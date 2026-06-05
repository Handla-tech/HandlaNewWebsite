# Contributing to Handla

Thank you for your interest in contributing! This document covers the development workflow, branching strategy, code standards, and PR process.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Branching Strategy](#branching-strategy)
3. [Commit Conventions](#commit-conventions)
4. [Pull Request Process](#pull-request-process)
5. [Code Standards](#code-standards)
6. [Testing](#testing)

---

## Development Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| npm | 10+ |
| Docker & Docker Compose | 24+ |
| Git | 2.40+ |

### Quick Start (Local Dev)

```bash
# 1. Clone the repository
git clone https://github.com/Handla-tech/HandlaNewWebsite.git
cd HandlaNewWebsite

# 2. Start infrastructure (MySQL + Redis)
docker compose -f docker-compose.dev.yml up -d mysql redis

# 3. Backend setup
cd handla-backend
cp .env.example .env          # fill in your env vars
npm install
npm run migration:run         # apply DB migrations
npm run seed                  # optional: seed sample data
npm run start:dev             # hot-reload on :3001

# 4. Frontend setup (new terminal)
cd ../handla-frontend
cp .env.local.example .env.local    # fill in your env vars
npm install
npm run dev                         # hot-reload on :3000
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, protected |
| `genspark_ai_developer` | AI-assisted development (current active branch) |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, deps, housekeeping |

**Always branch off `main`** for new work. Open PRs against `main`.

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Build, deps, tooling (no prod code change) |
| `docs` | Documentation only |
| `refactor` | Code restructure without behaviour change |
| `test` | Add/update tests |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace (no logic change) |

### Examples

```
feat(auth): add refresh-token rotation
fix(navbar): profile menu closes on outside click
chore(deps): upgrade framer-motion to 11.x
docs(readme): add Docker quick-start instructions
test(chat): add markAllAsRead unit tests
```

---

## Pull Request Process

1. **Branch** off `main` with a descriptive name: `feature/websocket-reconnect`
2. **Develop** with small, focused commits following the convention above
3. **Test** — ensure `npm test` passes in `handla-backend` and `npx tsc --noEmit` in `handla-frontend`
4. **Squash** your commits before opening the PR:
   ```bash
   # Combine all local commits into one
   git reset --soft $(git merge-base main HEAD)
   git commit -m "feat(scope): comprehensive description"
   ```
5. **Sync** with `main`:
   ```bash
   git fetch origin main
   git rebase origin/main
   # resolve any conflicts, prefer remote code
   ```
6. **Push** and open a PR against `main`
7. **PR Template** — include:
   - Summary of changes
   - How to test
   - Screenshots for UI changes (if applicable)
   - TypeScript/test results

### PR Checklist

- [ ] `npx tsc --noEmit` — 0 errors (frontend)
- [ ] `npm test` — all tests pass (backend)
- [ ] No `console.log` left in production code
- [ ] New components have PropTypes / TypeScript interfaces
- [ ] Environment variables documented in `.env.example`
- [ ] `TODOS.md` updated if a phase task was completed

---

## Code Standards

### Frontend (Next.js / TypeScript)

- **ESLint**: `npm run lint` must pass with 0 errors
- **Formatting**: Prettier defaults (2-space indent, single quotes)
- **Components**: Functional components with explicit TypeScript prop interfaces
- **Imports**: Absolute paths via `@/` alias (configured in `tsconfig.json`)
- **State**: Zustand stores for global state; `useState` for local UI state
- **Async data**: TanStack Query (`useQuery` / `useMutation`) for server state
- **Styling**: Tailwind CSS utility classes; custom tokens via `tailwind.config.ts`
- **Accessibility**: All interactive elements need `aria-label` or `aria-labelledby`; min touch target `44px`

### Backend (NestJS / TypeScript)

- **Validation**: All DTOs use `class-validator` decorators
- **Guards**: `@Public()` decorator for unauthenticated routes; JWT guard is global
- **Error handling**: Throw typed exceptions from `src/utils/exceptions.ts`
- **Responses**: Use `TransformInterceptor` standard shape — never return raw entities directly
- **Logging**: Use NestJS `Logger` class (backs to Winston); never `console.log`
- **Secrets**: All credentials in `.env`; never hardcode tokens or passwords

---

## Testing

### Backend

```bash
cd handla-backend

# Run all tests
npm test

# Run specific test file
npx jest auth.service.spec

# With coverage
npm run test:cov
```

All 83 unit tests must pass before opening a PR. For ERP changes, the target is **200+ total tests**.

### Frontend

```bash
cd handla-frontend

# Type-check (no test framework set up yet — see TODOS.md)
npx tsc --noEmit

# Lint
npm run lint
```

---

## ERP-Specific PR Checklist

When opening a PR that touches any ERP module (`clients`, `projects`, `tasks`, `contracts`, `invoices`, `expenses`, `dashboard`, `users`), verify **every item** below before requesting review:

### Backend

- [ ] **Migration `down()` required** — every new migration file must have a complete, correct `down(queryRunner)` method that fully reverses the `up()`. PRs without a working `down()` will not be merged.
- [ ] **`OwnershipGuard` test** — any new endpoint decorated with `@OwnedResource()` must have a corresponding unit test asserting:
  - ADMIN bypasses (always passes)
  - EMPLOYEE passes when `ownerId === currentUser.id`
  - EMPLOYEE is denied when `ownerId !== currentUser.id` (throws `OwnershipViolationException`)
  - CLIENT / LEAD are always denied on that endpoint
- [ ] **Swagger decorators** — every ERP controller endpoint must have `@ApiTags`, `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth()` (or `@ApiCookieAuth()`). Every DTO class used in a request body must have `@ApiProperty()` on each field.
- [ ] **No `console.log`** — run `grep -r "console.log" handla-backend/src/modules/<your-module>` and confirm 0 results. Use `this.logger.log()` / `this.logger.error()` instead.
- [ ] **No hardcoded secrets or magic strings** — all config values must come from `ConfigService`; all typed exceptions must be imported from `src/utils/exceptions.ts`.
- [ ] **Enum values in migration** — if you add a new `*_enum` Postgres type, use `queryRunner.query(...)` directly (not `queryRunner.startTransaction`) because `ALTER TYPE … ADD VALUE` is non-transactional in PostgreSQL.
- [ ] **Ownership scoping in `findAll`** — every `findAll` in a new ERP service must:
  - Return **only own records** when `actingUser.role === EMPLOYEE`
  - Return **all records** when `actingUser.role === ADMIN`
  - Exclude records silently (not throw) for role-based scoping

### Frontend

- [ ] **`'use client'` + `mounted` guard** — every ERP page/component that uses browser APIs, Zustand, or TanStack Query must start with `'use client'` and wrap its render in a `if (!mounted) return null` guard.
- [ ] **TanStack Query config** — all `useQuery` calls must use `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`.
- [ ] **Touch targets** — all clickable ERP elements (buttons, action menus, tab pills) must have `min-h-[44px]` (WCAG 2.5.5).
- [ ] **ARIA completeness**:
  - Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby={id}`, Escape key handler
  - Tables: `role="table"`, `role="columnheader"` with `aria-sort` (if sortable), `role="cell"`
  - Tab bars: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`; panels: `role="tabpanel"`, `aria-labelledby`
  - Loading states: `aria-busy="true"` during fetch; `aria-live="polite"` on data regions
- [ ] **i18n** — no hardcoded English strings in ERP components. Every user-facing string must use `useTranslation` with a key defined in both `public/locales/en/common.json` and `public/locales/ar/common.json`.
- [ ] **RTL awareness** — use `dir`-aware Tailwind variants (`rtl:`) or CSS logical properties for any layout that has directional alignment (e.g. `text-right` → `ltr:text-right rtl:text-left`).
- [ ] **`npx tsc --noEmit` → 0 errors** — run from `handla-frontend/` and confirm no TypeScript errors introduced by your changes.

### Both

- [ ] **ERP_TODOS.md updated** — mark any newly completed tasks ✅ in `ERP_TODOS.md` and update the completion summary table at the bottom.
- [ ] **No new packages** — do not add any `npm` / `yarn` package not already present in the existing `package.json` files. If a new dependency is genuinely required, open a separate discussion issue first.

---

## Questions?

Open an issue or start a discussion in the GitHub repository.
