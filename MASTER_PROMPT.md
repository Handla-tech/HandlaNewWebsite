# HANDLA: Full-Stack Production Master Prompt
## Next.js Frontend + NestJS Backend with Real-Time Chat, AWS S3, and Notifications

---

## PROJECT OVERVIEW

Build a production-ready **Software Services Marketing Platform** called **"Handla"** with a stunning marketing landing page, real-time client communication system, and admin dashboard. The platform enables clients to inquire about custom web solutions, ERP/CRM systems, mobile apps, and hosting services through real-time chat with file sharing capabilities.

### Core Value Proposition:
- **Clients**: Browse solutions, view testimonials, engage in real-time chat with company, upload project files
- **Admin**: Manage conversations, respond in real-time, track notifications, manage testimonials
- **Features**: Bilingual support (EN/AR), Dark/Light themes, Real-time WebSocket chat, AWS S3 file uploads, Email + In-app notifications, PostgreSQL persistence

### Design System:
> ⚡ **This is a modern website with glassmorphism and glowing theme.**
> - Glass-morphism effects on cards, panels, and overlays
> - Glowing neon accent colors (electric blue, violet, cyan)
> - Dark-first design with rich gradients
> - Frosted glass backgrounds with `backdrop-filter: blur()`
> - Glowing border effects and box shadows
> - Grid background utility for depth
> - Smooth Framer Motion animations throughout

---

## TECHNOLOGY STACK

### Frontend (Next.js 14+)
| Tech | Purpose |
|------|---------|
| Next.js 14 | Framework with App Router |
| shadcn/ui | UI component library |
| Tailwind CSS v3 | Styling with custom config |
| Framer Motion v11 | Animations |
| React Hook Form + Zod | Form management & validation |
| Socket.io-client | Real-time WebSocket |
| TanStack Query | Server state management |
| Zustand | Client state management |
| Axios | HTTP client with JWT interceptors |
| Lucide React | Icons |
| Google Fonts "Space Grotesk" | Typography (400, 500, 600, 700) |
| next-i18next | i18n (EN LTR / AR RTL) |
| AWS SDK v3 | S3 presigned URL generation |

### Backend (NestJS 10+)
| Tech | Purpose |
|------|---------|
| NestJS | Framework with TypeScript |
| PostgreSQL + TypeORM | Database & ORM |
| Socket.io | Real-time via @nestjs/websockets |
| JWT + HttpOnly Cookies | Authentication |
| class-validator | Input validation |
| AWS SDK v3 | S3 integration & presigned URLs |
| Nodemailer / AWS SES | Email service |
| Bull | Job queue for async processing |
| Helmet | Security headers |
| Winston | Logging |
| Jest + supertest | Testing |
| Docker | Containerization |

---

## ARCHITECTURE & DATA FLOW

### Entity Relationship Diagram

```
User (id, email, password_hash, name, role: ADMIN|CLIENT, created_at)
├─ has_many: Conversation
├─ has_many: Message (as sender)
├─ has_many: Notification (for user)
└─ has_many: Testimonial (if admin)

Conversation (id, admin_id, client_id, status: ACTIVE|ON_HOLD|COMPLETED, created_at)
└─ has_many: Message

Message (id, conversation_id, sender_id, content, file_url, is_read, created_at)

Notification (id, user_id, type: MESSAGE|SYSTEM, title, message, related_message_id, is_read, created_at)

Testimonial (id, client_name, client_company, content, image_url, rating, created_by_admin_id, created_at)
```

### Authentication Flow
1. Client signs up/logs in via Next.js auth form
2. Backend validates credentials and issues JWT token
3. Token stored in **httpOnly cookie** (secure, not accessible from JavaScript)
4. Frontend sends cookie automatically with each request
5. NestJS verifies token via JwtGuard middleware
6. Refresh token endpoint to maintain session without re-login

### Real-Time Chat Flow
1. Authenticated client emits `sendMessage` event via Socket.io
2. NestJS receives via ChatGateway, validates, saves to DB
3. Message saved with `is_read: false`
4. Notification created for admin
5. Admin notified via email (queued job) and WebSocket event
6. Message broadcast to both client and admin via WebSocket
7. Admin can respond; response saved and client notified similarly
8. Full conversation history persists and loads on login

### File Upload Flow (Presigned URLs)
1. Client selects file in chat interface
2. Frontend requests presigned S3 URL from NestJS (`GET /api/chat/presigned-url`)
3. Backend generates presigned URL (valid 15 minutes) and returns to frontend
4. Frontend uploads directly to S3 using presigned URL
5. On successful upload, frontend sends message with S3 file URL
6. Message with file reference stored in DB
7. Admin sees file link in conversation and can download

### Notification Flow
- **In-App**: Notification record created in DB, WebSocket event emitted to user
- **Email**: Bull job queued for async processing, sent via Nodemailer/SES
- **Admin Dashboard**: Shows notification badge with count, full notification center

---

## FRONTEND SPECIFICATIONS (Next.js)

### Project Structure
```
handla-frontend/
├── public/
│   └── images/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Landing page
│   │   ├── auth/
│   │   │   └── page.tsx        # Auth page (signin/signup)
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # Client dashboard
│   │   │   └── layout.tsx      # Dashboard layout
│   │   └── admin/
│   │       ├── page.tsx        # Admin panel
│   │       ├── testimonials/
│   │       │   └── page.tsx
│   │       └── layout.tsx
│   ├── components/
│   │   ├── landing/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── AnimatedHeadline.tsx
│   │   │   ├── TrustStrip.tsx
│   │   │   ├── About.tsx
│   │   │   ├── ServicesBento.tsx
│   │   │   ├── Solutions.tsx
│   │   │   ├── Process.tsx
│   │   │   ├── Contact.tsx
│   │   │   └── Footer.tsx
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── BlurredChatPreview.tsx
│   │   │   └── FileUploadButton.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationCenter.tsx
│   │   │   └── NotificationBell.tsx
│   │   └── ui/
│   │       └── [shadcn components]
│   ├── lib/
│   │   ├── socket.ts           # Socket.io client configuration
│   │   ├── api.ts              # Axios instance with JWT handling
│   │   ├── s3-uploader.ts      # S3 presigned URL & upload logic
│   │   ├── i18n.ts             # i18n configuration
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useChat.ts
│   │   ├── useSocket.ts
│   │   └── useNotifications.ts
│   ├── store/
│   │   ├── authStore.ts        # Zustand for auth state
│   │   ├── chatStore.ts
│   │   ├── notificationStore.ts
│   │   └── uiStore.ts          # Theme, language, etc.
│   ├── types/
│   │   └── index.ts            # All TypeScript interfaces
│   ├── styles/
│   │   └── globals.css
│   └── middleware.ts           # NextAuth/JWT verification
├── .env.local
├── next.config.js
├── tailwind.config.ts
└── package.json
```

### Key Features

#### Landing Page (Glassmorphism + Glowing Theme)
- All sections: Hero, Trust Strip, About, Services Bento, Solutions, Process, Contact, Footer
- Bilingual support (EN/AR) with RTL/LTR toggle
- Dark/Light theme toggle with smooth transitions
- Framer Motion animations throughout
- Contact section with blurred chat preview for non-authenticated users
- Glassmorphism cards with glowing border effects

#### Authentication Page
- Login and Signup modes with form validation (Zod)
- Email and password fields
- Social login buttons (Google, GitHub, LinkedIn) — UI only
- Real-time validation feedback
- RTL support

#### Client Dashboard
- Active conversation with admin
- Full message history with timestamps
- File upload button with S3 integration
- Real-time message updates via Socket.io
- Typing indicator when admin is responding
- Mark conversation as complete option

#### Admin Dashboard
- List of all client conversations with preview
- Unread message count badge
- Real-time notification bell with dropdown
- Click to view full conversation
- Message reply form with file upload
- Testimonial management (CRUD)
- Notification history

#### Real-Time Chat Component
- Messages from both sender (right) and recipient (left)
- Message timestamps
- Delivery status indicator (sent, delivered, read)
- Typing indicator animation
- File attachments displayed as downloadable links
- Auto-scroll to latest message
- Read receipt: messages marked as read when admin views

#### File Upload in Chat
1. Click upload button → request presigned URL from backend
2. Browser file picker
3. Upload directly to S3 (frontend-to-S3)
4. Show upload progress
5. File link in message
6. Handle upload errors gracefully

### Global State Management

#### Zustand Stores
```typescript
// authStore: { user, token, isLoggedIn, login(), logout(), refresh() }
// chatStore: { conversation, messages, isLoading, sendMessage(), loadHistory() }
// notificationStore: { notifications, unreadCount, addNotification(), markAsRead() }
// uiStore: { theme, language, sidebarOpen, toggleTheme(), setLanguage() }
```

#### Socket.io Events
```typescript
// Client emits:
- "sendMessage"  → { conversationId, content, fileUrl? }
- "markAsRead"   → { conversationId }
- "typing"       → { conversationId, isTyping }

// Client listens:
- "messageReceived"  → { message }
- "notification"     → { notification }
- "userTyping"       → { userId, isTyping }
- "userOnline"       → { userId }
```

### Design System (Glassmorphism + Glow)
- **Font**: Space Grotesk throughout
- **Color tokens**: CSS variables in light/dark modes
- **Glass-morphism**: `backdrop-filter: blur()`, semi-transparent backgrounds
- **Glow effects**: Box shadows with neon color accents (electric blue, violet, cyan)
- **Grid background**: Utility class for depth/texture
- **Animations**: Framer Motion with spring/ease transitions
- **Responsive**: Mobile-first (375px → 1280px+)
- **Accessibility**: ARIA labels and semantic HTML

### Key Routes
| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/auth` | Public | Login/Signup |
| `/dashboard` | CLIENT role | Client dashboard |
| `/admin` | ADMIN role | Admin panel |
| `/admin/testimonials` | ADMIN role | Testimonial management |

### Environment Variables (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_AWS_REGION=us-east-1
```

---

## BACKEND SPECIFICATIONS (NestJS)

### Project Structure
```
handla-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── user.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── socket.guard.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── aws.config.ts
│   │   ├── email.config.ts
│   │   └── socket.config.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── notifications/
│   │   ├── testimonials/
│   │   ├── aws/
│   │   └── email/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── utils/
│       ├── logger.ts
│       └── exceptions.ts
├── test/
├── .env
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── ormconfig.json
└── package.json
```

### Core Modules

#### 1. Auth Module
**Endpoints:**
```
POST /api/auth/signup    → Create user account
POST /api/auth/signin    → Login, return JWT in httpOnly cookie
POST /api/auth/refresh   → Refresh expired token
POST /api/auth/logout    → Revoke token
GET  /api/auth/me        → Get current user (authenticated)
```
**Features:**
- Password hashing with bcrypt (rounds: 10)
- Email validation (unique constraint)
- JWT in httpOnly, Secure, SameSite cookies
- Access token: 15 min expiry | Refresh token: 7 days
- Rate limiting: max 5 login attempts per 15 min per IP

#### 2. Chat Module
**REST Endpoints:**
```
GET   /api/chat/conversations              → Admin: all, Client: own
GET   /api/chat/conversations/:id          → Conversation + messages
POST  /api/chat/presigned-url             → Generate S3 presigned URL
PATCH /api/chat/messages/:id/read         → Mark as read
```

**WebSocket Events (Client Emits → Server):**
```
sendMessage  → { conversationId, content, fileUrl? }
markAsRead   → { messageId }
typing       → { conversationId, isTyping: boolean }
```

**WebSocket Events (Server Broadcasts):**
```
messageReceived      → { message, conversationId }
notificationNew      → { notification }
userTyping           → { userId, conversationId, isTyping }
conversationUpdated  → { conversation }
```

**Business Logic:**
- Auto-create conversation on first message if doesn't exist
- Validate sender is part of conversation
- Save message to DB before broadcasting
- Mark previous messages as read when user views conversation
- Trigger notification creation and email job queue

#### 3. Notification Module
**Endpoints:**
```
GET    /api/notifications                    → Paginated notifications
PATCH  /api/notifications/:id/read          → Mark as read
DELETE /api/notifications/:id               → Delete
```
**Entity:** `id, userId, type (MESSAGE|SYSTEM), title, message, relatedMessageId, isRead, createdAt`

#### 4. Testimonial Module
**Endpoints:**
```
GET    /api/testimonials       → Public: all, Admin: with filters
GET    /api/testimonials/:id   → Public: single
POST   /api/testimonials       → Admin only: create
PATCH  /api/testimonials/:id   → Admin only: update
DELETE /api/testimonials/:id   → Admin only: delete
```
**Validation:** clientName (2-100 chars), content (10-1000 chars), rating (1-5 integer), imageUrl (valid URL)

#### 5. AWS Service Module
**Methods:**
- `generatePresignedUrl(bucket, key, expiresIn)` — Presigned URL for frontend upload
- `uploadFile(buffer, bucket, key, contentType)` — Server-side fallback upload
- `deleteFile(bucket, key)` — Remove file from S3
- `sendEmail(to, subject, htmlContent, templateData)` — Queue email job

**Security:** 15-minute presigned URL expiration, JWT required to request, key-based access control

#### 6. Email Service Module
**Features:**
- Nodemailer with Gmail/AWS SES transport
- Handlebars templates
- Bull job queue for async processing
- Retry logic for failed emails
- Templates: new message notification, response notification

### Guards, Interceptors, Filters

| Component | Purpose |
|-----------|---------|
| JwtGuard | Extracts JWT from httpOnly cookie, validates, throws 401 |
| RolesGuard | Checks role against @Roles() decorator, throws 403 |
| SocketGuard | JWT verification for WebSocket connections |
| TransformInterceptor | Wraps all responses in `{ success, data, message, statusCode }` |
| HttpExceptionFilter | Formats exceptions with proper HTTP status codes |

### Database Configuration (TypeORM + PostgreSQL)
**Indexes:**
- User: unique on `email`
- Conversation: composite on `(adminId, clientId, status)`
- Message: on `conversationId, createdAt`
- Notification: on `userId, isRead, createdAt`

### Docker Configuration

**Dockerfile (Multi-stage):**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /build/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

**docker-compose.yml:**
```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: handla_db
      POSTGRES_USER: handla
      POSTGRES_PASSWORD: password_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: .
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    environment:
      DATABASE_HOST: postgres
      DATABASE_NAME: handla_db
      DATABASE_USER: handla
      DATABASE_PASSWORD: password_dev
      JWT_SECRET: dev_secret_key
      AWS_REGION: us-east-1
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      MAIL_HOST: smtp.gmail.com
      MAIL_USER: ${MAIL_USER}
      MAIL_PASS: ${MAIL_PASS}
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run start:dev

volumes:
  postgres_data:
```

### Environment Variables (.env)
```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=handla_db
DATABASE_USER=handla
DATABASE_PASSWORD=password_change_in_prod

# JWT
JWT_SECRET=your_super_secret_key_change_in_prod
JWT_EXPIRATION=900           # 15 minutes
JWT_REFRESH_EXPIRATION=604800  # 7 days

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=handla-uploads

# Email (Nodemailer)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
MAIL_FROM=no-reply@handla.com

# Socket.io
SOCKET_PORT=3001
SOCKET_CORS_ORIGIN=http://localhost:3000

# Application
NODE_ENV=development
PORT=3001
```

---

## API SPECIFICATION

### Authentication Endpoints
```
POST /api/auth/signup
  Body: { email, password, name }
  Response: { success: true, data: { user: { id, email, name, role } }, message: "User created" }
  Cookies: Set httpOnly token cookie

POST /api/auth/signin
  Body: { email, password }
  Response: { success: true, data: { user, token } }
  Cookies: Set httpOnly token cookie

POST /api/auth/refresh
  Auth: Required
  Response: { success: true, data: { token } }
  Cookies: Set new httpOnly token cookie

POST /api/auth/logout
  Auth: Required
  Response: { success: true, message: "Logged out" }
  Cookies: Clear token cookie

GET /api/auth/me
  Auth: Required
  Response: { success: true, data: { user } }
```

### Chat Endpoints
```
GET /api/chat/conversations
  Auth: Required
  Query: { page: 1, limit: 20 }
  Response: { success: true, data: { conversations: [...], total, page, pages } }

GET /api/chat/conversations/:conversationId
  Auth: Required
  Response: { success: true, data: { conversation, messages: [...] } }

POST /api/chat/presigned-url
  Auth: Required
  Body: { fileName, contentType, fileSize }
  Response: { success: true, data: { url, bucket, key, expiresIn } }

PATCH /api/chat/messages/:messageId/read
  Auth: Required
  Response: { success: true, data: { message } }
```

### Notification Endpoints
```
GET /api/notifications
  Auth: Required
  Query: { page: 1, limit: 20 }
  Response: { success: true, data: { notifications: [...], unreadCount } }

PATCH /api/notifications/:notificationId/read
  Auth: Required
  Response: { success: true, data: { notification } }

DELETE /api/notifications/:notificationId
  Auth: Required
  Response: { success: true, message: "Notification deleted" }
```

### Testimonial Endpoints
```
GET /api/testimonials
  Query: { page: 1, limit: 10 }
  Response: { success: true, data: { testimonials: [...], total, page, pages } }

GET /api/testimonials/:id
  Response: { success: true, data: { testimonial } }

POST /api/testimonials
  Auth: Required | Roles: ADMIN
  Body: { clientName, clientCompany, content, imageUrl, rating }
  Response: { success: true, data: { testimonial } }

PATCH /api/testimonials/:id
  Auth: Required | Roles: ADMIN
  Body: { clientName?, clientCompany?, content?, imageUrl?, rating? }
  Response: { success: true, data: { testimonial } }

DELETE /api/testimonials/:id
  Auth: Required | Roles: ADMIN
  Response: { success: true, message: "Testimonial deleted" }
```

---

## REAL-TIME CHAT FLOW (WebSocket)

### Conversation Lifecycle
1. Client logs in, connects to Socket.io gateway
2. Client joins conversation room: `socket.join('conversation:' + conversationId)`
3. First message creates conversation if doesn't exist
4. Both admin and client join same room
5. Messages broadcast to room
6. On disconnect, remove from room

### Gateway Event Handlers
```
sendMessage()
├── Validate JWT in socket handshake
├── Validate sender is in conversation
├── Save message to DB
├── Mark previous messages as read
├── Broadcast messageReceived to room
├── Create notification for recipient
└── Queue email job

markAsRead()
├── Update message.isRead = true
├── Broadcast messageRead to room
└── Update notification.isRead

typing()
├── Broadcast userTyping to room
└── Auto-emit typing:false after 3 seconds

handleConnection()
├── Verify JWT from cookie
├── Store socket.id -> user.id mapping
└── Load user's conversations

handleDisconnect()
├── Remove socket.id -> user.id mapping
└── Cleanup subscription rooms
```

---

## SECURITY CONSIDERATIONS

### Frontend
- JWT stored in httpOnly, Secure, SameSite cookies only (never localStorage)
- CORS configured to specific domain only
- Input validation with Zod before submission
- Rate limiting on file uploads (max 5MB per file, max 50MB per conversation)
- No sensitive data in localStorage

### Backend
- JWT verification on all protected routes and WebSocket connections
- Role-based access control (RBAC) with RolesGuard
- Input sanitization and validation with class-validator
- Password hashing with bcrypt (rounds: 10)
- Helmet middleware for security headers
- CORS restricted to frontend domain
- SQL injection prevention via TypeORM parameterized queries
- Rate limiting on auth endpoints (max 5 login attempts per 15 min per IP)
- Presigned URLs with 15-minute expiration
- No database credentials in code; use environment variables

---

## PERFORMANCE & OPTIMIZATION

### Frontend
- Lazy load components (dynamic imports)
- Image optimization with Next.js Image component
- Code splitting per route
- Memoization of expensive computations
- Virtual scrolling for large message lists
- Debounce WebSocket typing events

### Backend
- Database query optimization (indexes on foreign keys)
- Pagination for list endpoints (default 20 items per page)
- Caching for testimonials (Redis optional)
- Async job queue for emails (Bull)
- Connection pooling for database
- Gzip compression for responses

---

## TESTING STRATEGY

### Backend (NestJS)
- Unit tests for services (Jest)
- Integration tests for gateways and controllers
- Mock database for testing
- Test auth flow, message sending, notification creation
- Test error scenarios (invalid token, unauthorized role, etc.)

### Frontend (Next.js)
- Component tests with React Testing Library
- Integration tests for chat flow
- Mock Socket.io and API calls
- Test theme/language switching
- Test form validation

---

## MONITORING & LOGGING

### Backend
- Winston logger with file rotation
- Log all WebSocket events
- Log authentication attempts
- Monitor database query performance
- Alert on error rates > 1%
- Track message delivery latency

### Frontend
- Client-side error tracking (Sentry)
- Performance monitoring (Web Vitals)
- User session tracking (Google Analytics)

---

## DEPLOYMENT GUIDELINES

### Local Development
```bash
# Backend
docker-compose up -d
npm install
npm run start:dev

# Frontend
npm install
npm run dev

# Backend: http://localhost:3001
# Frontend: http://localhost:3000
```

### Production
1. Build Docker images for both services
2. Push to container registry (Docker Hub, AWS ECR)
3. Deploy to orchestration platform (ECS, K8s, Docker Swarm)
4. Configure environment variables securely (AWS Secrets Manager)
5. Set up reverse proxy (Nginx) with SSL termination
6. Configure CloudFront CDN for static assets
7. Enable database backups and point-in-time recovery
8. Set up monitoring and logging (CloudWatch, ELK)
9. Configure auto-scaling policies
10. Implement CI/CD pipeline (GitHub Actions)

---

## NOTES FOR DEVELOPERS

- **Start with Backend**: Build NestJS API and database schema first
- **Database Migrations**: Use TypeORM migrations; never use `synchronize: true` in production
- **Testing**: Write tests as you build; aim for 80%+ coverage on critical paths
- **Documentation**: Keep API documentation updated (Swagger recommended)
- **Git Workflow**: Use feature branches, require code review before merge
- **Security**: Never commit credentials; use environment variables
- **Performance**: Profile and optimize before deploying
- **Error Handling**: Log all errors; never expose sensitive data in error messages
- **Accessibility**: Test with screen readers; ensure keyboard navigation works
- **User Feedback**: Add success/error toasts, loading states, clear feedback for all actions
