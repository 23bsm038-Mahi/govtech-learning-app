# TAP Learning App Deployment Runbook

## Runtime Configuration

Copy `.env.example` to `.env` and set the deployment values before building:

```bash
EXPO_PUBLIC_FRAPPE_BASE_URL=https://your-frappe-site.example
EXPO_PUBLIC_TUTOR_WS_URL=wss://your-tutor-service.example/ws
EXPO_PUBLIC_DIKSHA_BASE_URL=https://diksha.gov.in
EXPO_PUBLIC_ENABLED_MODULES=localCourses,dikshaContent,aiTutor,feedbackForm
EXPO_PUBLIC_DEPLOYMENT_ID=tap-default
EXPO_PUBLIC_PARTNER_ID=tap
EXPO_PUBLIC_ALLOW_SAMPLE_DATA=false
EXPO_PUBLIC_REQUEST_TIMEOUT_MS=15000
EXPO_PUBLIC_CHAT_CONNECT_TIMEOUT_MS=12000
```

`EXPO_PUBLIC_ENABLED_MODULES` is the zero-code-change partner whitelist. Remove a key to disable that module for a deployment.
`EXPO_PUBLIC_ALLOW_SAMPLE_DATA` should stay `false` in production; set it to `true` only for local demos without live TAP services.

## Required Frappe Endpoints

- `POST /api/method/tap_lms.api.student_login`
  - body: `{ "full_name": string, "mobile_number": string }`
  - response message: `student_id` or `name`, optionally `api_key` and `api_secret`
- `GET /api/method/tap_lms.api.get_student_courses?student=<id>`
  - response message can be a list or `{ courses: [] }`
- `GET /api/method/tap_lms.api.get_student_progress?student=<id>`
  - response message can be a list of `{ course, progress }`
- `POST /api/method/tap_lms.api.update_student_progress`
  - body includes `student`, `course`, `progress`, `completed_lesson_id`, `deployment_id`, `partner_id`
- `POST /api/resource/TAP Feedback`
  - body includes `student`, `student_name`, `course_id`, `feedback`, `deployment_id`, `partner_id`

## Offline Behavior

The app caches the authenticated student, course catalog, DIKSHA content, feedback submissions, and progress updates in AsyncStorage. Feedback and progress updates are queued while offline and flushed when connectivity returns.

Course cache is scoped to the authenticated student to avoid showing one learner another learner's cached course list. If connectivity changes while feedback or progress is being sent, the app stores the payload locally and retries on the next online event.

## Build And Verification

```bash
npm install
npm run build
```

For Android device testing:

```bash
npm run android
```

Set `EXPO_PUBLIC_ALLOW_SAMPLE_DATA=true` only for local demos without live TAP services.
