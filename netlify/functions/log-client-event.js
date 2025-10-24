// netlify/functions/log-client-event.js
// 클라이언트(아이폰)에서 보내는 로그를 수신하여 Netlify 서버 로그에 출력하는 역할을 합니다.
exports.handler = async function(event) {
  // POST 요청만 허용합니다.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 클라이언트가 보낸 로그 데이터(level, message, context)를 파싱합니다.
    const { level = 'info', message, context } = JSON.parse(event.body);
    const logMessage = `[CLIENT LOG - ${level.toUpperCase()}] ${message}`;
    
    // 서버 로그에 클라이언트 로그를 보기 쉽게 출력합니다.
    if (context) {
      console.log(logMessage, JSON.stringify(context, null, 2));
    } else {
      console.log(logMessage);
    }

    // 성공적으로 수신했음을 클라이언트에 알립니다.
    return { statusCode: 200, body: 'Log received' };
  } catch (error) {
    // 오류 발생 시 서버 로그에 기록합니다.
    console.error('[CLIENT LOG] Error parsing log event:', error);
    return { statusCode: 400, body: 'Bad Request' };
  }
};
