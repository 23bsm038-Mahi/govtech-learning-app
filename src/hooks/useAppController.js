import { useCallback, useEffect, useState } from 'react';
import {
  fetchCourses,
  loginStudent,
  sendQueuedFeedback,
  sendQueuedProgressUpdate,
  updateCourseProgress,
} from '../services/frappeApi';
import {
  cacheCourses,
  cacheStudent,
  clearCachedCourses,
  clearCachedStudent,
  flushQueuedProgressUpdates,
  flushQueuedSubmissions,
  getCachedCourses,
  getCachedStudent,
  isOnline,
  subscribeToNetworkStatus,
} from '../services/offlineService';

function sanitizeCourse(course, index) {
  const safeLessons = Array.isArray(course?.lessons) ? course.lessons : [];
  const courseId = course?.id || course?.sourceId || `course-${index + 1}`;

  return {
    id: String(courseId),
    sourceId: String(course?.sourceId || courseId),
    title: course?.title || 'Untitled Course',
    category: course?.category || 'General',
    department: course?.department || 'Learning Team',
    description: course?.description || 'Course description is not available.',
    progress: Math.max(
      0,
      Math.min(100, Number.isFinite(Number(course?.progress)) ? Math.round(Number(course.progress)) : 0)
    ),
    lessons: safeLessons.map((lesson, lessonIndex) => ({
      id: String(lesson?.id || lessonIndex + 1),
      title: lesson?.title || 'Untitled Lesson',
      duration: lesson?.duration || '10 min',
    })),
  };
}

function sanitizeCourseList(courses) {
  if (!Array.isArray(courses)) {
    return [];
  }

  return courses.map(sanitizeCourse);
}

function useAppController() {
  const [student, setStudent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      let online = false;

      try {
        online = await isOnline();
      } catch (error) {
        online = false;
      }

      if (isMounted) {
        setIsOfflineMode(!online);
      }

      let cachedStudent = null;
      let cachedCourses = [];

      try {
        cachedStudent = await getCachedStudent();
        cachedCourses = cachedStudent ? await getCachedCourses(cachedStudent.id) : [];
      } catch (error) {
        cachedStudent = null;
        cachedCourses = [];
      }

      const safeCachedCourses = sanitizeCourseList(cachedCourses);

      if (!isMounted || !cachedStudent) {
        return;
      }

      setStudent(cachedStudent);
      setCourses(safeCachedCourses);

      if (online) {
        try {
          await flushQueuedProgressUpdates(sendQueuedProgressUpdate);
          await flushQueuedSubmissions(sendQueuedFeedback);
          const freshCourses = await fetchCourses(cachedStudent.id, cachedStudent.authToken);
          if (isMounted) {
            setCourses(sanitizeCourseList(freshCourses));
            setIsOfflineMode(false);
          }
        } catch (error) {
          if (isMounted) {
            setIsOfflineMode(true);
          }
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus(async (online) => {
      setIsOfflineMode(!online);

      if (online) {
        try {
          await flushQueuedProgressUpdates(sendQueuedProgressUpdate);
          await flushQueuedSubmissions(sendQueuedFeedback);
        } catch (error) {
          // Keep the app usable even if queued sync fails.
        }
      }
    });

    return unsubscribe;
  }, []);

  const loadCourses = useCallback(async (studentDetails) => {
    setIsLoading(true);
    setAppError('');

    try {
      const studentProfile = await loginStudent(studentDetails);
      setStudent(studentProfile);
      await cacheStudent(studentProfile);

      const cachedCourses = sanitizeCourseList(await getCachedCourses(studentProfile.id));
      if (cachedCourses.length) {
        setCourses(cachedCourses);
      }

      try {
        const fetchedCourses = await fetchCourses(studentProfile.id, studentProfile.authToken);
        setCourses(sanitizeCourseList(fetchedCourses));
        setIsOfflineMode(false);
      } catch (error) {
        if (cachedCourses.length) {
          setIsOfflineMode(true);
          setCourses(cachedCourses);
        } else {
          throw error;
        }
      }
    } catch (error) {
      setStudent(null);
      setCourses([]);
      setAppError(error.message || 'Something went wrong while loading the app.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async (formValues) => {
    await loadCourses(formValues);
  }, [loadCourses]);

  const handleLogout = useCallback(async () => {
    setStudent(null);
    setCourses([]);
    setAppError('');
    setIsLoading(false);
    await clearCachedStudent();
    await clearCachedCourses();
  }, []);

  const handleReloadCourses = useCallback(async () => {
    if (!student) {
      return;
    }

    setIsLoading(true);
    setAppError('');

    try {
      await flushQueuedProgressUpdates(sendQueuedProgressUpdate);
      await flushQueuedSubmissions(sendQueuedFeedback);

      const fetchedCourses = await fetchCourses(student.id, student.authToken);
      setCourses(sanitizeCourseList(fetchedCourses));
      setIsOfflineMode(false);
    } catch (error) {
      const cachedCourses = sanitizeCourseList(await getCachedCourses(student.id));

      if (cachedCourses.length) {
        setCourses(cachedCourses);
        setIsOfflineMode(true);
      } else {
        setAppError(error.message || 'Unable to refresh courses right now.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [student]);

  const handleCompleteLesson = useCallback(async ({ courseId, lessonId, progress }) => {
    if (!student) {
      return {
        success: false,
        message: 'Please login before updating progress.',
      };
    }

    const currentCourses = sanitizeCourseList(courses);
    const course = currentCourses.find((item) => item.id === String(courseId));

    if (!course) {
      return {
        success: false,
        message: 'Course is no longer available.',
      };
    }

    const nextProgress = Math.max(course.progress, Math.max(0, Math.min(100, Math.round(progress))));
    const updatedCourses = currentCourses.map((item) => (
      item.id === course.id
        ? {
            ...item,
            progress: nextProgress,
          }
        : item
    ));

    setCourses(updatedCourses);
    await cacheCourses(updatedCourses, student.id);

    try {
      const response = await updateCourseProgress({
        studentId: student.id,
        authToken: student.authToken,
        courseId: course.id,
        courseSourceId: course.sourceId,
        lessonId,
        progress: nextProgress,
      });

      return response;
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Unable to update progress right now.',
      };
    }
  }, [courses, student]);

  return {
    student,
    courses,
    isLoading,
    appError,
    isOfflineMode,
    handleLogin,
    handleLogout,
    handleReloadCourses,
    handleCompleteLesson,
  };
}

export default useAppController;
