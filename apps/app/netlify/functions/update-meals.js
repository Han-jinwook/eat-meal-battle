// Netlify 스케줄 함수: 급식 정보 업데이트
// 파일 경로: netlify/functions/update-meals.js

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// 환경 변수에서 API 키 가져오기
const CRON_API_KEY = process.env.CRON_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Supabase Admin 클라이언트 초기화 (RLS 우회용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 교육부 API 키
// 상수 선언이 아닌 반복 사용을 피하기 위해 상수 선언 제거

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
      const officeCode = meal.ATPT_OFCDC_SC_CODE; // 교육청 코드 기록
      
      // 날짜 형식 YYYYMMDD를 YYYY-MM-DD로 변경
      const dateStr = meal.MLSV_YMD; // YYYYMMDD 형식
      const mealDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      
      // 식단 파싱 (구분자 <br/>)
      const menuText = meal.DDISH_NM;
      const menuItems = menuText 
        ? menuText.split('<br/>').map(item => {
            // 메뉴 항목 처리 (3단계로 진행)
            return item
              // 1. 알레르기 정보 등 괄호 내용 제거
              .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, '')
              // 2. 각 항목을 슬래시(/)로 분리하고 개별 처리 후 다시 합치기
              .split('/')
              .map(part => {
                return part
                  // 3. 각 부분에서 끝에 붙은 u, -u, .u 등 제거 (다양한 패턴 처리)
                  .trim()
                  .replace(/[\-\.]?u$/gi, '') // -u, .u, u 등 제거
                  .replace(/[\-~]?\d*$/, '') // 끝에 붙은 -1, -2 등의 숫자 제거
                  .trim();
              })
              .join('/')
              .trim();
          })
          .filter(item => item && item.length > 0) // 빈 항목 제거
        : [];
      
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
          // 문자열로 변환 및 HTML 태그 제거
          let strNtrInfo = typeof meal.NTR_INFO === 'string' ? meal.NTR_INFO : JSON.stringify(meal.NTR_INFO);
          strNtrInfo = strNtrInfo.replace(/<br\s*\/?>/gi, '\n');
          
          // 사용자 화면에 표시할 형태로 저장
          const ntrPairs = strNtrInfo.split('\n');
          ntrPairs.forEach(pair => {
            if (!pair.includes(' : ')) return; // ' : '가 없는 행은 무시
            
            const [key, value] = pair.split(' : ');
            if (key && value) {
              const trimmedKey = key.trim();
              // 필요한 키만 처리 (영양소, 탈럽류, 지방 등)
              if (trimmedKey && !trimmedKey.includes('비고') && !trimmedKey.includes('여부')) {
                ntrInfo[trimmedKey] = value.trim();
              }
            }
          });
        } catch (e) {
          console.log('영양정보 파싱 오류:', e);
          // 오류 발생 시 원본 데이터 보존
          ntrInfo = meal.NTR_INFO; 
        }
      }
      
      // 영양소 정보
      if (meal.NTR_INFO) {
        console.log(`Processing nutrition info for meal ${meal.MLSV_YMD} ${meal.MMEAL_SC_NM}`);
        console.log(`Original NTR_INFO: ${meal.NTR_INFO}`);
        
        // 원본 영양소 정보 저장
        const originalNtrInfo = meal.NTR_INFO;
        
        // 정규화된 영양소 정보 생성
        const formattedNtrInfo = formatNutritionInfo(meal.NTR_INFO);
        console.log(`Formatted NTR_INFO: ${formattedNtrInfo}`);
        
        // ntr_info 필드에 이미 정규화된 정보가 있는지 확인
        if (meal.ntr_info !== formattedNtrInfo) {
          console.log(`Nutrition info update needed for meal ${meal.MLSV_YMD} ${meal.MMEAL_SC_NM}`);
          meal.ntr_info = formattedNtrInfo;
          needUpdate = true;
        }
      }
      
      // 원산지 정보 정규화
      let originInfo = meal.ORPLC_INFO || null;
      
      console.log(`[원산지 디버깅] 원본 원산지 정보:`, originInfo);
      
      if (originInfo) {
        // 원본 정보 기록
        const originalOriginInfo = originInfo;
        
        // 정규화된 원산지 정보 생성
        const formattedOriginInfo = formatOriginInfo(originInfo);
        console.log(`[원산지 디버깅] 정규화된 원산지 정보:`, formattedOriginInfo);
        
        // 최종 원산지 정보 저장
        originInfo = formattedOriginInfo;
      }
      
      meals.push({
        school_code: schoolCode,
        meal_date: mealDate,
        meal_type: mealType,
        menu_items: menuItems,
        kcal: meal.CAL_INFO || '0 kcal',
        origin_info: originInfo,
        ntr_info: ntrInfo
      });
    }
    
    // '중식'만 필터링해서 반환
    const lunchMeals = meals.filter(meal => meal.meal_type === '중식');
    console.log(`파싱된 중식 급식 정보: ${lunchMeals.length}개`);
    return lunchMeals;
  } catch (err) {
    console.error('급식 정보 조회 실패:', err);
    return [];
  }
}

/**
 * 영양소 정보를 서버 측에서 정규화하는 함수
 * @param {string} ntrInfo - NEIS API에서 받은 원본 영양소 정보
 * @returns {string} - 정규화된 영양소 정보 (영양소명 : 수치(단위) 형식)
 */
function formatNutritionInfo(ntrInfo) {
  if (!ntrInfo) return '';
  
  // HTML 태그 제거 및 줄바꾸기 처리
  const cleanNtrInfo = ntrInfo.replace(/<br\s*\/?>/gi, '\n');
  const items = cleanNtrInfo.split(/\n/).map(item => item.trim()).filter(Boolean);
  
  // 주요 영양소 순서 정의 (탄수화물, 단백질, 지방 순)
  const mainNutrientOrder = ['탄수화물', '단백질', '지방'];
  
  // 영양소 분류
  const mainNutrients = [];
  const otherNutrients = [];
  
  // 영양소 파싱 및 분류
  items.forEach(item => {
    // 예: 탄수화물(g) : 73.6
    const match = item.match(/(.+?)\s*[:\uff1a]\s*(.+)/);
    if (match) {
      let nutrientName = match[1].trim();
      let value = match[2].trim();
      
      // 영양소 이름과 단위 분리
      let baseName = nutrientName;
      let unit = '';
      
      // (g) 같은 단위가 있는지 추출
      const unitMatch = nutrientName.match(/\(([^)]+)\)/);
      if (unitMatch) {
        unit = unitMatch[1];
        // 영양소 이름에서 단위 제거
        baseName = nutrientName.replace(/\s*\([^)]*\)\s*/, '');
      }
      
      // 숫자 값 추출 - 정렬을 위해 필요
      const numericValue = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
      
      // '영양소명 : 수치(단위)' 형식으로 변경
      const formattedText = unit 
        ? `${baseName} : ${numericValue}(${unit})` 
        : `${baseName} : ${numericValue}`;
      
      // 영양소 분류
      if (mainNutrientOrder.includes(baseName)) {
        mainNutrients.push({ 
          name: baseName, 
          formattedText,
          numeric: numericValue,
          order: mainNutrientOrder.indexOf(baseName) // 정렬을 위한 순서 값
        });
      } else {
        otherNutrients.push({ 
          name: baseName, 
          formattedText,
          numeric: numericValue
        });
      }
    }
  });
  
  // 주요 영양소는 정해진 순서로, 기타 영양소는 값 기준 내림차순 정렬
  const sortedMainNutrients = mainNutrients.sort((a, b) => a.order - b.order);
  const sortedOtherNutrients = otherNutrients.sort((a, b) => b.numeric - a.numeric);
  
  // 정렬된 영양소 목록 생성
  let result = '';
  
  // 주요 영양소 출력
  sortedMainNutrients.forEach(nutrient => {
    result += `${nutrient.formattedText}\n`;
  });
  
  // 구분을 위한 개행 (주요 영양소와 기타 영양소 사이)
  if (sortedMainNutrients.length > 0 && sortedOtherNutrients.length > 0) {
    result += '\n';
  }
  
  // 기타 영양소 출력
  sortedOtherNutrients.forEach(nutrient => {
    result += `${nutrient.formattedText}\n`;
  });
  
  return result.trim();
}

/**
 * 원산지 정보를 서버 측에서 정규화하는 함수
 * @param {string|object} originInfo - NEIS API에서 받은 원본 원산지 정보
 * @returns {string} - 정규화된 원산지 정보 (식재료 : 원산지 형식)
 */
function formatOriginInfo(originInfo) {
  // originInfo가 없거나 빈 배열이거나 빈 문자열일 경우 처리
  if (!originInfo || (Array.isArray(originInfo) && originInfo.length === 0) || originInfo === '[]') {
    return null;
  }

  // 문자열로 변환 및 <br>, <br/> 태그를 줄바꿈으로 변환
  let strOriginInfo = typeof originInfo === 'string' ? originInfo : JSON.stringify(originInfo);
  let clean = strOriginInfo.replace(/\<br\s*\/?>\>/gi, '\n');

  // 각 줄별로 정리, "비고" 등 제외
  const lines = clean
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      return line && 
             !line.startsWith('비고') &&
             line.includes(' : ') && // ' : '가 포함된 줄만 포함 (원산지 정보가 있는 줄)
             !line.includes('수산가공품') && // 수산가공품 제외
             !line.includes('식육가공품'); // 식육가공품 제외
    });
    
  // 한우 처리를 위한 한우 관련 줄 찾기
  const hanwooLine = clean
    .split('\n')
    .find(line => line.includes('한우') || line.includes('쇠고기(종류)') || (line.includes('쇠고기') && line.includes('국내산')));
  
  // 원산지별 재료 분류
  const originGroups = {};
  
  // 한우가 있는 경우 국내산에 쇠고기 추가
  if (hanwooLine) {
    if (!originGroups['국내산']) {
      originGroups['국내산'] = new Set();
    }
    originGroups['국내산'].add('쇠고기');
  }
  
  // 한우 관련 줄 제외
  const filteredLines = lines.filter(line => 
    !line.includes('한우') && 
    !line.includes('쇠고기(종류)') && 
    !(line.includes('쇠고기') && line.includes('국내산(한우)'))
  );
  
  // skipPatterns에 일치하는 원산지 정보는 건너뛸
  const skipPatterns = [/비고/i, /가공품/i, /수산가공품/i, /식육가공품/i];

  filteredLines.forEach(line => {
    // 특수케이스 제외
    if (skipPatterns.some(pattern => pattern.test(line))) {
      return;
    }

    // 재료명과 원산지 분리
    const parts = line.split(' : ');
    if (parts.length === 2) {
      let ingredient = parts[0];
      let origin = parts[1];
      
      // 괄호와 그 안의 내용 추출 (예: 수입산(중국외) -> 중국)
      const bracketMatch = origin.match(/\(([^)]*)\)/);
      
      // 원산지가 '국내산' 또는 '국산'인 경우 '국내산'으로 통일
      if (origin === '국내산' || origin === '국산') {
        if (!originGroups['국내산']) {
          originGroups['국내산'] = new Set();
        }
        originGroups['국내산'].add(ingredient);
        return;
      } 

      // 괄호 안에 나라 이름이 있는 경우 그것을 사용
      if (bracketMatch && bracketMatch[1]) {
        let countryText = bracketMatch[1];
        
        // '외', '등' 등의 불필요한 단어 제거
        countryText = countryText.replace(/\s*\uc678$/, '').replace(/\s*\ub4f1$/, '');
        
        // 콤마로 구분된 나라들이 있는 경우
        if (countryText.includes(',')) {
          // 괄호 안의 나라 이름들을 각각 처리
          const countries = countryText.split(',').map(c => c.trim().replace(/\s*\ub4f1$/, '').replace(/\s*\uc678$/, ''));
        
          // 각 나라마다 재료 추가
          countries.forEach(country => {
            if (country && country !== '등' && country !== '외') {
              if (!originGroups[country]) {
                originGroups[country] = new Set();
              }
              originGroups[country].add(ingredient);
            }
          });
          return; // 각 나라로 처리했으니 더 이상 처리 안함
        } else {
          // 단일 나라인 경우
          if (countryText && countryText !== '등' && countryText !== '외') {
            if (!originGroups[countryText]) {
              originGroups[countryText] = new Set();
            }
            originGroups[countryText].add(ingredient);
            return; // 처리 완료
          }
        }
      }
      
      // 괄호가 없거나 괄호 안에 유의미한 값이 없는 경우
      // 원산지 처리
      origin = origin.replace(/\([^)]*\)/g, '').trim();
      
      // '수입산'이 있는 경우 건너뛸
      if (origin === '수입산') {
        return;
      }
      
      // '외국산'이 있는 경우 건너뛸
      if (origin === '외국산') {
        return;
      }
      
      // '러시아', '베트남' 등 나라 이름은 그대로 사용
      
      // 가공품, 식육가공품 등 불필요한 단어 제거
      ingredient = ingredient
        .replace(/\s*\uac00\uacf5\ud488$/g, '')
        .replace(/\s*\uc2dd\uc721\uac00\uacf5\ud488$/g, '')
        .replace(/\uc2dd\uc721/g, '')
        .replace(/\uc218\uc0b0/g, '')
        // "고기" 중복 제거 (쇠고기 → 쇠, 돼지고기 → 돼지)
        .replace(/\uace0\uae30$/g, '')
        .trim();
      
      // 쇠고기(종류) 제거
      if (ingredient.includes('(종류)')) {
        ingredient = ingredient.replace(/\(\uc885\ub958\)/g, '').trim();
        
        // 쇠고기는 국내산으로 처리
        if (ingredient === '쇠고기' || ingredient.includes('한우')) {
          if (!originGroups['국내산']) {
            originGroups['국내산'] = new Set();
          }
          originGroups['국내산'].add('쇠고기');
          return;
        }
      }
      
      // 원산지별 중복없는 Set 초기화
      if (!originGroups[origin]) {
        originGroups[origin] = new Set();
      }
      
      // 중복 없이 저장 (세트 사용)
      originGroups[origin].add(ingredient);
    }
  });
  
  // 결과 포맷팅
  let result = '';
  
  // 국내산을 가장 먼저 표시하고, 나머지는 가나다순으로 정렬
  // 국내산 먼저 출력
  if (originGroups['국내산'] && originGroups['국내산'].size > 0) {
    const sortedDomestic = Array.from(originGroups['국내산']).sort((a, b) => a.localeCompare(b, 'ko'));
    result += `국내산 : ${sortedDomestic.join(', ')}\n`;
  }
  
  // 나머지 원산지는 가나다순으로 정렬하여 출력 (한글 정렬)
  Object.keys(originGroups)
    .filter(origin => origin !== '국내산') // 국내산 제외
    .sort((a, b) => a.localeCompare(b, 'ko')) // 가나다순 정렬 (한글 정렬)
    .forEach(origin => {
      if (originGroups[origin].size > 0) {
        // 각 원산지 내에서도 재료를 가나다순 정렬
        const sortedIngredients = Array.from(originGroups[origin]).sort((a, b) => a.localeCompare(b, 'ko'));
        result += `${origin} : ${sortedIngredients.join(', ')}\n`;
      }
    });
  
  return result.trim();
}

// 급식 정보 가져오기 함수
// @param schoolCode 학교 코드
// @param officeCode 교육청 코드
// @returns 급식 정보 객체
async function fetchMealData(schoolCode, officeCode) {
  try {
    // 한국 시간 기준 오늘 날짜 (YYYYMMDD 형식)
    const dateStr = getTodayDate('YYYYMMDD');
    const today = getTodayDate();
    
    console.log(`급식 정보 조회: ${schoolCode} (${officeCode}) - ${dateStr}`);
    
    // NEIS API 키 설정 여부 출력
    console.log('NEIS_API_KEY 설정 여부:', process.env.NEIS_API_KEY ? '설정됨' : '설정되지 않음');
    
    // NEIS API 호출 URL 구성
    const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
    const params = {
      KEY: process.env.NEIS_API_KEY,
      Type: 'json',
      ATPT_OFCDC_SC_CODE: officeCode, // 교육청 코드 (필수값)
      SD_SCHUL_CODE: schoolCode,      // 학교 코드
      MLSV_YMD: dateStr,              // 조회할 날짜(YYYYMMDD)
      pSize: 100                      // 가져올 항목 수
    };
    const queryParams = new URLSearchParams(params);
    const fullUrl = `${apiUrl}?${queryParams.toString()}`;
    console.log(`급식 API 요청 URL: ${fullUrl}`);
    
    // API 호출
    const data = await fetchWithPromise(fullUrl);
    
    // 응답 데이터 간단한 로그
    console.log('급식 API 응답 연결 성공');
    
    // API 키 설정 확인
    console.log('NEIS_API_KEY 설정 여부:', process.env.NEIS_API_KEY ? '설정됨' : '설정되지 않음');
    
    // 응답 처리 - 기존 parseMealInfo 함수 사용
    const meals = parseMealInfo(data);
    
    if (meals.length === 0) {
      // 데이터가 없는 경우 기본 값 반환
      console.log(`[디버깅] fetchMealData: 메뉴 정보 없음`);
      
      // 기존 데이터 확인 후 없을 경우에만 대체 값 사용
      try {
        // 날짜 한 번 더 확인
        if (today) {
          console.log(`[디버깅] 데이터 없음 - 대체 값 사용 전 기존 데이터 확인`);
        }
        
        // 기존 DB에 저장된 정보가 있는지 확인
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data: existingData } = await supabase
          .from('meal_menus')
          .select('origin_info, ntr_info')
          .eq('school_code', schoolCode)
          .eq('meal_date', today)
          .eq('meal_type', '중식')
          .maybeSingle(); // 결과가 없어도 오류 발생 안함
        
        if (existingData) {
          console.log(`[디버깅] 기존 데이터 존재:`, existingData);
          
          return {
            school_code: schoolCode,
            meal_date: today,
            meal_type: 'lunch',
            menu_items: ['급식 정보가 없습니다'],
            kcal: '0kcal',
            origin_info: existingData.origin_info || '정보 없음',
            ntr_info: existingData.ntr_info || {}
          };
        }
      } catch (e) {
        console.error(`[디버깅] 기존 데이터 확인 오류:`, e);
        // 오류 발생 시 기본값 사용
      }
      
      // 기존 데이터 없을 경우 기본 값 사용
      return {
        school_code: schoolCode,
        meal_date: today,
        meal_type: 'lunch',
        menu_items: ['급식 정보가 없습니다'],
        kcal: '0kcal',
        origin_info: '정보 없음', // 기본값 사용
        ntr_info: {}
      };
    }
    
    // 처음 찾은 급식 정보 반환
    return meals[0];
  } catch (error) {
    console.error('급식 정보 조회 실패:', error);
    
    // 오류 발생 시 기본 데이터 반환 (실제 데이터 있을 경우 그 데이터 유지)
    return {
      school_code: schoolCode,
      meal_date: getTodayDate(),
      meal_type: 'lunch',
      menu_items: ['급식 정보를 가져오는 중 오류가 발생했습니다'],
      kcal: '0kcal',
      // 가능한 경우 이전에 저장된 원산지 정보를 가져와서 사용, 없는 경우만 '정보 없음' 사용
      origin_info: null, // 실제 호출 시점에 결정되도록 null로 설정
      ntr_info: null // 실제 호출 시점에 결정되도록 null로 설정
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
    // Supabase 설정 확인
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase 클라이언트 초기화 완료');
    
    // 1. DB에서 등록된 학교 정보 가져오기
    console.log('등록된 학교 정보 조회 시작');
    const { data: schoolData, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, office_code');
    
    if (schoolError) {
      throw new Error(`학교 정보 조회 실패: ${schoolError.message}`);
    }
    
    if (!schoolData || schoolData.length === 0) {
      throw new Error('등록된 학교 정보가 없습니다');
    }
    
    console.log(`총 ${schoolData.length}개 학교의 급식 정보 업데이트 시작`);
    
    // 기본 결과 저장용 변수
    const results = {
      success: 0,
      empty: 0,
      error: 0,
      details: []
    };
    
    // 2. 각 학교별 급식 정보 가져오기
    for (const school of schoolData) {
      try {
        console.log(`[${school.school_code}] 학교 급식 조회 시작`);
        
        // 교육청 코드 유효성 확인
        if (!school.office_code) {
          console.log(`[${school.school_code}] 학교의 교육청 코드가 없습니다`);
          results.error++;
          results.details.push({
            school_code: school.school_code,
            status: 'error',
            message: '교육청 코드 없음'
          });
          continue; // 다음 학교로 이동
        }
        
        // 급식 정보 가져오기 - 학교정보 테이블에서 가져온 교육청 코드 사용
        const mealData = await fetchMealData(school.school_code, school.office_code);
        
        // 급식 정보 체크 - 아예 비어있거나 "급식 정보가 없습니다" 같은 기본 메시지만 있는 경우 또는 fetch 오류 메시지를 포함하는 경우
        if (!mealData || !mealData.menu_items || mealData.menu_items.length === 0 || 
            (mealData.menu_items.length === 1 && (
              mealData.menu_items[0].includes('급식 정보가 없습니다') || 
              mealData.menu_items[0].includes('오류가 발생') ||
              mealData.menu_items[0].includes('정보 없음')
            ))) {
          console.log(`[${school.school_code}] 학교 급식 정보 없음`);
          
          // 기존 데이터가 있는지 먼저 확인 (원산지 및 영양소 정보)
          const { data: existingData } = await supabase
            .from('meal_menus')
            .select('origin_info, ntr_info')
            .eq('school_code', school.school_code)
            .eq('meal_date', getTodayDate())
            .eq('meal_type', '중식')
            .single();
            
          // 급식 없음 정보도 DB에 명시적으로 저장
          const emptyMealData = {
            school_code: school.school_code,
            meal_date: getTodayDate(),
            meal_type: '중식',  // 한글로 변경 ('lunch' -> '중식')
            menu_items: ['급식 정보가 없습니다'],
            kcal: '0 kcal',  // 표기법 통일
            // 기존에 저장된 영양소 정보가 있으면 그대로 유지
            ntr_info: (existingData && existingData.ntr_info) || {}, 
            // 기존에 저장된 원산지 정보가 있으면 그대로 유지
            // 원본 원산지 정보의 항상성을 유지하기 위해 기록
            origin_info: (existingData && existingData.origin_info) || '정보 없음'
          };
          
          // DB에 급식 없음 상태 저장 - upsert 사용(테이블에 unique 제약조건 있음)
          const { data, error } = await supabase
            .from('meal_menus')
            .upsert([emptyMealData], { 
              onConflict: 'school_code,meal_date,meal_type' 
            });
            
          if (error) {
            console.error(`[${school.school_code}] 급식 없음 정보 저장 오류:`, error);
            results.error++;
            results.details.push({
              school_code: school.school_code,
              status: 'error',
              message: `급식 없음 정보 저장 실패: ${error.message}`
            });
          } else {
            console.log(`[${school.school_code}] 급식 없음 정보 저장 성공`);
            
            // 급식 없음 정보도 메뉴 아이템 테이블에 저장
            try {
              // 저장된 급식의 ID 가져오기
              const { data: savedMeal, error: selectError } = await supabase
                .from('meal_menus')
                .select('id')
                .eq('school_code', school.school_code)
                .eq('meal_date', getTodayDate())
                .eq('meal_type', '중식')
                .single();
              
              if (selectError) {
                console.error(`[${school.school_code}] 급식 없음 ID 조회 오류:`, selectError);
              } else if (savedMeal && savedMeal.id) {
                // 메뉴 아이템 개별 저장 함수 호출
                await saveMenuItems(savedMeal.id, emptyMealData.menu_items, school.school_code);
              }
            } catch (menuItemError) {
              console.error(`[${school.school_code}] 급식 없음 메뉴 아이템 저장 중 오류:`, menuItemError);
              // 메뉴 아이템 저장 실패는 전체 급식 업데이트 결과에 영향을 주지 않음
            }
            
            results.empty++;
            results.details.push({
              school_code: school.school_code,
              status: 'empty_saved',
              message: '급식 정보 없음 (저장됨)'
            });
          }
          
          continue; // 다음 학교로 이동
        }
        
        // 3. DB에 저장 (meal_menus 테이블)
        // 3. DB에 저장 (meal_menus 테이블) - upsert 사용(테이블에 unique 제약조간 있음)
        const { data, error } = await supabase
          .from('meal_menus')
          .upsert([mealData], { 
            onConflict: 'school_code,meal_date,meal_type' 
          });
          
        if (error) {
          console.error(`[${school.school_code}] 학교 급식 정보 저장 오류:`, error);
          results.error++;
          results.details.push({
            school_code: school.school_code,
            status: 'error',
            message: error.message
          });
        } else {
          console.log(`[${school.school_code}] 학교 급식 정보 저장 성공`);
          
          // 급식 정보 저장 성공 후 메뉴 아이템 개별 저장 시도
          try {
            console.log(`[${school.school_code}] 저장된 급식의 ID 조회 시도 (meal_date: ${mealData.meal_date})`);
            // 저장된 급식의 ID 가져오기 - 서비스 롤 키 사용
            const { data: savedMeal, error: selectError } = await supabaseAdmin
              .from('meal_menus')
              .select('id')
              .eq('school_code', school.school_code)
              .eq('meal_date', mealData.meal_date)
              .eq('meal_type', mealData.meal_type)
              .single();
            
            if (selectError) {
              console.error(`[${school.school_code}] 급식 ID 조회 오류:`, selectError);
            } else if (savedMeal && savedMeal.id) {
              console.log(`[${school.school_code}] 급식 ID 조회 성공: ${savedMeal.id}`);
              console.log(`[${school.school_code}] 메뉴 아이템 ${mealData.menu_items.length}개 저장 시도`);
              // 메뉴 아이템 개별 저장 함수 호출
              const saveResult = await saveMenuItems(savedMeal.id, mealData.menu_items, school.school_code);
              console.log(`[${school.school_code}] 메뉴 아이템 저장 결과: ${saveResult ? '성공' : '실패'}`);
            } else {
              console.error(`[${school.school_code}] 급식 ID를 찾을 수 없음`);
            }
          } catch (menuItemError) {
            console.error(`[${school.school_code}] 메뉴 아이템 저장 중 오류:`, menuItemError);
            // 메뉴 아이템 저장 실패는 전체 급식 업데이트 결과에 영향을 주지 않음
          }
          
          results.success++;
          results.details.push({
            school_code: school.school_code,
            status: 'success',
            menu_count: mealData.menu_items.length
          });
        }
      } catch (schoolError) {
        console.error(`[${school.school_code}] 학교 처리 중 오류:`, schoolError);
        results.error++;
        results.details.push({
          school_code: school.school_code,
          status: 'error',
          message: schoolError.message
        });
      }
      
      // API 호출 제한을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }
    
    // 메뉴 아이템 개별 저장 함수
async function saveMenuItems(mealId, menuItems, schoolCode) {
  console.log(`[${schoolCode}] 메뉴 아이템 저장 시작: 항목 수 ${menuItems.length}, 급식 ID: ${mealId}`);
  
  if (!mealId) {
    console.error(`[${schoolCode}] 급식 ID가 없어 메뉴 아이템을 저장할 수 없습니다.`);
    return false;
  }
  
  if (!menuItems || menuItems.length === 0) {
    console.error(`[${schoolCode}] 저장할 메뉴 아이템이 없습니다.`);
    return false;
  }
  
  try {
    console.log(`[${schoolCode}] 기존 메뉴 아이템 삭제 시도 (meal_id: ${mealId})`);
    // 기존 메뉴 아이템 삭제 (재저장 시 중복 방지) - 서비스 롤 키 사용
    const { error: deleteError } = await supabaseAdmin
      .from('meal_menu_items')
      .delete()
      .eq('meal_id', mealId);
    
    if (deleteError) {
      console.error(`[${schoolCode}] 기존 메뉴 아이템 삭제 오류:`, deleteError);
      return false;
    }
    
    // 새 메뉴 아이템 저장
    const menuItemsToInsert = menuItems.map((item, index) => ({
      meal_id: mealId,
      item_name: item,
      item_order: index + 1
    }));
    
    console.log(`[${schoolCode}] 새 메뉴 아이템 ${menuItemsToInsert.length}개 저장 시도:`, 
      JSON.stringify(menuItemsToInsert.slice(0, 2)) + (menuItemsToInsert.length > 2 ? '...' : ''));
    
    // 서비스 롤 키를 사용하여 RLS 정책 우회
    const { data, error } = await supabaseAdmin
      .from('meal_menu_items')
      .insert(menuItemsToInsert);
    
    if (error) {
      console.error(`[${schoolCode}] 메뉴 아이템 저장 오류:`, error);
      return false;
    }
    
    console.log(`[${schoolCode}] 메뉴 아이템 ${menuItemsToInsert.length}개 저장 완료`);
    return true;
  } catch (err) {
    console.error(`[${schoolCode}] 메뉴 아이템 저장 중 예외 발생:`, err);
    return false;
  }
}

// 응답 반환
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `급식 정보 업데이트 완료: 성공 ${results.success}, 없음 ${results.empty}, 오류 ${results.error}`,
        results: results,
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
