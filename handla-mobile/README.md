# Handla Mobile

Staff-first, role-gated **React Native (Expo)** companion app for the Handla
platform. Reuses the existing NestJS backend API (same response envelope, JWT
auth). Built with Expo Router, React Query, Zustand, and Axios.

## Status

All Phase 8 slices delivered (see `../NEW_MODULES_TODO.md` → Phase 8):

- **Slice 1 — Auth + Shell** ✅ — email/password sign-in, secure token storage,
  transparent refresh, role-aware bottom-tab navigator, dashboard, notifications,
  profile, sign-out.
- **Slice 2 — Dashboard + Notifications** ✅ — staff KPI tiles / client portal
  welcome; notification list with read / mark-all-read.
- **Slice 3 — Chat** ✅ — real-time Socket.IO (conversation list + detail,
  typing, auto mark-read, live badges), REST fallback when offline.
- **Slice 4 — Support** ✅ — ticket list with status filters + staff SLA stats,
  ticket detail (threaded replies, staff internal notes, inline status/priority),
  new-ticket screen with staff client picker.
- **Slice 5 — Sales** ✅ — quotations / contracts / invoices lists + detail
  (line items, totals, lifecycle actions); role-scoped.
- **Slice 6 — Finance** ✅ — staff-only Finance hub (Purchases / Expenses /
  Ledger) with a financial summary header; purchase detail + Mark-as-Paid.
- **Slice 7 — Analytics + admin** ✅ — staff-only Analytics (KPIs, pageviews
  bar chart, top pages/referrers/devices/browsers/countries/events);
  ADMIN-only Team roster.

> Deferred: chat & ticket file attachments (S3 presigned) and push
> notifications — tracked in the Phase 8 TODO.

## Architecture

```
app/                        Expo Router routes
  _layout.tsx               Providers + AuthGate (redirects auth ↔ app)
  (auth)/login.tsx          Email/password sign-in
  (app)/_layout.tsx         Role-aware bottom tabs
  (app)/dashboard.tsx       KPIs (staff) / portal welcome (client)
  (app)/chat.tsx            Conversation list          (app)/conversation/[id].tsx
  (app)/support.tsx         Ticket list                (app)/ticket/[id].tsx, ticket/new.tsx
  (app)/sales.tsx           Sales docs list            (app)/{quotation,contract,invoice}/[id].tsx
  (app)/finance.tsx         Finance hub (staff)        (app)/purchase/[id].tsx
  (app)/analytics.tsx       Web analytics (staff)
  (app)/team.tsx            Team roster (ADMIN)
  (app)/notifications.tsx   Notification list (read / mark-all-read)
  (app)/profile.tsx         Account details + Admin links + sign-out
src/
  lib/api.ts                Axios instance + Bearer auth + transparent refresh
  lib/endpoints.ts          Typed endpoint helpers (auth/chat/support/sales/finance/analytics/users)
  lib/socket.ts             Socket.IO singleton + typed emit helpers
  lib/storage.ts            SecureStore (native) / localStorage (web) token store
  lib/config.ts             API + socket URL resolution
  lib/{ticket,sales,finance}Meta.ts  Enum → label/color display metadata
  hooks/useChatSocket.ts    Socket lifecycle + event binding hook
  store/authStore.ts        Zustand auth state + role helpers + socket lifecycle
  components/ui.tsx         Shared UI primitives (dark/gold theme)
  theme/                    Colors, spacing, radius, fonts
  types/                    Shared types (envelope, User, Ticket, Invoice, …)
```

### Role gating

Staff (ADMIN/EMPLOYEE) see the full back-office set. Clients see only their
chat, support, sales documents, notifications and profile. Staff-only tabs
(Finance, Analytics) are hidden from the client tab bar via `href: null`, and
the Team roster is ADMIN-only (reached from Profile → Admin).

### Auth

The mobile app uses **Bearer tokens** (not the web app's httpOnly cookies).
The backend `signin`/`signup`/`refresh` endpoints return
`{ accessToken, refreshToken }` in the response body (added additively — the web
app still uses cookies). Tokens are stored in `expo-secure-store` (Keychain /
Keystore) and attached as `Authorization: Bearer …`. A 401 triggers a
single-flight refresh (refresh token sent in the request body) and retries the
original request once.

## Running

```bash
cd handla-mobile
npm install          # or: npx expo install (to pin native versions)
npm start            # Expo dev server; press i / a / w
```

### Configuration

The API base URL (with the `/api` prefix) and socket URL resolve from, in order:

1. `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL` env vars
2. `app.json` → `expo.extra.apiUrl` / `socketUrl`
3. `http://localhost:3001/api` (dev fallback)

On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, e.g.:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3001/api npm start
```

## Type-check

```bash
npm run typecheck
```

## Build (EAS)

`eas.json` defines three profiles. `EXPO_PUBLIC_API_URL` /
`EXPO_PUBLIC_SOCKET_URL` are injected per profile (edit the staging/production
hosts to match your deployment):

| Profile          | Distribution | Output    | API host                          |
| ---------------- | ------------ | --------- | --------------------------------- |
| `development`    | internal     | dev client| `http://localhost:3001` (iOS simulator) |
| `preview`        | internal     | `.aab`/`.app` | `https://staging-api.handla.tech` |
| `production`     | store        | `.aab`    | `https://api.handla.tech`         |
| `production-apk` | internal     | **`.apk`**| `https://api.handla.tech`         |

> **`production-apk`** is the profile for a **personal, sideloadable Android
> build** — it produces a directly-installable `.apk` (no Play Store needed).
> See "Personal Android APK" below.

```bash
npm install -g eas-cli
eas login
eas build:configure          # one-time, links the EAS project id

# Internal test builds
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Store builds + submission
eas build --profile production --platform all
eas submit --profile production --platform ios      # / android
```

Bundle identifiers are already set (`tech.handla.mobile` for both platforms)
and `runtimeVersion` uses the `appVersion` policy for EAS Update compatibility.

## Personal Android APK (no Play Store, free)

To run the app on your **own Android phone** without publishing to Google Play,
build the `production-apk` profile. It points at the live backend
(`https://api.handla.tech`) and outputs a standalone `.apk` you can download and
sideload. Requires only a **free** Expo account — no $25 Play fee.

```bash
cd handla-mobile
npm install
npm install -g eas-cli

eas login                       # create a free account at expo.dev if needed
eas build:configure             # one-time: links/creates the EAS project id

# Build the installable APK (runs on Expo's cloud, ~10-20 min)
eas build --profile production-apk --platform android
```

When it finishes, the terminal (and your expo.dev dashboard) shows a **download
URL**. On the phone:

1. Open that link in the phone's browser and download the `.apk`.
2. Tap it → allow **"Install from unknown sources"** when prompted → Install.
3. Open **Handla** → sign in with your account → it talks to the live backend.

The build is permanent — it never expires. Rebuild only when you change the app
(bump `expo.version` in `app.json` first).

> **iOS note:** a self-signed personal iPhone build is possible with a free
> Apple ID (`eas build --profile preview --platform ios` + sideload), but it
> **expires after 7 days** and re-signing requires a Mac. A paid Apple Developer
> account ($99/yr) removes the expiry. Android APK is the free, hassle-free path.

## Device smoke test

1. Start the backend: `cd ../handla-backend && npm run start:dev` (port 3001).
2. On a physical device on the same LAN, run
   `EXPO_PUBLIC_API_URL=http://<LAN-IP>:3001/api EXPO_PUBLIC_SOCKET_URL=http://<LAN-IP>:3001 npm start`
   and open in Expo Go / the dev client.
3. Sign in as a staff user → verify Dashboard, Chat (send a message from the
   web app and confirm it arrives live), Support, Sales, Finance, Analytics,
   and (as ADMIN) Profile → Team.
4. Sign in as a client → verify only Chat / Support / Sales / Alerts / Profile
   are visible.
