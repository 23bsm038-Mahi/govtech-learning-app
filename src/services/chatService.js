import { createLocalId } from '../utils/createLocalId';
import { appConfig } from '../config/appConfig';

function buildSampleAiReply(message, course) {
  const cleanMessage = message.toLowerCase();
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  const completedLessons = Math.min(
    lessons.length,
    Math.floor((course.progress / 100) * lessons.length)
  );
  const nextLessonIndex = Math.min(completedLessons, Math.max(lessons.length - 1, 0));

  if (cleanMessage.includes('progress')) {
    return `You have completed ${course.progress}% of this course. Try the next lesson to keep your progress moving.`;
  }

  if (
    cleanMessage.includes('next') ||
    cleanMessage.includes('lesson') ||
    cleanMessage.includes('start')
  ) {
    if (!lessons.length) {
      return 'This course does not have lessons published yet. Check back after your learning team updates it.';
    }

    return `You can continue with Lesson ${nextLessonIndex + 1}: ${lessons[nextLessonIndex].title}.`;
  }

  if (
    cleanMessage.includes('course') ||
    cleanMessage.includes('learn') ||
    cleanMessage.includes('explain')
  ) {
    return `${course.title} helps you understand ${course.description.toLowerCase()}`;
  }

  if (cleanMessage.includes('hello') || cleanMessage.includes('hi')) {
    return `Hello! I can help you with lessons, progress, and simple questions about ${course.title}.`;
  }

  return 'Try asking about your progress, the next lesson, or what this course teaches.';
}

function buildChatMessage(sender, text) {
  return {
    id: createLocalId(`${sender}-message`),
    sender,
    text,
  };
}

function buildInitialMessage(studentName, courseTitle) {
  return buildChatMessage(
    'ai',
    `Hi ${studentName}, I am your AI Tutor. Ask me about ${courseTitle}.`
  );
}

function createSampleTutorSession({ studentName, course, onOpen, onMessage, onClose, onError, onStatusChange }) {
  let connectTimer = null;
  let replyTimer = null;
  let isClosed = false;

  return {
    connect() {
      onStatusChange('connecting');

      connectTimer = setTimeout(() => {
        if (isClosed) {
          return;
        }

        onStatusChange('connected');
        onOpen();
        onMessage(buildInitialMessage(studentName, course.title));
      }, 500);
    },

    sendMessage(message) {
      if (isClosed) {
        onError('Chat connection is closed.');
        return;
      }

      onStatusChange('connected');

      replyTimer = setTimeout(() => {
        if (isClosed) {
          return;
        }

        onMessage(buildChatMessage('ai', buildSampleAiReply(message, course)));
      }, 1000);
    },

    disconnect() {
      isClosed = true;
      clearTimeout(connectTimer);
      clearTimeout(replyTimer);
      onStatusChange('disconnected');
      onClose();
    },
  };
}

function createWebSocketClient({
  url,
  studentName,
  course,
  onOpen,
  onMessage,
  onClose,
  onError,
  onStatusChange,
  onFallbackToSample,
}) {
  let socket = null;
  let didFallback = false;
  let connectTimer = null;

  const fallback = () => {
    if (didFallback) {
      return;
    }

    didFallback = true;
    clearTimeout(connectTimer);

    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }

    if (appConfig.allowSampleData) {
      onFallbackToSample();
      return;
    }

    onStatusChange('disconnected');
    onClose();
  };

  return {
    connect() {
      try {
        onStatusChange('connecting');
        socket = new WebSocket(url);
        connectTimer = setTimeout(() => {
          onError('Chat connection timed out.');
          fallback();
        }, appConfig.chatConnectTimeoutMs);

        socket.onopen = () => {
          clearTimeout(connectTimer);
          onStatusChange('connected');
          onOpen();

          // Send a lightweight join event so a real backend can identify the session.
          socket.send(
            JSON.stringify({
              type: 'join',
              studentName,
              courseId: course.id,
              courseTitle: course.title,
            })
          );
        };

        socket.onmessage = (event) => {
          let parsedPayload;

          try {
            parsedPayload = JSON.parse(event.data);
          } catch (error) {
            parsedPayload = { text: event.data };
          }

          const messageText = parsedPayload?.text || parsedPayload?.message || '';

          if (!messageText) {
            return;
          }

          const sender = parsedPayload?.sender === 'student' ? 'student' : 'ai';
          onMessage(buildChatMessage(sender, messageText));
        };

        socket.onerror = () => {
          onStatusChange('disconnected');
          onError(appConfig.allowSampleData
            ? 'Chat connection failed. Falling back to local tutor mode.'
            : 'Chat connection failed. Please try again when the tutor service is available.');
          fallback();
        };

        socket.onclose = () => {
          if (didFallback) {
            return;
          }

          clearTimeout(connectTimer);
          onStatusChange('disconnected');
          onClose();
        };
      } catch (error) {
        onStatusChange('disconnected');
        onError(appConfig.allowSampleData
          ? 'Chat connection failed. Falling back to local tutor mode.'
          : 'Chat connection failed. Please try again when the tutor service is available.');
        fallback();
      }
    },

    sendMessage(message) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        onError('Chat is not connected yet.');
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'message',
          sender: 'student',
          text: message,
          studentName,
          courseId: course.id,
        })
      );
    },

    disconnect() {
      clearTimeout(connectTimer);
      if (socket) {
        socket.close();
      }
    },
  };
}

export function createTutorChatService({
  studentName,
  course,
  onOpen,
  onMessage,
  onClose,
  onError,
  onStatusChange,
}) {
  const apiUrl = appConfig.tutorWebSocketUrl;
  let activeClient = null;

  const startSampleClient = () => {
    activeClient = createSampleTutorSession({
      studentName,
      course,
      onOpen,
      onMessage,
      onClose,
      onError,
      onStatusChange,
    });

    activeClient.connect();
  };

  return {
    connect() {
      if (apiUrl && typeof WebSocket !== 'undefined') {
        activeClient = createWebSocketClient({
          url: apiUrl,
          studentName,
          course,
          onOpen,
          onMessage,
          onClose,
          onError,
          onStatusChange,
          onFallbackToSample: startSampleClient,
        });

        activeClient.connect();
        return;
      }

      if (appConfig.allowSampleData) {
        startSampleClient();
        return;
      }

      onStatusChange('disconnected');
      onError('AI Tutor is not configured for this deployment.');
    },

    sendMessage(message) {
      activeClient?.sendMessage(message);
    },

    disconnect() {
      activeClient?.disconnect();
    },
  };
}
