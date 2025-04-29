// Netlify 서버리스 함수: 급식 정보 업데이트
const https = require('https');
const { parse } = require('url');

// 환경 변수에서 API 키 가져오기
const CRON_API_KEY = process.env.CRON_API_KEY;

// HTTP 요청 함수
async function fetchWithPromise(url, options) {
  return new Promise((resolve, reject) => {
    const parsedUrl = parse(url);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, 
      (res) => {
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
      }
    );

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// 오늘 날짜 가져오기 (YYYY-MM-DD 형식)
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 네이버 급식 정보 가져오기 (예시)
async function fetchMealData() {
  // 실제로는 여기서 네이버나 다른 소스에서 급식 정보를 가져올 수 있습니다
  // 이 예제에서는 더미 데이터를 반환합니다
  const today = getTodayDate();
  
  return {
    date: today,
    menu: [
      '쌀밥',
      '미역국',
      '불고기',
      '김치',
      '요구르트'
    ],
    updatedAt: new Date().toISOString()
  };
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
    
    // 직접 급식 정보 가져오기
    const mealData = await fetchMealData();
    console.log('급식 정보 가져오기 성공:', JSON.stringify(mealData));
    
    // 알림 전송 시도 (선택적)
    let notificationStatus = 'skipped';
    
    try {
      const baseUrl = process.env.NETLIFY_URL || 'https://lunbat.com';
      const notificationApiUrl = `${baseUrl}/.netlify/functions/send-notification`;
      
      console.log(`알림 API 호출 시도: ${notificationApiUrl}`);
      
      // 알림 API가 없을 수 있으므로 try-catch로 분리
      const notificationResponse = await fetchWithPromise(notificationApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '오늘의 급식 업데이트',
          body: `오늘의 급식: ${mealData.menu.slice(0, 3).join(', ')} 외`,
          data: { 
            type: 'MEAL_UPDATE',
            date: mealData.date
          }
        })
      });
      
      notificationStatus = notificationResponse.statusCode;
      console.log(`알림 API 응답 상태 코드: ${notificationStatus}`);
    } catch (notificationError) {
      console.warn('알림 전송 실패 (무시됨):', notificationError);
      notificationStatus = 'failed';
    }
    
    // 응답 반환
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '급식 정보 업데이트 완료',
        date: mealData.date,
        menu: mealData.menu,
        notificationStatus: notificationStatus
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
