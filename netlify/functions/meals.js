// Netlify 함수: 급식 정보 조회 API
// 파일 경로: netlify/functions/meals.js

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const { v4: uuidv4 } = require('uuid'); // UUID 생성 라이브러리 임포트

// Supabase 환경 변수
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

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

// 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
function formatApiDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
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
      const officeCode = meal.ATPT_OFCDC_SC_CODE; // 교육청 코드 기록
      
      // 날짜 형식 YYYYMMDD를 YYYY-MM-DD로 변경
      const dateStr = meal.MLSV_YMD; // YYYYMMDD 형식
      const mealDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      
      // 식단 파싱 (구분자 <br/>)
      const menuText = meal.DDISH_NM;
      const menuItems = menuText ? menuText.split('<br/>') : [];
      
      // 급식 종류 파싱 (1: 조식, 2: 중식, 3: 석식)
      let mealType = '중식'; // 기본값
      if (meal.MMEAL_SC_CODE) {
        if (meal.MMEAL_SC_CODE === '1') mealType = '조식';
        else if (meal.MMEAL_SC_CODE === '2') mealType = '중식';
        else if (meal.MMEAL_SC_CODE === '3') mealType = '석식';
      }
      
      // NTR_INFO 처리 (영양정보)
      let ntrInfo = {};
      if (meal.NTR_INFO) {
        try {
          // 사용자 화면에 표시할 형태로 저장
          const ntrPairs = meal.NTR_INFO.split('<br/>');
          ntrPairs.forEach(pair => {
            const [key, value] = pair.split(' : ');
            if (key && value) {
              ntrInfo[key.trim()] = value.trim();
            }
          });
        } catch (e) {
          console.log('영양정보 파싱 오류:', e);
        }
      }
      
      // 각 meal 객체에 고유 ID 생성 - UUID 형식
      meals.push({
        id: uuidv4(), // 고유 ID 생성
        school_code: schoolCode,
        office_code: officeCode, // 교육청 코드 추가 (기존 로직은 그대로)
        meal_date: mealDate,
        meal_type: mealType,
        menu_items: menuItems,
        kcal: meal.CAL_INFO || '0 kcal',
        origin_info: meal.ORPLC_INFO || [],
        ntr_info: ntrInfo
      });
    }
    
    // meal_type 조건 없이 전체 급식 정보 반환
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
 * @param date 날짜 (YYYY-MM-DD 형식)
 * @returns 급식 정보 객체
 */
async function fetchMealInfo(schoolCode, officeCode, date) {
  try {
    // 날짜를 YYYYMMDD 형식으로 변환
    const apiDate = formatApiDate(date);
    
    console.log(`급식 정보 조회: ${schoolCode} (${officeCode}) - ${apiDate}`);
    
    // NEIS API 키 설정 여부 출력
    console.log('NEIS_API_KEY 설정 여부:', process.env.NEIS_API_KEY ? '설정됨' : '설정되지 않음');
    
    // NEIS API 호출 URL 구성
    const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
    const params = {
      KEY: process.env.NEIS_API_KEY,
      Type: 'json',
      ATPT_OFCDC_SC_CODE: officeCode, // 교육청 코드 (필수값)
      SD_SCHUL_CODE: schoolCode,      // 학교 코드
      MLSV_YMD: apiDate,              // 조회할 날짜(YYYYMMDD)
      pSize: 100                      // 가져올 항목 수
    };
    const queryParams = new URLSearchParams(params);
    const fullUrl = `${apiUrl}?${queryParams.toString()}`;
    console.log(`급식 API 요청 URL: ${fullUrl}`);
    
    // API 호출
    const data = await fetchWithPromise(fullUrl);
    
    // 응답 데이터 간단한 로그
    console.log('급식 API 응답 연결 성공');
    
    // 응답 처리
    const meals = parseMealInfo(data);
    
    if (meals.length === 0) {
      // 데이터가 없는 경우, 먼저 기존에 DB에 저장된 급식 정보 확인
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // DB에서 급식 정보 조회
      const { data: existingMealData, error: existingError } = await supabase
        .from('meal_menus')
        .select('*')
        .eq('school_code', schoolCode)
        .eq('meal_date', date)
        .eq('meal_type', '중식');  // 한글로 변경
      
      if (!existingError && existingMealData && existingMealData.length > 0) {
        console.log(`DB에 저장된 급식 정보 사용: ${schoolCode}, ${date}`);
        return existingMealData[0];
      }
      
      // DB에도 없는 경우, 빈 급식 정보 생성 후 DB 저장
      const emptyMealData = {
        school_code: schoolCode,
        meal_date: date,
        meal_type: '중식',  // 한글로 변경
        menu_items: ['급식 정보가 없습니다'],
        kcal: '0 kcal',
        ntr_info: {}, 
        origin_info: []  // 빈 배열로 저장
      };
      
      // DB에 저장
      const { data: savedData, error: saveError } = await supabase
        .from('meal_menus')
        .upsert([emptyMealData], { 
          onConflict: 'school_code,meal_date,meal_type' 
        });
      
      if (saveError) {
        console.error(`급식 없음 정보 저장 오류:`, saveError);
      } else {
        console.log(`급식 없음 정보 저장 성공`);
      }
      
      return emptyMealData;
    }
    
    // DB에 저장
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: savedData, error: saveError } = await supabase
      .from('meal_menus')
      .upsert([meals[0]], { 
        onConflict: 'school_code,meal_date,meal_type' 
      });
    
    if (saveError) {
      console.error(`급식 정보 저장 오류:`, saveError);
    } else {
      console.log(`급식 정보 저장 성공`);
    }
    
    // 처음 찾은 급식 정보 반환
    return meals[0];
  } catch (error) {
    console.error('급식 정보 조회 실패:', error);
    
    // 오류 발생 시 기본 데이터 반환
    return {
      school_code: schoolCode,
      meal_date: date,
      meal_type: '중식',
      menu_items: ['급식 정보를 가져오는 중 오류가 발생했습니다'],
      kcal: '0 kcal',
      origin_info: [],
      ntr_info: {}
    };
  }
}

// Netlify 함수 핸들러
exports.handler = async function(event, context) {
  console.log('급식 정보 조회 함수 실행 - ', new Date().toISOString());
  
  // HTTP 메소드 확인
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ 
        error: '지원하지 않는 HTTP 메소드',
        message: 'GET 요청만 지원됩니다' 
      })
    };
  }
  
  try {
    // 쿼리 파라미터 파싱
    const queryParams = event.queryStringParameters || {};
    const { school_code, office_code, date } = queryParams;
    
    console.log('수신된 쿼리 파라미터:', JSON.stringify(queryParams));
    console.log('호출 URL:', event.rawUrl || event.path);
    
    // 필수 파라미터 체크
    if (!school_code || !office_code) {
      console.log('필수 파라미터 누락:', { school_code, office_code });
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: '파라미터 오류', 
          message: 'school_code와 office_code는 필수 파라미터입니다',
          received: queryParams
        })
      };
    }
    
    // 날짜 기본값은 오늘
    const mealDate = date || new Date().toISOString().slice(0, 10);
    
    // 급식 정보 조회
    const mealData = await fetchMealInfo(school_code, office_code, mealDate);
    
    // 응답 JSON을 프론트엔드 기대 형식으로 래핑
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        meals: Array.isArray(mealData) ? mealData : (mealData ? [mealData] : []),
        source: 'api'
      })
    };
    
  } catch (error) {
    console.error('급식 정보 조회 API 오류:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '서버 오류',
        message: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
