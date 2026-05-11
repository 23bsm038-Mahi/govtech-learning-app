import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const COURSE_CACHE_KEY = 'tap-course-cache';
const SUBMISSION_QUEUE_KEY = 'tap-submission-queue';
const PROGRESS_QUEUE_KEY = 'tap-progress-queue';
const STUDENT_CACHE_KEY = 'tap-student-cache';
const DIKSHA_CACHE_KEY = 'tap-diksha-cache';

async function readJson(key, fallbackValue) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Keep the app usable when the device storage layer is temporarily unavailable.
  }
}

export async function isOnline() {
  const state = await NetInfo.fetch();
  if (typeof state.isInternetReachable === 'boolean') {
    return Boolean(state.isConnected) && state.isInternetReachable;
  }

  return Boolean(state.isConnected);
}

export function subscribeToNetworkStatus(onChange) {
  return NetInfo.addEventListener((state) => {
    const online = typeof state.isInternetReachable === 'boolean'
      ? Boolean(state.isConnected) && state.isInternetReachable
      : Boolean(state.isConnected);

    onChange(online);
  });
}

export async function getCachedCourses(studentId = '') {
  const cachedValue = await readJson(COURSE_CACHE_KEY, null);

  if (Array.isArray(cachedValue)) {
    return studentId ? [] : cachedValue;
  }

  if (!cachedValue || !Array.isArray(cachedValue.courses)) {
    return [];
  }

  if (studentId && cachedValue.studentId && String(cachedValue.studentId) !== String(studentId)) {
    return [];
  }

  return cachedValue.courses;
}

export async function cacheCourses(courses, studentId = '') {
  await writeJson(COURSE_CACHE_KEY, {
    studentId: studentId ? String(studentId) : '',
    courses,
    updatedAt: Date.now(),
  });
}

export async function clearCachedCourses() {
  try {
    await AsyncStorage.removeItem(COURSE_CACHE_KEY);
  } catch (error) {
    // Keep logout resilient even when storage cleanup fails.
  }
}

export async function getCachedStudent() {
  return readJson(STUDENT_CACHE_KEY, null);
}

export async function cacheStudent(student) {
  await writeJson(STUDENT_CACHE_KEY, student);
}

export async function clearCachedStudent() {
  try {
    await AsyncStorage.removeItem(STUDENT_CACHE_KEY);
  } catch (error) {
    // Keep logout resilient even when storage cleanup fails.
  }
}

export async function getCachedDikshaContent() {
  return readJson(DIKSHA_CACHE_KEY, []);
}

export async function cacheDikshaContent(items) {
  await writeJson(DIKSHA_CACHE_KEY, items);
}

export async function getQueuedSubmissions() {
  return readJson(SUBMISSION_QUEUE_KEY, []);
}

export async function queueSubmission(payload) {
  const currentQueue = await getQueuedSubmissions();
  const updatedQueue = [
    ...currentQueue,
    {
      ...payload,
      queuedAt: Date.now(),
    },
  ];

  await writeJson(SUBMISSION_QUEUE_KEY, updatedQueue);
  return updatedQueue.length;
}

export async function replaceSubmissionQueue(queue) {
  await writeJson(SUBMISSION_QUEUE_KEY, queue);
}

async function flushQueue({ getQueue, replaceQueue, sendItem }) {
  const currentQueue = await getQueue();
  const online = await isOnline();

  if (!currentQueue.length || !online) {
    return {
      sentCount: 0,
      remainingCount: currentQueue.length,
    };
  }

  const remainingQueue = [];
  let sentCount = 0;

  for (const item of currentQueue) {
    try {
      await sendItem(item);
      sentCount += 1;
    } catch (error) {
      remainingQueue.push(item);
    }
  }

  await replaceQueue(remainingQueue);

  return {
    sentCount,
    remainingCount: remainingQueue.length,
  };
}

export async function flushQueuedSubmissions(sendSubmission) {
  return flushQueue({
    getQueue: getQueuedSubmissions,
    replaceQueue: replaceSubmissionQueue,
    sendItem: sendSubmission,
  });
}

export async function getQueuedProgressUpdates() {
  return readJson(PROGRESS_QUEUE_KEY, []);
}

export async function queueProgressUpdate(payload) {
  const currentQueue = await getQueuedProgressUpdates();
  const existingIndex = currentQueue.findIndex(
    (item) => item.studentId === payload.studentId && item.courseId === payload.courseId
  );
  const updatedItem = {
    ...payload,
    queuedAt: Date.now(),
  };
  const updatedQueue = [...currentQueue];

  if (existingIndex >= 0) {
    updatedQueue[existingIndex] = updatedItem;
  } else {
    updatedQueue.push(updatedItem);
  }

  await writeJson(PROGRESS_QUEUE_KEY, updatedQueue);
  return updatedQueue.length;
}

export async function replaceProgressQueue(queue) {
  await writeJson(PROGRESS_QUEUE_KEY, queue);
}

export async function flushQueuedProgressUpdates(sendProgressUpdate) {
  return flushQueue({
    getQueue: getQueuedProgressUpdates,
    replaceQueue: replaceProgressQueue,
    sendItem: sendProgressUpdate,
  });
}
