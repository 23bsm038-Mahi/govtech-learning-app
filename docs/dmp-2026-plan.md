# TAP Learning App Architecture Notes

## Current Implementation

The app is now a React Native Android scaffold for TAP Buddy-style public education deployments. It keeps the original student journey but implements it through mobile app boundaries:

- `src/navigation` owns authenticated and unauthenticated navigation
- `src/hooks/useAppController.js` owns session restore, LMS loading, offline state, and sync triggers
- `src/services/frappeApi.js` owns Frappe LMS API calls and response normalization
- `src/services/offlineService.js` owns AsyncStorage cache and sync queues
- `src/services/chatService.js` owns AI tutor WebSocket sessions and demo fallback
- `src/services/dikshaService.js` owns DIKSHA content retrieval and cache fallback
- `src/services/moduleRegistry.js` owns partner module whitelisting

## Production Flow

1. Student enters name and 10-digit mobile number.
2. App authenticates against Frappe when `EXPO_PUBLIC_FRAPPE_BASE_URL` is configured.
3. Courses and progress are loaded, normalized, cached, and displayed on the dashboard.
4. Course detail shows lessons, progress, feedback, and AI tutor access.
5. Lesson completion updates local progress immediately and sends the update to Frappe.
6. Feedback and progress updates are queued offline and flushed when connectivity returns.
7. DIKSHA resources load from the configured content API, with cached content used during outages.

## Partner Whitelisting

Default module flags live in `src/config/moduleWhitelist.js`. Deployments can override them without code changes:

```bash
EXPO_PUBLIC_ENABLED_MODULES=localCourses,dikshaContent,aiTutor,feedbackForm
```

Supported module keys:

- `localCourses`
- `dikshaContent`
- `aiTutor`
- `feedbackForm`

## Deployment Readiness

Use `.env.example` as the source of required runtime configuration and `docs/deployment-runbook.md` for the API contracts and operational checklist.
