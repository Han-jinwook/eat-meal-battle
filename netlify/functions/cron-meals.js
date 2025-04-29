// Netlify 서버리스 함수: 급식 정보 업데이트
const https = require('https');

// 환경 변수에서 API 키 가져오기
const CRON_API_KEY = process.env.CRON_API_KEY;

// 내부 API 호출 함수
async function fetchWithPromise(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Netlify 서버리스 함수 핸들러
exports.handler = async function(event, context) {
  // API 키 검증
  const apiKey = event.queryStringParameters?.api_key;
  
  if (!apiKey || apiKey !== CRON_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid API key' })
    };
  }

  try {
    console.log('급식 정보 업데이트 시작');
    
    // 내부 API 호출 (메뉴 정보 가져오기)
    const baseUrl = process.env.NETLIFY_URL || 'https://lunbat.com';
    const menuApiUrl = `${baseUrl}/api/menu/today`;
    
    console.log(`메뉴 API 호출: ${menuApiUrl}`);
    
    const menuResponse = await fetchWithPromise(menuApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`메뉴 API 응답 상태 코드: ${menuResponse.statusCode}`);
    
    if (menuResponse.statusCode !== 200) {
      throw new Error(`메뉴 API 호출 실패: ${menuResponse.statusCode}`);
    }
    
    // 알림 API 호출 (알림 전송)
    const notificationApiUrl = `${baseUrl}/api/notifications/send`;
    
    console.log(`알림 API 호출: ${notificationApiUrl}`);
    
    const notificationResponse = await fetchWithPromise(notificationApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: '오늘의 급식 업데이트',
        body: '오늘의 급식 정보가 업데이트되었습니다.',
        data: { type: 'MEAL_UPDATE' }
      })
    });
    
    console.log(`알림 API 응답 상태 코드: ${notificationResponse.statusCode}`);
    
    // 응답 반환
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '급식 정보 업데이트 완료',
        menuStatus: menuResponse.statusCode,
        notificationStatus: notificationResponse.statusCode
      })
    };
  } catch (error) {
    console.error('급식 정보 업데이트 오류:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: '급식 정보 업데이트 중 오류 발생',
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
