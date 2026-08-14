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
- [x] `/erp/accounting` — Chart of Accounts manager + general ledger table (tabs: Ledger with IN/OUT filter + manual entry; Accounts grouped by type with CRUD, system-account guard).
- [ ] Client detail page: add **"Ledger / Statement"** tab (running balance, download statement PDF later). _(deferred — optional)_

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
- [x] `/erp/suppliers` — supplier CRUD (list, search, pagination, active/inactive badge, ADMIN delete).
- [x] `/erp/purchases` — list + create/edit (line-item editor w/ live totals, tax), mark paid, status/payment badges, tabs. PDF deferred.

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
- [x] `/erp/quotations` — list + builder (line items, live totals) + workflow actions (send / accept / reject / convert) + copy public link.
- [x] `/quotation/public/[token]` — public viewer with Accept / Reject (status-aware states).
- [ ] Client dashboard: "My Quotations". _(deferred to client-dashboard pass)_

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
- [x] `/erp/support` — staff ticket queue (status filter tabs + search), stats bar, ticket detail drawer with threaded replies + internal notes, status/priority change, create-ticket modal.
- [x] `/erp/support` API-keys modal — issue (copy-once plaintext) / list / revoke per-client keys.
- [ ] Client dashboard: `/dashboard/support` — open ticket + view/reply own tickets. _(deferred to client-dashboard pass)_

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
- [x] `/erp/reports` — date-range picker + 8 report tabs (P&L, cash flow, tax summary, A/R & A/P aging, revenue by client, projects status, support stats), currency-aware tables. CSV/PDF export deferred.

---

## PHASE 6 — Analytics (self-hosted)  ✅ (backend + web frontend done)
GA-style tracking for the public marketing site.

### Backend  ✅
- [x] Entity `AnalyticsEvent`: id, site (default), sessionId, visitorId (anon rotating hash), type (PAGEVIEW/EVENT), path (normalized), referrer + referrerHost, eventName, meta (json), deviceType, os, browser, country (best-effort from Accept-Language, no GeoIP dep), language, title, createdAt. Indexed on (site,createdAt), (type,createdAt), site, path, visitor, created_at.
- [x] Ingest endpoint `POST /api/analytics/collect` (+ `GET /api/analytics/collect` pixel fallback) — **public, no auth**, tiny payload, HTTP 204; parses UA + derives device/browser/os/country server-side; no PII beyond anon rotating id (`sha256(ip|ua|site|daySalt)` truncated; session hash rotates per 30-min window).
- [x] Aggregation service + endpoints (ADMIN/EMPLOYEE) at `/api/erp/analytics`: overview (pageviews, events, unique visitors, sessions, bounce rate, views/session), time-series (hour/day/month), top pages, top referrers, device/browser/country breakdown, top events — all with date range.
- [ ] Data retention/rollup consideration (daily aggregate table optional later). _(deferred — optional)_
- [x] Tests (18 — parsing helpers, record, overview, topPages, timeseries).

### Frontend
- [x] `public/analytics.js` — tiny (~5.7kb) tracker: first-party anon id cookie, auto pageviews on load + SPA route change (History API + popstate), `handla('event', name, meta)`, sendBeacon→fetch→pixel fallback, honours Do-Not-Track. Config via `data-endpoint`/`data-site`.
- [x] Wire tracker into the marketing site: `<Script>` in root `layout.tsx` (endpoint derived from `NEXT_PUBLIC_API_URL`); `lib/track.ts` helper + CTA events on Hero primary/secondary and Contact start-chat/admin-panel.
- [x] `/erp/analytics` — GA-style dashboard: KPI cards (pageviews, events, visitors, sessions, bounce rate, views/session), traffic-over-time sparkline (hour/day/month), top pages/referrers bar lists, device/browser/country breakdowns, top events. Date-range presets (7/30/90d) + custom picker. Dependency-free inline SVG charts.

---

## PHASE 7 — Frontend polish & navigation  ✅ (ERP back-office done)
- [x] Add all new modules to ERP sidebar with grouped role-gated nav (Workspace / Sales / Finance / Operations / Admin).
- [x] i18n note: ERP back-office pages are English-only by codebase convention (no ERP page imports `useTranslation`); new pages match existing English style. AR/RTL applies to marketing side only.
- [x] Empty states, loading skeletons/spinners, toasts, error handling across all new pages.
- [ ] Update client dashboard nav (Support + Quotations + Invoices). _(deferred to client-dashboard pass)_

---

## PHASE 8 — React Native (Expo) mobile app — `handla-mobile/`  ✅ COMPLETE
Goal: **full feature parity with web**, role-gated. Shipped in slices — all slices + EAS build config delivered. Deferred (non-blocking, tracked): chat/ticket file attachments (S3 presigned) and Expo push notifications.

- [x] Scaffold Expo SDK 51 (TypeScript, expo-router typed routes, React Query, Zustand, Axios), shared API client (reuses `{message,data}` envelope + Bearer auth), secure token storage (expo-secure-store / localStorage web fallback), dark/gold theme, shared UI primitives. Backend `signin/signup/refresh` extended to also return tokens in body (backward-compatible) so mobile can use Bearer auth.
- [x] **Slice 1 — Auth + Shell:** email/password login, transparent single-flight token refresh + retry, AuthGate redirect (auth ↔ app), role-aware bottom-tab navigator, dashboard (staff KPIs / client portal welcome), notifications (list + mark read / mark-all-read), profile + sign-out. Typechecks clean; iOS Metro bundle exports successfully.
- [x] **Slice 2 — Dashboard + Notifications:** dashboard KPI tiles (staff) / portal welcome (client); notification center (list + mark read / mark-all-read). Push (Expo notifications) deferred.
- [x] **Slice 3 — Chat:** real-time Socket.io (singleton client, `handshake.auth.token`, reuses ChatGateway events sendMessage/messageReceived/markAsRead/typing/join/leave), conversation list (staff: all, client: own + Start Chat) with live badge refresh + online indicator, conversation detail with optimistic-safe send (socket path + REST fallback), typing indicator, auto mark-read, auto-scroll. File upload (S3 presigned) deferred to a later pass.
- [x] **Slice 4 — Support:** ticket list with status filters + staff SLA stats (total/open/breach), role-scoped (staff see in-scope, client sees own), ticket detail with threaded replies (opening description + replies, staff internal-note toggle hidden from clients), staff inline status/priority quick-change, reply composer (blocked on CLOSED), new-ticket screen with staff client picker + priority/category selectors. Reuses `/erp/support` REST contract (getStats/getTickets/getTicket/addReply/updateTicket) + `/erp/clients` picker. Attachments (S3 presigned) deferred to a later pass.
- [x] **Slice 5 — Sales:** Sales hub tab with segmented control (Quotations / Contracts / Invoices), role-scoped lists reusing `/erp/quotations`, `/erp/contracts`, `/erp/invoices` (each returns `{<key>, total, page, pages}`). Quotation detail (line items, subtotal/tax/total, meta, notes; client Accept/Reject on SENT). Invoice detail (line items, totals, due/paid meta; staff Mark-as-Paid on unpaid/overdue). Contract detail (status/meta, contract body, "View Document" opening the `/pdf-url` presigned link via Linking; client Accept & Sign / Reject on SENT). Reusable `DetailHeader`/`Row` UI + shared `salesMeta` (status labels/colors, currency-aware `money()`/`fmtDate`). Currency rendered per-record (optional). Staff-only doc creation deferred to web (mobile is view + lifecycle actions).
- [x] **Slice 6 — Finance:** staff-only Finance hub tab (hidden from client tab bar via `href:null`) with segmented control (Purchases / Expenses / Ledger) and a financial summary header (income / expenses / net) from `/erp/expenses/summary`. Purchases list (status + payment badges, supplier, total) reusing `/purchases`; purchase detail (line items, subtotal/tax/total, supplier/account/dates meta, staff Mark-as-Paid on unpaid+non-cancelled). Expenses list (INCOME/EXPENSE signed amounts, category, date) from `/erp/expenses`. Accounting ledger list (IN/OUT signed amounts, account, source type, date) from `/accounting/ledger`. Shared `financeMeta` (status/direction/source labels+colors) + reuses `salesMeta` money()/fmtDate. Doc creation stays on web. Rich charts deferred to Slice 7 (analytics).
- [x] **Slice 7 — Analytics + admin:** staff-only Analytics tab (hidden from client tab bar via `href:null`) with range presets (7d/30d/90d → day/month interval), 6 KPI cards (pageviews/visitors/sessions/events/bounce/views-per-session), a dependency-free View-based bar chart for pageviews-over-time, and BarList sections for Top Pages / Referrers / Devices / Browsers / Countries / Events — all from `/erp/analytics/*` (overview/timeseries/top-pages/top-referrers/devices/browsers/countries/top-events). Admin surface: read-only Team roster (ADMIN-only, pushed from Profile → Admin section) with role filter chips + archived/disabled indicators, from ADMIN-only `/users`. Shared analytics types + `analyticsApi`/`usersApi`. Write-side user management + testimonials editing stay on web. `react-native-svg` intentionally not added — charts are plain Views to avoid a native dep.
- [x] Build config (EAS), README for running on device. `eas.json` with development / preview / production profiles (per-profile `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`), `runtimeVersion: appVersion` policy in `app.json` (bundle IDs `tech.handla.mobile` already set), and a rewritten README documenting the full architecture, role gating, EAS build/submit commands, and a device smoke-test checklist.

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

---

## PHASE 10 — AI Handla Assistant (queued, after mobile)  🟡
Analyze existing NestJS messaging/chat FIRST (do not rebuild). Layer an AI assistant on top of existing conversations/messages/WebSocket/auth.
- AI = language understanding only; NestJS stays workflow controller.
- Handla Knowledge Base (DB-managed, categories, public/internal visibility) + modular retrieval (upgradeable to RAG).
- Lead qualification: natural NL requirement collection → structured extracted_data + missing_fields + lead_status.
- Structured AI output {reply,intent,extracted_data,missing_fields,lead_status,needs_human,escalation_reason}; validate before use.
- STRICT truth policy — never fabricate Handla facts (clients/gov projects/certs/prices/etc.); say "not confirmed" + record for team.
- Business restrictions (no final quotes/discounts/delivery guarantees/contracts); escalation triggers.
- Human takeover (bot_enabled/status, stops AI immediately) + safe return-to-AI.
- Message origin: CLIENT/AI/STAFF/SYSTEM. Context strategy (summary + recent msgs + KB + lead state). Cost control (1 msg → 1 AI call). Prompt-injection defense. Concurrency/idempotency (no double replies). Graceful fallback on AI failure.
- AiModule (AiService/ChatbotService/KnowledgeService/LeadExtractionService/ConversationContextService/PromptService) — adapt to existing conventions. Env: OPENAI_API_KEY, OPENAI_MODEL. Admin UI: KB CRUD, lead panel, AI state, takeover. Tests.

## PHASE 11 — SaaS Control Plane (queued, after AI assistant)  🟡
Analyze Handla + Mudar/Matjari/Manara FIRST. Handla = managed SaaS Control Plane (no public self-service tenant creation; admin-only provisioning).
- Central models: Clients(reuse), Products, Plans(+limits/entitlements), Tenants, Subscriptions, TenantDomains, ProvisioningLogs.
- Tenant lifecycle PENDING/PROVISIONING/ACTIVE/SUSPENDED/FAILED/ARCHIVED; subscription TRIAL/ACTIVE/PAST_DUE/EXPIRED/CANCELLED (separate).
- Product-owned provisioning via secure service-to-service internal API (POST /internal/tenants); Handla stores external_tenant_id + metadata only, NOT raw DB creds.
- Idempotent provisioning (provisioning_request_id); queued/background job; retry-safe; failure → FAILED + logs; non-destructive suspend/reactivate; archive w/ retention before any guarded permanent delete.
- Database-per-tenant (product-owned, safe generated names); each product owns its migrations/seeders/initial-admin.
- Adapter/strategy ProductProvisioner interface (provision/suspend/reactivate/updatePlan/updateLimits) — no product if/else scattered.
- Subdomain strategy (*.mudar/matjari/manara.handla.tech), custom domains later. RBAC (saas.* perms). Admin UI: Clients/Products/Plans/Tenants/Subscriptions/Provisioning Logs + create/details/lifecycle actions. Lead→Client→Tenant conversion path. Tests.
