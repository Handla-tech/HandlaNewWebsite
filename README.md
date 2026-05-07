# Handla 🚀

> **Software Services Marketing Platform** — A production-ready full-stack application with real-time chat, AWS S3 file uploads, bilingual support (EN/AR), and a stunning glassmorphism + glowing neon design.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-10-red?style=flat-square&logo=nestjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Socket.io](https://img.shields.io/badge/Socket.io-4-black?style=flat-square&logo=socket.io)
![AWS S3](https://img.shields.io/badge/AWS-S3-orange?style=flat-square&logo=amazon-aws)
![Docker](https://img.shields.io/badge/Docker-Compose-blue?style=flat-square&logo=docker)

---

## ✨ Features

- **Landing Page** — Modern glassmorphism + glowing neon design with Framer Motion animations
- **Bilingual** — Full English (LTR) and Arabic (RTL) support via next-i18next
- **Dark / Light Theme** — Smooth theme toggle with CSS variables
- **Real-Time Chat** — WebSocket-powered instant messaging between clients and admin
- **File Sharing** — Direct S3 uploads via presigned URLs in chat
- **In-App Notifications** — Real-time notification center with unread badge
- **Email Notifications** — Async email queue via Bull + Nodemailer/SES
- **Admin Dashboard** — Conversation management, testimonial CRUD, notification history
- **Client Dashboard** — View conversation, send messages, upload files
- **JWT Auth** — Secure httpOnly cookie-based authentication with refresh tokens
- **Role-Based Access** — CLIENT and ADMIN roles with route guards

---

## 🏗️ Tech Stack

### Frontend (`handla-frontend/`)
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS v3 + custom glassmorphism utilities |
| Animations | Framer Motion v11 |
| Real-Time | Socket.io-client |
| State | Zustand + TanStack Query |
| Forms | React Hook Form + Zod |
| HTTP | Axios with JWT interceptors |
| i18n | next-i18next (EN/AR) |
| Icons | Lucide React |
| Font | Space Grotesk (Google Fonts) |

### Backend (`handla-backend/`)
| Layer | Technology |
|-------|-----------|
| Framework | NestJS 10 (TypeScript) |
| Database | PostgreSQL 16 + TypeORM |
| Real-Time | Socket.io via @nestjs/websockets |
| Auth | JWT + httpOnly cookies + Passport |
| File Storage | AWS S3 (presigned URLs) |
| Email | Nodemailer / AWS SES + Bull queue |
| Validation | class-validator + class-transformer |
| Security | Helmet, CORS, rate limiting |
| Logging | Winston |
| Testing | Jest + supertest |

---

## 📁 Project Structure

```
handla/
├── handla-frontend/          # Next.js 14 frontend
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   ├── components/       # UI components (landing, chat, notifications)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Axios, Socket.io, S3 uploader, i18n
│   │   ├── store/            # Zustand stores
│   │   ├── types/            # TypeScript interfaces
│   │   └── styles/           # Global CSS + glassmorphism utilities
│   ├── public/
│   │   └── locales/          # EN + AR translation files
│   └── .env.local.example
│
├── handla-backend/           # NestJS 10 backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # JWT auth (signup, signin, refresh, logout)
│   │   │   ├── chat/         # WebSocket gateway + REST endpoints
│   │   │   ├── notifications/ # In-app notifications
│   │   │   ├── testimonials/ # CRUD (admin only)
│   │   │   ├── aws/          # S3 presigned URLs
│   │   │   └── email/        # Nodemailer + Bull queue
│   │   ├── common/           # Guards, interceptors, filters, decorators
│   │   ├── config/           # DB, JWT, AWS, email, socket configs
│   │   └── utils/            # Logger, custom exceptions
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── package.json              # Root workspace config
├── .gitignore
├── MASTER_PROMPT.md          # Full project specification
└── TODOS.md                  # Task tracker
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** + **Docker Compose** (for PostgreSQL)
- **AWS Account** (for S3 + optional SES)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Handla-tech/HandlaNewWebsite.git
cd HandlaNewWebsite
```

---

### 2. Backend Setup

```bash
cd handla-backend

# Copy environment file
cp .env.example .env

# Edit .env with your values (DB, JWT secret, AWS keys, mail config)
nano .env

# Start PostgreSQL via Docker
docker-compose up -d postgres

# Install dependencies
npm install

# Run database migrations
npm run migration:run

# (Optional) Seed database with admin user + sample data
npm run seed

# Start development server
npm run start:dev
# Backend available at: http://localhost:3001
```

---

### 3. Frontend Setup

```bash
cd handla-frontend

# Copy environment file
cp .env.local.example .env.local

# Edit .env.local if needed
nano .env.local

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend available at: http://localhost:3000
```

---

### 4. Run Both Together (from root)

```bash
# Install root dev dependencies
npm install

# Start both frontend and backend concurrently
npm run dev
```

---

### 5. Full Docker Stack

```bash
cd handla-backend

# Start all services (PostgreSQL + API)
docker-compose up -d

# Check logs
docker-compose logs -f api
```

---

## 🔐 Environment Variables

### Backend (`handla-backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_HOST` | PostgreSQL host | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_NAME` | Database name | `handla_db` |
| `DATABASE_USER` | DB username | `handla` |
| `DATABASE_PASSWORD` | DB password | `your_password` |
| `JWT_SECRET` | JWT signing secret | `your_super_secret_key` |
| `JWT_EXPIRATION` | Access token TTL (seconds) | `900` |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL (seconds) | `604800` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | `your_secret` |
| `AWS_S3_BUCKET` | S3 bucket name | `handla-uploads` |
| `MAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USER` | SMTP username | `you@gmail.com` |
| `MAIL_PASS` | SMTP password / app password | `your_app_password` |
| `MAIL_FROM` | Sender email | `no-reply@handla.com` |
| `SOCKET_CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:3000` |
| `NODE_ENV` | Environment | `development` |
| `PORT` | API server port | `3001` |

### Frontend (`handla-frontend/.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io server URL | `http://localhost:3001` |
| `NEXT_PUBLIC_AWS_REGION` | AWS region (for S3) | `us-east-1` |

---

## 📡 API Overview

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/signin` | Login, returns httpOnly cookie |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout, clears cookie |
| GET | `/api/auth/me` | Get current user |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/conversations/:id` | Get conversation + messages |
| POST | `/api/chat/presigned-url` | Get S3 upload URL |
| PATCH | `/api/chat/messages/:id/read` | Mark message as read |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| DELETE | `/api/notifications/:id` | Delete notification |

### Testimonials
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/testimonials` | List all (public) |
| GET | `/api/testimonials/:id` | Get single (public) |
| POST | `/api/testimonials` | Create (admin only) |
| PATCH | `/api/testimonials/:id` | Update (admin only) |
| DELETE | `/api/testimonials/:id` | Delete (admin only) |

---

## ⚡ Real-Time Events (Socket.io)

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `sendMessage` | `{ conversationId, content, fileUrl? }` | Send a message |
| `markAsRead` | `{ messageId }` | Mark message read |
| `typing` | `{ conversationId, isTyping }` | Typing indicator |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `messageReceived` | `{ message, conversationId }` | New message |
| `notificationNew` | `{ notification }` | New notification |
| `userTyping` | `{ userId, conversationId, isTyping }` | Typing status |
| `conversationUpdated` | `{ conversation }` | Conversation changed |

---

## 🎨 Design System

The platform uses a **glassmorphism + glowing neon** design language:

- **Font**: Space Grotesk (Google Fonts)
- **Glass effect**: `backdrop-filter: blur(12px)` + semi-transparent backgrounds
- **Glow**: Neon box-shadows with electric blue, violet, and cyan accents
- **Grid background**: Subtle grid utility for depth
- **Dark-first**: Rich dark mode with full light mode support
- **Animations**: Framer Motion with spring/ease transitions
- **Responsive**: Mobile-first, 375px → 1280px+

---

## 🧪 Testing

```bash
# Backend unit + integration tests
npm run test:backend

# Frontend component tests
npm run test:frontend

# All tests
npm run test
```

---

## 🐳 Docker

```bash
# Start full stack
cd handla-backend && docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (wipes DB)
docker-compose down -v
```

---

## 📋 Development Progress

See [TODOS.md](./TODOS.md) for the full 20-phase task tracker.

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Repository & Project Setup | ✅ Done |
| 1 | Backend NestJS Foundation | ⏳ Pending |
| 2 | Database Entities & Migrations | ⏳ Pending |
| 3 | Auth Module | ⏳ Pending |
| 4 | Chat Module | ⏳ Pending |
| 5 | Notification Module | ⏳ Pending |
| 6 | Testimonial Module | ⏳ Pending |
| 7 | AWS & Email Modules | ⏳ Pending |
| 8 | Docker & Security | ⏳ Pending |
| 9 | Frontend Foundation | ⏳ Pending |
| 10 | Landing Page Components | ⏳ Pending |
| 11 | Authentication Page | ⏳ Pending |
| 12 | Chat Components | ⏳ Pending |
| 13 | Notification Components | ⏳ Pending |
| 14 | Client Dashboard | ⏳ Pending |
| 15 | Admin Dashboard | ⏳ Pending |
| 16 | Real-Time Integration | ⏳ Pending |
| 17 | i18n & Accessibility | ⏳ Pending |
| 18 | Responsive Design | ⏳ Pending |
| 19 | Integration Testing | ⏳ Pending |
| 20 | Polish & Production | ⏳ Pending |

---

## 🤝 Contributing

1. Create a feature branch from `main`
2. Follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
3. All changes go through `genspark_ai_developer` → `main` PR
4. Ensure tests pass before merging

---

## 📄 License

MIT © Handla Tech
