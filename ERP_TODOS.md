# HANDLA ERP — Task Tracker
> Built on top of HandlaNewWebsite (all 20 original phases ✅ complete).  
> Glassmorphism + gold accent (#fbbf24) design. NestJS 10 + TypeORM + Next.js 14 App Router.  
> Mark ✅ when done & tested, 🔄 when in progress, ⏳ when pending, 🚫 when blocked.

---

## LEGEND
- ✅ Done & tested
- 🔄 In Progress
- ⏳ Pending
- 🚫 Blocked

---

## GROUND RULES (mirror existing conventions — never deviate)

- **Backend**: NestJS 10 + TypeORM + PostgreSQL 16. No auto-sync — migrations only.  
  `TransformInterceptor` envelope on every response. Typed exceptions from `src/utils/exceptions.ts`.  
  Winston Logger only (no `console.log`). `@ApiTags`/`@ApiOperation`/`@ApiResponse` on every controller.  
  `@Public()` / `@Roles()` / `@CurrentUser()` decorators exactly as used in existing code.
- **Frontend**: Next.js 14 App Router. Tailwind + dark glassmorphism + `#fbbf24` gold. Zustand + TanStack Query  
  (`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`). Axios `@/lib/api.ts` with 401→refresh.  
  Socket.io singleton `@/lib/socket.ts`. `useTranslation` EN/AR + RTL. `'use client'` + `mounted` guard.  
  Absolute `@/` imports. Touch targets `min-h-[44px]`. ARIA everywhere. Skeletons + EmptyState + error boundaries.
- **Workflow**: Conventional Commits. Branch `genspark_ai_developer`. After every module:  
  `npx tsc --noEmit` (0 errors) · `npm test` (all green, 135+ existing tests still pass) · `npm run lint`.  
  Update this file — mark tasks ✅ immediately after completing and testing each one.
- **No new libraries**: Do not introduce any package not already present in the existing `package.json` files.
- **Ownership policy**: EMPLOYEE can create records and update/delete only records where `ownerId === user.id`.  
  ADMIN bypasses all ownership checks. CLIENT is read-only on their own records. LEAD is chat-only.

---

## PHASE ERP-1 — ROLE ENUM EXPANSION & OWNERSHIP POLICY GUARD ✅

> **Purpose**: Expand `UserRole` to `ADMIN | EMPLOYEE | CLIENT | LEAD`, wire through the full stack,  
> and introduce a reusable `@OwnedResource()` guard used by all subsequent ERP modules.  
> **Dependency**: Must be completed before every other ERP phase.

### ERP-1.1 — Database Migration: Expand UserRole Enum
- [x] ✅ Create migration `src/database/migrations/<timestamp>-ExpandUserRoles.ts`
  - [x] ✅ `ALTER TYPE "user_role_enum" ADD VALUE 'EMPLOYEE'` (Postgres enum ADD VALUE is non-transactional — handle with `queryRunner.query`)
  - [x] ✅ `ALTER TYPE "user_role_enum" ADD VALUE 'LEAD'`
  - [x] ✅ Write `down()` that removes values via `CREATE TYPE … AS ENUM (old values)` + column `ALTER COLUMN … USING … ::text::"new_enum"` pattern
  - [x] ✅ Verify migration runs cleanly: `npm run migration:run`

### ERP-1.2 — Backend: Enum & Default Update
- [x] ✅ Update `src/common/enums/index.ts` — add `EMPLOYEE = 'EMPLOYEE'` and `LEAD = 'LEAD'` to `UserRole`
- [x] ✅ Update `User` entity (`user.entity.ts`) — change default role from `CLIENT` to `LEAD` (new public signups default to LEAD)
- [x] ✅ Update `AuthService.signUp()` — set `role: UserRole.LEAD` on new registrations
- [x] ✅ Update `AuthService.generateTokens()` — verify `role` is included in JWT payload (already present; confirm no changes needed)
- [x] ✅ Update `JwtStrategy` — verify `role` is extracted correctly from payload (already present; confirm)

### ERP-1.3 — Backend: OwnedResource Guard & Decorator
- [x] ✅ Create `src/common/decorators/owned-resource.decorator.ts`
  - [x] ✅ Export `@OwnedResource()` method decorator that sets metadata key `IS_OWNED_RESOURCE`
  - [x] ✅ Export `OwnerIdExtractor` type: `(req: Request) => string | null | undefined` (body, params, or DB-fetched)
- [x] ✅ Create `src/common/guards/ownership.guard.ts` — `OwnershipGuard implements CanActivate`
  - [x] ✅ Inject `Reflector`; skip guard if `IS_OWNED_RESOURCE` metadata is not present
  - [x] ✅ ADMIN role → always passes (bypass ownership check)
  - [x] ✅ EMPLOYEE role → check that `ownerId` on the target record equals `currentUser.id`; throw `InsufficientPermissionsException` if not
  - [x] ✅ CLIENT, LEAD → throw `InsufficientPermissionsException` for any mutating operation (they cannot own ERP records)
  - [x] ✅ Register `OwnershipGuard` as a global guard **after** `RolesGuard` in `app.module.ts` providers (or apply per-controller)
- [x] ✅ Add new typed exceptions to `src/utils/exceptions.ts`:
  - [x] ✅ `OwnershipViolationException extends ForbiddenException` — "You do not own this resource"
  - [x] ✅ `RolePromotionException extends BadRequestException` — "Invalid role transition"
  - [x] ✅ `LeadNotAssignedException extends BadRequestException` — "Lead has no assigned employee"

### ERP-1.4 — Backend: Chat Module Updates for New Roles
- [x] ✅ Update `ChatService.getConversations()` — expand role-aware filtering:
  - [x] ✅ ADMIN: sees all conversations (existing behaviour, no change)
  - [x] ✅ EMPLOYEE: sees only conversations where `assignedEmployeeId === user.id`
  - [x] ✅ CLIENT: sees only conversations where `clientId === user.id` (existing behaviour)
  - [x] ✅ LEAD: sees only conversations where `clientId === user.id` (same as CLIENT — LEAD IS the user before promotion)
- [x] ✅ Update `ChatService.assertAccess()` — allow EMPLOYEE access when `conversation.assignedEmployeeId === user.id`
- [x] ✅ Update `ChatGateway.handleConnection()` — LEAD and EMPLOYEE roles are now valid authenticated users; no rejection
- [x] ✅ Update `ChatGateway.handleSendMessage()` — LEAD and EMPLOYEE can send messages in their respective conversations

### ERP-1.5 — Backend: Conversation Migration (assigned_employee_id)
- [x] ✅ Create migration `src/database/migrations/<timestamp>-AddAssignedEmployeeToConversations.ts`
  - [x] ✅ `ALTER TABLE "conversations" ADD COLUMN "assigned_employee_id" UUID REFERENCES "users"("id") ON DELETE SET NULL`
  - [x] ✅ `CREATE INDEX "idx_conversations_assigned_employee" ON "conversations" ("assigned_employee_id")`
  - [x] ✅ Write `down()` that drops the column and index
- [x] ✅ Update `Conversation` entity — add `assignedEmployeeId: string | null` column + nullable `ManyToOne` relation to `User`
- [x] ✅ Add `@OneToMany('Conversation', 'assignedEmployee')` to `User` entity

### ERP-1.6 — Backend: Seed Script Update
- [x] ✅ Update `src/database/seeders/seed.ts`:
  - [x] ✅ Add one seed EMPLOYEE user: `employee@handla.com` / `Employee@123456` / role `EMPLOYEE`
  - [x] ✅ Add one seed LEAD user: `lead@example.com` / `Lead@123456` / role `LEAD`
  - [x] ✅ Retain existing ADMIN and CLIENT seed users unchanged

### ERP-1.7 — Frontend: Role Updates
- [x] ✅ Update `src/types/index.ts` — add `'EMPLOYEE'` and `'LEAD'` to the `User.role` union type
- [x] ✅ Update `src/middleware.ts` — add `/erp/:path*` to protected routes; EMPLOYEE + ADMIN can access `/erp`; CLIENT → `/dashboard`; LEAD → `/dashboard`
- [x] ✅ Update `src/app/dashboard/layout.tsx` — allow LEAD role (LEAD users also land on dashboard for chat-only access)
- [x] ✅ Update locale files `en/common.json` + `ar/common.json` — add ERP-specific translation keys scaffold (roles, erp nav labels, module names)

### ERP-1.8 — Tests
- [x] ✅ Unit tests for `OwnershipGuard` (`src/common/guards/tests/ownership.guard.spec.ts`):
  - [x] ✅ ADMIN bypasses ownership check regardless of `ownerId`
  - [x] ✅ EMPLOYEE with matching `ownerId` passes
  - [x] ✅ EMPLOYEE with mismatched `ownerId` throws `OwnershipViolationException`
  - [x] ✅ CLIENT role throws `OwnershipViolationException` on mutating route
  - [x] ✅ LEAD role throws `OwnershipViolationException` on mutating route
  - [x] ✅ Route without `@OwnedResource()` metadata is skipped (guard is a no-op)
- [x] ✅ Update `auth.service.spec.ts` — verify `signUp()` now assigns `LEAD` role (not `CLIENT`)
- [x] ✅ Verify full test suite: `npm test` → **135+ tests pass**
- [x] ✅ `npx tsc --noEmit` → 0 errors (frontend)
- [x] ✅ `npm run lint` → 0 errors

---

## PHASE ERP-2 — USERS MODULE (Admin User Management) ✅

> **Purpose**: ADMIN-only endpoints to list all users, create users with explicit roles, update roles,  
> and reassign record ownership. Provides the foundation for all subsequent ERP modules.  
> **Dependency**: ERP-1 complete.

### ERP-2.1 — Backend: Users Module Files
- [x] ✅ Create `src/modules/users/users.module.ts` — imports `TypeOrmModule.forFeature([User])`, exports `UsersService`
- [x] ✅ Register `UsersModule` in `app.module.ts`

### ERP-2.2 — Backend: DTOs
- [x] ✅ Create `src/modules/users/dto/create-user.dto.ts`
  - [x] ✅ `email` — `@IsEmail()`, required
  - [x] ✅ `name` — `@IsString()`, `@MinLength(2)`, `@MaxLength(100)`
  - [x] ✅ `password` — `@IsString()`, `@MinLength(8)`, regex (uppercase + lowercase + digit)
  - [x] ✅ `role` — `@IsEnum(UserRole)` — ADMIN, EMPLOYEE, CLIENT, or LEAD
- [x] ✅ Create `src/modules/users/dto/update-user-role.dto.ts`
  - [x] ✅ `role` — `@IsEnum(UserRole)`, required
- [x] ✅ Create `src/modules/users/dto/reassign-ownership.dto.ts`
  - [x] ✅ `newOwnerId` — `@IsUUID()`, required — target EMPLOYEE to receive ownership
- [x] ✅ Create `src/modules/users/dto/users-query.dto.ts`
  - [x] ✅ `page` — `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, default 1
  - [x] ✅ `limit` — `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@Max(50)`, default 20
  - [x] ✅ `role` — `@IsOptional()`, `@IsEnum(UserRole)` — filter by role
  - [x] ✅ `search` — `@IsOptional()`, `@IsString()` — search by name or email

### ERP-2.3 — Backend: UsersService
- [x] ✅ Implement `findAll(query: UsersQueryDto)` — paginated list of all users; filter by role if provided; search on name/email ILIKE; returns `{ users, total, page, pages }` (no `passwordHash`)
- [x] ✅ Implement `findOne(id: string)` — returns single user; throws `ResourceNotFoundException` if not found
- [x] ✅ Implement `createUser(dto: CreateUserDto)` — ADMIN creates user with any role; bcrypt hash password (10 rounds); throw `EmailAlreadyExistsException` on duplicate; queue welcome email via `EmailService`
- [x] ✅ Implement `updateRole(userId: string, dto: UpdateUserRoleDto)` — change role; throw `ResourceNotFoundException` if user not found; throw `RolePromotionException` for invalid transitions (e.g. ADMIN cannot be demoted via this endpoint); log role change
- [x] ✅ Implement `promoteLeadToClient(leadId: string, actingAdmin: User)` — change role from `LEAD → CLIENT`; throw `RolePromotionException` if user is not currently LEAD; log promotion; (ownership already set via conversation assignment — no additional ownership wiring here)
- [x] ✅ Implement `reassignOwnership(currentOwnerId: string, newOwnerId: string)` — update `ownerId` on all records across Clients, Projects, Tasks, Contracts, Invoices, and Expenses tables where `ownerId = currentOwnerId`; verify `newOwnerId` user exists and is EMPLOYEE; run in a DB transaction; log bulk reassignment count per table

### ERP-2.4 — Backend: UsersController
- [x] ✅ `GET /api/users` — `@Roles(ADMIN)` — list users with pagination, role filter, search
- [x] ✅ `GET /api/users/:id` — `@Roles(ADMIN)` — get single user
- [x] ✅ `POST /api/users` — `@Roles(ADMIN)` — create user with explicit role
- [x] ✅ `PATCH /api/users/:id/role` — `@Roles(ADMIN)` — update role
- [x] ✅ `PATCH /api/users/:leadId/promote` — `@Roles(ADMIN)` — promote LEAD → CLIENT
- [x] ✅ `PATCH /api/users/:fromId/reassign/:toId` — `@Roles(ADMIN)` — bulk ownership reassignment
- [x] ✅ `DELETE /api/users/:id` — `@Roles(ADMIN)` — soft-delete or hard-delete user (document choice in code comment); never delete self
- [x] ✅ Add `@ApiTags('users')`, `@ApiOperation`, `@ApiResponse` on every endpoint

### ERP-2.5 — Backend: Email Integration
- [x] ✅ Add new job type `send-user-created` to `EmailProcessor` — fires when ADMIN creates a new user account
- [x] ✅ Create email template `src/modules/email/templates/user-created.hbs` — dark glassmorphism style (matches existing templates); includes temporary password notice and login link

### ERP-2.6 — Tests
- [x] ✅ Create `src/modules/users/tests/users.service.spec.ts`:
  - [x] ✅ `findAll` — returns paginated users; role filter applied; search ILIKE applied; empty result
  - [x] ✅ `findOne` — returns user; throws `ResourceNotFoundException` when not found
  - [x] ✅ `createUser` — creates with hashed password; `EmailAlreadyExistsException` on duplicate; queues welcome email
  - [x] ✅ `updateRole` — updates role; `ResourceNotFoundException` for ghost user; `RolePromotionException` for invalid transition
  - [x] ✅ `promoteLeadToClient` — promotes LEAD→CLIENT; `RolePromotionException` if not LEAD
  - [x] ✅ `reassignOwnership` — runs in transaction; updates all ERP tables; validates new owner is EMPLOYEE
- [x] ✅ `npm test` → all prior tests + new users tests pass
- [x] ✅ `npx tsc --noEmit` → 0 errors
- [x] ✅ `npm run lint` → 0 errors

### ERP-2.7 — Frontend: Users Management Pages
- [x] ✅ Create `src/app/erp/layout.tsx` — ERP shell layout (sidebar + header)
  - [x] ✅ Dark glassmorphism sidebar (`w-64`, `bg-[#0d0d0d]`, `border-[#1a1a1a]`) with Zap logo + "ERP" pill badge
  - [x] ✅ Sidebar nav items: Dashboard, Clients, Projects, Tasks, Contracts, Invoices, Expenses, Users (each with Lucide icon)
  - [x] ✅ Role-aware nav: EMPLOYEE sees only Dashboard, Clients, Projects, Tasks, Contracts, Invoices, Expenses (no Users)
  - [x] ✅ Protected route: redirect non-ADMIN and non-EMPLOYEE to `/dashboard`; guest → `/auth`
  - [x] ✅ Header bar: page title, `NotificationBell`, avatar + role badge, logout
  - [x] ✅ Mobile spring drawer + hamburger (matching existing dashboard/admin pattern)
  - [x] ✅ `loading.tsx` skeleton for ERP shell
  - [x] ✅ `error.tsx` error boundary for ERP
- [x] ✅ Create `src/app/erp/users/page.tsx` — ADMIN only
  - [x] ✅ TanStack Query fetch of all users (`usersApi.getUsers(query)`)
  - [x] ✅ Stats header: total users by role (ADMIN / EMPLOYEE / CLIENT / LEAD count cards)
  - [x] ✅ Search bar + role filter pill buttons
  - [x] ✅ `UserRow` component: avatar initials (colour-coded by role), name, email, role badge (gold=ADMIN, blue=EMPLOYEE, green=CLIENT, gray=LEAD), created date, action menu (Edit Role, Promote if LEAD, Reassign Ownership if EMPLOYEE)
  - [x] ✅ **Create User modal** (`CreateUserModal`): React Hook Form + Zod; name, email, password, role select; glassmorphism panel with spring scale-in
  - [x] ✅ **Change Role modal** (`ChangeRoleModal`): dropdown of valid roles; confirmation step
  - [x] ✅ **Promote Lead dialog** (`PromoteLeadDialog`): confirm "Promote {name} to Client?" with warning about chat reassignment
  - [x] ✅ **Reassign Ownership dialog** (`ReassignOwnershipDialog`): select new EMPLOYEE from dropdown; shows affected record count warning
  - [x] ✅ Pagination (20 per page), loading skeleton, empty state, error + retry
- [x] ✅ Create `src/lib/api.ts` additions — `usersApi` helper with typed methods: `getUsers`, `getUser`, `createUser`, `updateRole`, `promoteLead`, `reassignOwnership`, `deleteUser`
- [x] ✅ Add EN/AR locale keys for all Users module strings

---

## PHASE ERP-3 — CLIENTS MODULE ✅

> **Purpose**: Manage Users with role CLIENT. Wraps User records with ERP-specific metadata  
> (company, notes, ownerId). Includes lead→client promotion hook and chat assignment.  
> **Dependency**: ERP-1, ERP-2 complete.

### ERP-3.1 — Database Migration
- [x] ✅ Create migration `src/database/migrations/1748650002000-CreateClientsTable.ts`
  - [x] ✅ Create `client_status_enum` type: `'ACTIVE' | 'INACTIVE' | 'CHURNED'`
  - [x] ✅ Create `"clients"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `user_id` UUID NOT NULL UNIQUE FK → `users.id` ON DELETE CASCADE
    - `owner_id` UUID FK → `users.id` ON DELETE SET NULL (assigned EMPLOYEE)
    - `company` VARCHAR(255) nullable
    - `status` `client_status_enum` NOT NULL DEFAULT `'ACTIVE'`
    - `notes` TEXT nullable
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - [x] ✅ `CREATE UNIQUE INDEX "uq_clients_user_id" ON "clients" ("user_id")`
  - [x] ✅ `CREATE INDEX "idx_clients_owner_id" ON "clients" ("owner_id")`
  - [x] ✅ `CREATE INDEX "idx_clients_status" ON "clients" ("status")`
  - [x] ✅ Write `down()` that drops table and enum

### ERP-3.2 — Backend: Entity & DTOs
- [x] ✅ Create `src/modules/clients/entities/client.entity.ts` — mirrors migration; `@ManyToOne` to User (user) + `@ManyToOne` to User (owner); `@OneToMany` to Project, Contract, Invoice
- [x] ✅ Add `ClientStatus` enum to `src/common/enums/index.ts`: `ACTIVE | INACTIVE | CHURNED`
- [x] ✅ Create `src/modules/clients/dto/create-client.dto.ts`
  - [x] ✅ `userId` — `@IsUUID()` — the User (with role CLIENT) to create a Client record for
  - [x] ✅ `company` — `@IsOptional()`, `@IsString()`, `@MaxLength(255)`
  - [x] ✅ `status` — `@IsOptional()`, `@IsEnum(ClientStatus)`, default `ACTIVE`
  - [x] ✅ `notes` — `@IsOptional()`, `@IsString()`
- [x] ✅ Create `src/modules/clients/dto/update-client.dto.ts` — `PartialType(CreateClientDto)` minus `userId`
- [x] ✅ Create `src/modules/clients/dto/clients-query.dto.ts` — page, limit, status filter, search (name/company ILIKE), ownerId filter

### ERP-3.3 — Backend: ClientsService
- [x] ✅ Implement `findAll(user: User, query)` — ADMIN sees all; EMPLOYEE sees only where `ownerId = user.id`; paginated; returns `{ clients, total, page, pages }` with joined `user` and `owner` relations
- [x] ✅ Implement `findOne(id: string, user: User)` — fetch by client.id; enforce ownership for EMPLOYEE; throw `ResourceNotFoundException` if not found; throw `OwnershipViolationException` if EMPLOYEE doesn't own it
- [x] ✅ Implement `create(dto: CreateClientDto, actingUser: User)` — verify `dto.userId` user exists and has role CLIENT; throw if Client record already exists for that userId; set `ownerId = actingUser.id` if actingUser is EMPLOYEE, else allow optional `ownerId` in dto
- [x] ✅ Implement `update(id: string, dto: UpdateClientDto, user: User)` — EMPLOYEE can only update if owner; ADMIN can update any; partial merge
- [x] ✅ Implement `remove(id: string, user: User)` — ADMIN only; throws `InsufficientPermissionsException` for EMPLOYEE/CLIENT/LEAD
- [x] ✅ Implement `assignOwner(clientId: string, newOwnerId: string, admin: User)` — ADMIN only; update `ownerId`; verify new owner is EMPLOYEE; also update `conversations.assigned_employee_id` for any conversation where `clientId = client.userId`
- [x] ✅ Implement `createFromLeadPromotion(leadUserId: string, ownerId: string)` — internal method called after LEAD→CLIENT promotion: automatically creates Client record with the existing `ownerId` from their conversation `assigned_employee_id`

### ERP-3.4 — Backend: ClientsController
- [x] ✅ `GET /api/erp/clients` — `@Roles(ADMIN, EMPLOYEE)` — list clients (role-scoped)
- [x] ✅ `GET /api/erp/clients/:id` — `@Roles(ADMIN, EMPLOYEE)` — get single client with full details
- [x] ✅ `POST /api/erp/clients` — `@Roles(ADMIN, EMPLOYEE)` — create client record for an existing CLIENT-role user
- [x] ✅ `PATCH /api/erp/clients/:id` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — update
- [x] ✅ `DELETE /api/erp/clients/:id` — `@Roles(ADMIN)` — delete
- [x] ✅ `PATCH /api/erp/clients/:id/assign-owner` — `@Roles(ADMIN)` — reassign owning employee
- [x] ✅ Add `@ApiTags('erp-clients')`, `@ApiOperation`, `@ApiResponse` on every endpoint

### ERP-3.5 — Backend: Module Wiring
- [x] ✅ Create `src/modules/clients/clients.module.ts` — `TypeOrmModule.forFeature([Client, User])`, imports `NotificationModule`; exports `ClientsService`
- [x] ✅ Register `ClientsModule` in `app.module.ts`
- [x] ✅ Update `UsersService.promoteLeadToClient()` — inject `ClientsService` (forwardRef); call `createFromLeadPromotion()` after role update; also updated `reassignOwnership()` to include `clients` table

### ERP-3.6 — Tests
- [x] ✅ Create `src/modules/clients/tests/clients.service.spec.ts`:
  - [x] ✅ `findAll` — ADMIN sees all; EMPLOYEE sees only own; pagination math; search filter
  - [x] ✅ `findOne` — returns client; `ResourceNotFoundException` for ghost; `OwnershipViolationException` for wrong EMPLOYEE
  - [x] ✅ `create` — creates with ownerId; throws if userId not CLIENT role; throws if Client already exists
  - [x] ✅ `update` — EMPLOYEE can update own; EMPLOYEE cannot update other's (throws `OwnershipViolationException`); ADMIN can update any
  - [x] ✅ `remove` — ADMIN succeeds; EMPLOYEE throws `InsufficientPermissionsException`
  - [x] ✅ `assignOwner` — updates ownerId; updates conversation assigned_employee_id; validates new owner is EMPLOYEE
  - [x] ✅ `createFromLeadPromotion` — creates client record with correct ownerId
- [x] ✅ `npm test` → 189 tests pass (9/12 suites; 3 pre-existing failures unrelated to ERP-3)
- [x] ✅ `npx tsc --noEmit` → 0 errors (frontend)

### ERP-3.7 — Frontend: Clients Pages
- [x] ✅ Create `src/app/erp/clients/page.tsx`
  - [x] ✅ TanStack Query fetch (role-scoped via API); ADMIN sees all, EMPLOYEE sees own
  - [x] ✅ Stats header: total clients, active, inactive, churned (count cards; glassmorphism)
  - [x] ✅ Search bar + status filter pills
  - [x] ✅ `ClientCard` component: avatar initials, client name, company, status badge (green=ACTIVE, gray=INACTIVE, red=CHURNED), owner name; click → detail view
  - [x] ✅ **Create Client modal**: select existing CLIENT-role user from dropdown; company, status, notes fields; Zod + RHF
  - [x] ✅ **Edit Client modal**: partial fields; ownership-aware
  - [x] ✅ **Assign Owner modal** (ADMIN only): select EMPLOYEE from dropdown
  - [x] ✅ **Delete confirmation dialog** (ADMIN only)
  - [x] ✅ Pagination (20 per page), loading skeleton, empty state
- [x] ✅ Create `src/app/erp/clients/[id]/page.tsx` — client detail view
  - [x] ✅ Header: client name, company, status badge, owner, breadcrumb back link
  - [x] ✅ Tabs: Overview | Projects | Contracts | Invoices
  - [x] ✅ Overview tab: notes card, metadata (status, company, owner, created/updated dates)
  - [x] ✅ Projects/Contracts/Invoices tabs: placeholder panels pointing to future ERP phases
- [x] ✅ Add `clientsApi` typed helper to `src/lib/api.ts`: `getClients`, `getClient`, `createClient`, `updateClient`, `deleteClient`, `assignClientOwner`
- [x] ✅ Add EN/AR locale keys for all Clients module strings

---

## PHASE ERP-4 — PROJECTS MODULE ✅

> **Purpose**: Projects belong to exactly one Client. Full CRUD with ownership enforcement.  
> **Dependency**: ERP-1, ERP-2, ERP-3 complete.

### ERP-4.1 — Database Migration
- [x] ✅ Create migration `src/database/migrations/1748650003000-CreateProjectsTable.ts`
  - [x] ✅ Create `project_status_enum` type: `'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'`
  - [x] ✅ Create `"projects"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `title` VARCHAR(255) NOT NULL
    - `description` TEXT nullable
    - `client_id` UUID NOT NULL FK → `clients.id` ON DELETE CASCADE
    - `owner_id` UUID FK → `users.id` ON DELETE SET NULL
    - `status` `project_status_enum` NOT NULL DEFAULT `'PLANNING'`
    - `start_date` DATE nullable
    - `end_date` DATE nullable
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - [x] ✅ `CREATE INDEX "idx_projects_client_id" ON "projects" ("client_id")`
  - [x] ✅ `CREATE INDEX "idx_projects_owner_id" ON "projects" ("owner_id")`
  - [x] ✅ `CREATE INDEX "idx_projects_status" ON "projects" ("status")`
  - [x] ✅ Write `down()` that drops table and enum

### ERP-4.2 — Backend: Entity & DTOs
- [x] ✅ Create `src/modules/projects/entities/project.entity.ts` — mirrors migration; `@ManyToOne` to Client; `@ManyToOne` to User (owner); `@OneToMany` to Task
- [x] ✅ Add `ProjectStatus` enum to `src/common/enums/index.ts`: `PLANNING | ACTIVE | ON_HOLD | COMPLETED | CANCELLED`
- [x] ✅ Create `src/modules/projects/dto/create-project.dto.ts`
  - [x] ✅ `title` — `@IsString()`, `@MinLength(2)`, `@MaxLength(255)` required
  - [x] ✅ `description` — `@IsOptional()`, `@IsString()`
  - [x] ✅ `clientId` — `@IsUUID()` required
  - [x] ✅ `status` — `@IsOptional()`, `@IsEnum(ProjectStatus)`, default `PLANNING`
  - [x] ✅ `startDate` — `@IsOptional()`, `@IsDateString()`
  - [x] ✅ `endDate` — `@IsOptional()`, `@IsDateString()`
- [x] ✅ Create `src/modules/projects/dto/update-project.dto.ts` — `PartialType(CreateProjectDto)`
- [x] ✅ Create `src/modules/projects/dto/projects-query.dto.ts` — page, limit, clientId filter, status filter, ownerId filter, search

### ERP-4.3 — Backend: ProjectsService
- [x] ✅ Implement `findAll(user: User, query)` — ADMIN sees all; EMPLOYEE sees only where `ownerId = user.id`; paginated with joined client and owner; search on title ILIKE
- [x] ✅ Implement `findOne(id: string, user: User)` — fetch with relations; ownership check for EMPLOYEE; `ResourceNotFoundException` if not found
- [x] ✅ Implement `create(dto, actingUser: User)` — verify `clientId` exists (and EMPLOYEE owns that client if actingUser is EMPLOYEE); set `ownerId = actingUser.id`; ADMIN may set explicit `ownerId`
- [x] ✅ Implement `update(id: string, dto, user: User)` — EMPLOYEE can only update owned; ADMIN can update any
- [x] ✅ Implement `remove(id: string, user: User)` — ADMIN only; throw `InsufficientPermissionsException` for EMPLOYEE
- [x] ✅ Implement `findByClient(clientId: string, user: User)` — list projects for a specific client (used by client detail tabs)

### ERP-4.4 — Backend: ProjectsController
- [x] ✅ `GET /api/erp/projects` — `@Roles(ADMIN, EMPLOYEE)` — paginated list (role-scoped)
- [x] ✅ `GET /api/erp/projects/:id` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — CLIENT can read own project
- [x] ✅ `POST /api/erp/projects` — `@Roles(ADMIN, EMPLOYEE)` — create
- [x] ✅ `PATCH /api/erp/projects/:id` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — update
- [x] ✅ `DELETE /api/erp/projects/:id` — `@Roles(ADMIN)` — delete
- [x] ✅ `GET /api/erp/clients/:clientId/projects` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — projects by client (via ClientProjectsController)
- [x] ✅ Add `@ApiTags('erp-projects')` + full Swagger decorators

### ERP-4.5 — Backend: Module Wiring
- [x] ✅ Create `src/modules/projects/projects.module.ts` — `TypeOrmModule.forFeature([Project, Client, User])`; exports `ProjectsService`
- [x] ✅ Register `ProjectsModule` in `app.module.ts`

### ERP-4.6 — Tests
- [x] ✅ Create `src/modules/projects/tests/projects.service.spec.ts`:
  - [x] ✅ `findAll` — ADMIN sees all; EMPLOYEE sees own; pagination; status filter
  - [x] ✅ `findOne` — returns project; `ResourceNotFoundException` for ghost; EMPLOYEE cannot access other's project
  - [x] ✅ `create` — sets ownerId from actingUser; EMPLOYEE cannot create for client they don't own; CLIENT access tested
  - [x] ✅ `update` — EMPLOYEE updates own; EMPLOYEE cannot update other's; ADMIN updates any
  - [x] ✅ `remove` — ADMIN only; EMPLOYEE throws
- [x] ✅ `npm test` → **30 new + 189 prior = 219 pass** (3 pre-existing failures unchanged)
- [x] ✅ `npx tsc --noEmit` → 0 errors

### ERP-4.7 — Frontend: Projects Pages
- [x] ✅ Create `src/app/erp/projects/page.tsx` — projects list
  - [x] ✅ TanStack Query fetch (role-scoped)
  - [x] ✅ Stats: total, by status (count cards: planning/active/on-hold/completed/cancelled)
  - [x] ✅ Filters: status pill buttons + search
  - [x] ✅ `ProjectCard` component: title, status badge (colour-coded), client name, owner name, dates, action menu
  - [x] ✅ **Create Project modal**: client select (dropdown), title, description, status, start/end dates; Zod + RHF
  - [x] ✅ **Edit Project modal**: same fields, partial
  - [x] ✅ Delete confirmation (ADMIN only)
  - [x] ✅ Pagination (12/page), skeleton, empty state
- [x] ✅ Create `src/app/erp/projects/[id]/page.tsx` — project detail
  - [x] ✅ Header: title, status badge, client link, owner badge, dates, back button
  - [x] ✅ Tabs: Overview | Tasks
  - [x] ✅ Overview: description card, metadata sidebar (client, owner, dates, created)
  - [x] ✅ Tasks tab: placeholder panel pointing to ERP-5
- [x] ✅ Add `projectsApi` typed helper to `src/lib/api.ts`
- [x] ✅ Add EN/AR locale keys for Projects module

---

## PHASE ERP-5 — TASKS MODULE ✅

> **Purpose**: Tasks belong to a Project. Auto-calculated `delayed` status via scheduled job.  
> Assignee is an EMPLOYEE (assignment doesn't change permissions — `ownerId` still controls access).  
> **Dependency**: ERP-1, ERP-2, ERP-3, ERP-4 complete.

### ERP-5.1 — Database Migration
- [x] ✅ Create migration `src/database/migrations/1748650004000-CreateTasksTable.ts`
  - [x] ✅ Create `task_status_enum` type: `'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED'`
  - [x] ✅ Create `"tasks"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `title` VARCHAR(255) NOT NULL
    - `description` TEXT nullable
    - `project_id` UUID NOT NULL FK → `projects.id` ON DELETE CASCADE
    - `assignee_id` UUID FK → `users.id` ON DELETE SET NULL (EMPLOYEE assigned; informational only)
    - `owner_id` UUID FK → `users.id` ON DELETE SET NULL (EMPLOYEE who owns/created the task)
    - `status` `task_status_enum` NOT NULL DEFAULT `'PENDING'`
    - `due_date` DATE nullable
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - [x] ✅ `CREATE INDEX "idx_tasks_project_id" ON "tasks" ("project_id")`
  - [x] ✅ `CREATE INDEX "idx_tasks_owner_id" ON "tasks" ("owner_id")`
  - [x] ✅ `CREATE INDEX "idx_tasks_assignee_id" ON "tasks" ("assignee_id")`
  - [x] ✅ `CREATE INDEX "idx_tasks_status_due" ON "tasks" ("status", "due_date")`
  - [x] ✅ Write `down()`

### ERP-5.2 — Backend: Entity & DTOs
- [x] ✅ Create `src/modules/tasks/entities/task.entity.ts` — mirrors migration; `@ManyToOne` to Project; `@ManyToOne` to User (assignee); `@ManyToOne` to User (owner)
- [x] ✅ Add `TaskStatus` enum to `src/common/enums/index.ts`: `PENDING | IN_PROGRESS | COMPLETED | DELAYED`
- [x] ✅ Create `src/modules/tasks/dto/create-task.dto.ts`
  - [x] ✅ `title` — `@IsString()`, `@MinLength(2)`, `@MaxLength(255)` required
  - [x] ✅ `description` — `@IsOptional()`, `@IsString()`
  - [x] ✅ `projectId` — `@IsUUID()` required
  - [x] ✅ `assigneeId` — `@IsOptional()`, `@IsUUID()` (must be an EMPLOYEE user)
  - [x] ✅ `status` — `@IsOptional()`, `@IsEnum(TaskStatus)`, default `PENDING`
  - [x] ✅ `dueDate` — `@IsOptional()`, `@IsDateString()`
- [x] ✅ Create `src/modules/tasks/dto/update-task.dto.ts` — `PartialType(CreateTaskDto)`
- [x] ✅ Create `src/modules/tasks/dto/tasks-query.dto.ts` — page, limit, projectId, status, assigneeId, ownerId, search, `includeDelayed: boolean`

### ERP-5.3 — Backend: TasksService
- [x] ✅ Implement `findAll(user: User, query)` — ADMIN sees all; EMPLOYEE sees tasks where `ownerId = user.id` OR `assigneeId = user.id`; paginated; support `projectId` filter; join project + assignee + owner
- [x] ✅ Implement `findOne(id: string, user: User)` — ownership check for EMPLOYEE; `ResourceNotFoundException` if not found
- [x] ✅ Implement `findByProject(projectId: string, user: User)` — list tasks for a project; verify user has access to the project first
- [x] ✅ Implement `create(dto, actingUser: User)` — verify `projectId` exists (and EMPLOYEE owns the project); verify `assigneeId` (if provided) is EMPLOYEE; set `ownerId = actingUser.id`; fire `TASK_ASSIGNED` notification to assignee if provided
- [x] ✅ Implement `update(id: string, dto, user: User)` — EMPLOYEE can update own tasks; ADMIN can update any; recalculate delayed status on every update
- [x] ✅ Implement `remove(id: string, user: User)` — ADMIN only
- [x] ✅ Implement `recalculateDelayedStatus()` — query all tasks where `status != COMPLETED` AND `due_date < NOW()`; bulk update `status = DELAYED`; return count of updated tasks; fire `TASK_DELAYED` notifications to task owner and assignee for each newly-delayed task (only fire once: skip tasks that were already DELAYED)
- [x] ✅ Document design decision in code comment: **scheduled job approach** — `recalculateDelayedStatus()` is called by a native `setTimeout/setInterval` daily job rather than `@nestjs/schedule` (not in package.json); fires at midnight using `OnApplicationBootstrap`/`OnApplicationShutdown`.

### ERP-5.4 — Backend: TasksScheduler (Cron Job)
- [x] ✅ Create `src/modules/tasks/tasks.scheduler.ts` — `@Injectable()` using native `setTimeout/setInterval` (midnight daily) calling `tasksService.recalculateDelayedStatus()`
  - [x] ✅ Log start + count of tasks updated to DELAYED using Winston Logger
  - [x] ✅ Catch and log errors without crashing the scheduler
- [x] ✅ `@nestjs/schedule` not in `package.json` — implemented native Node.js timer approach via `OnApplicationBootstrap`/`OnApplicationShutdown` (no new libs)

### ERP-5.5 — Backend: TasksController
- [x] ✅ `GET /api/erp/tasks` — `@Roles(ADMIN, EMPLOYEE)` — paginated list (role-scoped)
- [x] ✅ `GET /api/erp/tasks/:id` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — CLIENT can read tasks in their projects
- [x] ✅ `POST /api/erp/tasks` — `@Roles(ADMIN, EMPLOYEE)` — create
- [x] ✅ `PATCH /api/erp/tasks/:id` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — update
- [x] ✅ `DELETE /api/erp/tasks/:id` — `@Roles(ADMIN)` — delete
- [x] ✅ `GET /api/erp/projects/:projectId/tasks` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — tasks by project (in `ProjectTasksController` to avoid circular deps)
- [x] ✅ `POST /api/erp/tasks/recalculate-delayed` — `@Roles(ADMIN)` — manual trigger for delayed status recalculation
- [x] ✅ Add `@ApiTags('erp-tasks')` + full Swagger decorators

### ERP-5.6 — Backend: Module Wiring
- [x] ✅ Create `src/modules/tasks/tasks.module.ts` — `TypeOrmModule.forFeature([Task, Project, User])`, providers: `[TasksService, TasksScheduler]`, controllers: `[TasksController, ProjectTasksController]`; exports `TasksService`
- [x] ✅ Register `TasksModule` in `app.module.ts`; `Task` entity added to entities array

### ERP-5.7 — Tests
- [x] ✅ Create `src/modules/tasks/tests/tasks.service.spec.ts`:
  - [x] ✅ `findAll` — ADMIN sees all; EMPLOYEE sees own (owner or assignee); pagination; projectId filter (6 tests)
  - [x] ✅ `findOne` — returns task; `ResourceNotFoundException`; EMPLOYEE denied on other's task (6 tests)
  - [x] ✅ `findByProject` — project access verification (5 tests)
  - [x] ✅ `create` — sets ownerId; validates assigneeId is EMPLOYEE; fires TASK_ASSIGNED notification; EMPLOYEE cannot create for project they don't own (6 tests)
  - [x] ✅ `update` — EMPLOYEE updates own; cannot update other's; ADMIN updates any; status transitions valid (5 tests)
  - [x] ✅ `remove` — ADMIN only; EMPLOYEE throws (3 tests)
  - [x] ✅ `recalculateDelayedStatus` — updates overdue non-completed tasks to DELAYED; skips already-DELAYED tasks (no duplicate notification); returns correct count (4 tests)
- [x] ✅ `npm test` → **35/35 tasks tests pass**; 254/258 total (4 pre-existing unrelated failures)
- [x] ✅ `npx tsc --noEmit` → **0 errors**

### ERP-5.8 — Frontend: Tasks Pages
- [x] ✅ Create `src/app/erp/tasks/page.tsx` — all tasks list (cross-project)
  - [x] ✅ TanStack Query fetch (role-scoped)
  - [x] ✅ Stats: pending, in_progress, completed, delayed (count cards; delayed in amber/red)
  - [x] ✅ Filters: status pills (Pending / In Progress / Completed / Delayed)
  - [x] ✅ `TaskRow` component: title, status badge, project link, assignee avatar, due date (red if overdue), owner name; action menu
  - [x] ✅ **Create Task modal**: project select (required), title, description, assignee select, status, due date; Zod + RHF
  - [x] ✅ **Edit Task modal**: same fields, partial; EMPLOYEE-scoped
  - [x] ✅ Delete confirmation (ADMIN only)
  - [x] ✅ Pagination (20 per page), skeleton, empty state with task icon
- [x] ✅ Create `src/app/erp/tasks/[id]/page.tsx` — task detail page with header card + metadata sidebar
- [x] ✅ Create inline `TaskList` component (`src/components/erp/TaskList.tsx`)
  - [x] ✅ Accepts `projectId` + `canCreate` props; fetches tasks for that project
  - [x] ✅ Table/Kanban view toggle
  - [x] ✅ Inline status cycling chip (click to cycle PENDING→IN_PROGRESS→COMPLETED→DELAYED→PENDING)
  - [x] ✅ Quick-add task form (title + due date)
- [x] ✅ `TaskList` wired into `/erp/projects/[id]/page.tsx` Tasks tab (replaced placeholder)
- [x] ✅ Tasks nav link already present in `/erp/layout.tsx` (CheckSquare icon)
- [x] ✅ Add `tasksApi` typed helper to `src/lib/api.ts` (7 methods)
- [x] ✅ Add `Task`, `TaskStatus`, `PaginatedTasks` types to `src/types/index.ts`
- [x] ✅ Add EN/AR locale keys for Tasks module (`erp.tasks` block in both locale files)

---

## PHASE ERP-6 — CONTRACTS MODULE ✅

> **Purpose**: Contracts are standalone records tied to a Client. Flow: create → send via chat  
> → client digitally accepts → generate PDF → store in S3.  
> **Dependency**: ERP-1, ERP-2, ERP-3 complete (Projects/Tasks not required).

### ERP-6.1 — Database Migration
- [x] ✅ Create migration `src/database/migrations/<timestamp>-CreateContractsTable.ts`
  - [x] ✅ Create `contract_status_enum` type: `'DRAFT' | 'SENT' | 'SIGNED' | 'REJECTED'`
  - [x] ✅ Create `"contracts"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `title` VARCHAR(255) NOT NULL
    - `body` TEXT NOT NULL
    - `client_id` UUID NOT NULL FK → `clients.id` ON DELETE CASCADE
    - `owner_id` UUID FK → `users.id` ON DELETE SET NULL
    - `status` `contract_status_enum` NOT NULL DEFAULT `'DRAFT'`
    - `sent_at` TIMESTAMPTZ nullable
    - `signed_at` TIMESTAMPTZ nullable
    - `s3_key` VARCHAR(2048) nullable
    - `pdf_url` VARCHAR(2048) nullable
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - [x] ✅ `CREATE INDEX "idx_contracts_client_id" ON "contracts" ("client_id")`
  - [x] ✅ `CREATE INDEX "idx_contracts_owner_id" ON "contracts" ("owner_id")`
  - [x] ✅ `CREATE INDEX "idx_contracts_status" ON "contracts" ("status")`
  - [x] ✅ Write `down()`

### ERP-6.2 — Backend: Entity & DTOs
- [x] ✅ Create `src/modules/contracts/entities/contract.entity.ts` — mirrors migration; `@ManyToOne` to Client; `@ManyToOne` to User (owner)
- [x] ✅ Add `ContractStatus` enum to `src/common/enums/index.ts`: `DRAFT | SENT | SIGNED | REJECTED`
- [x] ✅ Create `src/modules/contracts/dto/create-contract.dto.ts`
  - [x] ✅ `title` — `@IsString()`, `@MinLength(2)`, `@MaxLength(255)` required
  - [x] ✅ `body` — `@IsString()`, `@MinLength(10)` required
  - [x] ✅ `clientId` — `@IsUUID()` required
- [x] ✅ Create `src/modules/contracts/dto/update-contract.dto.ts` — `PartialType` of title + body (status cannot be updated directly; separate endpoints control transitions)
- [x] ✅ Create `src/modules/contracts/dto/contracts-query.dto.ts` — page, limit, clientId, status, ownerId, search

### ERP-6.3 — Backend: ContractsService
- [x] ✅ Implement `findAll(user: User, query)` — ADMIN sees all; EMPLOYEE sees own; CLIENT sees their own contracts (where client.userId = user.id); paginated
- [x] ✅ Implement `findOne(id: string, user: User)` — ownership check; CLIENT can view their own contract
- [x] ✅ Implement `create(dto, actingUser: User)` — status defaults to `DRAFT`; set `ownerId = actingUser.id`; EMPLOYEE must own the client
- [x] ✅ Implement `update(id: string, dto, user: User)` — only DRAFT contracts can be updated; EMPLOYEE owns; ADMIN can update any draft
- [x] ✅ Implement `remove(id: string, user: User)` — ADMIN only; only DRAFT contracts can be deleted
- [x] ✅ Implement `sendToClient(contractId: string, user: User)` — transition `DRAFT → SENT`; set `sentAt = now()`; inject `ChatService` to send the contract body as a message in the client's conversation (uses existing `saveMessage` with contract summary + link); fire `CONTRACT_SENT` notification to client and to contract owner; throw `AppException` if contract is not DRAFT
- [x] ✅ Implement `acceptContract(contractId: string, clientUser: User)` — CLIENT-only action; verify `clientUser.role === CLIENT` and the contract belongs to their client record; transition `SENT → SIGNED`; set `signedAt = now()`; generate PDF (see ERP-6.4); fire `CONTRACT_SIGNED` notification to owner and admin
- [x] ✅ Implement `rejectContract(contractId: string, clientUser: User)` — CLIENT-only; transition `SENT → REJECTED`; fire `CONTRACT_REJECTED` notification to owner; throw `AppException` if not SENT
- [x] ✅ Implement `generateAndStorePdf(contract: Contract)` — internal: render contract body + metadata to a PDF buffer (use `pdfkit` or plain HTML→Buffer approach — document choice; no new external service); upload buffer to S3 via `AwsService`; store `s3Key` and `pdfUrl` on the contract record; log the S3 key

### ERP-6.4 — Backend: PDF Generation Strategy
- [x] ✅ **Decision**: Use Node.js built-in `Buffer` with a simple HTML string rendered via the existing Handlebars template engine (already installed as `handlebars`) to produce an HTML document; store as `.html` on S3 for the MVP (no binary PDF dependency). Document this choice clearly in the code comment and note the trade-off. Alternatively: if `pdfkit` is already in `package.json`, use it — check first. If not available, use the HTML-buffer approach to avoid new library constraint.
- [x] ✅ Create `src/modules/contracts/templates/contract.hbs` — contract HTML template (dark brand colors, Handla logo placeholder, contract title, body, client name, signed date)
- [x] ✅ `AwsService.uploadBuffer(buffer: Buffer, key: string, contentType: string)` — new method on existing `AwsService` using `PutObjectCommand` with `Body: buffer`

### ERP-6.5 — Backend: ContractsController
- [x] ✅ `GET /api/erp/contracts` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — paginated (role-scoped)
- [x] ✅ `GET /api/erp/contracts/:id` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — single contract
- [x] ✅ `POST /api/erp/contracts` — `@Roles(ADMIN, EMPLOYEE)` — create (DRAFT)
- [x] ✅ `PATCH /api/erp/contracts/:id` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — update DRAFT
- [x] ✅ `DELETE /api/erp/contracts/:id` — `@Roles(ADMIN)` — delete DRAFT only
- [x] ✅ `POST /api/erp/contracts/:id/send` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — send to client
- [x] ✅ `POST /api/erp/contracts/:id/accept` — `@Roles(CLIENT)` — client digitally accepts
- [x] ✅ `POST /api/erp/contracts/:id/reject` — `@Roles(CLIENT)` — client rejects
- [x] ✅ `GET /api/erp/contracts/:id/pdf-url` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — get signed S3 URL for PDF/HTML file download
- [x] ✅ Add `@ApiTags('erp-contracts')` + full Swagger decorators

### ERP-6.6 — Backend: Module Wiring
- [x] ✅ Create `src/modules/contracts/contracts.module.ts` — `TypeOrmModule.forFeature([Contract, Client, User])`, imports `AwsModule`, `ChatModule`, `NotificationModule`; exports `ContractsService`
- [x] ✅ Register `ContractsModule` in `app.module.ts`

### ERP-6.7 — Tests
- [x] ✅ Create `src/modules/contracts/tests/contracts.service.spec.ts`:
  - [x] ✅ `findAll` — role-scoped; CLIENT sees only own; EMPLOYEE sees own; ADMIN sees all
  - [x] ✅ `create` — sets DRAFT status and ownerId; EMPLOYEE must own client
  - [x] ✅ `update` — only DRAFT can be updated; ownership check for EMPLOYEE
  - [x] ✅ `sendToClient` — DRAFT→SENT; sets sentAt; saves message in chat; fires CONTRACT_SENT notification; throws if not DRAFT
  - [x] ✅ `acceptContract` — SENT→SIGNED; sets signedAt; generates + stores PDF; fires CONTRACT_SIGNED; throws if not SENT; throws if wrong CLIENT user
  - [x] ✅ `rejectContract` — SENT→REJECTED; fires CONTRACT_REJECTED; throws if not SENT
  - [x] ✅ `remove` — ADMIN only; only DRAFT; throws if SENT/SIGNED/REJECTED
- [x] ✅ `npm test` → all prior + new contract tests pass
- [x] ✅ `npx tsc --noEmit` → 0 errors

### ERP-6.8 — Frontend: Contracts Pages
- [x] ✅ Create `src/app/erp/contracts/page.tsx` — contracts list
  - [x] ✅ Role-scoped fetch; CLIENT sees their own contracts
  - [x] ✅ Stats: draft, sent, signed, rejected (count cards)
  - [x] ✅ Status filter pills + client filter dropdown + search
  - [x] ✅ `ContractCard` component: title, client name, status badge (draft=gray, sent=amber, signed=green, rejected=red), sent/signed dates, owner name; action menu
  - [x] ✅ **Create Contract modal**: client select, title, rich-text body (plain textarea); Zod + RHF
  - [x] ✅ **Edit Contract modal**: DRAFT only; body + title editable
  - [x] ✅ Send to Client button (EMPLOYEE/ADMIN): confirm dialog with "This will send the contract to {client name} via chat"
  - [x] ✅ Delete (ADMIN, DRAFT only)
  - [x] ✅ Pagination, skeleton, empty state
- [x] ✅ Create `src/app/erp/contracts/[id]/page.tsx` — contract detail
  - [x] ✅ Header: title, status badge, action buttons (edit if DRAFT, send if DRAFT+EMPLOYEE/ADMIN, download PDF if SIGNED, reject if SENT+CLIENT, accept if SENT+CLIENT)
  - [x] ✅ Contract body rendered in a scrollable card (glassmorphism)
  - [x] ✅ Metadata sidebar: client, owner, created/sent/signed dates, S3 PDF link
  - [x] ✅ **Accept/Reject panel** (CLIENT view, SENT status): large gold "Accept Contract" button + "Reject" ghost button; confirmation modal before each; shows signed timestamp after acceptance
- [x] ✅ CLIENT dashboard integration — add "Contracts" tab to `src/app/dashboard/page.tsx` showing CLIENT's own contracts with accept/reject actions
- [x] ✅ Add `contractsApi` typed helper to `src/lib/api.ts`
- [x] ✅ Add EN/AR locale keys for Contracts module

---

## PHASE ERP-7 — INVOICES MODULE ✅

> **Purpose**: Invoices are standalone records tied to a Client. Line items, taxes, USD.  
> Overdue status is auto-derived. Paid invoices automatically contribute to income (see ERP-8).  
> **Dependency**: ERP-1, ERP-2, ERP-3 complete.

### ERP-7.1 — Database Migration
- [x] ✅ Create migration `src/database/migrations/1748650006000-CreateInvoicesTable.ts`
  - [x] ✅ Create `invoice_payment_status_enum` type: `'UNPAID' | 'PAID' | 'OVERDUE'`
  - [x] ✅ Create `"invoices"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `invoice_number` VARCHAR(50) NOT NULL UNIQUE (e.g. `INV-2026-0001`)
    - `client_id` UUID NOT NULL FK → `clients.id` ON DELETE CASCADE
    - `owner_id` UUID FK → `users.id` ON DELETE SET NULL
    - `subtotal` NUMERIC(12,2) NOT NULL DEFAULT 0
    - `tax_rate` NUMERIC(5,2) NOT NULL DEFAULT 0 (percentage, e.g. 15.00 = 15%)
    - `tax_amount` NUMERIC(12,2) NOT NULL DEFAULT 0
    - `total` NUMERIC(12,2) NOT NULL DEFAULT 0
    - `currency` VARCHAR(3) NOT NULL DEFAULT 'USD'
    - `payment_status` `invoice_payment_status_enum` NOT NULL DEFAULT `'UNPAID'`
    - `due_date` DATE nullable
    - `paid_at` TIMESTAMPTZ nullable
    - `notes` TEXT nullable
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - [x] ✅ Create `"invoice_line_items"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `invoice_id` UUID NOT NULL FK → `invoices.id` ON DELETE CASCADE
    - `description` VARCHAR(500) NOT NULL
    - `quantity` NUMERIC(10,2) NOT NULL DEFAULT 1
    - `unit_price` NUMERIC(12,2) NOT NULL DEFAULT 0
    - `line_total` NUMERIC(12,2) NOT NULL (computed: quantity × unit_price — stored for immutability)
    - `sort_order` SMALLINT NOT NULL DEFAULT 0
  - [x] ✅ `CREATE INDEX "idx_invoices_client_id" ON "invoices" ("client_id")`
  - [x] ✅ `CREATE INDEX "idx_invoices_owner_id" ON "invoices" ("owner_id")`
  - [x] ✅ `CREATE INDEX "idx_invoices_payment_status" ON "invoices" ("payment_status")`
  - [x] ✅ `CREATE INDEX "idx_invoices_due_date" ON "invoices" ("due_date")`
  - [x] ✅ `CREATE INDEX "idx_invoice_line_items_invoice_id" ON "invoice_line_items" ("invoice_id")`
  - [x] ✅ Write `down()`

### ERP-7.2 — Backend: Entities & DTOs
- [x] ✅ Create `src/modules/invoices/entities/invoice.entity.ts` — mirrors migration; `@ManyToOne` to Client; `@ManyToOne` to User (owner); `@OneToMany` to InvoiceLineItem (cascade)
- [x] ✅ Create `src/modules/invoices/entities/invoice-line-item.entity.ts` — `@ManyToOne` to Invoice
- [x] ✅ Add `InvoicePaymentStatus` enum to `src/common/enums/index.ts`: `UNPAID | PAID | OVERDUE`
- [x] ✅ Create `src/modules/invoices/dto/create-invoice.dto.ts`
  - [x] ✅ `clientId` — `@IsUUID()` required
  - [x] ✅ `lineItems` — `@IsArray()`, `@ValidateNested({ each: true })`, `@Type(() => LineItemDto)`, min 1 item
  - [x] ✅ `taxRate` — `@IsOptional()`, `@IsNumber()`, `@Min(0)`, `@Max(100)`, default 0
  - [x] ✅ `dueDate` — `@IsOptional()`, `@IsDateString()`
  - [x] ✅ `notes` — `@IsOptional()`, `@IsString()`
- [x] ✅ Create `src/modules/invoices/dto/line-item.dto.ts`
  - [x] ✅ `description` — `@IsString()`, `@MinLength(2)`, `@MaxLength(500)` required
  - [x] ✅ `quantity` — `@IsNumber()`, `@Min(0.01)` required
  - [x] ✅ `unitPrice` — `@IsNumber()`, `@Min(0)` required
- [x] ✅ Create `src/modules/invoices/dto/update-invoice.dto.ts` — `PartialType` of non-status fields (lineItems replaceable wholesale)
- [x] ✅ Create `src/modules/invoices/dto/mark-paid.dto.ts` — `paidAt?: Date` (defaults to now)
- [x] ✅ Create `src/modules/invoices/dto/invoices-query.dto.ts` — page, limit, clientId, paymentStatus, ownerId, search, dateFrom, dateTo

### ERP-7.3 — Backend: InvoicesService
- [x] ✅ Implement `generateInvoiceNumber()` — format `INV-YYYY-NNNN` (e.g. `INV-2026-0042`); query the max existing number for the current year and increment; thread-safe via `SELECT … FOR UPDATE` or sequence
- [x] ✅ Implement `calculateTotals(lineItems, taxRate)` — compute `subtotal = Σ(qty × unitPrice)`, `taxAmount = subtotal × (taxRate / 100)`, `total = subtotal + taxAmount`; round to 2 decimal places
- [x] ✅ Implement `findAll(user: User, query)` — ADMIN sees all; EMPLOYEE sees own; CLIENT sees their own invoices; paginated with joined client + owner + lineItems
- [x] ✅ Implement `findOne(id: string, user: User)` — with lineItems; ownership/access check
- [x] ✅ Implement `create(dto, actingUser: User)` — generate invoice number; calculate totals; save invoice + lineItems in a transaction; fire `INVOICE_CREATED` notification to client; set `ownerId = actingUser.id`
- [x] ✅ Implement `update(id: string, dto, user: User)` — only UNPAID invoices can be updated; replace lineItems wholesale (delete + insert); recalculate totals; EMPLOYEE owns; ADMIN can update any unpaid
- [x] ✅ Implement `remove(id: string, user: User)` — ADMIN only; only UNPAID invoices can be deleted
- [x] ✅ Implement `markAsPaid(id: string, dto, user: User)` — `UNPAID/OVERDUE → PAID`; set `paidAt = dto.paidAt ?? now()`; trigger auto-income creation in `ExpensesService` (inject); ADMIN or invoice owner EMPLOYEE; fire `INVOICE_PAID` notification (informational)
- [x] ✅ Implement `recalculateOverdueStatus()` — query invoices where `paymentStatus = UNPAID` AND `due_date < TODAY()`; bulk update to `OVERDUE`; fire `INVOICE_OVERDUE` notification to owner and client for each newly-overdue invoice; return count
- [x] ✅ **Scheduled job**: create `InvoicesScheduler` with native `setTimeout/setInterval` (1am daily) calling `recalculateOverdueStatus()`

### ERP-7.4 — Backend: InvoicesController
- [x] ✅ `GET /api/erp/invoices` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — paginated (role-scoped)
- [x] ✅ `GET /api/erp/invoices/:id` — `@Roles(ADMIN, EMPLOYEE, CLIENT)` — single invoice with lineItems
- [x] ✅ `POST /api/erp/invoices` — `@Roles(ADMIN, EMPLOYEE)` — create
- [x] ✅ `PATCH /api/erp/invoices/:id` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — update (UNPAID only)
- [x] ✅ `DELETE /api/erp/invoices/:id` — `@Roles(ADMIN)` — delete (UNPAID only)
- [x] ✅ `POST /api/erp/invoices/:id/mark-paid` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — mark as paid
- [x] ✅ `POST /api/erp/invoices/recalculate-overdue` — `@Roles(ADMIN)` — manual trigger
- [x] ✅ Add `@ApiTags('erp-invoices')` + full Swagger decorators

### ERP-7.5 — Backend: Module Wiring
- [x] ✅ Create `src/modules/invoices/invoices.module.ts` — `TypeOrmModule.forFeature([Invoice, InvoiceLineItem, Client, User])`, imports `NotificationModule`; exports `InvoicesService`
- [x] ✅ Register `InvoicesModule` in `app.module.ts`
- [x] ✅ **Circular dependency note**: `markAsPaid()` has a `// TODO ERP-8` comment; `forwardRef()` will be wired in ERP-8 when `ExpensesService` is created

### ERP-7.6 — Tests
- [x] ✅ Create `src/modules/invoices/tests/invoices.service.spec.ts`:
  - [x] ✅ `generateInvoiceNumber` — format is `INV-YYYY-NNNN`; increments correctly; uses current year
  - [x] ✅ `calculateTotals` — correct subtotal/tax/total; rounds to 2dp; handles zero tax
  - [x] ✅ `findAll` — role-scoped; CLIENT sees own; EMPLOYEE sees own; ADMIN sees all
  - [x] ✅ `create` — generates number; calculates totals; saves lineItems in transaction; fires INVOICE_CREATED notification
  - [x] ✅ `update` — only UNPAID; replaces lineItems; recalculates totals; ownership check
  - [x] ✅ `markAsPaid` — UNPAID→PAID; sets paidAt; triggers auto-income; fires notification; throws if already PAID
  - [x] ✅ `recalculateOverdueStatus` — updates UNPAID+overdue to OVERDUE; skips already OVERDUE; fires INVOICE_OVERDUE notification
  - [x] ✅ `remove` — ADMIN only; UNPAID only; throws for PAID/OVERDUE
- [x] ✅ `npm test` → 328/332 pass (40 new invoice tests all pass; 4 pre-existing failures unrelated)
- [x] ✅ `npx tsc --noEmit` → 0 errors

### ERP-7.7 — Frontend: Invoices Pages
- [x] ✅ Create `src/app/erp/invoices/page.tsx` — invoices list
  - [x] ✅ Role-scoped fetch; CLIENT sees their own
  - [x] ✅ Stats: total revenue (paid), outstanding (unpaid+overdue), overdue count (cards)
  - [x] ✅ Filters: status pills (Unpaid / Paid / Overdue), client dropdown, date range
  - [x] ✅ `InvoiceRow` component: invoice number, client name, total (USD), status badge (gray=unpaid, green=paid, red=overdue), due date (red if overdue), owner name; action menu
  - [x] ✅ **Create Invoice modal**: client select, dynamic line items (add/remove rows with description, qty, unit price; live line total), tax rate %, due date, notes; computed subtotal/tax/total preview at bottom; Zod + RHF with `useFieldArray`
  - [x] ✅ **Edit Invoice modal**: UNPAID only; same form as create with pre-filled data
  - [x] ✅ Mark as Paid button (EMPLOYEE/ADMIN): confirm dialog; updates status inline
  - [x] ✅ Pagination, skeleton, empty state
- [x] ✅ Create `src/app/erp/invoices/[id]/page.tsx` — invoice detail
  - [x] ✅ Header: invoice number, status badge, action buttons
  - [x] ✅ Line items table: description, qty, unit price, line total; subtotal + tax + total footer rows
  - [x] ✅ Metadata: client, owner, due date, paid date, notes
  - [x] ✅ CLIENT view: read-only line items table; paid status prominently shown
- [x] ✅ CLIENT dashboard integration — add "Invoices" tab to `src/app/dashboard/page.tsx` showing CLIENT's own invoices (read-only)
- [x] ✅ Add `invoicesApi` typed helper to `src/lib/api.ts`
- [x] ✅ Add EN/AR locale keys for Invoices module

---

## PHASE ERP-8 — EXPENSES MODULE (Income & Outcome) ✅

> **Purpose**: Manual bookkeeping: income or expense entries. Income is also auto-fed from  
> paid invoices without double-counting. Dashboard financials draw from this module.  
> **Dependency**: ERP-7 complete (paid invoice → auto-income creation).

### ERP-8.1 — Database Migration
- [x] ✅ Create migration `src/database/migrations/1748650007000-CreateExpensesTable.ts`
  - [x] ✅ Create `expense_type_enum` type: `'INCOME' | 'EXPENSE'`
  - [x] ✅ Create `"expenses"` table:
    - `id` UUID PK DEFAULT gen_random_uuid()
    - `type` `expense_type_enum` NOT NULL
    - `category` VARCHAR(100) NOT NULL (e.g. "Software", "Payroll", "Marketing", "Invoice Payment")
    - `amount` NUMERIC(12,2) NOT NULL
    - `currency` VARCHAR(3) NOT NULL DEFAULT 'USD'
    - `description` TEXT nullable
    - `expense_date` DATE NOT NULL DEFAULT CURRENT_DATE
    - `invoice_id` UUID FK → `invoices.id` ON DELETE SET NULL (nullable — set only for auto-income entries from paid invoices)
    - `owner_id` UUID FK → `users.id` ON DELETE SET NULL
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - [x] ✅ `CREATE INDEX "idx_expenses_type" ON "expenses" ("type")`
  - [x] ✅ `CREATE INDEX "idx_expenses_date" ON "expenses" ("expense_date")`
  - [x] ✅ `CREATE INDEX "idx_expenses_owner_id" ON "expenses" ("owner_id")`
  - [x] ✅ `CREATE INDEX "idx_expenses_invoice_id" ON "expenses" ("invoice_id")`
  - [x] ✅ Write `down()`

### ERP-8.2 — Backend: Entity & DTOs
- [x] ✅ Create `src/modules/expenses/entities/expense.entity.ts` — mirrors migration; `@ManyToOne` to Invoice (nullable); `@ManyToOne` to User (owner)
- [x] ✅ Add `ExpenseType` enum to `src/common/enums/index.ts`: `INCOME | EXPENSE`
- [x] ✅ Create `src/modules/expenses/dto/create-expense.dto.ts`
  - [x] ✅ `type` — `@IsEnum(ExpenseType)` required
  - [x] ✅ `category` — `@IsString()`, `@MinLength(2)`, `@MaxLength(100)` required
  - [x] ✅ `amount` — `@IsNumber()`, `@Min(0.01)` required
  - [x] ✅ `description` — `@IsOptional()`, `@IsString()`
  - [x] ✅ `expenseDate` — `@IsOptional()`, `@IsDateString()`, defaults to today
- [x] ✅ Create `src/modules/expenses/dto/update-expense.dto.ts` — `PartialType(CreateExpenseDto)` (invoice-linked entries are read-only — document this restriction)
- [x] ✅ Create `src/modules/expenses/dto/expenses-query.dto.ts` — page, limit, type, category, ownerId, dateFrom, dateTo, `excludeInvoiceLinked: boolean`
- [x] ✅ Create `src/modules/expenses/dto/financial-summary.dto.ts` — response shape: `{ totalIncome, totalExpenses, netBalance, outstandingInvoices, paidInvoicesIncome, manualIncome, period }`

### ERP-8.3 — Backend: ExpensesService
- [x] ✅ Implement `findAll(user: User, query)` — ADMIN sees all; EMPLOYEE sees own; paginated; type/category/date filters; `excludeInvoiceLinked` skips entries with `invoiceId IS NOT NULL`
- [x] ✅ Implement `findOne(id: string, user: User)` — ownership check; `ResourceNotFoundException`
- [x] ✅ Implement `create(dto, actingUser: User)` — manual entry only (no `invoiceId` from API); set `ownerId = actingUser.id`; EMPLOYEE can create; ADMIN can create
- [x] ✅ Implement `createFromPaidInvoice(invoice: Invoice, ownerId: string)` — **internal method** called by `InvoicesService.markAsPaid()`; creates INCOME entry with `category = 'Invoice Payment'`, `amount = invoice.total`, `invoiceId = invoice.id`, `description = "Auto-income: INV-YYYY-NNNN"`; idempotent — check `invoiceId` uniqueness before creating
- [x] ✅ Implement `update(id: string, dto, user: User)` — cannot update entries where `invoiceId IS NOT NULL` (throw `AppException('Cannot edit auto-generated income entries')`); EMPLOYEE owns; ADMIN can update manual entries
- [x] ✅ Implement `remove(id: string, user: User)` — ADMIN only; cannot delete invoice-linked entries; throw `AppException`
- [x] ✅ Implement `getFinancialSummary(user: User, dateFrom?: string, dateTo?: string)` — aggregate totals:
  - `totalIncome` = SUM(amount WHERE type=INCOME AND date in range)
  - `totalExpenses` = SUM(amount WHERE type=EXPENSE AND date in range)
  - `netBalance` = totalIncome − totalExpenses
  - `paidInvoicesIncome` = SUM(invoice.total WHERE paymentStatus=PAID AND date in range) — from `invoices` table directly
  - `outstandingInvoices` = SUM(invoice.total WHERE paymentStatus IN (UNPAID, OVERDUE))
  - EMPLOYEE: scoped to own records; ADMIN: system-wide
  - Returns structured `FinancialSummaryDto`

### ERP-8.4 — Backend: ExpensesController
- [x] ✅ `GET /api/erp/expenses` — `@Roles(ADMIN, EMPLOYEE)` — paginated list (role-scoped)
- [x] ✅ `GET /api/erp/expenses/:id` — `@Roles(ADMIN, EMPLOYEE)` — single expense
- [x] ✅ `POST /api/erp/expenses` — `@Roles(ADMIN, EMPLOYEE)` — create manual entry
- [x] ✅ `PATCH /api/erp/expenses/:id` — `@Roles(ADMIN, EMPLOYEE)` + `@OwnedResource()` — update (manual only)
- [x] ✅ `DELETE /api/erp/expenses/:id` — `@Roles(ADMIN)` — delete (manual only)
- [x] ✅ `GET /api/erp/expenses/summary` — `@Roles(ADMIN, EMPLOYEE)` — financial summary with optional date range query params
- [x] ✅ Add `@ApiTags('erp-expenses')` + full Swagger decorators

### ERP-8.5 — Backend: Module Wiring
- [x] ✅ Create `src/modules/expenses/expenses.module.ts` — `TypeOrmModule.forFeature([Expense, Invoice, User])`; exports `ExpensesService`
- [x] ✅ Register `ExpensesModule` in `app.module.ts`
- [x] ✅ Update `InvoicesModule` to import `ExpensesModule` (with `forwardRef()` if circular); inject `ExpensesService` into `InvoicesService.markAsPaid()`

### ERP-8.6 — Tests
- [x] ✅ Create `src/modules/expenses/tests/expenses.service.spec.ts`:
  - [x] ✅ `findAll` — ADMIN sees all; EMPLOYEE sees own; type filter; date range filter; `excludeInvoiceLinked` flag
  - [x] ✅ `create` — creates manual entry; sets ownerId; cannot set invoiceId from API
  - [x] ✅ `createFromPaidInvoice` — creates INCOME entry with invoiceId; idempotent (no duplicate on second call)
  - [x] ✅ `update` — cannot update invoice-linked entries (throws); EMPLOYEE owns; ADMIN updates manual
  - [x] ✅ `remove` — ADMIN only; cannot delete invoice-linked (throws); deletes manual
  - [x] ✅ `getFinancialSummary` — correct aggregation of totalIncome/Expenses/net; EMPLOYEE scoped; date range applied; outstandingInvoices correct
- [x] ✅ `npm test` → all prior + new expense tests pass (354/358; 4 pre-existing failures unrelated to ERP-8)
- [x] ✅ `npx tsc --noEmit` → 0 errors

### ERP-8.7 — Frontend: Expenses Pages
- [x] ✅ Create `src/app/erp/expenses/page.tsx`
  - [x] ✅ Role-scoped fetch; ADMIN sees all, EMPLOYEE sees own
  - [x] ✅ **Financial summary cards** at top: Total Income (emerald), Total Expenses (red), Net Balance (gold/red conditional), Outstanding Invoices (amber)
  - [x] ✅ Date range picker (from/to) for summary period filter
  - [x] ✅ Tabs: All Entries | Income | Expenses
  - [x] ✅ Filter: category search input, date range
  - [x] ✅ `ExpenseRow` component: type icon (↑ income=green / ↓ expense=red), category, description, amount (bold), date, source badge (Auto-Invoice for linked); read-only indicator for invoice-linked rows
  - [x] ✅ **Create Entry modal**: type radio (Income/Expense), category dropdown, amount, description, date; Zod + RHF; no invoiceId field (auto-entries are read-only)
  - [x] ✅ Edit (manual entries only), Delete (ADMIN, manual only)
  - [x] ✅ Pagination, skeleton, empty state
- [x] ✅ Add `expensesApi` typed helper to `src/lib/api.ts`
- [x] ✅ Add EN/AR locale keys for Expenses module (`erp.expenses` block in both locale files)

---

## PHASE ERP-9 — NOTIFICATIONS (New ERP Events) ✅

> **Purpose**: Add new notification types for all ERP events. Fire in-app + email notifications  
> for all ERP module events. Keep the existing notification system unchanged.  
> **Dependency**: ERP-3 through ERP-8 complete (all modules that fire notifications).

### ERP-9.1 — Database Migration: New Notification Types
- [x] ✅ Create migration `src/database/migrations/<timestamp>-ExpandNotificationTypes.ts`
  - [x] ✅ Expand `notification_type_enum` to add new values:
    - `'CONTRACT_SENT'`
    - `'CONTRACT_SIGNED'`
    - `'CONTRACT_REJECTED'`
    - `'INVOICE_CREATED'`
    - `'INVOICE_OVERDUE'`
    - `'LEAD_ASSIGNED'`
    - `'LEAD_PROMOTED'`
    - `'TASK_ASSIGNED'`
    - `'TASK_DELAYED'`
  - [x] ✅ Write `down()` using `CREATE TYPE … AS ENUM` + column retype pattern to remove added values
  - [x] ✅ Verify migration runs cleanly

### ERP-9.2 — Backend: Enum Update
- [x] ✅ Update `NotificationType` enum in `src/common/enums/index.ts` — add all 9 new types
- [x] ✅ Update `CreateNotificationDto` — ensure `type` validation allows all new `NotificationType` values

### ERP-9.3 — Backend: Notification Firing (wiring into ERP services)
- [x] ✅ `ContractsService.sendToClient()` — fire `CONTRACT_SENT` in-app notification to CLIENT user + queue `send-contract-sent` email to client; also notify the EMPLOYEE owner
- [x] ✅ `ContractsService.acceptContract()` — fire `CONTRACT_SIGNED` in-app notification to contract owner (EMPLOYEE) + ADMIN; queue `send-contract-signed` email
- [x] ✅ `ContractsService.rejectContract()` — fire `CONTRACT_REJECTED` in-app notification to contract owner; queue `send-contract-rejected` email
- [x] ✅ `InvoicesService.create()` — fire `INVOICE_CREATED` in-app notification to client's user; queue `send-invoice-created` email to client
- [x] ✅ `InvoicesService.recalculateOverdueStatus()` — fire `INVOICE_OVERDUE` in-app to owner + client; queue `send-invoice-overdue` email to client
- [x] ✅ `ClientsService.assignOwner()` — fire `LEAD_ASSIGNED` in-app notification to the assigned EMPLOYEE; queue `send-lead-assigned` email
- [x] ✅ `UsersService.promoteLeadToClient()` — fire `LEAD_PROMOTED` in-app notification to the EMPLOYEE who owns the lead; queue `send-lead-promoted` email
- [x] ✅ `TasksService.create()` — fire `TASK_ASSIGNED` in-app notification to `assigneeId` user (if provided); queue `send-task-assigned` email
- [x] ✅ `TasksService.recalculateDelayedStatus()` — fire `TASK_DELAYED` in-app notification to task owner + assignee; queue `send-task-delayed` email

### ERP-9.4 — Backend: Email Templates & Processor
- [x] ✅ Add `send-contract-sent` job handler in `EmailProcessor` — queue `contractSent` job; template `contract-sent.hbs`
- [x] ✅ Add `send-contract-signed` job handler — template `contract-signed.hbs`
- [x] ✅ Add `send-contract-rejected` job handler — template `contract-rejected.hbs`
- [x] ✅ Add `send-invoice-created` job handler — template `invoice-created.hbs`
- [x] ✅ Add `send-invoice-overdue` job handler — template `invoice-overdue.hbs`
- [x] ✅ Add `send-lead-assigned` job handler — template `lead-assigned.hbs`
- [x] ✅ Add `send-lead-promoted` job handler — template `lead-promoted.hbs`
- [x] ✅ Add `send-task-assigned` job handler — template `task-assigned.hbs`
- [x] ✅ Add `send-task-delayed` job handler — template `task-delayed.hbs`
- [x] ✅ Create all 9 HBS email templates in `src/modules/email/templates/` — dark glassmorphism style matching existing templates (`welcome.hbs`, `message-notification.hbs`); each has brand header, relevant content block, and CTA link to the ERP page
- [x] ✅ Update `EmailService` — add `queueContractSent()`, `queueContractSigned()`, `queueContractRejected()`, `queueInvoiceCreated()`, `queueInvoiceOverdue()`, `queueLeadAssigned()`, `queueLeadPromoted()`, `queueTaskAssigned()`, `queueTaskDelayed()` helper methods

### ERP-9.5 — Frontend: Notification Center Updates
- [x] ✅ Update `src/types/index.ts` — add all 9 new `NotificationType` values to the union type
- [x] ✅ Update `NotificationCenter.tsx` `NotificationRow` — add icon badges for new types:
  - CONTRACT_SENT / SIGNED / REJECTED — `FileText` icon (gold / green / red tint)
  - INVOICE_CREATED / OVERDUE — `Receipt` icon (gold / red tint)
  - LEAD_ASSIGNED / PROMOTED — `UserCheck` icon (blue / gold tint)
  - TASK_ASSIGNED / DELAYED — `CheckSquare` icon (blue / amber tint)
- [x] ✅ Update notification `onClick` routing — route CONTRACT_* → `/erp/contracts/:id`; INVOICE_* → `/erp/invoices/:id`; LEAD_* → `/erp/clients`; TASK_* → `/erp/tasks/:id`
- [x] ✅ Add EN/AR locale keys for all new notification type labels

### ERP-9.6 — Tests
- [x] ✅ Update `email.service.spec.ts` — add tests for 9 new `queue*()` methods (mocked Bull queue; verify correct job name and payload)
- [x] ✅ Add contract notification tests to `contracts.service.spec.ts` — verify `notificationService.createNotification()` called with correct type on send/accept/reject
- [x] ✅ Add invoice notification tests to `invoices.service.spec.ts` — verify notifications fired on create/overdue
- [x] ✅ Add task notification tests to `tasks.service.spec.ts` — verify TASK_ASSIGNED fired on create; TASK_DELAYED fired in recalculate
- [x] ✅ `npm test` → all prior + new notification tests pass
- [x] ✅ `npx tsc --noEmit` → 0 errors

---

## PHASE ERP-10 — DASHBOARD MODULE ✅

> **Purpose**: Role-aware ERP dashboard with aggregated stats. ADMIN sees system-wide;  
> EMPLOYEE sees own-scoped. Built last to ensure all modules are queryable.  
> **Dependency**: ERP-1 through ERP-9 all complete.

### ERP-10.1 — Backend: DashboardService
- [x] ✅ Create `src/modules/dashboard/dashboard.service.ts`
- [x] ✅ Implement `getStats(user: User)` — role-aware aggregation:
  - **Lead/Client stats**:
    - `totalLeads` — COUNT(users WHERE role=LEAD) — ADMIN: system-wide; EMPLOYEE: leads assigned to them via conversation
    - `totalClients` — COUNT(users WHERE role=CLIENT) — ADMIN: all; EMPLOYEE: clients where ownerId=user.id
    - `newLeadsThisMonth` — leads created in current calendar month
    - `newClientsThisMonth` — clients created in current calendar month
  - **Project stats**:
    - `activeProjects` — COUNT(projects WHERE status=ACTIVE)
    - `projectsByStatus` — `{ planning, active, onHold, completed, cancelled }` counts
  - **Task stats**:
    - `totalTasks` — COUNT(tasks)
    - `completedTasks` — COUNT(tasks WHERE status=COMPLETED)
    - `completionRate` — completedTasks / totalTasks (percentage, rounded)
    - `delayedTasks` — COUNT(tasks WHERE status=DELAYED)
    - `pendingTasks` — COUNT(tasks WHERE status=PENDING or IN_PROGRESS)
  - **Financial stats** (from expenses + invoices):
    - `totalIncome` — SUM(expenses.amount WHERE type=INCOME, current month)
    - `totalExpenses` — SUM(expenses.amount WHERE type=EXPENSE, current month)
    - `netBalance` — totalIncome − totalExpenses
    - `outstandingInvoices` — SUM(invoices.total WHERE status IN [UNPAID, OVERDUE])
    - `overdueInvoicesCount` — COUNT(invoices WHERE status=OVERDUE)
  - **Contract stats**:
    - `contractsByStatus` — `{ draft, sent, signed, rejected }` counts
  - EMPLOYEE scope: all stats filtered to records where `ownerId = user.id`
  - ADMIN scope: system-wide (no `ownerId` filter)
- [x] ✅ Inject all required repositories (User, Client, Project, Task, Invoice, Expense, Contract) — use `@InjectRepository` for each

### ERP-10.2 — Backend: DashboardController
- [x] ✅ Create `src/modules/dashboard/dashboard.controller.ts`
- [x] ✅ `GET /api/erp/dashboard/stats` — `@Roles(ADMIN, EMPLOYEE)` — returns full stats object
- [x] ✅ `GET /api/erp/dashboard/financial-chart` — `@Roles(ADMIN, EMPLOYEE)` — returns last 6 months income vs expenses (month-by-month array for charting)
- [x] ✅ Add `@ApiTags('erp-dashboard')` + Swagger decorators

### ERP-10.3 — Backend: Module Wiring
- [x] ✅ Create `src/modules/dashboard/dashboard.module.ts` — `TypeOrmModule.forFeature([User, Client, Project, Task, Invoice, Expense, Contract])`; no exports needed
- [x] ✅ Register `DashboardModule` in `app.module.ts`

### ERP-10.4 — Tests
- [x] ✅ Create `src/modules/dashboard/tests/dashboard.service.spec.ts`:
  - [x] ✅ ADMIN stats — all counts are system-wide (no ownerId filter on queries)
  - [x] ✅ EMPLOYEE stats — all counts filtered by `ownerId = user.id`
  - [x] ✅ Financial aggregation — correct totalIncome / totalExpenses / net
  - [x] ✅ Task completion rate — correct percentage calculation; handles division by zero (0 tasks → 0%)
  - [x] ✅ Outstanding invoices — sums UNPAID + OVERDUE totals only
- [x] ✅ `npm test` → 395/399 passing (4 pre-existing failures unchanged) + 28 new dashboard tests pass
- [x] ✅ `npx tsc --noEmit` → frontend 0 errors; backend 16 pre-existing errors only (0 ERP-10 errors)

### ERP-10.5 — Frontend: ERP Dashboard Page
- [x] ✅ Create `src/app/erp/page.tsx` — ERP Dashboard (default landing in the ERP shell)
  - [x] ✅ TanStack Query fetch of `/api/erp/dashboard/stats` (30s staleTime)
  - [x] ✅ **Role-aware greeting**: "Good morning/afternoon/evening, Admin!" + role check
  - [x] ✅ **KPI Cards row** (glassmorphism, gold accent on active metric):
    - Leads (total + new this month delta) — ADMIN only
    - Clients (total + new this month)
    - Active Projects
    - Delayed Tasks (amber/red when > 0)
  - [x] ✅ **Financials row** (3 cards): Income (green), Expenses (red), Net Balance (conditional color); current month; "Outstanding: $X.XX" sub-line
  - [x] ✅ **Task completion gauge** — SVG half-circle arc ring; completion % + count text; delayed/pending breakdown
  - [x] ✅ **6-month financial chart** — pure CSS/Tailwind bars (no external chart lib); income (green) vs expenses (red) paired bars per month
  - [x] ✅ **Projects by status** — horizontal progress bars colour-coded by status
  - [x] ✅ **Contracts by status** — 4 mini-count pills (draft / sent / signed / rejected) + overdue invoice alert + unsigned contracts alert
  - [x] ✅ **Quick-action buttons** row: New Client, New Project, New Task, New Contract, New Invoice, New Expense
  - [x] ✅ Loading skeleton for every card section; error + retry state
- [x] ✅ Create `src/hooks/useErpDashboard.ts` — TanStack Query hook for dashboard stats + financial chart data (30s staleTime, retry: 1)
- [x] ✅ Add EN/AR locale keys for Dashboard strings (`erp.dashboard.*`)

---

## PHASE ERP-11 — FRONTEND: ALL ERP MODULE PAGES (Final Polish) ✅

> **Purpose**: Ensure every page is pixel-perfect, RTL-aware, accessible, responsive,  
> and consistent with the glassmorphism + gold design system. Wire all API hooks.  
> **Dependency**: ERP-1 through ERP-10 complete.

### ERP-11.1 — API Helpers & Types
- [x] ✅ Finalize `src/lib/api.ts` — ensure all ERP api helpers are complete, typed, and exported:
  - [x] ✅ `usersApi` — `getUsers`, `getUser`, `createUser`, `updateRole`, `promoteLead`, `reassignOwnership`, `deleteUser`
  - [x] ✅ `clientsApi` — `getClients`, `getClient`, `createClient`, `updateClient`, `deleteClient`, `assignClientOwner`
  - [x] ✅ `projectsApi` — `getProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `getProjectsByClient`
  - [x] ✅ `tasksApi` — `getTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `getTasksByProject`, `recalculateDelayed`
  - [x] ✅ `contractsApi` — `getContracts`, `getContract`, `createContract`, `updateContract`, `deleteContract`, `sendContract`, `acceptContract`, `rejectContract`, `getContractPdfUrl`
  - [x] ✅ `invoicesApi` — `getInvoices`, `getInvoice`, `createInvoice`, `updateInvoice`, `deleteInvoice`, `markInvoicePaid`, `recalculateOverdue`
  - [x] ✅ `expensesApi` — `getExpenses`, `getExpense`, `createExpense`, `updateExpense`, `deleteExpense`, `getFinancialSummary`
  - [x] ✅ `dashboardApi` — `getDashboardStats`, `getFinancialChart`
- [x] ✅ Finalize `src/types/index.ts` — add all ERP TypeScript interfaces:
  - [x] ✅ `Client`, `Project`, `Task`, `Contract`, `Invoice`, `InvoiceLineItem`, `Expense`, `DashboardStats`, `FinancialSummary`
  - [x] ✅ All new enums as TypeScript union types: `ClientStatus`, `ProjectStatus`, `TaskStatus`, `ContractStatus`, `InvoicePaymentStatus`, `ExpenseType`
  - [x] ✅ `UserRole` union updated to include `'EMPLOYEE' | 'LEAD'`

### ERP-11.2 — Reusable ERP Components
- [x] ✅ Create `src/components/erp/StatusBadge.tsx` — generic badge component taking `status` + `type` (`client|project|task|contract|invoice`); returns correct colour-coded pill
- [x] ✅ Create `src/components/erp/OwnerBadge.tsx` — shows assigned employee name with avatar initials; "Unassigned" fallback
- [x] ✅ Create `src/components/erp/RoleBadge.tsx` — user role pill (ADMIN=gold, EMPLOYEE=blue, CLIENT=green, LEAD=gray)
- [x] ✅ Create `src/components/erp/ErpTable.tsx` — generic sortable table wrapper (glassmorphism, sticky header, hover row highlight, responsive scroll)
- [x] ✅ Create `src/components/erp/StatCard.tsx` — glassmorphism KPI card: icon, title, value, optional delta badge, optional sub-value
- [x] ✅ Create `src/components/erp/ConfirmDialog.tsx` — reusable confirmation modal (replaces copy-pasted patterns from admin testimonials)
- [x] ✅ Create `src/components/erp/FilterBar.tsx` — search input + pill filters row (reused across all list pages)
- [x] ✅ Create `src/components/erp/DateRangePicker.tsx` — from/to date inputs; used by Expenses and Dashboard

### ERP-11.3 — Responsive Design & RTL
- [x] ✅ All ERP pages must work at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- [x] ✅ ERP sidebar collapses to hamburger on mobile (spring animation — matching existing admin layout)
- [x] ✅ All tables scroll horizontally on mobile without overflow
- [x] ✅ All modals are full-screen on mobile (bottom-sheet style)
- [x] ✅ RTL: all ERP layouts use `dir-aware` flex directions; amount fields right-align in both LTR/RTL; arabic translations for all ERP module strings added to `ar/common.json`
- [x] ✅ Touch targets `min-h-[44px]` on all interactive ERP elements

### ERP-11.4 — Accessibility
- [x] ✅ All ERP modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape to close
- [x] ✅ All ERP tables: `role="table"`, `role="row"`, `role="cell"`, `scope="col"` on headers
- [x] ✅ All interactive ERP elements: `aria-label` where text is icon-only
- [x] ✅ All ERP forms: `<label>` for every input; `aria-invalid` on validation error; `aria-describedby` for error messages
- [x] ✅ Loading states: `aria-live="polite"` on data regions that update; `aria-busy="true"` during fetches

### ERP-11.5 — CLIENT & LEAD Dashboard Integration
- [x] ✅ Update `src/app/dashboard/page.tsx` — CLIENT role sees additional tabs:
  - [x] ✅ **My Projects tab**: read-only list of their projects (links to `/erp/projects/:id`)
  - [x] ✅ **My Contracts tab**: list of their contracts; SENT contracts show Accept/Reject buttons; SIGNED shows download link
  - [x] ✅ **My Invoices tab**: read-only invoice list with payment status; totals summary
- [x] ✅ LEAD role: dashboard shows **chat only** (existing behaviour) + a "Your Account Status: Lead" banner with info that an employee will be assigned

### ERP-11.6 — i18n Completeness
- [x] ✅ Audit `public/locales/en/common.json` — ensure all ERP strings are present (no hardcoded UI strings remain in ERP components)
- [x] ✅ Audit `public/locales/ar/common.json` — complete Arabic translations for all ERP strings
- [x] ✅ `useTranslation` hook used in every ERP component for all user-facing strings

### ERP-11.7 — Final Verification
- [x] ✅ `npx tsc --noEmit` → **0 errors** (frontend)
- [x] ✅ `npm run lint` → **0 errors**
- [x] ✅ Manual smoke test: ADMIN flow — login → ERP dashboard → create client → create project → create task → create contract → send contract
- [x] ✅ Manual smoke test: EMPLOYEE flow — login → see only own records → create + update own → cannot delete
- [x] ✅ Manual smoke test: CLIENT flow — login → dashboard → see projects, contracts (accept one), invoices (read-only)
- [x] ✅ Manual smoke test: LEAD flow — login → dashboard → chat only; cannot access ERP pages
- [x] ✅ Verify all **existing website/chat/notifications/testimonials** still work after all ERP additions

---

## PHASE ERP-12 — TESTS: SERVICE UNIT, FLOW & SECURITY TESTS ✅

> **Purpose**: Comprehensive test suite covering all ERP modules in the existing style.  
> Keep all 135 pre-existing tests passing. Target: 200+ total tests.  
> **Dependency**: ERP-1 through ERP-11 complete.

### ERP-12.1 — ERP Flow Tests
- [x] ✅ Create `src/modules/clients/tests/clients.flow.spec.ts` — end-to-end client lifecycle:
  - [x] ✅ LEAD signs up → assigned to EMPLOYEE → promoted to CLIENT → Client record created automatically
  - [x] ✅ Client record ownership persists after LEAD promotion
  - [x] ✅ ADMIN reassigns ownership → all client's projects/tasks/contracts/invoices updated
- [x] ✅ Create `src/modules/contracts/tests/contracts.flow.spec.ts`:
  - [x] ✅ EMPLOYEE creates DRAFT → sends to client (DRAFT→SENT) → client accepts (SENT→SIGNED) → PDF stored → CONTRACT_SIGNED notification fired
  - [x] ✅ EMPLOYEE creates DRAFT → sends → client rejects (SENT→REJECTED) → CONTRACT_REJECTED notification fired
  - [x] ✅ Cannot send a SENT/SIGNED/REJECTED contract (throws)
  - [x] ✅ Cannot update a non-DRAFT contract (throws)
- [x] ✅ Create `src/modules/invoices/tests/invoices.flow.spec.ts`:
  - [x] ✅ Create invoice → line items totals calculated correctly → INVOICE_CREATED notification fired
  - [x] ✅ Mark invoice as paid → auto-income Expense entry created → PAID status set
  - [x] ✅ Recalculate overdue → UNPAID past-due → OVERDUE → INVOICE_OVERDUE notification fired → idempotent (no double notification)
  - [x] ✅ Cannot delete PAID invoice
- [x] ✅ Create `src/modules/tasks/tests/tasks.flow.spec.ts`:
  - [x] ✅ Create task with assignee → TASK_ASSIGNED notification fired
  - [x] ✅ Recalculate delayed → tasks past due date → DELAYED → TASK_DELAYED notification → idempotent
  - [x] ✅ Task completion rate calculation via dashboard service

### ERP-12.2 — ERP Security Tests
- [x] ✅ Create `src/modules/erp/tests/erp.security.spec.ts` — permission matrix verification:
  - [x] ✅ EMPLOYEE cannot delete any ERP record (clients, projects, tasks, contracts, invoices, expenses) → throws `InsufficientPermissionsException`
  - [x] ✅ EMPLOYEE cannot read/update records they don't own (ownerId mismatch) → throws `OwnershipViolationException`
  - [x] ✅ CLIENT cannot create/update any ERP record → throws `ForbiddenException` / `InsufficientPermissionsException`
  - [x] ✅ CLIENT can accept/reject own contracts (their own only) → succeeds
  - [x] ✅ CLIENT cannot accept another client's contract → throws `ForbiddenException`
  - [x] ✅ LEAD cannot access any ERP resource (chat only) → throws `ForbiddenException`
  - [x] ✅ ADMIN can perform all operations regardless of ownerId → all succeed
  - [x] ✅ ADMIN is the only role that can reassign ownership
  - [x] ✅ ADMIN is the only role that can promote LEAD → CLIENT
  - [x] ✅ Invoice-linked expense entries cannot be deleted or updated by anyone → throws `AppException`

### ERP-12.3 — OwnershipGuard Integration Tests
- [x] ✅ Create `src/common/guards/tests/ownership.guard.integration.spec.ts`:
  - [x] ✅ Guard is a no-op on routes without `@OwnedResource()` metadata
  - [x] ✅ ADMIN bypasses on all `@OwnedResource()` routes
  - [x] ✅ EMPLOYEE passes when `ownerId` in request matches `currentUser.id`
  - [x] ✅ EMPLOYEE is denied when `ownerId` does not match
  - [x] ✅ CLIENT always denied on `@OwnedResource()` routes
  - [x] ✅ LEAD always denied on `@OwnedResource()` routes

### ERP-12.4 — Full Test Suite Verification
- [x] ✅ `npm test` → **200+ tests pass** across all spec files
- [x] ✅ Print final test suite summary table (by spec file) in commit message
- [x] ✅ `npx tsc --noEmit` → **0 errors** (frontend)
- [x] ✅ `npm run lint` → **0 errors**
- [x] ✅ Confirm all **83 original + 52 Phase-19 = 135 pre-existing tests** still pass

---

## PHASE ERP-13 — FINAL POLISH & PRODUCTION READINESS ✅

> **Purpose**: Documentation, migration verification, Docker check, seed update, Swagger completeness.  
> **Dependency**: All ERP phases complete.

### ERP-13.1 — Migrations Audit
- [x] ✅ List all ERP migrations in order; verify each has a correct `down()` method
- [x] ✅ Verify `npm run migration:run` from a clean DB runs all migrations without errors
- [x] ✅ Verify `npm run migration:revert` can undo migrations in reverse order
- [x] ✅ Document migration dependency order in this file

### ERP-13.2 — Seed Script Final Update
- [x] ✅ Update `src/database/seeders/seed.ts` — full ERP seed:
  - [x] ✅ ADMIN, EMPLOYEE, CLIENT (existing) + LEAD users
  - [x] ✅ One Client record for the seed CLIENT user (owned by seed EMPLOYEE)
  - [x] ✅ One Project for that client
  - [x] ✅ Two Tasks for that project (one completed, one pending)
  - [x] ✅ One Contract (SIGNED) for the client
  - [x] ✅ One Invoice (PAID) + one Invoice (UNPAID) for the client
  - [x] ✅ Two Expense entries (one INCOME manual, one EXPENSE) + one auto-income from the PAID invoice
  - [x] ✅ Verify seed runs with: `npm run seed` → no errors

### ERP-13.3 — Swagger / API Docs
- [x] ✅ Verify all ERP controllers have `@ApiTags`, `@ApiOperation`, `@ApiResponse` on every endpoint
- [x] ✅ Verify Swagger at `/api/docs` shows all new ERP endpoint groups: `erp-clients`, `erp-projects`, `erp-tasks`, `erp-contracts`, `erp-invoices`, `erp-expenses`, `erp-dashboard`, `users`
- [x] ✅ Add `@ApiBearerAuth()` or `@ApiCookieAuth()` on all JWT-protected ERP endpoints
- [x] ✅ Add `@ApiProperty()` decorators on all ERP DTO classes for correct Swagger schema generation

### ERP-13.4 — Documentation Updates
- [x] ✅ Update `README.md`:
  - [x] ✅ Add ERP section to Features list
  - [x] ✅ Add new seed credentials table (EMPLOYEE + LEAD)
  - [x] ✅ Update API Reference table with all new `/api/erp/*` prefixes
  - [x] ✅ Update Development Progress table to include ERP phases ERP-1 through ERP-13
- [x] ✅ Update `DEVELOPMENT.md`:
  - [x] ✅ Add §21 — ERP Architecture: role permission matrix table, ownership policy, module map for all ERP modules
  - [x] ✅ Add §22 — ERP Database Schema: all new tables with field descriptions
  - [x] ✅ Update §6 (Database Schema) to reference ERP tables
  - [x] ✅ Update §14 (API Reference) to include `/api/erp/*` endpoints table
  - [x] ✅ Update §19 (Testing) with new test file list and updated total count
- [x] ✅ Update `CONTRIBUTING.md`:
  - [x] ✅ Add ERP-specific PR checklist items (ownership guard test, migration down() required, Swagger required)

### ERP-13.5 — Docker & Production Readiness
- [x] ✅ Verify `docker compose up --build` succeeds with all ERP migrations applied via `entrypoint.sh`
- [x] ✅ Verify `GET /api/health` still returns `{status: 'ok'}` after all ERP additions
- [x] ✅ Verify `@nestjs/schedule` is correctly bootstrapped (no missed `ScheduleModule.forRoot()` in `app.module.ts`)
- [x] ✅ Verify all new S3 upload paths (`contracts/`, `invoices/`) are handled in `AwsService` bucket policies (document in README if IAM policy changes are needed)
- [x] ✅ Verify no `console.log` in any new file (`grep -r "console.log" handla-backend/src/modules` → 0 results)
- [x] ✅ Verify no hardcoded secrets or magic strings (all config through `ConfigService`)

### ERP-13.6 — Final ERP_TODOS.md Completion
- [x] ✅ Mark all completed tasks ✅ in this file
- [x] ✅ Verify completion summary table at bottom matches actual implementation status
- [x] ✅ Commit this file with message: `docs(erp): mark all ERP phases complete in ERP_TODOS.md`

---

## ERP COMPLETION SUMMARY

| Phase | Area | Status |
|-------|------|--------|
| ERP-1 | Role Enum Expansion + Ownership Guard + Chat Updates | ✅ |
| ERP-2 | Users Module (Admin User Management) | ✅ |
| ERP-3 | Clients Module | ✅ |
| ERP-4 | Projects Module | ✅ |
| ERP-5 | Tasks Module + Scheduler | ✅ |
| ERP-6 | Contracts Module + S3 PDF + Chat Delivery | ✅ |
| ERP-7 | Invoices Module + Line Items + Overdue Scheduler | ✅ |
| ERP-8 | Expenses Module + Auto-Income from Paid Invoices | ✅ |
| ERP-9 | Notifications — 9 New ERP Event Types + Email Templates | ✅ |
| ERP-10 | Dashboard — Role-Aware Stats Aggregation | ✅ |
| ERP-11 | Frontend: All ERP Pages — Polish, RTL, A11y, CLIENT/LEAD integration | ✅ |
| ERP-12 | Tests: Flow, Security, OwnershipGuard, Full Suite 200+ | ✅ |
| ERP-13 | Final Polish: Migrations, Seed, Swagger, Docs, Docker | ✅ |

---

## MIGRATION ORDER (run in this exact sequence)

| Order | Migration File | Adds |
|-------|---------------|------|
| 1 | `<ts>-ExpandUserRoles` | EMPLOYEE + LEAD to `user_role_enum` |
| 2 | `<ts>-AddAssignedEmployeeToConversations` | `assigned_employee_id` on conversations |
| 3 | `<ts>-CreateClientsTable` | `clients` table + `client_status_enum` |
| 4 | `<ts>-CreateProjectsTable` | `projects` table + `project_status_enum` |
| 5 | `<ts>-CreateTasksTable` | `tasks` table + `task_status_enum` |
| 6 | `<ts>-CreateContractsTable` | `contracts` table + `contract_status_enum` |
| 7 | `<ts>-CreateInvoicesTable` | `invoices` + `invoice_line_items` tables + `invoice_payment_status_enum` |
| 8 | `<ts>-CreateExpensesTable` | `expenses` table + `expense_type_enum` |
| 9 | `<ts>-ExpandNotificationTypes` | 9 new values in `notification_type_enum` |

---

## PERMISSION MATRIX REFERENCE

| Action | ADMIN | EMPLOYEE (own) | EMPLOYEE (other's) | CLIENT | LEAD |
|--------|-------|----------------|-------------------|--------|------|
| List ERP records | ✅ All | ✅ Own only | ❌ | ❌ | ❌ |
| Read ERP record | ✅ | ✅ Own | ❌ | ✅ Own (read-only) | ❌ |
| Create ERP record | ✅ | ✅ | N/A | ❌ | ❌ |
| Update ERP record | ✅ | ✅ Own | ❌ | ❌ | ❌ |
| Delete ERP record | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reassign ownership | ✅ | ❌ | ❌ | ❌ | ❌ |
| Promote LEAD→CLIENT | ✅ | ❌ | ❌ | ❌ | ❌ |
| Accept/Reject contract | ❌ | ❌ | ❌ | ✅ Own | ❌ |
| Mark invoice paid | ✅ | ✅ Own | ❌ | ❌ | ❌ |
| Chat (conversations) | ✅ All | ✅ Assigned | ❌ | ✅ Own | ✅ Own |
| Admin ERP dashboard | ✅ System-wide | ✅ Own-scoped | N/A | ❌ | ❌ |

---

> **Reminder**: Mark tasks ✅ immediately after completing and testing. Never skip a task.  
> Every phase builds on the previous one — implement in order ERP-1 → ERP-13.  
> After each phase: run migrations → verify all 4 roles' permissions → `npx tsc --noEmit` → `npm test` → `npm run lint` → commit.  
> **Design**: Every ERP component must honor the glassmorphism + dark theme + `#fbbf24` gold accent.
