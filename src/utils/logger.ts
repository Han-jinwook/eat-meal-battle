// src/utils/logger.ts
// 클라이언트 측 로그를 서버로 전송하는 유틸리티입니다.

const sendLog = (level: 'info' | 'warn' | 'error', message: string, context?: object) => {
  // navigator.sendBeacon을 사용할 수 있으면 사용합니다.
  // 이 API는 페이지가 닫히는 중에도 안정적으로 데이터를 보낼 수 있도록 보장합니다.
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify({ level, message, context })], { type: 'application/json' });
    navigator.sendBeacon('/.netlify/functions/log-client-event', blob);
  } else {
    // sendBeacon을 지원하지 않는 브라우저를 위한 폴백(fallback)
    try {
      fetch('/.netlify/functions/log-client-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, context }),
        keepalive: true, // 페이지 이동 시 요청이 취소되지 않도록 보장
      });
    } catch (error) {
      console.error('Remote logging with fetch failed:', error);
    }
  }
};

export const logger = {
  info: (message: string, context?: object) => sendLog('info', message, context),
  warn: (message: string, context?: object) => sendLog('warn', message, context),
  error: (message: string, context?: object) => sendLog('error', message, context),
};
