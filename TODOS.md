# HANDLA — Project TODO Tracker
> Modern glassmorphism + glowing theme | Full-Stack Next.js + NestJS Platform
> Track every task below. Mark ✅ when done, 🔄 when in progress, ⏳ when pending.

---

## LEGEND
- ✅ Done & tested
- 🔄 In Progress
- ⏳ Pending
- 🚫 Blocked

---

## PHASE 0 — REPOSITORY & PROJECT SETUP

### 0.1 Monorepo Initialization
- [x] ✅ Initialize monorepo structure with root `package.json`
- [x] ✅ Create `handla-frontend/` directory
- [x] ✅ Create `handla-backend/` directory
- [x] ✅ Create root `.gitignore` covering Node, Next.js, NestJS, env files
- [x] ✅ Create root `README.md` with project overview and setup instructions
- [x] ✅ Initialize git with main branch and create `genspark_ai_developer` branch

### 0.2 Environment Files
- [x] ✅ Create `handla-backend/.env.example` with all required keys
- [x] ✅ Create `handla-frontend/.env.local.example` with all required keys
- [x] ✅ Document all environment variables in README

---

## PHASE 1 — BACKEND: NestJS Foundation

### 1.1 Project Initialization
- [ ] ⏳ Run `nest new handla-backend` with npm package manager
- [ ] ⏳ Install all dependencies:
  - `@nestjs/typeorm typeorm pg`
  - `@nestjs/jwt @nestjs/passport passport passport-jwt`
  - `@nestjs/websockets @nestjs/platform-socket.io socket.io`
  - `@nestjs/config`
  - `class-validator class-transformer`
  - `bcrypt`
  - `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
  - `nodemailer`
  - `bull @nestjs/bull`
  - `helmet`
  - `winston nest-winston`
  - `cookie-parser`
  - `handlebars`
- [ ] ⏳ Install dev dependencies:
  - `@types/bcrypt @types/nodemailer @types/cookie-parser @types/passport-jwt`
  - `@types/multer`

### 1.2 Configuration Layer
- [ ] ⏳ Create `src/config/database.config.ts` — TypeORM PostgreSQL config
- [ ] ⏳ Create `src/config/jwt.config.ts` — JWT secret, expiry settings
- [ ] ⏳ Create `src/config/aws.config.ts` — AWS region, credentials, S3 bucket
- [ ] ⏳ Create `src/config/email.config.ts` — SMTP/SES settings
- [ ] ⏳ Create `src/config/socket.config.ts` — CORS, namespace settings
- [ ] ⏳ Wire all configs into `AppModule` via `ConfigModule.forRoot()`

### 1.3 Common Layer (Guards, Interceptors, Filters)
- [ ] ⏳ Create `src/common/decorators/roles.decorator.ts`
- [ ] ⏳ Create `src/common/decorators/user.decorator.ts`
- [ ] ⏳ Create `src/common/guards/jwt.guard.ts` — httpOnly cookie extraction
- [ ] ⏳ Create `src/common/guards/roles.guard.ts` — RBAC enforcement
- [ ] ⏳ Create `src/common/guards/socket.guard.ts` — WebSocket JWT guard
- [ ] ⏳ Create `src/common/filters/http-exception.filter.ts`
- [ ] ⏳ Create `src/common/interceptors/transform.interceptor.ts` — standard response wrapping
- [ ] ⏳ Create `src/common/pipes/validation.pipe.ts`
- [ ] ⏳ Apply global interceptor, filter, and pipe in `main.ts`

### 1.4 Utilities
- [ ] ⏳ Create `src/utils/logger.ts` — Winston logger configuration
- [ ] ⏳ Create `src/utils/exceptions.ts` — custom exception classes

---

## PHASE 2 — BACKEND: Database Entities & Migrations

### 2.1 Entity Definitions
- [ ] ⏳ Create `User` entity — `id, email, password_hash, name, role (ADMIN|CLIENT), created_at`
- [ ] ⏳ Create `Conversation` entity — `id, admin_id (FK), client_id (FK), status (ACTIVE|ON_HOLD|COMPLETED), created_at, updated_at`
- [ ] ⏳ Create `Message` entity — `id, conversation_id (FK), sender_id (FK), content, file_url, is_read, created_at`
- [ ] ⏳ Create `Notification` entity — `id, user_id (FK), type (MESSAGE|SYSTEM), title, message, related_message_id, is_read, created_at`
- [ ] ⏳ Create `Testimonial` entity — `id, client_name, client_company, content, image_url, rating, created_by_admin_id (FK), created_at, updated_at`

### 2.2 Relationships & Indexes
- [ ] ⏳ Set up TypeORM relationships (OneToMany, ManyToOne) between all entities
- [ ] ⏳ Add unique index on `User.email`
- [ ] ⏳ Add composite index on `Conversation (admin_id, client_id, status)`
- [ ] ⏳ Add index on `Message (conversation_id, created_at)`
- [ ] ⏳ Add index on `Notification (user_id, is_read, created_at)`

### 2.3 Migrations & Seeders
- [ ] ⏳ Configure `ormconfig.json` / TypeORM data source for migrations
- [ ] ⏳ Generate initial migration for all 5 entities
- [ ] ⏳ Create seed script for admin user and sample testimonials
- [ ] ⏳ Test migrations run cleanly against PostgreSQL

---

## PHASE 3 — BACKEND: Auth Module

### 3.1 Auth Module Files
- [ ] ⏳ Create `auth.module.ts` — wire JwtModule, PassportModule, UserEntity
- [ ] ⏳ Create `entities/user.entity.ts`
- [ ] ⏳ Create `dto/signup.dto.ts` — email, password (min 8 chars), name
- [ ] ⏳ Create `dto/signin.dto.ts` — email, password
- [ ] ⏳ Create `strategies/jwt.strategy.ts` — extract JWT from httpOnly cookie

### 3.2 Auth Service
- [ ] ⏳ Implement `signup()` — hash password, check email uniqueness, create user
- [ ] ⏳ Implement `signin()` — validate credentials, issue JWT + refresh token
- [ ] ⏳ Implement `refresh()` — validate refresh token, issue new access token
- [ ] ⏳ Implement `logout()` — clear cookie
- [ ] ⏳ Implement `getMe()` — return current authenticated user
- [ ] ⏳ Add bcrypt password hashing (rounds: 10)

### 3.3 Auth Controller
- [ ] ⏳ `POST /api/auth/signup` — set httpOnly cookie on success
- [ ] ⏳ `POST /api/auth/signin` — set httpOnly cookie on success
- [ ] ⏳ `POST /api/auth/refresh` — refresh access token
- [ ] ⏳ `POST /api/auth/logout` — clear cookie
- [ ] ⏳ `GET /api/auth/me` — protected by JwtGuard

### 3.4 Auth Testing
- [ ] ⏳ Unit test: `AuthService` — signup, signin, duplicate email error
- [ ] ⏳ Unit test: `AuthService` — invalid credentials error
- [ ] ⏳ Integration test: `POST /api/auth/signup` returns 201 + cookie
- [ ] ⏳ Integration test: `POST /api/auth/signin` returns 200 + cookie
- [ ] ⏳ Integration test: `GET /api/auth/me` with invalid token returns 401

---

## PHASE 4 — BACKEND: Chat Module

### 4.1 Chat Entities & DTOs
- [ ] ⏳ Create `entities/conversation.entity.ts`
- [ ] ⏳ Create `entities/message.entity.ts`
- [ ] ⏳ Create `dto/send-message.dto.ts` — conversationId, content, fileUrl?
- [ ] ⏳ Create `dto/create-conversation.dto.ts`

### 4.2 Chat Service
- [ ] ⏳ Implement `getConversations(user)` — admin gets all, client gets own
- [ ] ⏳ Implement `getConversationById(id, user)` — with messages, auth check
- [ ] ⏳ Implement `createOrGetConversation(clientId, adminId)` — auto-create
- [ ] ⏳ Implement `saveMessage(conversationId, senderId, content, fileUrl?)` — persist to DB
- [ ] ⏳ Implement `markMessageAsRead(messageId, userId)` — update is_read
- [ ] ⏳ Implement `generatePresignedUrl(fileName, contentType)` — call AWS service
- [ ] ⏳ Implement pagination for conversations list

### 4.3 Chat Controller (REST)
- [ ] ⏳ `GET /api/chat/conversations` — paginated, role-aware
- [ ] ⏳ `GET /api/chat/conversations/:id` — with message history
- [ ] ⏳ `POST /api/chat/presigned-url` — returns S3 presigned URL
- [ ] ⏳ `PATCH /api/chat/messages/:id/read` — mark as read

### 4.4 Chat Gateway (WebSocket)
- [ ] ⏳ Create `chat.gateway.ts` with `@WebSocketGateway` decorator
- [ ] ⏳ Implement `afterInit()` — gateway initialization
- [ ] ⏳ Implement `handleConnection(client)` — verify JWT, store socket→user mapping, join rooms
- [ ] ⏳ Implement `handleDisconnect(client)` — cleanup socket→user mapping
- [ ] ⏳ Implement `handleSendMessage()` — validate, save, broadcast `messageReceived`
- [ ] ⏳ Implement `handleMarkAsRead()` — update DB, broadcast `messageRead`
- [ ] ⏳ Implement `handleTyping()` — broadcast `userTyping`, auto-clear after 3 seconds
- [ ] ⏳ Integrate SocketGuard for connection authentication
- [ ] ⏳ Trigger notification creation after message saved
- [ ] ⏳ Queue email job after message saved

### 4.5 Chat Testing
- [ ] ⏳ Unit test: `ChatService` — save message, get conversations
- [ ] ⏳ Unit test: `ChatService` — presigned URL generation
- [ ] ⏳ Integration test: WebSocket `sendMessage` event persists to DB
- [ ] ⏳ Integration test: Unauthorized socket connection rejected

---

## PHASE 5 — BACKEND: Notification Module

### 5.1 Notification Entity & DTO
- [ ] ⏳ Create `entities/notification.entity.ts`
- [ ] ⏳ Create `dto/notification.dto.ts`

### 5.2 Notification Service
- [ ] ⏳ Implement `createNotification(userId, type, title, message, relatedMessageId?)` 
- [ ] ⏳ Implement `getUserNotifications(userId, page, limit)` — paginated, ordered by `created_at DESC`
- [ ] ⏳ Implement `markAsRead(notificationId, userId)` — ownership check
- [ ] ⏳ Implement `deleteNotification(notificationId, userId)` — ownership check
- [ ] ⏳ Implement `getUnreadCount(userId)` — for badge display
- [ ] ⏳ Emit WebSocket `notificationNew` event after creation

### 5.3 Notification Controller
- [ ] ⏳ `GET /api/notifications` — paginated + unreadCount
- [ ] ⏳ `PATCH /api/notifications/:id/read`
- [ ] ⏳ `DELETE /api/notifications/:id`

### 5.4 Notification Testing
- [ ] ⏳ Unit test: notification created on new message
- [ ] ⏳ Unit test: unread count accurate after marking read

---

## PHASE 6 — BACKEND: Testimonial Module

### 6.1 Testimonial Entity & DTOs
- [ ] ⏳ Create `entities/testimonial.entity.ts`
- [ ] ⏳ Create `dto/create-testimonial.dto.ts` — with class-validator rules
- [ ] ⏳ Create `dto/update-testimonial.dto.ts` — all fields optional (PartialType)

### 6.2 Testimonial Service
- [ ] ⏳ Implement `create(dto, adminId)` — admin only
- [ ] ⏳ Implement `findAll(page, limit)` — public, paginated
- [ ] ⏳ Implement `findOne(id)` — public
- [ ] ⏳ Implement `update(id, dto, adminId)` — admin only
- [ ] ⏳ Implement `delete(id, adminId)` — admin only

### 6.3 Testimonial Controller
- [ ] ⏳ `GET /api/testimonials` — public, paginated
- [ ] ⏳ `GET /api/testimonials/:id` — public
- [ ] ⏳ `POST /api/testimonials` — ADMIN only
- [ ] ⏳ `PATCH /api/testimonials/:id` — ADMIN only
- [ ] ⏳ `DELETE /api/testimonials/:id` — ADMIN only

### 6.4 Testimonial Testing
- [ ] ⏳ Unit test: create testimonial (admin)
- [ ] ⏳ Unit test: public read testimonials
- [ ] ⏳ Integration test: non-admin create returns 403

---

## PHASE 7 — BACKEND: AWS & Email Modules

### 7.1 AWS Service
- [ ] ⏳ Create `aws.module.ts` and `aws.service.ts`
- [ ] ⏳ Implement `generatePresignedUrl()` — PutObject, 15-min expiry
- [ ] ⏳ Implement `deleteFile()` — DeleteObject from S3
- [ ] ⏳ Configure AWS SDK v3 with credentials from env
- [ ] ⏳ Export `AwsModule` for use in `ChatModule`

### 7.2 Email Service
- [ ] ⏳ Create `email.module.ts` and `email.service.ts`
- [ ] ⏳ Create Handlebars template: `message-notification.hbs`
- [ ] ⏳ Create Handlebars template: `response-notification.hbs`
- [ ] ⏳ Implement `sendMessageNotificationEmail()` — to admin when client messages
- [ ] ⏳ Implement `sendResponseNotificationEmail()` — to client when admin responds
- [ ] ⏳ Configure Bull queue for async email processing
- [ ] ⏳ Add retry logic (3 attempts) for failed emails

### 7.3 Testing
- [ ] ⏳ Unit test: AWS presigned URL generation (mocked)
- [ ] ⏳ Unit test: email queuing (mocked Bull)

---

## PHASE 8 — BACKEND: Docker & Infrastructure

### 8.1 Docker Setup
- [ ] ⏳ Create multi-stage `Dockerfile` (builder + runtime, node:20-alpine)
- [ ] ⏳ Create `docker-compose.yml` with `postgres` + `api` services
- [ ] ⏳ Create `.dockerignore` file
- [ ] ⏳ Create `.env.example` with all required variables documented
- [ ] ⏳ Test `docker-compose up` starts both services cleanly
- [ ] ⏳ Verify migrations auto-run on API container startup

### 8.2 Security Hardening
- [ ] ⏳ Add `helmet` middleware in `main.ts`
- [ ] ⏳ Add CORS configuration (frontend domain only)
- [ ] ⏳ Add rate limiting on auth endpoints (`throttler`)
- [ ] ⏳ Add global validation pipe with `whitelist: true, forbidNonWhitelisted: true`
- [ ] ⏳ Add `cookie-parser` middleware

---

## PHASE 9 — FRONTEND: Next.js Foundation

### 9.1 Project Initialization
- [ ] ⏳ Create Next.js 14 app with App Router and TypeScript
- [ ] ⏳ Install all dependencies:
  - `shadcn/ui` (init with new-york style)
  - `framer-motion`
  - `socket.io-client`
  - `@tanstack/react-query`
  - `zustand`
  - `axios`
  - `react-hook-form @hookform/resolvers zod`
  - `next-i18next react-i18next i18next`
  - `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
  - `lucide-react`
  - `clsx tailwind-merge`

### 9.2 Tailwind & Design System Configuration
- [ ] ⏳ Configure `tailwind.config.ts`:
  - Custom color palette (electric blue, violet, cyan glow colors)
  - Space Grotesk font family
  - Custom `backdrop-blur` utilities
  - Custom `box-shadow` glow utilities
  - Dark mode class strategy
- [ ] ⏳ Configure `globals.css`:
  - CSS custom properties (color tokens for light/dark)
  - Glassmorphism utility classes (`.glass`, `.glass-dark`)
  - Glow border utility classes
  - Grid background utility (`.bg-grid`)
  - Space Grotesk import from Google Fonts
  - Scrollbar styling
- [ ] ⏳ Configure `next.config.js`:
  - Image domains (AWS S3)
  - i18n routing
  - Environment variable exposure

### 9.3 TypeScript Types
- [ ] ⏳ Create `src/types/index.ts` with all interfaces:
  - `User`, `Conversation`, `Message`, `Notification`, `Testimonial`
  - `AuthState`, `ChatState`, `NotificationState`, `UIState`
  - `ApiResponse<T>`, `PaginatedResponse<T>`
  - Socket event payload types

### 9.4 Core Libraries
- [ ] ⏳ Create `src/lib/api.ts` — Axios instance with:
  - Base URL from env
  - `withCredentials: true` for cookie sending
  - Request interceptor for token refresh
  - Response interceptor for error handling
- [ ] ⏳ Create `src/lib/socket.ts` — Socket.io client:
  - Connect with credentials
  - Auto-reconnect config
  - Typed event emitters
- [ ] ⏳ Create `src/lib/s3-uploader.ts` — S3 upload logic:
  - Request presigned URL from backend
  - Upload file directly to S3
  - Report progress
  - Error handling
- [ ] ⏳ Create `src/lib/i18n.ts` — i18n configuration
- [ ] ⏳ Create `src/lib/utils.ts` — `cn()`, date formatters, helpers

### 9.5 Zustand Stores
- [ ] ⏳ Create `src/store/authStore.ts` — `{ user, isLoggedIn, login(), logout(), refresh() }`
- [ ] ⏳ Create `src/store/chatStore.ts` — `{ conversation, messages, sendMessage(), loadHistory() }`
- [ ] ⏳ Create `src/store/notificationStore.ts` — `{ notifications, unreadCount, addNotification(), markAsRead() }`
- [ ] ⏳ Create `src/store/uiStore.ts` — `{ theme, language, sidebarOpen, toggleTheme(), setLanguage() }`

### 9.6 Custom Hooks
- [ ] ⏳ Create `src/hooks/useAuth.ts` — auth state + actions
- [ ] ⏳ Create `src/hooks/useChat.ts` — chat state + send + history
- [ ] ⏳ Create `src/hooks/useSocket.ts` — socket connection lifecycle + events
- [ ] ⏳ Create `src/hooks/useNotifications.ts` — notification state + real-time updates

### 9.7 Providers & Layout
- [ ] ⏳ Create root `src/app/layout.tsx` with:
  - TanStack Query Provider
  - Theme Provider (dark/light)
  - i18n Provider
  - Font loading (Space Grotesk)
  - Auth initialization
- [ ] ⏳ Create `src/middleware.ts` — protect `/dashboard` and `/admin` routes

### 9.8 i18n Locale Files
- [ ] ⏳ Create `public/locales/en/common.json` — all English strings
- [ ] ⏳ Create `public/locales/ar/common.json` — all Arabic strings
- [ ] ⏳ Ensure RTL layout switching works when `ar` locale active

---

## PHASE 10 — FRONTEND: Landing Page Components

> All components use **glassmorphism + glowing theme** with Framer Motion animations

### 10.1 Navbar Component
- [ ] ⏳ Create `src/components/landing/Navbar.tsx`:
  - Logo "Handla" with glow effect
  - Navigation links with smooth scroll
  - CTA "Get Started" button with neon glow
  - Dark/Light theme toggle button
  - EN/AR language toggle
  - Mobile hamburger menu with slide-out drawer
  - Glassmorphism background on scroll (`backdrop-blur`)
  - Sticky positioning

### 10.2 Hero Section
- [ ] ⏳ Create `src/components/landing/Hero.tsx`:
  - Full-height hero section
  - Grid background utility
  - Animated headline with gradient text
  - Subtitle text
  - Two CTA buttons (primary glow, secondary outline)
  - Floating glassmorphism card(s) decorative element
  - Framer Motion entrance animations (fade-up, stagger)
  - Particle/glow orbs in background

### 10.3 Animated Headline
- [ ] ⏳ Create `src/components/landing/AnimatedHeadline.tsx`:
  - Typewriter or word-swap animation
  - Gradient text effect (blue → violet → cyan)
  - Framer Motion variants

### 10.4 Trust Strip
- [ ] ⏳ Create `src/components/landing/TrustStrip.tsx`:
  - Horizontal scrolling logos/badges strip
  - "Trusted by" label
  - Auto-scroll marquee animation
  - Glassmorphism container

### 10.5 About Section
- [ ] ⏳ Create `src/components/landing/About.tsx`:
  - Company description
  - Key stats (e.g., "50+ projects", "5 years", "30+ clients")
  - Glassmorphism stat cards with glow border
  - Scroll-triggered Framer Motion animations

### 10.6 Services Bento Grid
- [ ] ⏳ Create `src/components/landing/ServicesBento.tsx`:
  - Bento grid layout (asymmetric card grid)
  - Services: Custom Web Dev, ERP/CRM, Mobile Apps, Hosting
  - Each card: icon (Lucide), title, description, glow border
  - Hover: scale + increased glow effect
  - Framer Motion staggered entrance

### 10.7 Solutions Section
- [ ] ⏳ Create `src/components/landing/Solutions.tsx`:
  - Tabbed or accordion layout
  - Solutions: Startup, Enterprise, Government, SMB
  - Glassmorphism panel per solution
  - Animated transitions between tabs

### 10.8 Process Section
- [ ] ⏳ Create `src/components/landing/Process.tsx`:
  - Step-by-step process (Discovery → Design → Build → Launch)
  - Connected steps with glowing line/connector
  - Step cards with numbers, icons, descriptions
  - Scroll-triggered reveal animations

### 10.9 Testimonials Section
- [ ] ⏳ Create testimonials display in landing (fetched from API):
  - Carousel or grid of testimonial cards
  - Glassmorphism cards with star ratings
  - Client name, company, quote
  - Auto-play carousel with controls

### 10.10 Contact Section
- [ ] ⏳ Create `src/components/landing/Contact.tsx`:
  - For unauthenticated users: blurred chat preview + "Sign in to Chat" CTA
  - For authenticated users: live `ChatWindow` component embedded
  - Contact info (email, social links)
  - Glassmorphism container

### 10.11 Footer
- [ ] ⏳ Create `src/components/landing/Footer.tsx`:
  - Logo + tagline
  - Navigation links (grouped)
  - Social media icons (Lucide)
  - Language/theme toggles
  - Copyright notice
  - Subtle glow divider at top

### 10.12 Blurred Chat Preview
- [ ] ⏳ Create `src/components/chat/BlurredChatPreview.tsx`:
  - Mock chat bubbles with `blur` CSS filter
  - "Sign in to start chatting" overlay
  - CTA button linking to `/auth`
  - Glassmorphism styling

---

## PHASE 11 — FRONTEND: Authentication Page

### 11.1 Auth Page
- [ ] ⏳ Create `src/app/auth/page.tsx`:
  - Toggle between Sign In / Sign Up modes
  - Animated transition between forms (Framer Motion)
  - Centered glassmorphism card with glow border
  - Grid background

### 11.2 Sign In Form
- [ ] ⏳ Email field with validation
- [ ] ⏳ Password field with show/hide toggle
- [ ] ⏳ "Remember me" checkbox
- [ ] ⏳ Zod schema validation
- [ ] ⏳ Loading spinner on submit
- [ ] ⏳ Error toast on failure
- [ ] ⏳ Redirect to `/dashboard` on success (CLIENT) or `/admin` (ADMIN)

### 11.3 Sign Up Form
- [ ] ⏳ Name, email, password, confirm password fields
- [ ] ⏳ Password strength indicator
- [ ] ⏳ Zod schema with confirm password match
- [ ] ⏳ Loading state and error handling
- [ ] ⏳ Redirect to `/dashboard` on success

### 11.4 Social Login UI (UI only)
- [ ] ⏳ Google, GitHub, LinkedIn buttons (styled, not functional)
- [ ] ⏳ Divider "or continue with"

---

## PHASE 12 — FRONTEND: Chat Components

### 12.1 Chat Window
- [ ] ⏳ Create `src/components/chat/ChatWindow.tsx`:
  - Glassmorphism container
  - Header with conversation partner name, online status
  - Message list + input composited
  - Auto-scroll to latest message

### 12.2 Message List
- [ ] ⏳ Create `src/components/chat/MessageList.tsx`:
  - Right-aligned: sender's own messages (colored bubble)
  - Left-aligned: recipient's messages (glass bubble)
  - Timestamps formatted (relative: "2 min ago")
  - Delivery status icons (sent ✓, delivered ✓✓, read ✓✓ blue)
  - File attachment display (icon + filename + download link)
  - Typing indicator animation (bouncing dots)
  - Skeleton loading state

### 12.3 Message Input
- [ ] ⏳ Create `src/components/chat/MessageInput.tsx`:
  - Text input with glassmorphism styling
  - Send button with glow effect
  - Emit `typing` event on keystroke (debounced)
  - Stop typing after 3 seconds of inactivity
  - File upload button integrated
  - Disable send while uploading
  - Handle Enter key to send

### 12.4 File Upload Button
- [ ] ⏳ Create `src/components/chat/FileUploadButton.tsx`:
  - File input trigger (paperclip icon)
  - Request presigned URL from backend
  - Upload file directly to S3
  - Progress bar during upload
  - Show success/error state
  - Attach file URL to message on success
  - Max 5MB validation

---

## PHASE 13 — FRONTEND: Notification Components

### 13.1 Notification Bell
- [ ] ⏳ Create `src/components/notifications/NotificationBell.tsx`:
  - Bell icon (Lucide) with animated pulse
  - Unread count badge (glow effect)
  - Click to open NotificationCenter dropdown

### 13.2 Notification Center
- [ ] ⏳ Create `src/components/notifications/NotificationCenter.tsx`:
  - Glassmorphism dropdown panel
  - List of notifications (type icon, title, message, time)
  - "Mark all as read" button
  - Individual notification click → mark as read + navigate
  - Empty state design
  - Scrollable list (max-height with overflow)

---

## PHASE 14 — FRONTEND: Client Dashboard

### 14.1 Dashboard Layout
- [ ] ⏳ Create `src/app/dashboard/layout.tsx`:
  - Protected route (redirect if not CLIENT)
  - Sidebar navigation (glassmorphism)
  - Header with user avatar, NotificationBell, logout

### 14.2 Client Dashboard Page
- [ ] ⏳ Create `src/app/dashboard/page.tsx`:
  - Load or create conversation with admin
  - Render `ChatWindow` component
  - Show conversation status (ACTIVE/ON_HOLD/COMPLETED)
  - "Mark as Complete" button
  - Handle no-conversation empty state

---

## PHASE 15 — FRONTEND: Admin Dashboard

### 15.1 Admin Layout
- [ ] ⏳ Create `src/app/admin/layout.tsx`:
  - Protected route (redirect if not ADMIN)
  - Sidebar: Conversations, Notifications, Testimonials links
  - Header with NotificationBell (with real-time unread count)

### 15.2 Admin Main Page
- [ ] ⏳ Create `src/app/admin/page.tsx`:
  - List all client conversations
  - Each row: client name, last message preview, timestamp, unread badge
  - Click row → expand `ChatWindow` for that conversation
  - Conversation status filter (ACTIVE / ON_HOLD / COMPLETED)
  - Pagination

### 15.3 Admin Testimonials Page
- [ ] ⏳ Create `src/app/admin/testimonials/page.tsx`:
  - Table of all testimonials
  - Create testimonial form (modal/slide-over with glassmorphism)
  - Edit testimonial inline or in modal
  - Delete with confirmation dialog
  - Image URL preview
  - Star rating selector

---

## PHASE 16 — FRONTEND: Real-Time Integration

### 16.1 Socket Integration
- [ ] ⏳ Connect socket on auth, disconnect on logout
- [ ] ⏳ Join conversation room on chat open
- [ ] ⏳ Listen to `messageReceived` → append to chatStore
- [ ] ⏳ Listen to `notificationNew` → add to notificationStore + show toast
- [ ] ⏳ Listen to `userTyping` → show typing indicator
- [ ] ⏳ Listen to `userOnline` → update online status in UI
- [ ] ⏳ Emit `typing` event on keypress (debounced 500ms)
- [ ] ⏳ Emit `markAsRead` when conversation opened

### 16.2 TanStack Query Integration
- [ ] ⏳ Create query for `GET /api/chat/conversations`
- [ ] ⏳ Create query for `GET /api/chat/conversations/:id`
- [ ] ⏳ Create query for `GET /api/notifications`
- [ ] ⏳ Create query for `GET /api/testimonials`
- [ ] ⏳ Create mutation for `POST /api/testimonials`
- [ ] ⏳ Create mutation for `PATCH /api/testimonials/:id`
- [ ] ⏳ Create mutation for `DELETE /api/testimonials/:id`

---

## PHASE 17 — FRONTEND: i18n & Accessibility

### 17.1 Internationalization
- [ ] ⏳ Add all English strings to `public/locales/en/common.json`
- [ ] ⏳ Add all Arabic translations to `public/locales/ar/common.json`
- [ ] ⏳ Replace all hardcoded strings with `t('key')` throughout all components
- [ ] ⏳ Implement RTL layout switch when Arabic selected:
  - `dir="rtl"` on `<html>`
  - Tailwind RTL utilities (`rtl:` prefix)
  - Chat bubbles swap sides for RTL
- [ ] ⏳ Language toggle persists via `uiStore` and `localStorage`

### 17.2 Accessibility
- [ ] ⏳ Add ARIA labels to all interactive elements
- [ ] ⏳ Ensure keyboard navigation works (Tab, Enter, Escape)
- [ ] ⏳ Add `role` attributes to modal, dialog, status elements
- [ ] ⏳ Ensure color contrast meets WCAG AA in both themes
- [ ] ⏳ Add skip-to-content link in layout

---

## PHASE 18 — FRONTEND: Responsive Design

### 18.1 Breakpoints
- [ ] ⏳ 375px (mobile) — full test: navbar collapses, chat fills screen
- [ ] ⏳ 768px (tablet) — sidebar visible, bento grid 2 columns
- [ ] ⏳ 1024px (desktop) — full layout, 3-column bento, side-by-side dashboard
- [ ] ⏳ 1280px+ (large) — max-width container centered

### 18.2 Mobile-Specific
- [ ] ⏳ Hamburger menu with animated drawer
- [ ] ⏳ Chat window full-screen on mobile
- [ ] ⏳ Admin conversation list stacks vertically
- [ ] ⏳ Touch-friendly tap targets (min 44x44px)

---

## PHASE 19 — INTEGRATION TESTING

### 19.1 End-to-End Flow Tests
- [ ] ⏳ Client signup → auto-redirect to dashboard
- [ ] ⏳ Client sends message → admin receives in real-time
- [ ] ⏳ Admin replies → client receives in real-time
- [ ] ⏳ Client uploads file → appears in conversation for admin
- [ ] ⏳ Notification badge increments on new message
- [ ] ⏳ Marking notification as read decrements badge
- [ ] ⏳ Admin creates testimonial → appears on landing page
- [ ] ⏳ Language toggle switches all text to Arabic
- [ ] ⏳ Theme toggle switches dark/light correctly

### 19.2 Auth Flow Tests
- [ ] ⏳ Invalid email format blocked by Zod
- [ ] ⏳ Short password blocked by Zod
- [ ] ⏳ Wrong credentials → error toast
- [ ] ⏳ Expired JWT → auto-refresh or redirect to /auth
- [ ] ⏳ Unauthenticated user cannot access /dashboard or /admin

### 19.3 Security Tests
- [ ] ⏳ CLIENT cannot access /admin routes (403)
- [ ] ⏳ CLIENT cannot CRUD testimonials (403)
- [ ] ⏳ Presigned URL requires authentication
- [ ] ⏳ Socket connection rejected without valid JWT

---

## PHASE 20 — POLISH & PRODUCTION READINESS

### 20.1 Performance
- [ ] ⏳ Add `React.lazy` + `Suspense` for dashboard and admin pages
- [ ] ⏳ Add `loading.tsx` skeleton components per route
- [ ] ⏳ Add `error.tsx` error boundary per route
- [ ] ⏳ Optimize images with `next/image`
- [ ] ⏳ Verify Lighthouse score ≥ 90 (Performance, Accessibility, Best Practices)

### 20.2 Error Handling & UX
- [ ] ⏳ Global error toast system (shadcn `useToast`)
- [ ] ⏳ Loading skeletons for all async data
- [ ] ⏳ Empty states for: no conversations, no notifications, no testimonials
- [ ] ⏳ Offline detection and reconnect logic for WebSocket
- [ ] ⏳ Upload error handling with retry option

### 20.3 SEO & Meta
- [ ] ⏳ Add metadata in `layout.tsx` (title, description, OG tags)
- [ ] ⏳ Add `robots.txt` and `sitemap.xml`
- [ ] ⏳ Add structured data (JSON-LD) for services

### 20.4 Documentation
- [ ] ⏳ Update root `README.md` with full setup instructions
- [ ] ⏳ Add `CONTRIBUTING.md` with git workflow
- [ ] ⏳ Add Swagger/OpenAPI docs to backend (`@nestjs/swagger`)
- [ ] ⏳ Document all Socket.io events

---

## COMPLETION SUMMARY

| Phase | Area | Status |
|-------|------|--------|
| 0 | Repo & Setup | ✅ |
| 1 | Backend Foundation | ⏳ |
| 2 | Database Entities | ⏳ |
| 3 | Auth Module | ⏳ |
| 4 | Chat Module | ⏳ |
| 5 | Notification Module | ⏳ |
| 6 | Testimonial Module | ⏳ |
| 7 | AWS & Email | ⏳ |
| 8 | Docker & Security | ⏳ |
| 9 | Frontend Foundation | ⏳ |
| 10 | Landing Page | ⏳ |
| 11 | Auth Page | ⏳ |
| 12 | Chat Components | ⏳ |
| 13 | Notifications UI | ⏳ |
| 14 | Client Dashboard | ⏳ |
| 15 | Admin Dashboard | ⏳ |
| 16 | Real-Time Integration | ⏳ |
| 17 | i18n & A11y | ⏳ |
| 18 | Responsive Design | ⏳ |
| 19 | Integration Tests | ⏳ |
| 20 | Polish & Production | ⏳ |

---

> **Reminder**: Mark tasks ✅ immediately after completing and testing. Never skip a task — each phase builds on the previous one.
> **Design**: Every component must honor the glassmorphism + glowing neon theme (backdrop-blur, glow shadows, semi-transparent surfaces).
