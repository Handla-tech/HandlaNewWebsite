# Handla — Developer Reference

> **Purpose**: Fast-onboarding technical document. Read this before touching any code.  
> **Last updated**: 2026-05-28

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Architecture](#3-architecture)
4. [Backend (NestJS)](#4-backend-nestjs)
5. [Frontend (Next.js)](#5-frontend-nextjs)
6. [Database Schema](#6-database-schema)
7. [Authentication Flow](#7-authentication-flow)
8. [Real-Time (WebSocket)](#8-real-time-websocket)
9. [File Uploads (S3)](#9-file-uploads-s3)
10. [Email Queue (Bull/Redis)](#10-email-queue-bullredis)
11. [Environment Variables](#11-environment-variables)
12. [Local Development](#12-local-development)
13. [Docker / Production](#13-docker--production)
14. [API Reference](#14-api-reference)
15. [Socket.io Events](#15-socketio-events)
16. [Frontend State Management](#16-frontend-state-management)
17. [i18n & RTL](#17-i18n--rtl)
18. [Design System](#18-design-system)
19. [Testing](#19-testing)
20. [Known Limitations & Future Work](#20-known-limitations--future-work)

---

## 1. Project Overview

**Handla** is a bilingual (EN/AR) software-services marketing platform. It lets potential clients browse Handla's offerings, initiate contact, and communicate in real-time with the Handla team via a built-in chat system.

### Core capabilities

| Feature | Technology |
|---------|-----------|
| Landing page (marketing) | Next.js 14 App Router, Framer Motion |
| Real-time chat | Socket.io 4, NestJS WebSocket Gateway |
| In-app notifications | Socket.io + PostgreSQL |
| Auth (JWT, httpOnly cookies) | NestJS Passport, bcrypt |
| File sharing in chat | AWS S3 presigned URLs |
| Email notifications | Nodemailer + Bull queue (Redis) |
| Testimonials (public) | REST API, TanStack Query |
| Admin panel | Next.js protected routes |
| Bilingual support | EN/AR with RTL layout |

---

## 2. Repository Layout

```
HandlaNewWebsite/
├── handla-backend/          # NestJS API server
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── common/          # Guards, filters, interceptors, decorators, pipes
│   │   ├── config/          # ConfigService wrappers (DB, JWT, AWS, SMTP…)
│   │   ├── database/        # TypeORM migrations, seeders
│   │   ├── health/          # GET /api/health (Docker HEALTHCHECK)
│   │   ├── modules/
│   │   │   ├── auth/        # JWT auth, signup/signin/refresh/logout/me
│   │   │   ├── aws/         # S3 presigned-URL generation, file delete
│   │   │   ├── chat/        # Conversations, messages, WebSocket gateway
│   │   │   ├── email/       # Nodemailer + Bull queue + HBS templates
│   │   │   ├── notifications/ # In-app notification CRUD
│   │   │   └── testimonials/  # Public/admin testimonial CRUD
│   │   └── utils/           # Custom exceptions, Winston logger
│   ├── .env.example
│   ├── Dockerfile
│   └── entrypoint.sh        # Wait-for-Postgres → migrate → start
│
├── handla-frontend/         # Next.js 14 App Router
│   ├── src/
│   │   ├── app/             # App Router pages & layouts
│   │   │   ├── page.tsx     # Landing page
│   │   │   ├── layout.tsx   # Root layout (font, metadata, JSON-LD)
│   │   │   ├── not-found.tsx
│   │   │   ├── error.tsx    # Global error boundary
│   │   │   ├── sitemap.ts   # /sitemap.xml
│   │   │   ├── robots.ts    # /robots.txt (programmatic)
│   │   │   ├── auth/        # Sign in / Sign up
│   │   │   ├── dashboard/   # Client chat view
│   │   │   └── admin/       # Admin conversations + testimonials
│   │   ├── components/
│   │   │   ├── JsonLd.tsx   # JSON-LD structured data
│   │   │   ├── Providers.tsx # QueryClient, OfflineBanner, ToastContainer
│   │   │   ├── auth/        # SignInForm, SignUpForm
│   │   │   ├── chat/        # ChatWindow, MessageList, MessageInput, FileUploadButton
│   │   │   ├── landing/     # Navbar, Hero, About, ServicesBento, Solutions, Process,
│   │   │   │                  Testimonials, Contact, Footer, TrustStrip, AnimatedHeadline
│   │   │   ├── notifications/ # NotificationBell, NotificationCenter
│   │   │   └── ui/          # ProfileMenu, ToastContainer, OfflineBanner,
│   │   │                      Skeleton, EmptyState
│   │   ├── hooks/           # useAuth, useChat, useNotifications, useSocket,
│   │   │                      useTranslation, useBreakpoint
│   │   ├── lib/             # api.ts (Axios), socket.ts, s3-uploader.ts,
│   │   │                      i18n.ts, utils.ts
│   │   ├── middleware.ts    # Route protection (cookie check, no JWT decode)
│   │   ├── store/           # Zustand: authStore, chatStore, notificationStore,
│   │   │                      uiStore, toastStore
│   │   └── types/index.ts   # Shared TypeScript types
│   ├── public/
│   │   ├── locales/en/common.json
│   │   ├── locales/ar/common.json
│   │   └── robots.txt       # Static fallback
│   ├── .env.local.example
│   ├── next.config.js
│   └── tailwind.config.ts
│
├── docker-compose.yml       # Production stack (mysql + redis + api)
├── docker-compose.dev.yml   # Dev override (hot-reload, exposed ports)
├── TODOS.md                 # Phase-by-phase task tracker
├── CONTRIBUTING.md          # Git workflow, conventions, PR checklist
└── DEVELOPMENT.md           # This file
```

---

## 3. Architecture

```
Browser
  │
  ├─ HTTP  ──► Next.js (port 3000)
  │              └─ Axios (withCredentials) ──► NestJS API (port 3001)
  │                   ├─ Auth: httpOnly cookies (access_token, refresh_token)
  │                   ├─ PostgreSQL (TypeORM)
  │                   ├─ Redis (Bull email queue)
  │                   └─ AWS S3 (file uploads via presigned URLs)
  │
  └─ WS   ──► Socket.io Gateway (same NestJS process, port 3001)
                  ├─ chat:sendMessage
                  ├─ chat:markAsRead
                  ├─ chat:typing
                  └─ notificationNew
```

**Key design decisions:**

- **httpOnly cookies** for JWT (not localStorage) — immune to XSS.
- **Soft logout** via `registerAuthFailureCallback` in `api.ts` — avoids the hard-reload + cookie loop.
- **Socket auth**: cookie-first, then `Authorization: Bearer` header, then `handshake.auth.token`.
- **Presigned URLs** for S3 — the API never handles file bytes, only metadata.
- **Bull queue** for emails — async, retried 3× with exponential backoff.

---

## 4. Backend (NestJS)

### Module map

| Module | Controllers | Services | Gateway |
|--------|------------|---------|---------|
| `AuthModule` | `POST /auth/signup` `signin` `refresh` `logout` `GET /auth/me` | `AuthService` | — |
| `ChatModule` | `GET/POST /chat/conversations` `presigned-url` `PATCH status/read` | `ChatService` | `ChatGateway` |
| `NotificationModule` | `GET/PATCH/DELETE /notifications` | `NotificationService` | — |
| `TestimonialModule` | `GET/POST/PATCH/DELETE /testimonials` | `TestimonialService` | — |
| `AwsModule` | — | `AwsService` | — |
| `EmailModule` | — | `EmailService` | `EmailProcessor` |
| `HealthModule` | `GET /health` | — | — |

### Global middleware stack (order matters)

1. `helmet()` — security headers
2. `cors()` — origin whitelist
3. `cookieParser()` — parses `Cookie` header into `req.cookies`
4. `GlobalValidationPipe` — whitelist + forbidNonWhitelisted + transform
5. `AllExceptionsFilter` — unified error envelope `{success, statusCode, message, errors, path}`
6. `TransformInterceptor` — wraps success responses as `{success, data, message, statusCode, timestamp}`
7. `JwtAuthGuard` (global) — extracts JWT from `access_token` cookie or `Authorization: Bearer`, skips `@Public()` routes
8. `RolesGuard` (global) — enforces `@Roles(UserRole.ADMIN)` decorator; throws 403

### Important patterns

**Custom exceptions** (`src/utils/exceptions.ts`):
```typescript
throw new EmailAlreadyExistsException();      // 409
throw new InvalidCredentialsException();       // 401
throw new ResourceNotFoundException('User');   // 404
```

**Accessing current user in controllers**:
```typescript
@Get('me')
getMe(@CurrentUser() user: User) { ... }
```

**Making a route public**:
```typescript
@Public()
@Get('testimonials')
findAll() { ... }
```

---

## 5. Frontend (Next.js)

### Routing

| Path | Component | Protected |
|------|-----------|----------|
| `/` | `LandingPage` | No |
| `/auth` | `AuthPage` | Redirect if logged in |
| `/dashboard` | `DashboardPage` | CLIENT only |
| `/admin` | `AdminPage` | ADMIN only |
| `/admin/testimonials` | `AdminTestimonialsPage` | ADMIN only |

**Middleware** (`src/middleware.ts`) does a **cookie-only** check (no JWT decode) to protect `/dashboard` and `/admin`. The layouts double-check with `useAuth()` for role enforcement.

### Key files

| File | Role |
|------|------|
| `src/lib/api.ts` | Axios instance; 401→refresh interceptor; `registerAuthFailureCallback` |
| `src/lib/socket.ts` | Socket.io singleton; `connectSocket()` / `disconnectSocket()` |
| `src/lib/s3-uploader.ts` | Presign → PUT to S3; progress callback; file validation |
| `src/components/Providers.tsx` | QueryClient; AppInitializer (auth-failure, getMe, theme, socket); OfflineBanner; ToastContainer |

### Component conventions

- Every client component starts with `'use client';`
- Hydration-safe checks use `mounted` state pattern:
  ```typescript
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  ```
- All async states show loading skeleton or spinner; empty states use `<EmptyState />`
- RTL-aware: use `isRTL` from `useTranslation()` to flip `x` directions in motion props

---

## 6. Database Schema

### Tables

```
users
  id          UUID PK
  email       VARCHAR(255) UNIQUE
  password_hash VARCHAR(255)
  name        VARCHAR(255)
  role        ENUM('ADMIN','CLIENT')
  created_at  TIMESTAMP

conversations
  id          UUID PK
  admin_id    UUID FK → users.id
  client_id   UUID FK → users.id
  status      ENUM('ACTIVE','ON_HOLD','COMPLETED')
  created_at  TIMESTAMP
  updated_at  TIMESTAMP
  INDEX (admin_id, client_id, status)

messages
  id              UUID PK
  conversation_id UUID FK → conversations.id
  sender_id       UUID FK → users.id
  content         TEXT (nullable)
  file_url        VARCHAR(2048) (nullable)
  is_read         BOOLEAN DEFAULT false
  created_at      TIMESTAMP
  INDEX (conversation_id, created_at)

notifications
  id                  UUID PK
  user_id             UUID FK → users.id
  type                ENUM('MESSAGE','SYSTEM')
  title               VARCHAR(255)
  message             TEXT
  related_message_id  UUID (nullable)
  is_read             BOOLEAN DEFAULT false
  created_at          TIMESTAMP
  INDEX (user_id, is_read, created_at)

testimonials
  id                  UUID PK
  client_name         VARCHAR(100)
  client_company      VARCHAR(150) (nullable)
  content             TEXT
  image_url           VARCHAR(2048) (nullable)
  rating              INT CHECK(1..5)
  created_by_admin_id UUID FK → users.id
  created_at          TIMESTAMP
  updated_at          TIMESTAMP
```

### Migrations

Migration files live in `handla-backend/src/database/migrations/`.  
Run with: `npm run migration:run`  
Revert with: `npm run migration:revert`

---

## 7. Authentication Flow

### Sign-in

```
Client → POST /api/auth/signin { email, password }
  → AuthService.signIn()
    → bcrypt.compare(password, user.password_hash)
    → sign access_token (15 min) + refresh_token (7 days)
    → Set-Cookie: access_token=...; HttpOnly; SameSite=Strict
    → Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict; Path=/api/auth/refresh
  ← 200 { user: { id, name, email, role } }
```

### Token refresh (transparent)

`api.ts` interceptor catches `401` responses:

```
401 response received
  → POST /api/auth/refresh (httpOnly refresh_token cookie sent automatically)
    → If OK: new access_token cookie set; retry original request
    → If FAIL: call _onAuthFailure() (registered by Providers.tsx)
      → setUser(null) — clears Zustand + sessionStorage
      → router.push('/auth') — soft nav, no middleware cookie re-check
```

### Middleware route protection

```
Request to /dashboard or /admin
  → middleware.ts checks cookies.access_token
    → if missing: redirect to /auth?callbackUrl=<path>
    → if present: allow through (JWT validity checked server-side on first API call)
```

---

## 8. Real-Time (WebSocket)

### Connection

The Socket.io gateway runs inside the same NestJS process on port 3001.  
`lib/socket.ts` creates a typed singleton:

```typescript
const socket = io(SOCKET_URL, {
  withCredentials: true,          // sends httpOnly cookie
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
```

`useSocket()` hook calls `connectSocket()` when `isLoggedIn` becomes true, and `disconnectSocket()` on logout.

### Auth on handshake

`ChatGateway.handleConnection()` authenticates in this priority order:
1. `socket.handshake.headers.cookie` — `access_token` httpOnly cookie
2. `socket.handshake.headers.authorization` — `Bearer <token>`
3. `socket.handshake.auth.token` — fallback

### Rooms

| Room name | Joined by |
|-----------|----------|
| `user:{userId}` | Every authenticated connection (personal room) |
| `conversation:{conversationId}` | On `joinConversation` event |

---

## 9. File Uploads (S3)

**Flow**: client never sends file bytes to the API.

1. Client calls `POST /api/chat/presigned-url { fileName, contentType, fileSize }` → gets a presigned PUT URL
2. Client PUTs the file directly to S3 using `lib/s3-uploader.ts`
3. Client sends the S3 URL as `fileUrl` in the `chat:sendMessage` socket event
4. Gateway persists `fileUrl` to `messages.file_url`

**Constraints** (enforced in `PresignedUrlDto`):
- Max file size: 5 MB
- Allowed MIME types validated in `s3-uploader.ts`

**Key S3 bucket env vars**: `AWS_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

---

## 10. Email Queue (Bull/Redis)

`EmailModule` uses Bull with a Redis backend.  
`EmailProcessor` handles three job types:

| Job | Template | Trigger |
|-----|---------|---------|
| `send-message-notification` | `message-notification.hbs` | New message to recipient |
| `send-response-notification` | `response-notification.hbs` | Admin reply to client |
| `send-welcome` | `welcome.hbs` | New user signup |

All jobs retry 3 times with exponential backoff on SMTP failure.

---

## 11. Environment Variables

### Backend (`handla-backend/.env`)

```dotenv
# Application
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=handla
DB_PASSWORD=secret
DB_NAME=handla_db

# JWT
JWT_SECRET=<32+ char random string>
JWT_EXPIRY=15m
JWT_REFRESH_SECRET=<different 32+ char random string>
JWT_REFRESH_EXPIRY=7d

# Redis (Bull email queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=handla-uploads

# SMTP (or SES)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@handla.tech

# CORS
SOCKET_CORS_ORIGIN=http://localhost:3000
```

### Frontend (`handla-frontend/.env.local`)

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 12. Local Development

### Start everything

```bash
# Terminal 1: Infrastructure
docker compose -f docker-compose.dev.yml up -d mysql redis

# Terminal 2: Backend (hot-reload)
cd handla-backend
cp .env.example .env   # edit values
npm install
npm run migration:run
npm run start:dev        # → http://localhost:3001/api
                         # → http://localhost:3001/api/docs (Swagger)

# Terminal 3: Frontend (hot-reload)
cd handla-frontend
cp .env.local.example .env.local
npm install
npm run dev              # → http://localhost:3000
```

### Useful backend scripts

```bash
npm run start:dev       # hot-reload
npm run build           # tsc compile to dist/
npm run start:prod      # run compiled dist/main.js
npm test                # jest unit tests
npm run test:cov        # with coverage
npm run migration:generate -- --name=MyMigration
npm run migration:run
npm run migration:revert
npm run seed            # seed sample data
```

### Useful frontend scripts

```bash
npm run dev             # hot-reload
npm run build           # production build
npm run start           # serve production build
npm run lint            # ESLint
npx tsc --noEmit        # type-check
```

---

## 13. Docker / Production

```bash
# Build and start full stack
docker compose up --build -d

# View API logs
docker compose logs -f api

# Run migrations inside container
docker compose exec api npm run migration:run
```

The `entrypoint.sh` script:
1. Waits up to 60 s for PostgreSQL to be ready
2. Waits up to 30 s for Redis (non-fatal)
3. Runs `typeorm migration:run`
4. `exec node dist/main` (replaces shell — proper PID 1)

---

## 14. API Reference

Full interactive docs at **`/api/docs`** (Swagger UI, development mode only).

### Auth endpoints (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | Public | Create account; sets httpOnly cookies |
| POST | `/signin` | Public | Sign in; sets httpOnly cookies (rate-limited: 5/15min) |
| POST | `/refresh` | Cookie | Rotate access + refresh tokens |
| POST | `/logout` | Cookie | Clear both cookies |
| GET  | `/me` | JWT | Return current user |

### Chat endpoints (`/api/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/conversations` | JWT | List conversations (paginated, role-aware) |
| GET | `/conversations/:id` | JWT | Get conversation with message history |
| POST | `/conversations` | JWT | Create conversation |
| POST | `/presigned-url` | JWT | Get S3 presigned upload URL |
| PATCH | `/conversations/:id/status` | JWT | Update conversation status |
| PATCH | `/messages/:id/read` | JWT | Mark message as read |

### Notification endpoints (`/api/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | Paginated list + unreadCount |
| GET | `/unread-count` | JWT | Badge count only |
| PATCH | `/:id/read` | JWT | Mark one as read |
| PATCH | `/read-all` | JWT | Mark all as read |
| DELETE | `/:id` | JWT | Delete one |
| DELETE | `/read` | JWT | Delete all read |

### Testimonial endpoints (`/api/testimonials`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Paginated list |
| GET | `/:id` | Public | Get single |
| POST | `/` | ADMIN | Create |
| PATCH | `/:id` | ADMIN | Update |
| DELETE | `/:id` | ADMIN | Delete |

---

## 15. Socket.io Events

### Client → Server (emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:sendMessage` | `{ conversationId, content?, fileUrl? }` | Send a message |
| `chat:markAsRead` | `{ messageId }` | Mark single message read |
| `chat:markAllRead` | `{ conversationId }` | Mark all as read in conversation |
| `chat:typing` | `{ conversationId, isTyping }` | Typing indicator |
| `chat:joinConversation` | `{ conversationId }` | Join a conversation room |
| `chat:leaveConversation` | `{ conversationId }` | Leave a conversation room |

### Server → Client (on)

| Event | Payload | Description |
|-------|---------|-------------|
| `messageReceived` | `{ message, conversationId }` | New message in a conversation |
| `messageRead` | `{ messageId, conversationId }` | Single message marked read |
| `messagesRead` | `{ conversationId, count }` | Bulk read |
| `userTyping` | `{ userId, conversationId, isTyping }` | Typing state from other user |
| `userOnline` | `{ userId, isOnline }` | Presence update |
| `notificationNew` | `{ notification, conversationId, senderId }` | New in-app notification |

**Socket rooms:**
- `user:{userId}` — personal room (joined on connect)
- `conversation:{conversationId}` — joined on `chat:joinConversation`

---

## 16. Frontend State Management

### Zustand stores

| Store | Persisted | Key state |
|-------|----------|----------|
| `authStore` | sessionStorage | `user`, `isLoggedIn`, `isLoading` |
| `chatStore` | no | `conversations`, `activeConversation`, `messages`, `typingUsers`, `onlineUsers` |
| `notificationStore` | no | `notifications`, `unreadCount` |
| `uiStore` | localStorage | `theme`, `locale` |
| `toastStore` | no | `toasts[]` |

### Data fetching (TanStack Query)

`useChat` and `useNotifications` hooks use `useQuery` with:
- `staleTime: 30_000` (30 s)
- `retry: 1`
- `refetchOnWindowFocus: false`

Socket events invalidate the relevant query caches via `queryClient.invalidateQueries()`.

### Toast system

```typescript
import { useToastStore } from '@/store/toastStore';
const { addToast } = useToastStore();

addToast({ type: 'success', title: 'Saved!', message: 'Your changes were saved.' });
addToast({ type: 'error',   title: 'Failed', message: error.message });
addToast({ type: 'info',    title: 'Note',   message: '...' });
addToast({ type: 'message', title: 'New message from Admin' });
```

Toasts auto-dismiss after `duration` ms (default 4000). `duration: 0` = persistent.

---

## 17. i18n & RTL

### Locale files

```
public/locales/
  en/common.json   — English strings
  ar/common.json   — Arabic strings
```

### Using translations

```typescript
import { useTranslation } from '@/hooks/useTranslation';

const { t, locale, isRTL } = useTranslation();
// t('nav.about') → "About" or "من نحن"
// isRTL → true when locale === 'ar'
```

### RTL layout

When locale is `ar`:
- `document.documentElement.dir = 'rtl'` (set by `uiStore.setLocale`)
- `document.documentElement.lang = 'ar'`
- Framer Motion animations flip their `x` direction via `isRTL ? -20 : 20`
- Mobile drawer slides from the left instead of right

### Toggle locale

```typescript
const setLocale = useUIStore((s) => s.setLocale);
setLocale('ar');   // or 'en'
```

---

## 18. Design System

### Colour palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0a0a` | Page background |
| Surface | `#0d0d0d` | Cards, sidebars |
| Surface elevated | `#111111`, `#141414` | Dropdowns, inputs |
| Border | `#1a1a1a`, `#2a2a2a` | Dividers, card borders |
| Text primary | `#ffffff` | Headings |
| Text secondary | `#a0a0a0`, `#888` | Body, labels |
| Text muted | `#666`, `#555`, `#444` | Placeholders, hints |
| Gold accent | `#fbbf24` | CTAs, active states, badges |
| Gold subtle | `rgba(251,191,36,0.1)` | Highlight backgrounds |
| Danger | `#f87171` (red-400) | Errors, destructive actions |
| Success | `#34d399` (emerald-400) | Active status |
| Warning | `#fbbf24` (amber-400) | On-hold status |

### Typography

- Font: `Space Grotesk` (via `next/font/google`)
- CSS variable: `--font-space-grotesk`
- Applied via: `className="font-sans"` on `<body>`

### Tailwind custom tokens

Defined in `tailwind.config.ts`:
- `colors.gold.*` — amber/yellow shades aliased to `gold-400` etc.
- `boxShadow.glass` / `glass-lg` — glassmorphism shadows
- `keyframes.float`, `pulse-glow`, `shimmer`, `marquee`
- `backgroundImage.site-grid` — CSS grid overlay
- `darkMode: ['class']` — toggled by uiStore

### Component anatomy

All interactive components follow:
1. `min-h-[44px] min-w-[44px]` — touch targets
2. `transition-all duration-150` or `200` — standard easing
3. `rounded-xl` or `rounded-2xl` — consistent border radius
4. `border-[#2a2a2a]` default → `border-[#fbbf24]/40` active — state indication

---

## 19. Testing

### Backend — Jest unit tests

| Spec file | Tests | Covers |
|-----------|-------|--------|
| `auth.service.spec.ts` | 8 | signup, signin, refresh, getMe |
| `chat.service.spec.ts` | 16 | CRUD, access control, pagination |
| `notification.service.spec.ts` | 19 | CRUD, ownership checks, bulk ops |
| `testimonial.service.spec.ts` | 13 | CRUD, pagination, null fields |
| `aws.service.spec.ts` | 15 | presigned URL, delete, copy, exists |
| `email.service.spec.ts` | 12 | queue methods, templates, retry |
| **Total** | **83** | |

Run: `cd handla-backend && npm test`

### Frontend — TypeScript

`cd handla-frontend && npx tsc --noEmit` — 0 errors required before merge.

No Jest/RTL tests yet — tracked in TODOS.md Phase 20 follow-ups.

---

## 20. Known Limitations & Future Work

| Item | Notes |
|------|-------|
| Social OAuth | Google/GitHub/LinkedIn buttons on auth page are UI-only placeholders |
| Frontend unit tests | No Jest/RTL tests; TypeScript check is the current quality gate |
| Lighthouse score | Not formally measured yet; structure supports high scores |
| Push notifications | Only in-app; browser Web Push API not implemented |
| Email templates | Hardcoded EN; no i18n in email templates |
| Conversation pagination | Admin sees all conversations; no lazy-loading on the admin list beyond page=1 cursor |
| S3 file type enforcement | Backend validates `contentType` string; no server-side MIME sniffing |
| Rate limiting | Only on `/auth/signin` (5/15 min); global throttler available but not applied |
| WebSocket scaling | Single NestJS process; for multi-instance add `@nestjs/platform-socket.io` Redis adapter |

---

## 21. ERP Architecture

The ERP system is built on top of the original 20 phases. It adds role-based business logic, ownership enforcement, and 7 new resource modules — all sharing the same NestJS/TypeORM/PostgreSQL stack.

### Role Permission Matrix

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
| ERP dashboard | ✅ System-wide | ✅ Own-scoped | N/A | ❌ | ❌ |

### Ownership Policy

Every ERP record (`Client`, `Project`, `Task`, `Contract`, `Invoice`, `Expense`) has an `ownerId` column pointing to the EMPLOYEE user who created/owns it.

- **`@OwnedResource()` decorator** — set on mutating endpoints; metadata key `'isOwnedResource'`
- **`OwnershipGuard`** — global guard applied after `RolesGuard`:
  - `ADMIN` → always pass (bypasses ownership check)
  - `EMPLOYEE` → pass only when `ownerId === currentUser.id`; otherwise throw `OwnershipViolationException`
  - `CLIENT` / `LEAD` → always throw `OwnershipViolationException` on any `@OwnedResource()` route
  - Routes **without** `@OwnedResource()` metadata → guard is a no-op
- **Bulk reassignment** — `PATCH /api/users/:fromId/reassign/:toId` (ADMIN only) updates `ownerId` on all records in a single DB transaction

### ERP Module Map

| Module | Backend path | Frontend path | Key entities |
|--------|-------------|---------------|--------------|
| Users | `src/modules/users/` | `src/app/erp/users/` | `User` |
| Clients | `src/modules/clients/` | `src/app/erp/clients/` | `Client` |
| Projects | `src/modules/projects/` | `src/app/erp/projects/` | `Project` |
| Tasks | `src/modules/tasks/` | `src/app/erp/tasks/` | `Task`, `TasksScheduler` |
| Contracts | `src/modules/contracts/` | `src/app/erp/contracts/` | `Contract` |
| Invoices | `src/modules/invoices/` | `src/app/erp/invoices/` | `Invoice`, `InvoiceLineItem`, `InvoicesScheduler` |
| Expenses | `src/modules/expenses/` | `src/app/erp/expenses/` | `Expense` |
| Dashboard | `src/modules/dashboard/` | `src/app/erp/` | aggregation only |

### Schedulers (No `@nestjs/schedule`)

Two native Node.js schedulers run via `OnApplicationBootstrap` / `OnApplicationShutdown`:

| Scheduler | File | Fires | Action |
|-----------|------|-------|--------|
| `TasksScheduler` | `tasks/tasks.scheduler.ts` | Daily midnight | `recalculateDelayedStatus()` — sets `DELAYED` on past-due non-completed tasks |
| `InvoicesScheduler` | `invoices/invoices.scheduler.ts` | Daily 1 AM | `recalculateOverdueStatus()` — sets `OVERDUE` on UNPAID past-due invoices |

### Frontend ERP Shell (`src/app/erp/layout.tsx`)

- Dark glassmorphism sidebar (`w-64`, `bg-[#0d0d0d]`, `border-[#1a1a1a]`) + spring-animated mobile drawer
- Role-aware nav: EMPLOYEE sees all modules; ADMIN adds Users page
- Protected: non-ADMIN/non-EMPLOYEE redirected to `/dashboard` (CLIENT/LEAD); guests → `/auth`
- Reusable ERP components in `src/components/erp/`:
  - `StatusBadge` — colour-coded status pill for all record types
  - `OwnerBadge` — employee avatar + name; "Unassigned" fallback
  - `RoleBadge` — role pill (ADMIN=gold, EMPLOYEE=blue, CLIENT=green, LEAD=gray)
  - `ErpTable` — glassmorphism sortable table with ARIA + horizontal scroll
  - `StatCard` — KPI card with icon, delta badge, loading skeleton
  - `ConfirmDialog` — accessible confirm modal (`role="dialog"`, Escape key, spring animation)
  - `FilterBar` — search input + pill filter buttons
  - `DateRangePicker` — from/to date inputs with labels

---

## 22. ERP Database Schema

All ERP tables use UUIDs as primary keys (`gen_random_uuid()`), `created_at`/`updated_at` timestamps, and a nullable `owner_id` FK to `users.id ON DELETE SET NULL`.

### `clients`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL UNIQUE FK→users | The CLIENT-role user this record wraps |
| `owner_id` | UUID FK→users | Assigned EMPLOYEE |
| `company` | VARCHAR(255) nullable | |
| `status` | `client_status_enum` | `ACTIVE \| INACTIVE \| CHURNED`, default `ACTIVE` |
| `notes` | TEXT nullable | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `projects`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | VARCHAR(255) NOT NULL | |
| `description` | TEXT nullable | |
| `client_id` | UUID NOT NULL FK→clients | CASCADE delete |
| `owner_id` | UUID FK→users | Assigned EMPLOYEE |
| `status` | `project_status_enum` | `PLANNING \| ACTIVE \| ON_HOLD \| COMPLETED \| CANCELLED` |
| `start_date` / `end_date` | DATE nullable | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | VARCHAR(255) NOT NULL | |
| `description` | TEXT nullable | |
| `project_id` | UUID NOT NULL FK→projects | CASCADE delete |
| `assignee_id` | UUID FK→users nullable | EMPLOYEE assigned (informational) |
| `owner_id` | UUID FK→users | EMPLOYEE who created/owns the task |
| `status` | `task_status_enum` | `PENDING \| IN_PROGRESS \| COMPLETED \| DELAYED` |
| `due_date` | DATE nullable | Scheduler sets DELAYED when past due |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `contracts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `title` | VARCHAR(255) NOT NULL | |
| `body` | TEXT NOT NULL | Contract body text |
| `client_id` | UUID NOT NULL FK→clients | CASCADE delete |
| `owner_id` | UUID FK→users | Owning EMPLOYEE |
| `status` | `contract_status_enum` | `DRAFT \| SENT \| SIGNED \| REJECTED` |
| `sent_at` | TIMESTAMPTZ nullable | Set on DRAFT→SENT transition |
| `signed_at` | TIMESTAMPTZ nullable | Set on SENT→SIGNED transition |
| `s3_key` | VARCHAR(2048) nullable | S3 object key for stored PDF/HTML |
| `pdf_url` | VARCHAR(2048) nullable | Public or pre-signed S3 URL |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `invoices` + `invoice_line_items`

**`invoices`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `invoice_number` | VARCHAR(50) NOT NULL UNIQUE | Format `INV-YYYY-NNNN` |
| `client_id` | UUID NOT NULL FK→clients | CASCADE delete |
| `owner_id` | UUID FK→users | |
| `subtotal` | NUMERIC(12,2) | Σ(line totals) |
| `tax_rate` | NUMERIC(5,2) | Percentage, e.g. `15.00` = 15% |
| `tax_amount` | NUMERIC(12,2) | `subtotal × (taxRate / 100)` |
| `total` | NUMERIC(12,2) | `subtotal + taxAmount` |
| `currency` | VARCHAR(3) | Default `'USD'` |
| `payment_status` | `invoice_payment_status_enum` | `UNPAID \| PAID \| OVERDUE` |
| `due_date` | DATE nullable | Scheduler sets OVERDUE when past due |
| `paid_at` | TIMESTAMPTZ nullable | Set on mark-paid |
| `notes` | TEXT nullable | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**`invoice_line_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `invoice_id` | UUID NOT NULL FK→invoices | CASCADE delete |
| `description` | VARCHAR(500) NOT NULL | |
| `quantity` | NUMERIC(10,2) | Min 0.01 |
| `unit_price` | NUMERIC(12,2) | |
| `line_total` | NUMERIC(12,2) | `quantity × unit_price` (stored for immutability) |
| `sort_order` | SMALLINT | Display order |

### `expenses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `type` | `expense_type_enum` | `INCOME \| EXPENSE` |
| `category` | VARCHAR(100) NOT NULL | e.g. `'Invoice Payment'`, `'Payroll'` |
| `amount` | NUMERIC(12,2) NOT NULL | |
| `currency` | VARCHAR(3) | Default `'USD'` |
| `description` | TEXT nullable | |
| `expense_date` | DATE NOT NULL | Default `CURRENT_DATE` |
| `invoice_id` | UUID FK→invoices nullable | Set only on auto-income entries; those entries are immutable |
| `owner_id` | UUID FK→users | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### ERP Enums Summary

| Enum | Values |
|------|--------|
| `user_role_enum` | `ADMIN \| EMPLOYEE \| CLIENT \| LEAD` |
| `client_status_enum` | `ACTIVE \| INACTIVE \| CHURNED` |
| `project_status_enum` | `PLANNING \| ACTIVE \| ON_HOLD \| COMPLETED \| CANCELLED` |
| `task_status_enum` | `PENDING \| IN_PROGRESS \| COMPLETED \| DELAYED` |
| `contract_status_enum` | `DRAFT \| SENT \| SIGNED \| REJECTED` |
| `invoice_payment_status_enum` | `UNPAID \| PAID \| OVERDUE` |
| `expense_type_enum` | `INCOME \| EXPENSE` |
| `notification_type_enum` | (original values) + `CONTRACT_SENT \| CONTRACT_SIGNED \| CONTRACT_REJECTED \| INVOICE_CREATED \| INVOICE_OVERDUE \| LEAD_ASSIGNED \| LEAD_PROMOTED \| TASK_ASSIGNED \| TASK_DELAYED` |

### Migration Order

All ERP migrations live in `handla-backend/src/database/migrations/`. Run in this order:

1. `*-ExpandUserRoles` — adds `EMPLOYEE`, `LEAD` to `user_role_enum`
2. `*-AddAssignedEmployeeToConversations` — adds `assigned_employee_id` column to `conversations`
3. `*-CreateClientsTable` — `clients` + `client_status_enum`
4. `*-CreateProjectsTable` — `projects` + `project_status_enum`
5. `*-CreateTasksTable` — `tasks` + `task_status_enum`
6. `*-CreateContractsTable` — `contracts` + `contract_status_enum`
7. `*-CreateInvoicesTable` — `invoices`, `invoice_line_items` + `invoice_payment_status_enum`
8. `*-CreateExpensesTable` — `expenses` + `expense_type_enum`
9. `*-ExpandNotificationTypes` — adds 9 new values to `notification_type_enum`
