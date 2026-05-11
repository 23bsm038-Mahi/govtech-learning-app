import { courseList } from '../courseData';
import { appConfig, hasConfiguredFrappeBackend } from '../config/appConfig';
import {
  cacheCourses,
  isOnline,
  queueProgressUpdate,
  queueSubmission,
} from './offlineService';

function cloneCourses() {
  return courseList.map((course) => ({
    ...course,
    lessons: [...course.lessons],
  }));
}

function getBaseUrl() {
  return appConfig.frappeBaseUrl;
}

function hasFrappeBackend() {
  return hasConfiguredFrappeBackend();
}

function buildUrl(path) {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.exception || data?.message || data?._server_messages || 'Frappe request failed.');
  }

  return data;
}

function buildAuthHeaders(authToken = '') {
  if (!authToken) {
    return {};
  }

  return {
    Authorization: authToken.startsWith('token ') ? authToken : `token ${authToken}`,
  };
}

async function fetchWithTimeout(url, options = {}) {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, appConfig.requestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isLikelyNetworkError(error) {
  const message = String(error?.message || '').toLowerCase();

  return (
    error?.name === 'AbortError' ||
    error instanceof TypeError ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('internet') ||
    message.includes('timeout') ||
    message.includes('aborted')
  );
}

function ensureSampleDataAllowed() {
  if (!appConfig.allowSampleData) {
    throw new Error('Backend is not configured and sample data is disabled for this deployment.');
  }
}

function mapCourseRecord(course, index) {
  return {
    name: `COURSE-${index + 1}`,
    title: course.title,
    description: course.description,
    category: course.category,
    department: course.department,
    progress: course.progress,
    lessons: course.lessons,
  };
}

function buildSampleCourseResponse(studentId) {
  const courses = cloneCourses().map(mapCourseRecord);

  return {
    message: {
      student_id: studentId,
      courses,
    },
  };
}

function buildSampleProgressResponse(studentId) {
  return {
    message: cloneCourses().map((course, index) => ({
      name: `PROGRESS-${index + 1}`,
      student: studentId,
      course: `COURSE-${index + 1}`,
      progress: course.progress,
    })),
  };
}

function normalizeCourseList(responseData) {
  const rawCourses =
    responseData?.message?.courses ||
    responseData?.message ||
    responseData?.data ||
    [];

  return rawCourses.map((course, index) => {
    const courseKey = course.id || course.course_id || course.name || `COURSE-${index + 1}`;

    return {
      id: String(courseKey),
      sourceId: course.name || course.course || String(courseKey),
      title: course.title || course.course_title || 'Untitled Course',
      description: course.description || 'Course description is not available.',
      category: course.category || course.course_category || 'General',
      department: course.department || course.owner_department || 'Learning Team',
      progress: clampProgress(course.progress || 0),
      lessons: normalizeLessons(course.lessons),
    };
  });
}

function normalizeProgressMap(responseData) {
  const progressItems = responseData?.message || responseData?.data || [];

  return progressItems.reduce((result, item) => {
    const courseId = item.course_id || item.course || item.id || item.name;
    if (courseId) {
      result[String(courseId)] = clampProgress(item.progress || item.percentage || 0);
    }
    return result;
  }, {});
}

function normalizeLessons(lessons) {
  if (!Array.isArray(lessons)) {
    return [];
  }

  return lessons.map((lesson, index) => ({
    id: String(lesson.id || lesson.name || lesson.lesson_id || index + 1),
    title: lesson.title || lesson.lesson_title || lesson.subject || 'Untitled Lesson',
    duration: lesson.duration || lesson.estimated_duration || lesson.time_to_complete || '10 min',
  }));
}

function clampProgress(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

async function requestFrappeLogin(student) {
  const response = await fetchWithTimeout(buildUrl('/api/method/tap_lms.api.student_login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      full_name: student.name,
      mobile_number: student.mobile,
    }),
  });

  const data = await parseJsonResponse(response);

  return {
    ...student,
    id: data?.message?.student_id || data?.message?.name || `student-${student.mobile.slice(-4)}`,
    authToken: data?.message?.api_secret
      ? `${data?.message?.api_key}:${data?.message?.api_secret}`
      : data?.message?.api_key || '',
  };
}

function requestSampleLogin(student) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (student.mobile === '0000000000') {
        reject(new Error('Unable to connect to the learning service right now.'));
        return;
      }

      resolve({
        ...student,
        id: `student-${student.mobile.slice(-4)}`,
        authToken: 'sample-token',
      });
    }, 500);
  });
}

async function requestFrappeCourses(studentId, authToken = '') {
  const response = await fetchWithTimeout(
    buildUrl(`/api/method/tap_lms.api.get_student_courses?student=${encodeURIComponent(studentId)}`),
    {
      headers: buildAuthHeaders(authToken),
    }
  );

  return parseJsonResponse(response);
}

function requestSampleCourses(studentId) {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      if (!(await isOnline())) {
        reject(new Error('Unable to reach the learning service right now.'));
        return;
      }

      resolve(buildSampleCourseResponse(studentId));
    }, 800);
  });
}

async function requestFrappeProgress(studentId, authToken = '') {
  const response = await fetchWithTimeout(
    buildUrl(`/api/method/tap_lms.api.get_student_progress?student=${encodeURIComponent(studentId)}`),
    {
      headers: buildAuthHeaders(authToken),
    }
  );

  return parseJsonResponse(response);
}

function requestSampleProgress(studentId) {
  return Promise.resolve(buildSampleProgressResponse(studentId));
}

function mergeCoursesWithProgress(courses, progressMap) {
  return courses.map((course) => ({
    ...course,
    progress: progressMap[course.id] ?? progressMap[course.sourceId] ?? course.progress,
  }));
}

function normalizeSubmissionMessage(data) {
  return {
    success: true,
    message: data?.message || 'Feedback submitted successfully.',
  };
}

export async function loginStudent(student) {
  const online = await isOnline();

  if (!online && !hasFrappeBackend() && appConfig.allowSampleData) {
    return requestSampleLogin(student);
  }

  if (hasFrappeBackend()) {
    if (!online) {
      throw new Error('Internet is required for first-time login. Existing sessions can continue offline.');
    }

    return requestFrappeLogin(student);
  }

  if (!appConfig.allowSampleData) {
    throw new Error('Frappe backend is not configured for this deployment.');
  }

  return requestSampleLogin(student);
}

export async function fetchStudentProgress(studentId, authToken = '') {
  if (!hasFrappeBackend()) {
    ensureSampleDataAllowed();
  }

  const responseData = hasFrappeBackend()
    ? await requestFrappeProgress(studentId, authToken)
    : await requestSampleProgress(studentId);

  return normalizeProgressMap(responseData);
}

export async function fetchCourses(studentId, authToken = '') {
  if (!(await isOnline())) {
    throw new Error('Unable to reach the learning service right now.');
  }

  if (!hasFrappeBackend()) {
    ensureSampleDataAllowed();
  }

  const courseResponse = hasFrappeBackend()
    ? await requestFrappeCourses(studentId, authToken)
    : await requestSampleCourses(studentId);

  let progressMap = {};

  try {
    progressMap = await fetchStudentProgress(studentId, authToken);
  } catch (error) {
    progressMap = {};
  }

  const normalizedCourses = mergeCoursesWithProgress(
    normalizeCourseList(courseResponse),
    progressMap
  );

  await cacheCourses(normalizedCourses, studentId);
  return normalizedCourses;
}

export async function sendQueuedFeedback(payload) {
  if (!(await isOnline())) {
    throw new Error('Still offline');
  }

  if (hasFrappeBackend()) {
    const response = await fetchWithTimeout(buildUrl('/api/resource/TAP Feedback'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(payload.authToken),
      },
      body: JSON.stringify({
        data: {
          student: payload.studentId,
          student_name: payload.studentName,
          course_id: payload.courseId,
          feedback: payload.feedback,
          deployment_id: appConfig.deploymentId,
          partner_id: appConfig.partnerId,
        },
      }),
    });

    const data = await parseJsonResponse(response);
    return normalizeSubmissionMessage(data);
  }

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!payload.studentName.trim()) {
        reject(new Error('Name is required before submitting feedback.'));
        return;
      }

      if (payload.feedback.trim().length < 5) {
        reject(new Error('Feedback is too short. Please write a little more.'));
        return;
      }

      resolve({
        success: true,
        message: 'Feedback submitted successfully. Your mentor can review it later.',
      });
    }, 700);
  });
}

export async function submitCourseFeedback(payload) {
  if (!payload.studentName.trim()) {
    throw new Error('Name is required before submitting feedback.');
  }

  if (payload.feedback.trim().length < 5) {
    throw new Error('Feedback is too short. Please write a little more.');
  }

  if (!(await isOnline())) {
    await queueSubmission(payload);
    return {
      success: true,
      queued: true,
      message: 'Offline Mode: feedback saved locally and will be sent when internet is back.',
    };
  }

  try {
    return await sendQueuedFeedback(payload);
  } catch (error) {
    if (isLikelyNetworkError(error) || !(await isOnline())) {
      await queueSubmission(payload);
      return {
        success: true,
        queued: true,
        message: 'Connection changed while sending. Feedback was saved locally and will sync when internet is back.',
      };
    }

    throw error;
  }
}

export async function sendQueuedProgressUpdate(payload) {
  if (!(await isOnline())) {
    throw new Error('Still offline');
  }

  const progress = clampProgress(payload.progress);

  if (hasFrappeBackend()) {
    const response = await fetchWithTimeout(buildUrl('/api/method/tap_lms.api.update_student_progress'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(payload.authToken),
      },
      body: JSON.stringify({
        student: payload.studentId,
        course: payload.courseSourceId || payload.courseId,
        progress,
        completed_lesson_id: payload.lessonId,
        deployment_id: appConfig.deploymentId,
        partner_id: appConfig.partnerId,
      }),
    });

    await parseJsonResponse(response);
  }

  return {
    success: true,
    progress,
  };
}

export async function updateCourseProgress(payload) {
  const progress = clampProgress(payload.progress);
  const updatePayload = {
    ...payload,
    progress,
  };

  if (!(await isOnline())) {
    await queueProgressUpdate(updatePayload);
    return {
      success: true,
      queued: true,
      progress,
      message: 'Offline Mode: progress saved locally and will sync when internet is back.',
    };
  }

  try {
    await sendQueuedProgressUpdate(updatePayload);
  } catch (error) {
    if (isLikelyNetworkError(error) || !(await isOnline())) {
      await queueProgressUpdate(updatePayload);
      return {
        success: true,
        queued: true,
        progress,
        message: 'Connection changed while syncing. Progress was saved locally and will sync when internet is back.',
      };
    }

    throw error;
  }

  return {
    success: true,
    progress,
    message: 'Progress updated.',
  };
}
