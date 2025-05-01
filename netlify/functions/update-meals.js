// Netlify 스케줄 함수: 급식 정보 업데이트
// 파일 경로: netlify/functions/update-meals.js

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// 환경 변수에서 API 키 가져오기
const CRON_API_KEY = process.env.CRON_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 교육부 API 키
const NEIS_API_KEY = process.env.NEIS_API_KEY || '';

// HTTP 요청 함수 (Node.js 환경에서 fetch 대신 사용)
async function fetchWithPromise(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`데이터 파싱 오류: ${e.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// 오늘 날짜 가져오기 (YYYY-MM-DD 및 YYYYMMDD 형식)
function getTodayDate(format = 'YYYY-MM-DD') {
  const now = new Date();
  // 한국 시간(UTC+9)으로 변환
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getUTCDate()).padStart(2, '0');
  
  if (format === 'YYYYMMDD') {
    return `${year}${month}${day}`;
  }
  
  return `${year}-${month}-${day}`;
}

/**
 * NEIS API 응답에서 급식 정보 파싱
 * @param {Object} data API 응답 객체
 * @returns 파싱된 급식 정보 배열
 */
function parseMealInfo(data) {
  // 결과값을 저장할 배열
  const meals = [];
  
  try {
    // API 응답에 급식 정보가 있는지 확인
    if (!data.mealServiceDietInfo) {
      console.log('급식 정보가 없습니다:', JSON.stringify(data));
      return meals; // 급식 정보가 없으면 빈 배열 반환
    }
    
    const mealServiceDietInfo = data.mealServiceDietInfo;
    
    // 헤더와 바디 분리 (표준 NEIS API 형식)
    if (!mealServiceDietInfo[0] || !mealServiceDietInfo[0].head) {
      console.log('응답 형식 오류 (head 없음):', JSON.stringify(mealServiceDietInfo));
      return meals;
    }
    
    const header = mealServiceDietInfo[0].head;
    
    // 응답 성공 여부 확인
    if (!header[1] || !header[1].RESULT || header[1].RESULT.CODE !== 'INFO-000') {
      console.log('급식 조회 응답 에러:', header[1]?.RESULT?.MESSAGE || 'Unknown error');
      return meals;
    }
    
    // 데이터 확인
    if (!mealServiceDietInfo[1] || !mealServiceDietInfo[1].row || mealServiceDietInfo[1].row.length === 0) {
      console.log('검색된 급식 정보가 없습니다.');
      return meals;
    }
    
    // 모든 급식 객체 처리
    const mealRows = mealServiceDietInfo[1].row;
    for (const meal of mealRows) {
      // 기본 정보
      const schoolCode = meal.SD_SCHUL_CODE;
      const officeCode = meal.ATPT_OFCDC_SC_CODE;
      
      // 날짜 형식 YYYYMMDD를 YYYY-MM-DD로 변경
      const dateStr = meal.MLSV_YMD; // YYYYMMDD 형식
      const mealDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      
      // 식단 파싱 (구분자 <br/>)
      const menuText = meal.DDISH_NM;
      const menuItems = menuText ? menuText.split('<br/>') : [];
      
      // 급식 종류 파싱 (1: 조식, 2: 중식, 3: 석식)
      let mealType = 'lunch'; // 기본값
      if (meal.MMEAL_SC_CODE) {
        if (meal.MMEAL_SC_CODE === '1') mealType = 'breakfast';
        else if (meal.MMEAL_SC_CODE === '2') mealType = 'lunch';
        else if (meal.MMEAL_SC_CODE === '3') mealType = 'dinner';
      }
      
      meals.push({
        school_code: schoolCode,
        office_code: officeCode,
        meal_date: mealDate,
        meal_type: mealType,
        menu_items: menuItems,
        kcal: meal.CAL_INFO || '정보 없음',
        nutrition_info: meal.NTR_INFO || '정보 없음',
        origin_info: meal.ORPLC_INFO || '정보 없음',
        ntr_info: {}
      });
    }
    
    console.log(`파싱된 급식 정보: ${meals.length}개`);
    return meals;
  } catch (error) {
    console.error('급식 정보 파싱 오류:', error);
    return meals;
  }
}

/**
 * 급식 정보 가져오기 함수
 * @param schoolCode 학교 코드
 * @param officeCode 교육청 코드
 * @returns 급식 정보 객체
 */
async function fetchMealData(schoolCode = 'J100000001', officeCode = 'B10') {
  try {
    // 한국 시간 기준 오늘 날짜 (YYYYMMDD 형식)
    const dateStr = getTodayDate('YYYYMMDD');
    const today = getTodayDate(); // YYYY-MM-DD 형식
    
    console.log(`급식 정보 조회: ${schoolCode}(${officeCode}) - ${dateStr}`);
    
    // NEIS API 호출 URL 구성
    const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
    const queryParams = new URLSearchParams({
      KEY: NEIS_API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '100',
      ATPT_OFCDC_SC_CODE: officeCode, // 시도교육청코드
      SD_SCHUL_CODE: schoolCode,      // 표준학교코드
      MLSV_YMD: dateStr,              // 급식일자
    });
    
    const fullUrl = `${apiUrl}?${queryParams.toString()}`;
    console.log(`급식 API 요청 URL: ${fullUrl}`);
    
    // API 호출
    const data = await fetchWithPromise(fullUrl);
    
    // 응답 데이터 간단한 로그
    console.log('급식 API 응답 연결 성공');
    
    // API 키 설정 확인
    console.log('NEIS_API_KEY 설정 여부:', NEIS_API_KEY ? '설정됨' : '설정되지 않음');
    
    // 응답 처리 - 기존 parseMealInfo 함수 사용
    const meals = parseMealInfo(data);
    
    if (meals.length === 0) {
      // 데이터가 없는 경우 기본 값 반환
      return {
        school_code: schoolCode,
        office_code: officeCode,
        meal_date: today,
        meal_type: 'lunch',
        menu_items: ['급식 정보가 없습니다'],
        kcal: '0kcal',
        nutrition_info: '정보 없음',
        origin_info: '정보 없음',
        ntr_info: {}
      };
    }
    
    // 처음 찾은 급식 정보 반환
    return meals[0];
  } catch (error) {
    console.error('급식 정보 조회 실패:', error);
    
    // 오류 발생 시 기본 데이터 반환
    return {
      school_code: schoolCode,
      office_code: officeCode,
      meal_date: getTodayDate(),
      meal_type: 'lunch',
      menu_items: ['급식 정보를 가져오는 중 오류가 발생했습니다'],
      kcal: '0kcal',
      nutrition_info: '정보 없음',
      origin_info: '정보 없음',
      ntr_info: {}
    };
  }
}

// Netlify 스케줄 함수 핸들러
exports.handler = async function(event, context) {
  console.log('급식 정보 업데이트 함수 실행 시작 - ', new Date().toISOString());
  
  // API 키 검증 (수동으로 호출하는 경우)
  if (event.httpMethod === 'GET') {
    const apiKey = event.queryStringParameters?.api_key;
    
    if (CRON_API_KEY && (!apiKey || apiKey !== CRON_API_KEY)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ 
          error: '인증 실패', 
          message: '유효한 API 키가 필요합니다' 
        })
      };
    }
  }
  
  try {
    // 1. 급식 정보 가져오기
    console.log('급식 정보 가져오기 시작');
    const mealData = await fetchMealData();
    console.log('급식 정보 가져오기 성공:', JSON.stringify(mealData));
    
    // 2. Supabase에 저장
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase 클라이언트 초기화 완료');
    
    // 3. DB에 저장 (meal_menus 테이블)
    const { data, error } = await supabase
      .from('meal_menus')
      .upsert([mealData], { 
        onConflict: 'school_code,office_code,meal_date,meal_type' 
      });
      
    if (error) {
      console.error('Supabase DB 저장 오류:', error);
      throw new Error(`DB 저장 실패: ${error.message}`);
    }
    
    console.log('급식 정보 DB 저장 성공');
    
    // 응답 반환
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '급식 정보 업데이트 완료',
        date: mealData.meal_date,
        menu: mealData.menu_items,
        updated_at: new Date().toISOString()
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
