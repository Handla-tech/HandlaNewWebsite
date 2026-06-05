# Handla

> **Software Services Marketing Platform** — Production-ready full-stack application with real-time chat, AWS S3 file uploads, bilingual support (EN/AR), and a dark glassmorphism design.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-10-red?style=flat-square&logo=nestjs)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue?style=flat-square&logo=mysql)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Socket.io](https://img.shields.io/badge/Socket.io-4-black?style=flat-square&logo=socket.io)
![AWS S3](https://img.shields.io/badge/AWS-S3-orange?style=flat-square&logo=amazon-aws)
![Docker](https://img.shields.io/badge/Docker-Compose-blue?style=flat-square&logo=docker)

---

## Features

- **Landing page** — Animated ERP-focused marketing page (hero, KPIs, services, solutions, process, testimonials, contact)
- **Bilingual** — Full English (LTR) and Arabic (RTL) with live locale toggle
- **Real-time chat** — WebSocket-powered messaging between clients and the Handla team
- **File sharing** — Direct-to-S3 uploads via presigned URLs inside chat
- **In-app notifications** — Real-time notification centre with unread badge
- **Email notifications** — Async email queue via Bull + Nodemailer
- **Admin dashboard** — Conversation management and testimonial CRUD
- **Client dashboard** — Personal chat view
- **JWT auth** — Secure httpOnly cookie-based authentication with transparent refresh
- **Offline banner** — Detects network loss and reconnection
- **SEO** — Metadata, sitemap.xml, robots.txt, JSON-LD structured data

---

## Tech Stack

### Frontend (`handla-frontend/`)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS v3 + custom tokens |
| Animations | Framer Motion v11 |
| Real-Time | Socket.io-client 4 |
| State | Zustand + TanStack Query |
| Forms | React Hook Form + Zod |
| HTTP | Axios with 401→refresh interceptor |
| i18n | Custom `useTranslation` hook + JSON locale files |
| Icons | Lucide React |
| Font | Space Grotesk (Google Fonts) |

### Backend (`handla-backend/`)

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 10 (TypeScript) |
| Database | PostgreSQL 16 + TypeORM |
| Real-Time | Socket.io via @nestjs/websockets |
| Auth | JWT + httpOnly cookies + Passport |
| File Storage | AWS S3 (presigned PUT URLs) |
| Email | Nodemailer + Bull queue (Redis) |
| Validation | class-validator + class-transformer |
| Security | Helmet, CORS, rate limiting (ThrottlerModule) |
| Logging | Winston (nest-winston) |
| Docs | Swagger UI at `/api/docs` (dev only) |
| Testing | Jest — 83 unit tests |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20 LTS
- Docker & Docker Compose
- AWS account (for S3 — optional for local chat testing without file uploads)

### 1. Clone

```bash
git clone https://github.com/Handla-tech/HandlaNewWebsite.git
cd HandlaNewWebsite
```

### 2. Start infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d mysql redis
```

### 3. Backend

```bash
cd handla-backend
cp .env.example .env        # fill in JWT secrets, DB password
npm install
npm run migration:run       # create tables
npm run seed                # admin + sample client + 6 testimonials
npm run start:dev           # http://localhost:3001
                            # Swagger: http://localhost:3001/api/docs
```

**Default seed credentials:**

| Email | Password | Role |
|-------|---------|------|
| `admin@handla.com` | `Admin@123456` | ADMIN |
| `employee@handla.com` | `Employee@123456` | EMPLOYEE |
| `client@example.com` | `Client@123456` | CLIENT |
| `lead@example.com` | `Lead@123456` | LEAD |

### 4. Frontend

```bash
cd handla-frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

---

## Environment Variables

### Backend (`.env`)

```dotenv
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=handla
DB_PASSWORD=secret
DB_NAME=handla_db
JWT_SECRET=<32+ char random>
JWT_EXPIRY=15m
JWT_REFRESH_SECRET=<different 32+ char random>
JWT_REFRESH_EXPIRY=7d
REDIS_HOST=localhost
REDIS_PORT=6379
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=handla-uploads
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@handla.tech
SOCKET_CORS_ORIGIN=http://localhost:3000
```

### Frontend (`.env.local`)

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Docker (Production)

```bash
docker compose up --build -d
docker compose logs -f api
docker compose exec api npm run migration:run
```

---

## API Reference

See **`http://localhost:3001/api/docs`** (Swagger UI) in development.

Quick reference:

| Prefix | Endpoints |
|--------|----------|
| `/api/auth` | signup, signin, refresh, logout, me |
| `/api/chat` | conversations CRUD, presigned-url, status, read |
| `/api/notifications` | list, count, mark-read, delete |
| `/api/testimonials` | public list/get + admin CRUD |
| `/api/health` | health check (used by Docker) |

---

## Project Documentation

| File | Purpose |
|------|---------|
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Deep technical reference — architecture, auth flow, Socket events, state management, design system |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Git workflow, commit conventions, PR process, code standards |
| [`TODOS.md`](./TODOS.md) | 20-phase task tracker (all phases ✅ complete) |

---

## Development Progress

All 20 phases complete ✅

| Phase | Area | Status |
|-------|------|--------|
| 0 | Repo & Setup | ✅ |
| 1–8 | Backend (foundation → Docker) | ✅ |
| 9–18 | Frontend (foundation → responsive) | ✅ |
| 19 | Integration Tests | ✅ |
| 20 | Polish & Production Readiness | ✅ |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

---

## License

MIT © Handla Tech
