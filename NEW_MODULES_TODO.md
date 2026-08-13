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

### Backend
- [ ] Enums: `PurchaseStatus` (DRAFT, ORDERED, RECEIVED, CANCELLED), `PurchasePaymentStatus` (UNPAID, PAID, OVERDUE).
- [ ] Entity `Supplier`: id, name, company, email, phone, taxId, address, notes, isActive.
- [ ] Entity `Purchase` (PO/Bill): id, purchaseNumber (PO-YYYY-NNNN), supplierId, status, paymentStatus, subtotal, taxRate, taxAmount, total, currency (optional), orderDate, dueDate, paidAt, notes, ownerId.
- [ ] Entity `PurchaseLineItem`: description, qty, unitPrice, lineTotal.
- [ ] Service: CRUD, thread-safe number generation, `markAsPaid()` → **auto-create Expense** (category from account) → which cascades to ledger OUT entry (Phase 1 hook). Overdue scheduler (daily) like invoices.
- [ ] Controller `/api/purchases` + `/api/suppliers` (ADMIN/EMPLOYEE).
- [ ] Purchase PDF (reuse invoice PDF infra).
- [ ] Tests.

### Frontend
- [ ] `/erp/suppliers` — supplier CRUD.
- [ ] `/erp/purchases` — list + create/edit (line items, tax), mark paid, PDF, status badges.

---

## PHASE 3 — Quotations  🔴
Quote → accept → auto draft Contract + Invoice. Public accept/reject.

### Backend
- [ ] Enum `QuotationStatus` (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED).
- [ ] Entity `Quotation`: id, quoteNumber (QUO-YYYY-NNNN), clientId (or leadId), status, subtotal, taxRate, taxAmount, total, currency (optional), validUntil, notes, publicToken (uuid), acceptedAt, rejectedAt, convertedInvoiceId, convertedContractId, ownerId.
- [ ] Entity `QuotationLineItem`.
- [ ] Service: CRUD, number generation, `send()`, `accept()`/`reject()` (public via token), **`convert()`** → creates DRAFT Contract + DRAFT Invoice from line items; sets status CONVERTED. Expiry scheduler.
- [ ] Controllers:
  - `/api/quotations` (ADMIN/EMPLOYEE CRUD + convert; CLIENT read own)
  - `/api/quotations/public/:token` (GET view, POST accept, POST reject) — no auth.
- [ ] Quotation PDF + QR (reuse invoice/contract infra).
- [ ] Notifications on send/accept/reject.
- [ ] Tests.

### Frontend
- [ ] `/erp/quotations` — list + builder (line items) + send + convert button.
- [ ] `/quotation/public/[token]` — public viewer with Accept / Reject.
- [ ] Client dashboard: "My Quotations".

---

## PHASE 4 — Support / Ticketing  🔴
Post-launch support. Clients open tickets; staff respond. External platforms integrate via API key.

### Backend
- [ ] Enums: `TicketStatus` (OPEN, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED), `TicketPriority` (LOW, MEDIUM, HIGH, URGENT), `TicketCategory` (BUG, FEATURE, QUESTION, BILLING, OTHER).
- [ ] Entity `Ticket`: id, ticketNumber (TCK-YYYY-NNNN), subject, description, status, priority, category, clientId, projectId (nullable), assigneeId (staff, nullable), createdById, source (WEB/API/EMAIL), lastReplyAt, closedAt.
- [ ] Entity `TicketReply`: id, ticketId, authorId (nullable for API/system), body, attachments (json), isInternalNote (staff-only), createdAt.
- [ ] Entity `ClientApiKey`: id, clientId, keyHash, label, lastUsedAt, isActive, createdAt. (Raw key shown once.)
- [ ] Service: CRUD, assign, status transitions, reply (client + staff + internal note), attachments via S3 presigned. API-key auth path for programmatic ticket creation.
- [ ] Controllers:
  - `/api/support/tickets` (staff: all; client: own) + replies.
  - `/api/support/api-keys` (staff issues/revokes per client).
  - `/api/support/ingest` — **API-key authenticated** endpoint for external platforms to open/append tickets (guarded by `ApiKeyGuard`).
- [ ] `ApiKeyGuard` (validates `X-Handla-Key` header → resolves client).
- [ ] Notifications + email on new ticket / new reply.
- [ ] Tests.

### Frontend
- [ ] `/erp/support` — staff ticket queue (filters: status/priority/assignee/client), ticket detail with threaded replies + internal notes, assign, status change.
- [ ] `/erp/support/api-keys` — issue/revoke client keys (copy-once modal).
- [ ] Client dashboard: `/dashboard/support` — open ticket + view/reply own tickets.

---

## PHASE 5 — Reports  🟡
Read-only analytical endpoints + printable/exportable views.

### Backend
- [ ] `/api/reports` (ADMIN/EMPLOYEE):
  - `profit-loss` (income vs expenses+purchases, grouped by currency, date range)
  - `cash-flow` (money in/out over time buckets)
  - `tax-summary` (tax collected on invoices vs tax paid on purchases)
  - `ar-aging` (unpaid invoices by age) / `ap-aging` (unpaid purchases by age)
  - `revenue-by-client`, `revenue-over-time`
  - `projects-status`, `tasks-throughput`, `support-stats` (tickets by status/priority, avg resolution)
- [ ] All computed from ledger + source tables; currency-aware grouping.
- [ ] Tests.

### Frontend
- [ ] `/erp/reports` — date-range picker, currency filter, charts (Recharts or existing chart lib), CSV/PDF export.

---

## PHASE 6 — Analytics (self-hosted)  🟡
GA-style tracking for the public marketing site.

### Backend
- [ ] Entity `AnalyticsEvent`: id, siteId (default), sessionId, visitorId (anon cookie), type (PAGEVIEW/EVENT), path, referrer, utm fields, eventName, eventData (json), device, os, browser, country (from IP, best-effort), createdAt.
- [ ] Ingest endpoint `POST /api/analytics/collect` — **public, no auth**, rate-limited, CORS-open, tiny payload; parses UA server-side; no PII beyond anon id.
- [ ] Aggregation service + endpoints (ADMIN/EMPLOYEE): totals, unique visitors, sessions, top pages, top referrers, device/browser breakdown, events, time-series — all with date range.
- [ ] Data retention/rollup consideration (daily aggregate table optional later).
- [ ] Tests.

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
