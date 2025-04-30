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
  // skip_notification 파라미터 추출 - GitHub Actions에서 호출 시 사용
  const skipNotification = event.queryStringParameters?.skip_notification === 'true';
  
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
    // --- DB 저장 로직 시작 ---
try {
  const { createClient } = require('@supabase/supabase-js');
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: dbData, error } = await supabase
    .from('meal_menus')
    .upsert([
      {
        school_code: mealData.school_code,
        office_code: mealData.office_code,
        meal_date: mealData.meal_date,
        meal_type: mealData.meal_type,
        menu_items: mealData.menu_items,
        kcal: mealData.kcal,
        nutrition_info: mealData.nutrition_info,
        origin_info: mealData.origin_info,
        ntr_info: mealData.ntr_info
      }
    ], { onConflict: 'school_code,office_code,meal_date,meal_type' });
  if (error) {
    console.error('DB 저장 오류:', error);
    throw new Error(`DB 저장 실패: ${error.message}`);
  }
  console.log('급식 정보 DB 저장 성공:', dbData);
} catch (dbError) {
  console.error('Supabase DB 저장 오류:', dbError);
  throw new Error(`Supabase DB 저장 실패: ${dbError.message}`);
}
// --- DB 저장 로직 끝 ---
    // 알림 전송 시도 코드 제거 - 급식 사진 검증 시 별도로 처리해야 함
    console.log('급식 정보만 업데이트하고 알림은 보내지 않습니다.');
    // GitHub Actions에서 요청한 경우 skipped_by_request로 표시
    const notificationStatus = skipNotification ? 'skipped_by_request' : 'disabled';
    
    // 응답 반환
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '급식 정보 업데이트 완료',
        date: mealData.date,
        menu: mealData.menu,
        notificationStatus: notificationStatus,
        skipNotification: skipNotification // 요청에서 skip_notification 파라미터가 지정되었는지 표시
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
