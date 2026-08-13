# Handla — New Modules Roadmap

> Expansion plan for: **Accounting Hub, Purchases, Quotations, Support/Ticketing, Reports, Analytics, and a React Native (Expo) staff mobile app.**
>
> Stack (confirmed): NestJS 10 + **MySQL 8** + TypeORM · Next.js 14 (App Router) · React Native (Expo) for mobile.
> Roles: `ADMIN`, `EMPLOYEE`, `CLIENT`, `LEAD`.

---

## Decisions locked in

| Topic | Decision |
|-------|----------|
| **Accounting** | Option A — Financial Hub (Chart of Accounts + unified transaction ledger). **Plus a per-client ledger** showing every money movement for each client in one place. No full double-entry. |
| **Purchases** | Full version: managed **Suppliers**, **Purchase Orders → Bills** with payment status. A **paid purchase auto-creates an EXPENSE** entry. |
| **Quotations** | Lead/Client → Quotation → on **accept**, auto-generate a **draft Contract + draft Invoice**. Public accept/reject link (like contracts). |
| **Support** | Ticketing (subject, description, priority, category, status, attachments, threaded replies). Tickets tied to **Client + Project**. Per-client **API key** so their external platform can open tickets programmatically. Keep SLA simple (no timers for v1). |
| **Reports** | Financial (P&L, cash flow, tax/VAT summary, A/R & A/P aging) + operational (projects, tasks, tickets). Base currency **optional** (multi-country clients). |
| **Analytics** | **Self-hosted** GA-style: tracking script + events table + dashboard (pageviews, sessions, referrers, device/browser, top pages, custom events). No third-party GA. |
| **Currency** | Optional / per-record. Reports group by currency; no forced base currency conversion. |
| **Roles** | New back-office modules → **ADMIN + EMPLOYEE** only. **CLIENT** sees only: their chat, their Support tickets, their invoices/contracts/quotations. |
| **Mobile** | **Expo** app in `handla-mobile/`. End goal: **full feature parity with the web** (staff + client capabilities, role-gated). Shipped in slices. |

---

## Global conventions (apply to every phase)

- Money fields: `DECIMAL(12,2)`. Currency: `VARCHAR(3)`, **nullable/optional**.
- All list endpoints: pagination (`page`, `limit`), consistent `{ success, data, message, statusCode }` envelope (existing `TransformInterceptor`).
- Guards: `JwtGuard` + `RolesGuard`. New back-office routes = `@Roles(ADMIN, EMPLOYEE)`.
- Every new entity added to `app.module.ts` entities array **and** a TypeORM migration (no `synchronize` in prod).
- Notifications: reuse `NotificationType` (add new enum members as needed) + email queue.
- Tests: Jest unit tests per service; keep the suite green.
- **Git:** commit after each sub-phase, then update the PR to `main` from `genspark_ai_developer`.

---

## PHASE 1 — Accounting Hub  🔴
Central place where **all money movements** live, plus a **ledger per client**.

### Backend  ✅ DONE
- [x] Enums: `AccountType` (ASSET, LIABILITY, INCOME, EXPENSE, EQUITY), `LedgerDirection` (IN/OUT), `LedgerSourceType` (INVOICE, EXPENSE, PURCHASE, QUOTATION, MANUAL).
- [x] Entity `Account` (Chart of Accounts): code (unique), name, type, parentId, currency (optional), isSystem, isActive.
- [x] Entity `LedgerEntry` (unified transaction ledger): entryDate, accountId, clientId (nullable), direction, amount, currency (optional), sourceType, sourceId, description, ownerId. UNIQUE(sourceType, sourceId) for idempotency.
- [x] Seed default Chart of Accounts (AccountingSeeder, `isSystem` accounts, runs on init).
- [x] Service:
  - [x] `record()` — generic idempotent ledger writer (resolve account by code/id, dedupe on source).
  - [x] Hook: **Expense** created → OUT entry; **paid Invoice** → IN entry tagged with client (via ExpensesService.postToLedger). Purchase hook wired in Phase 2.
  - [x] `getClientLedger(clientId)` — chronological statement + running balance + totals by currency.
  - [x] `getAccountBalance(accountId, {from,to})`.
  - [x] `findLedger()` general ledger with filters + pagination; manual entry create/delete.
- [x] Controller `/api/accounting`: accounts CRUD + balance, ledger query/manual, `clients/:id/ledger`.
- [x] Tests (9 passing; full suite 692 green).
- [ ] Backfill migration for pre-existing paid invoices/expenses (deferred — dev uses synchronize; will add with prod migration set).

### Frontend
- [ ] `/erp/accounting` — Chart of Accounts manager + general ledger table (filters, export CSV).
- [ ] Client detail page: add **"Ledger / Statement"** tab (running balance, download statement PDF later).

---

## PHASE 2 — Purchases  🔴
Money going out: suppliers, purchase orders, bills. Mirror of invoices.

### Backend  ✅ DONE
- [x] Enums: `PurchaseStatus` (DRAFT, ORDERED, RECEIVED, CANCELLED), `PurchasePaymentStatus` (UNPAID, PAID, OVERDUE).
- [x] Entity `Supplier`: name, company, email, phone, taxId, address, notes, isActive.
- [x] Entity `Purchase` (PO/Bill): purchaseNumber (PO-YYYY-NNNN), supplierId, status, paymentStatus, subtotal, taxRate, taxAmount, total, currency (optional), accountCode (which expense account to book to), orderDate, dueDate, paidAt, notes, ownerId.
- [x] Entity `PurchaseLineItem`: description, qty, unitPrice, lineTotal (immutable snapshot).
- [x] SuppliersService + SuppliersController (CRUD, search, ADMIN/EMPLOYEE; delete ADMIN).
- [x] PurchasesService: CRUD, thread-safe PO number generation, `markAsPaid()` → `ExpensesService.createFromPaidPurchase()` → EXPENSE (idempotent on purchaseId) → ledger OUT entry booked to the purchase's `accountCode`. Overdue scheduler at 2am.
- [x] Controller `/api/purchases` (+ mark-paid) and `/api/suppliers`.
- [x] Expense entity extended with `purchaseId`; auto-entries (invoice OR purchase) are read-only.
- [x] Tests (13 new; full suite 705 green).
- [ ] Purchase PDF — deferred to the frontend/PDF phase (reuse invoice PDF infra).

### Frontend
- [ ] `/erp/suppliers` — supplier CRUD.
- [ ] `/erp/purchases` — list + create/edit (line items, tax), mark paid, PDF, status badges.

---

## PHASE 3 — Quotations  ✅ (backend done)
Quote → accept → auto draft Contract + Invoice. Public accept/reject.

### Backend
- [x] Enum `QuotationStatus` (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED).
- [x] Entity `Quotation`: id, quoteNumber (QUO-YYYY-NNNN), clientId, status, subtotal, taxRate, taxAmount, total, currency (optional), validUntil, notes, publicToken (uuid), sentAt, acceptedAt, rejectedAt, convertedInvoiceId, convertedContractId, ownerId.
- [x] Entity `QuotationLineItem`.
- [x] Service: CRUD, QUO-YYYY-NNNN number generation, `send()`, `accept()`/`reject()` (public via token + staff), **`convert()`** → creates DRAFT Invoice + DRAFT Contract from line items; sets status CONVERTED + links. Expiry scheduler (3am).
- [x] Controllers:
  - `/erp/quotations` (ADMIN/EMPLOYEE CRUD + send/accept/reject/convert; CLIENT read own + accept/reject)
  - `/erp/quotations/public/:token` (GET view, POST accept, POST reject) — no auth (`@Public()`), sanitized projection.
- [ ] Quotation PDF + QR (reuse invoice/contract infra). _(deferred — optional)_
- [x] Notifications on send/accept/reject.
- [x] Tests (14 unit tests; full suite 719 passing).

### Frontend
- [ ] `/erp/quotations` — list + builder (line items) + send + convert button.
- [ ] `/quotation/public/[token]` — public viewer with Accept / Reject.
- [ ] Client dashboard: "My Quotations".

---

## PHASE 4 — Support / Ticketing  ✅ (backend done)
Post-launch support. Clients open tickets; staff respond. External platforms integrate via API key.

### Backend
- [x] Enums: `TicketStatus` (OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED), `TicketPriority` (LOW, MEDIUM, HIGH, URGENT), `TicketCategory` (BUG, FEATURE, QUESTION, BILLING, OTHER), `TicketSource` (WEB, API, EMAIL).
- [x] Entity `Ticket`: id, ticketNumber (TKT-YYYY-NNNN), subject, description, status, priority, category, clientId, projectId (nullable), assigneeId (nullable), reporterId, source, attachments (json), SLA fields (firstResponseDueAt, resolveDueAt, firstRespondedAt, resolvedAt, closedAt).
- [x] Entity `TicketReply`: id, ticketId, authorId (nullable for API), authorName, body, attachments (json), isInternal (staff-only), createdAt.
- [x] Entity `ClientApiKey`: id, clientId, label, keyHash (sha256), prefix, isActive, lastUsedAt, createdBy. (Raw key shown once at creation.)
- [x] Service: role-scoped CRUD, assign, status transitions (+resolvedAt/closedAt stamps), threaded replies (client + staff + internal note; client-reply reopen; first-staff-reply stamps SLA), **priority-based SLA windows** (URGENT 1h/8h … LOW 24h/168h) with read-time `slaBreached`, per-client API-key issue/list/revoke, programmatic ingest (ticket + reply), stats.
- [x] Controllers:
  - `/erp/support` (staff: in-scope; client: own) — tickets, replies, update/assign/status, delete (ADMIN), stats.
  - `/erp/support/api-keys` (staff issues/lists/revokes per client; plaintext returned once).
  - `/api/support/tickets` + `/api/support/tickets/:id/replies` + `/api/support/ping` — **API-key authenticated** ingest for external platforms (guarded by `ApiKeyGuard`).
- [x] `ApiKeyGuard` (validates `Authorization: Bearer` or `X-Api-Key` → resolves client, bumps lastUsedAt) + `@ApiKeyClient()` decorator.
- [x] Notifications on new ticket / new reply / status change.
- [x] Tests (18 unit tests; full suite 737 passing).
- [ ] Email on new ticket / reply _(deferred — optional; notifications in place)_.
- [ ] Attachments via S3 presigned _(currently accepts pre-uploaded URLs; presign deferred)_.

### Frontend
- [ ] `/erp/support` — staff ticket queue (filters: status/priority/assignee/client), ticket detail with threaded replies + internal notes, assign, status change.
- [ ] `/erp/support/api-keys` — issue/revoke client keys (copy-once modal).
- [ ] Client dashboard: `/dashboard/support` — open ticket + view/reply own tickets.

---

## PHASE 5 — Reports  ✅ (backend done)
Read-only analytical endpoints + printable/exportable views.

### Backend
- [x] `/erp/reports` (ADMIN/EMPLOYEE), all accept ?from&to (default current year) + ?clientId + ?groupBy:
  - [x] `profit-loss` (ledger INCOME vs EXPENSE accounts, grouped by currency, net profit)
  - [x] `cash-flow` (ledger IN/OUT bucketed by month/quarter/year + totals per currency)
  - [x] `tax-summary` (output tax on invoices vs input tax on purchases → net tax payable)
  - [x] `ar-aging` (unpaid/overdue invoices) / `ap-aging` (unpaid/overdue purchases) — buckets current/1-30/31-60/61-90/90+ with detail
  - [x] `revenue-by-client` (paid invoices in range, per currency)
  - [x] `projects-status` (counts by status)
  - [x] `support-stats` (tickets by status/priority/category, open, resolved, SLA breaches, avg resolution hours)
- [x] All computed from ledger + source tables; currency-aware grouping ("UNSPECIFIED" bucket for null currency).
- [x] Tests (10 unit tests; full suite 45 suites / 747 passing).

### Frontend
- [ ] `/erp/reports` — date-range picker, currency filter, charts (Recharts or existing chart lib), CSV/PDF export.

---

## PHASE 6 — Analytics (self-hosted)  ✅ (backend done)
GA-style tracking for the public marketing site.

### Backend  ✅
- [x] Entity `AnalyticsEvent`: id, site (default), sessionId, visitorId (anon rotating hash), type (PAGEVIEW/EVENT), path (normalized), referrer + referrerHost, eventName, meta (json), deviceType, os, browser, country (best-effort from Accept-Language, no GeoIP dep), language, title, createdAt. Indexed on (site,createdAt), (type,createdAt), site, path, visitor, created_at.
- [x] Ingest endpoint `POST /api/analytics/collect` (+ `GET /api/analytics/collect` pixel fallback) — **public, no auth**, tiny payload, HTTP 204; parses UA + derives device/browser/os/country server-side; no PII beyond anon rotating id (`sha256(ip|ua|site|daySalt)` truncated; session hash rotates per 30-min window).
- [x] Aggregation service + endpoints (ADMIN/EMPLOYEE) at `/api/erp/analytics`: overview (pageviews, events, unique visitors, sessions, bounce rate, views/session), time-series (hour/day/month), top pages, top referrers, device/browser/country breakdown, top events — all with date range.
- [ ] Data retention/rollup consideration (daily aggregate table optional later). _(deferred — optional)_
- [x] Tests (18 — parsing helpers, record, overview, topPages, timeseries).

### Frontend
- [ ] `public/analytics.js` — tiny (<3kb) tracker: sets anon id cookie, sends pageviews on route change, exposes `handla('event', name, data)`.
- [ ] Wire tracker into the marketing site (landing pages, key CTAs: contact submit, start chat, quote request).
- [ ] `/erp/analytics` — GA-style dashboard (visitors, pageviews, sessions, top pages/referrers, device charts, live-ish recent events).

---

## PHASE 7 — Frontend polish & navigation  🟡
- [ ] Add all new modules to ERP sidebar with role gating.
- [ ] i18n (EN/AR) strings for every new screen (RTL-safe).
- [ ] Empty states, loading skeletons, toasts, error handling.
- [ ] Update client dashboard nav (Support + Quotations + Invoices).

---

## PHASE 8 — React Native (Expo) mobile app — `handla-mobile/`  🟢
Goal: **full feature parity with web**, role-gated. Shipped in slices.

- [ ] Scaffold Expo (TypeScript, expo-router, React Navigation), shared API client (reuse envelope), secure token storage, i18n, theme (glass/dark).
- [ ] **Slice 1 — Auth + Shell:** login/refresh, role-aware tab navigator, profile.
- [ ] **Slice 2 — Dashboard + Notifications:** KPIs, notification center, push (Expo notifications) later.
- [ ] **Slice 3 — Chat:** real-time Socket.io, file upload (S3 presigned), typing.
- [ ] **Slice 4 — Support:** ticket queue (staff) / my tickets (client), replies, attachments.
- [ ] **Slice 5 — Sales:** clients, quotations, contracts, invoices (view + create + PDF share).
- [ ] **Slice 6 — Finance:** purchases, expenses, accounting ledger, reports (mobile charts).
- [ ] **Slice 7 — Analytics + admin:** analytics dashboard, users/testimonials management.
- [ ] Build config (EAS), README for running on device.

---

## Suggested delivery order
1. **Accounting Hub** (foundation — everything posts to the ledger)
2. **Purchases** (feeds ledger/expenses)
3. **Quotations** (feeds contracts/invoices)
4. **Support** (client-facing value)
5. **Reports** (reads everything above)
6. **Analytics** (independent, self-contained)
7. **Frontend** for all of the above (interleaved per phase)
8. **Mobile app** (parity, in slices) — last, once web APIs are stable

---

## Status legend
🔴 High · 🟡 Medium · 🟢 Later &nbsp;|&nbsp; `[ ]` todo · `[x]` done
