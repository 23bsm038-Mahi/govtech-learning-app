# Native GovTech Learning App for Public Education Systems

React Native Android app scaffold for TAP Buddy learning flows. The app supports student onboarding, Frappe LMS course retrieval, progress tracking, offline feedback/progress sync, WebSocket AI tutor chat, DIKSHA content discovery, and partner module whitelisting.

## Features

- Student login/onboarding with mobile validation and cached session restore
- Dashboard with Frappe-backed courses, progress, and offline fallback
- Course detail flow with lesson completion and progress updates
- Offline queue for feedback submissions and progress updates
- AI Tutor chat over WebSockets with local demo fallback when enabled
- DIKSHA content adapter with cache fallback
- Zero-code-change module whitelist via `EXPO_PUBLIC_ENABLED_MODULES`

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Use `npm run android` to launch the Android Expo target.
For local demos without live backend services, set `EXPO_PUBLIC_ALLOW_SAMPLE_DATA=true`.

## Environment

See `.env.example` for all supported values:

- `EXPO_PUBLIC_FRAPPE_BASE_URL`
- `EXPO_PUBLIC_TUTOR_WS_URL`
- `EXPO_PUBLIC_DIKSHA_BASE_URL`
- `EXPO_PUBLIC_ENABLED_MODULES`
- `EXPO_PUBLIC_DEPLOYMENT_ID`
- `EXPO_PUBLIC_PARTNER_ID`
- `EXPO_PUBLIC_ALLOW_SAMPLE_DATA`
- `EXPO_PUBLIC_REQUEST_TIMEOUT_MS`
- `EXPO_PUBLIC_CHAT_CONNECT_TIMEOUT_MS`

For production deployments, set `EXPO_PUBLIC_ALLOW_SAMPLE_DATA=false` so missing backend configuration fails clearly.

## Build

```bash
npm run build
```

The production export is written to `dist/`.

## Deployment Notes

Operational setup, required Frappe API contracts, offline behavior, and whitelabel configuration are documented in [docs/deployment-runbook.md](docs/deployment-runbook.md).
