// Netlify 서버리스 함수: 급식 정보 업데이트
// mealUpdater 모듈 직접 사용 (Next.js API 호출 방식에서 변경됨)
const { updateAllMeals } = require('../../src/lib/mealUpdater');

// 등록된 학교 목록은 이미 모듈 내에서 처리되므로 여기서는 단순하게 설정
const DEFAULT_SCHOOLS = [
  // 실제 학교 코드는 DB에서 가져와서 사용합니다
  // 임시 예시 데이터로, 모듈에서 DB 쿼리하여 사용
  { school_code: "7380292", office_code: "E10" }
];

// Netlify 서버리스 함수 핸들러
exports.handler = async function(event, context) {
  // API 키 검증
  const apiKey = event.queryStringParameters?.api_key;
  
  // 환경 변수에서 API 키 가져오기
  const validApiKey = process.env.CRON_API_KEY;
  if (!validApiKey) {
    console.log('환경 변수 CRON_API_KEY가 설정되지 않았습니다!');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error: CRON_API_KEY not set' })
    };
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid API key' })
    };
  }

  try {
    console.log('급식 정보 업데이트 시작 - 직접 DB 저장 방식');
    
    // 환경 변수 확인 (디버깅용)
    console.log('SUPABASE_URL 설정됨:', !!process.env.SUPABASE_URL);
    console.log('SUPABASE_SERVICE_KEY 설정됨:', !!process.env.SUPABASE_SERVICE_KEY);
    console.log('NEIS_API_KEY 설정됨:', !!process.env.NEIS_API_KEY);
    
    // 공용 모듈로 급식 정보 업데이트 직접 실행 (API 호출 없이)
    const result = await updateAllMeals(DEFAULT_SCHOOLS);
    
    console.log('급식 업데이트 결과:', JSON.stringify(result));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '급식 정보 업데이트 완료',
        date: new Date().toISOString(),
        stats: {
          total: result.total,
          updated: result.updated,
          inserted: result.inserted,
          errors: result.errorCount
        }
      })
    };
  } catch (error) {
    console.error('급식 업데이트 실패:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};