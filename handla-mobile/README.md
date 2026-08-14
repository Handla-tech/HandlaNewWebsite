# Handla Mobile

Staff-first, role-gated **React Native (Expo)** companion app for the Handla
platform. Reuses the existing NestJS backend API (same response envelope, JWT
auth). Built with Expo Router, React Query, Zustand, and Axios.

## Status

Delivered in slices (see `../NEW_MODULES_TODO.md` → Phase 8):

- **Slice 1 — Auth + Shell** ✅ — email/password sign-in, secure token storage,
  transparent refresh, role-aware bottom-tab navigator, dashboard, notifications,
  profile, sign-out.
- Slice 2+ (Chat, Support, Sales, Finance, Analytics/admin) — pending.

## Architecture

```
app/                        Expo Router routes
  _layout.tsx               Providers + AuthGate (redirects auth ↔ app)
  (auth)/login.tsx          Email/password sign-in
  (app)/_layout.tsx         Role-aware bottom tabs
  (app)/dashboard.tsx       KPIs (staff) / portal welcome (client)
  (app)/notifications.tsx   Notification list (read / mark-all-read)
  (app)/profile.tsx         Account details + sign-out
src/
  lib/api.ts                Axios instance + Bearer auth + transparent refresh
  lib/endpoints.ts          Typed endpoint helpers
  lib/storage.ts            SecureStore (native) / localStorage (web) token store
  lib/config.ts             API + socket URL resolution
  store/authStore.ts        Zustand auth state + role helpers
  components/ui.tsx         Shared UI primitives (dark/gold theme)
  theme/                    Colors, spacing, radius, fonts
  types/                    Shared types (envelope, User, Notification, …)
```

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

EAS build config is added in a later slice. For now use Expo Go / dev client.
