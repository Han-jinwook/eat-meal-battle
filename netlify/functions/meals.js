// Netlify 함수: 급식 정보 조회 API
// 파일 경로: netlify/functions/meals.js

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const { v4: uuidv4 } = require('uuid'); // UUID 생성 라이브러리 임포트

// Supabase 환경 변수
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase 클라이언트 초기화 (전역 변수로 한 번만 선언)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase Admin 클라이언트 초기화 (RLS 우회용)
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

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
  let clean = strOriginInfo.replace(/<br\s*\/?>/gi, '\n');

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

// 날짜 형식을 DB에 저장할 YYYY-MM-DD 형식으로 변환
function formatDbDate(dateStr) {
  if (!dateStr) return '';
  
  // 이미 YYYY-MM-DD 형식이면 그대로 반환
  if (dateStr.includes('-') && dateStr.length === 10) {
    return dateStr;
  }
  
  // YYYYMMDD 형식을 YYYY-MM-DD로 변환
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  
  // 기타 형식은 그대로 반환
  return dateStr;
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
      // 로컬 환경과 동일하게 원본 문자열을 그대로 저장
      let ntrInfo = meal.NTR_INFO || '';
      
      // 영양정보가 있지만 문자열이 아닌 경우 문자열로 변환
      if (ntrInfo && typeof ntrInfo !== 'string') {
        try {
          ntrInfo = JSON.stringify(ntrInfo);
        } catch (e) {
          console.log('영양정보 문자열 변환 오류:', e);
          ntrInfo = '';
        }
      }
      
      // 원산지 정보 정규화
      let originInfo = meal.ORPLC_INFO || null;
      
      // 서버 정규화 함수를 사용하여 원산지 정보를 처리
      if (originInfo) {
        originInfo = formatOriginInfo(originInfo);
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
        origin_info: originInfo,
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
    // 날짜 형식 확인 및 통일 (DB 조회 전)
    let formattedDate = date;
    // YYYYMMDD 형식이면 YYYY-MM-DD로 변환
    if (date && date.length === 8 && !date.includes('-')) {
      formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      console.log(`날짜 형식 변환 (조회 전): ${date} -> ${formattedDate}`);
    }
    
    console.log(`급식 정보 조회: ${schoolCode} (${officeCode}) - ${formattedDate}`);
    
    // 1. 먼저 DB에서 급식 정보 조회
    // 전역에서 선언된 supabase 클라이언트 사용
    
    // DB에서 급식 정보 조회
    const { data: existingMealData, error: existingError } = await supabase
      .from('meal_menus')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('meal_date', formattedDate)
      .eq('meal_type', '중식');
    
    // DB에 데이터가 있으면 바로 반환
    if (!existingError && existingMealData && existingMealData.length > 0) {
      console.log(`DB에 저장된 급식 정보 사용: ${schoolCode}, ${formattedDate}`);
      // DB에서 가져온 데이터임을 표시
      const dbMealData = existingMealData[0];
      dbMealData.source = 'database';
      return dbMealData;
    }
    
    // 2. DB에 없으면 API 호출
    console.log('DB에 없는 데이터입니다. API 호출을 시도합니다.');
    
    // 날짜를 YYYYMMDD 형식으로 변환 (API 호출용)
    const apiDate = formatApiDate(date);
    
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
      
      // DB에도 없는 경우, 빈 급식 정보 생성 후 DB 저장
      const emptyMealData = {
        id: uuidv4(),
        school_code: schoolCode,
        office_code: officeCode, // 교육청 코드 추가
        meal_date: formatDbDate(date), // 일관된 형식으로 변환
        meal_type: '중식',  // 한글로 변경
        menu_items: ['급식 정보가 없습니다'],
        kcal: '0 kcal',
        ntr_info: '', 
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
      
      // 빈 데이터도 DB에서 가져온 것으로 표시
      emptyMealData.source = 'database';
      return emptyMealData;
    }
    
    // DB에 저장
    // 기존 데이터 확인 (이미지 참조 여부 확인)
    const { data: existingData, error: mealExistingError } = await supabase
      .from('meal_menus')
      .select('id')
      .eq('school_code', meals[0].school_code)
      .eq('meal_date', meals[0].meal_date)
      .eq('meal_type', meals[0].meal_type)
      .single();
    
    // 기존 데이터 확인 전에 meal_date 형식 일관성 유지
    meals[0].meal_date = formatDbDate(meals[0].meal_date);
    console.log(`DB에 저장할 날짜 형식: ${meals[0].meal_date}`);
    
    // 기존 ID가 있는지 확인
    if (!mealExistingError && existingData && existingData.id) {
      // 해당 ID를 참조하는 이미지가 있는지 확인
      const { data: imageData, error: imageError } = await supabase
        .from('meal_images')
        .select('id')
        .eq('meal_id', existingData.id)
        .limit(1);
      
      if (!imageError && imageData && imageData.length > 0) {
        console.log(`이미지 참조가 있는 급식 데이터 업데이트: ${existingData.id}`);
        
        // ID를 유지하면서 나머지 데이터 업데이트
        const { data: updatedData, error: updateError } = await supabase
          .from('meal_menus')
          .update({
            menu_items: meals[0].menu_items,
            kcal: meals[0].kcal,
            ntr_info: meals[0].ntr_info,
            origin_info: meals[0].origin_info
          })
          .eq('id', existingData.id);
        
        if (updateError) {
          console.error(`급식 정보 업데이트 오류:`, updateError);
        } else {
          console.log(`기존 ID 유지하면서 급식 정보 업데이트 성공`);
        }
        
        // 기존 데이터에 ID 설정
        meals[0].id = existingData.id;
        return meals[0];
      }
    }
    
    // 이미지 참조가 없는 경우 새로 삽입 또는 업데이트
    const { data: savedData, error: saveError } = await supabase
      .from('meal_menus')
      .upsert([meals[0]], { 
        onConflict: 'school_code,meal_date,meal_type' 
      });
    
    if (saveError) {
      console.error(`급식 정보 저장 오류:`, saveError);
    } else {
      console.log(`급식 정보 저장 성공`);
      
      try {
        // 급식 ID 조회
        const { data: mealIdData, error: mealIdError } = await supabaseAdmin
          .from('meal_menus')
          .select('id')
          .eq('school_code', meals[0].school_code)
          .eq('meal_date', meals[0].meal_date)
          .eq('meal_type', meals[0].meal_type)
          .single();
        
        if (mealIdError) {
          console.error(`급식 ID 조회 오류:`, mealIdError);
        } else if (mealIdData && mealIdData.id) {
          console.log(`API에서 가져온 급식의 메뉴 아이템 저장 시도 (meal_id: ${mealIdData.id})`);
          
          // 기존 메뉴 아이템 삭제
          const { error: deleteError } = await supabaseAdmin
            .from('meal_menu_items')
            .delete()
            .eq('meal_id', mealIdData.id);
          
          if (deleteError) {
            console.error(`기존 메뉴 아이템 삭제 오류:`, deleteError);
          } else {
            // 각 메뉴 아이템 저장
            const menuItemsToInsert = meals[0].menu_items.map((item, index) => ({
              meal_id: mealIdData.id,
              item_name: item,
              item_order: index + 1
            }));
            
            console.log(`메뉴 아이템 ${menuItemsToInsert.length}개 삽입 시도`);
            
            const { data: insertData, error: insertError } = await supabaseAdmin
              .from('meal_menu_items')
              .insert(menuItemsToInsert);
            
            if (insertError) {
              console.error(`메뉴 아이템 삽입 오류:`, insertError);
            } else {
              console.log(`메뉴 아이템 ${menuItemsToInsert.length}개 삽입 성공`);
            }
          }
        }
      } catch (menuItemError) {
        console.error(`메뉴 아이템 저장 중 오류:`, menuItemError);
      }
    }
    
    // 처음 찾은 급식 정보 반환 (API에서 가져온 데이터)
    meals[0].source = 'api';
    return meals[0];
  } catch (error) {
    console.error('급식 정보 조회 실패:', error);
    
    // 오류 발생 시 기본 데이터 반환
    const mealData = {
      school_code: schoolCode,
      office_code: officeCode, // 교육청 코드 추가
      meal_date: formatDbDate(date), // 일관된 형식으로 변환
      meal_type: '중식',
      menu_items: ['급식 정보를 가져오는 중 오류가 발생했습니다'],
      kcal: '0 kcal',
      origin_info: [],
      ntr_info: {},
      source: 'error' // 오류 상태를 표시
    };
    return mealData;
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
    // 데이터 소스를 정확히 표시
    const source = mealData.source || 'api';
    
    // 데이터에서 source 필드 제거 (프론트엔드에서는 응답 전체의 source 필드를 사용)
    if (mealData.source) {
      delete mealData.source;
    }
    
    // 급식 ID가 있는 경우 메뉴 아이템 조회
    if (mealData && mealData.id) {
      try {
        console.log(`[급식 정보 API] 급식 ${mealData.id}의 메뉴 아이템 조회 시도 (서비스 롤 키 사용) - 학교코드: ${mealData.school_code}, 날짜: ${mealData.meal_date}`);
        
        // DB 연결 테스트 - id 필드를 사용해서 테스트
        const { data: testData, error: testError } = await supabaseAdmin
          .from('meal_menu_items')
          .select('id')
          .limit(1);
          
        if (testError) {
          console.error(`[급식 정보 API] DB 연결 테스트 실패:`, testError);
        } else {
          console.log(`[급식 정보 API] DB 연결 테스트 성공:`, testData);
        }
        
        // 급식에 대한 메뉴 아이템 조회 - 서비스 롤 키 사용하여 RLS 정책 우회
        const { data: menuItems, error: menuItemsError } = await supabaseAdmin
          .from('meal_menu_items')
          .select('*')
          .eq('meal_id', mealData.id)
          .order('item_order', { ascending: true });
        
        if (menuItemsError) {
          console.error(`[급식 정보 API] 급식 ${mealData.id}의 메뉴 아이템 조회 오류:`, menuItemsError);
          mealData.menuItems = [];
        } else if (menuItems && menuItems.length > 0) {
          // 기존 menu_items 배열은 유지하면서 새로운 menuItems 객체 배열 추가
          console.log(`[급식 정보 API] 급식 ${mealData.id}의 메뉴 아이템 ${menuItems.length}개 조회 성공`);
          console.log(`[급식 정보 API] 처음 ${Math.min(3, menuItems.length)}개 아이템:`, 
            JSON.stringify(menuItems.slice(0, 3)));
          mealData.menuItems = menuItems;
        } else {
          console.log(`[급식 정보 API] 급식 ${mealData.id}의 메뉴 아이템 없음. 기존 menu_items 사용`);
          
          // 기존 menu_items가 있는지 확인
          if (mealData.menu_items && mealData.menu_items.length > 0) {
            console.log(`[급식 정보 API] 기존 menu_items ${mealData.menu_items.length}개 사용`);
          } else {
            console.log(`[급식 정보 API] 기존 menu_items도 없음`);
          }
          
          mealData.menuItems = [];
        }
      } catch (menuItemError) {
        console.error('메뉴 아이템 조회 오류:', menuItemError);
        mealData.menuItems = [];
      }
    }
    
    // 응답 반환
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        meals: Array.isArray(mealData) ? mealData : (mealData ? [mealData] : []),
        source: source,
        date: date // 날짜 정보 추가
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
