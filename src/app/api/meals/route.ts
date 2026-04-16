import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 교육부 API 키
const API_KEY = process.env.NEIS_API_KEY || '';

/**
 * 날짜 형식 변환 (YYYYMMDD)
 * @param date 날짜 객체
 * @returns YYYYMMDD 형식의 문자열
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 오늘 기준 7일 범위 생성 (오늘 포함 앞뒤 3일씩)
 * @param centerDate 중심 날짜 (YYYY-MM-DD 형식)
 * @returns 7일간의 날짜 배열 (YYYY-MM-DD 형식)
 */
function generate7DayRange(centerDate: string): string[] {
  const center = new Date(centerDate);
  const dates = [];
  
  // 앞뒤 3일씩 총 7일
  for (let i = -3; i <= 3; i++) {
    const targetDate = new Date(center);
    targetDate.setDate(center.getDate() + i);
    dates.push(targetDate.toISOString().split('T')[0]);
  }
  
  return dates;
}

/**
 * 급식 정보 API 호출 (단일 날짜 또는 날짜 범위)
 * @param schoolCode 학교 코드
 * @param officeCode 교육청 코드
 * @param date 날짜 (YYYYMMDD 형식) 또는 시작 날짜
 * @param endDate 종료 날짜 (YYYYMMDD 형식, 선택적)
 * @returns 급식 정보
 */
async function fetchMealInfo(schoolCode: string, officeCode: string, date: string, endDate?: string) {
  // 날짜 형식을 YYYYMMDD로 변환
  let apiStartDate = date;
  let apiEndDate = endDate;
  
  if (date && date.includes('-')) {
    apiStartDate = date.replace(/-/g, '');
  }
  if (endDate && endDate.includes('-')) {
    apiEndDate = endDate.replace(/-/g, '');
  }
  
  // NEIS API 호출 URL 구성
  const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
  const queryParams = new URLSearchParams({
    KEY: API_KEY,
    Type: 'json',
    pIndex: '1',
    pSize: '100',
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
    MMEAL_SC_CODE: '2', // 중식
  });

  // 날짜 범위 또는 단일 날짜 설정
  if (apiEndDate) {
    queryParams.set('MLSV_FROM_YMD', apiStartDate);
    queryParams.set('MLSV_TO_YMD', apiEndDate);
    console.log(`급식 API 요청 (범위): ${apiStartDate} ~ ${apiEndDate}`);
  } else {
    queryParams.set('MLSV_YMD', apiStartDate);
    console.log(`급식 API 요청 (단일): ${apiStartDate}`);
  }

  const fullUrl = `${apiUrl}?${queryParams.toString()}`;
  const safeLogUrl = fullUrl.replace(/KEY=[^&]+/, 'KEY=[REDACTED]');
  console.log(`급식 API 요청 URL: ${safeLogUrl}`);

  const response = await fetch(fullUrl);
  
  if (!response.ok) {
    console.error(`API 응답 상태 코드: ${response.status}`);
    throw new Error('교육부 급식 API 호출 실패');
  }

  const data = await response.json();
  return data;
}

/**
 * 급식 정보 파싱
 * @param apiResponse API 응답 데이터
 * @returns 파싱된 급식 정보
 */
function parseMealInfo(apiResponse: any) {
  // 파싱된 급식 정보 결과 배열
  const meals = [];
  
  // NEIS API 응답 구조: { RESULT: { CODE: 'SUCCESS' }, mealServiceDietInfo: [{ head: [...] }, { row: [...] }] }
  if (apiResponse.mealServiceDietInfo && Array.isArray(apiResponse.mealServiceDietInfo)) {
    // 응답에 mealServiceDietInfo가 있고 배열인 경우
    if (apiResponse.mealServiceDietInfo.length > 1 && apiResponse.mealServiceDietInfo[1].row) {
      const mealRows = apiResponse.mealServiceDietInfo[1].row;
      
      // 각 급식 정보 처리
      for (const meal of mealRows) {
        // 메뉴 항목 파싱 (불필요한 문자 제거)
        let menuItems = [];
        if (meal.DDISH_NM) {
          menuItems = meal.DDISH_NM
            .replace(/<br\s*\/?>\>/gi, '\n')
            .split('\n')
            .map(item => {
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
            .filter(item => item && item.length > 0); // 빈 항목 제거
        }

        // 날짜 형식 통일 (YYYYMMDD -> YYYY-MM-DD)
        let formattedDate = meal.MLSV_YMD;
        if (formattedDate && formattedDate.length === 8) {
          formattedDate = `${formattedDate.substring(0, 4)}-${formattedDate.substring(4, 6)}-${formattedDate.substring(6, 8)}`;
        }

        // 식사 타입 한글로 통일
        let mealType = meal.MMEAL_SC_NM;
        if (mealType === 'breakfast' || mealType === 'Breakfast') {
          mealType = '조식';
        } else if (mealType === 'lunch' || mealType === 'Lunch') {
          mealType = '중식';
        } else if (mealType === 'dinner' || mealType === 'Dinner') {
          mealType = '석식';
        }

        // 원산지 정보 정규화 (formatOriginInfo 함수 참고)
        let originInfo = meal.ORPLC_INFO || null;
        if (originInfo) {
          // 문자열로 변환 및 HTML 태그 제거
          let strOriginInfo = typeof originInfo === 'string' ? originInfo : JSON.stringify(originInfo);
          strOriginInfo = strOriginInfo.replace(/<br\s*\/?>/gi, '\n');
          
          // 불필요한 텍스트 제거 (비고, 가공품 등)
          const lines = strOriginInfo
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
              return line && 
                     !line.startsWith('비고') &&
                     line.includes(' : ') && // ' : '가 포함된 줄만 포함 (원산지 정보가 있는 줄)
                     !line.includes('수산가공품') && // 수산가공품 제외
                     !line.includes('식육가공품'); // 식육가공품 제외
            });
          
          // skipPatterns에 일치하는 원산지 정보는 건너뛰
          const skipPatterns = [/비고/i, /가공품/i, /수산가공품/i, /식육가공품/i];
          
          // 정규화된 원산지 정보를 저장
          originInfo = lines
            .filter(line => !skipPatterns.some(pattern => pattern.test(line)))
            .join('\n');
        }
        
        // 영양소 정보 정규화 (formatNutritionInfo 함수 참고)
        let ntrInfo = meal.NTR_INFO || null;
        if (ntrInfo) {
          // 문자열이면 그대로 사용, 그렇지 않으면 문자열로 변환
          let strNtrInfo = typeof ntrInfo === 'string' ? ntrInfo : JSON.stringify(ntrInfo);
          
          // HTML 태그 제거
          strNtrInfo = strNtrInfo.replace(/<br\s*\/?>/gi, '\n');
          
          // 정규화된 영양소 정보를 저장
          ntrInfo = strNtrInfo;
        }
        
        meals.push({
          school_code: meal.SD_SCHUL_CODE,
          office_code: meal.ATPT_OFCDC_SC_CODE,
          meal_date: formattedDate, // 형식화된 날짜 사용
          meal_type: mealType,     // 한글화된 타입 사용
          menu_items: menuItems,
          kcal: meal.CAL_INFO || '0 kcal',
          // nutrition_info 필드 제거
          origin_info: originInfo,
          ntr_info: ntrInfo, // 정규화된 영양소 정보
          raw_data: meal,
        });
      }
    }
  } else if (apiResponse.RESULT && apiResponse.RESULT.CODE !== 'SUCCESS') {
    // API 오류 응답인 경우
    console.error(`API 오류: ${apiResponse.RESULT.CODE} - ${apiResponse.RESULT.MESSAGE || '알 수 없는 오류'}`);
  }

  return meals;
}

/**
 * 급식 정보를 DB에 저장하는 함수
 * @param supabase Supabase 클라이언트
 * @param schoolCode 학교 코드
 * @param officeCode 교육청 코드
 * @param date 날짜 (YYYY-MM-DD)
 * @param meals 급식 정보 배열
 */
async function saveMealData(supabase: any, schoolCode: string, officeCode: string, date: string, meals: any[]) {
  if (meals && meals.length > 0) {
    // 급식 정보가 있는 경우
    const mealRecords = meals.map(meal => ({
      school_code: meal.school_code,
      office_code: meal.office_code,
      meal_date: meal.meal_date,
      meal_type: meal.meal_type,
      menu_items: meal.menu_items,
      kcal: meal.kcal,
      origin_info: meal.origin_info,
      ntr_info: meal.ntr_info || ''
    }));
    
    const { error: insertError } = await supabase
      .from('meal_menus')
      .upsert(mealRecords, {
        onConflict: 'school_code,meal_date,meal_type'
      });
      
    if (insertError) {
      console.error('급식 정보 DB 저장 오류:', insertError);
      throw insertError;
    }
  } else {
    // 급식 정보가 없는 경우 빈 레코드 저장
    const emptyRecord = {
      school_code: schoolCode,
      office_code: officeCode,
      meal_date: date,
      meal_type: '중식',
      menu_items: ['급식 정보가 없습니다'],
      kcal: '0 kcal',
      origin_info: null,
      ntr_info: '',
      is_empty_result: true
    };
    
    const { error: emptyInsertError } = await supabase
      .from('meal_menus')
      .upsert([emptyRecord], {
        onConflict: 'school_code,meal_date,meal_type'
      });
      
    if (emptyInsertError) {
      console.error('빈 급식 정보 DB 저장 오류:', emptyInsertError);
      throw emptyInsertError;
    }
  }
}

/**
 * 오늘 날짜 처리: 7일치 로직
 */
async function handleTodayRequest(supabase: any, schoolCode: string, officeCode: string, formattedDate: string, today: string) {
  console.log('🎯 오늘 날짜 감지 - 7일치 급식정보 처리 시작');
  let isDbAvailable = true;

  // 1. 오늘 데이터가 DB에 있는지 확인 (실패 시 API 폴백)
  try {
    const { data: todayData, error: todayError } = await supabase
      .from('meal_menus')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('meal_date', today);

    if (todayError) {
      throw todayError;
    }

    // 2. 오늘 데이터가 있으면 바로 반환
    if (todayData && todayData.length > 0) {
      console.log('✅ 오늘 데이터 이미 존재 - DB에서 반환');
      const hasEmptyResult = todayData.some(meal => meal.is_empty_result);

      return NextResponse.json({
        success: true,
        date: formattedDate,
        meals: hasEmptyResult ? [] : todayData,
        source: 'database',
        is_empty_result: hasEmptyResult,
        school_code: schoolCode,
        office_code: officeCode
      });
    }
  } catch (dbError: any) {
    isDbAvailable = false;
    console.warn('⚠️ 오늘 데이터 DB 조회 실패 - NEIS API 폴백 사용:', dbError?.message || dbError);
  }
  
  // 3. 오늘 데이터가 없으면 7일치 API 호출
  console.log('📅 7일치 범위 API 호출 시작');
  const dates = generate7DayRange(today);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  
  try {
    // 7일치 한번에 API 호출
    console.log(`📅 7일치 범위 API 호출: ${startDate} ~ ${endDate}`);
    const rangeData = await fetchMealInfo(schoolCode, officeCode, startDate, endDate);
    const allMeals = parseMealInfo(rangeData);
    
    // 날짜별로 그룹화
    const mealsByDate = new Map();
    allMeals.forEach(meal => {
      const date = meal.meal_date;
      if (!mealsByDate.has(date)) {
        mealsByDate.set(date, []);
      }
      mealsByDate.get(date).push(meal);
    });
    
    // 각 날짜별로 DB 저장 (캐시용, 실패해도 응답은 계속)
    let todayMeals = [];
    for (const targetDate of dates) {
      const dateMeals = mealsByDate.get(targetDate) || [];
      
      if (targetDate === today) {
        todayMeals = dateMeals;
      }

      if (isDbAvailable) {
        try {
          await saveMealData(supabase, schoolCode, officeCode, targetDate, dateMeals);
        } catch (saveError: any) {
          isDbAvailable = false;
          console.warn(`⚠️ ${targetDate} DB 캐시 저장 실패 (응답은 계속):`, saveError?.message || saveError);
        }
      }
      console.log(`✅ ${targetDate} 급식정보 처리 완료 (${dateMeals.length}개)`);
    }
    
    console.log('🎉 7일치 급식정보 일괄 생성 완료');
    
    const hasEmptyResult = !todayMeals || todayMeals.length === 0;
    
    return NextResponse.json({
      success: true,
      date: formattedDate,
      meals: hasEmptyResult ? [] : todayMeals,
      source: isDbAvailable ? 'api' : 'api-no-cache',
      is_empty_result: hasEmptyResult,
      school_code: schoolCode,
      office_code: officeCode
    });
    
  } catch (rangeError) {
    console.error('❌ 7일치 범위 조회 실패, 1일치로 폴백:', rangeError);
    // 실패 시 1일치 폴백
    return await handleOtherDateRequest(supabase, schoolCode, officeCode, formattedDate);
  }
}

/**
 * 과거/미래 날짜 처리: 1일치 로직
 */
async function handleOtherDateRequest(supabase: any, schoolCode: string, officeCode: string, formattedDate: string) {
  console.log('📅 과거/미래 날짜 - 1일치 급식정보 처리 시작');
  let isDbAvailable = true;

  // 1. DB에서 급식 정보 확인 (실패 시 API 폴백)
  try {
    const { data: dbMeals, error: dbError } = await supabase
      .from('meal_menus')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('meal_date', formattedDate);

    if (dbError) {
      throw dbError;
    }

    // 2. DB에 데이터가 있으면 바로 반환
    if (dbMeals && dbMeals.length > 0) {
      console.log(`DB에서 ${dbMeals.length}개의 급식 정보를 가져왔습니다.`);
      const hasEmptyResult = dbMeals.some(meal => meal.is_empty_result);

      return NextResponse.json({
        success: true,
        date: formattedDate,
        meals: hasEmptyResult ? [] : dbMeals,
        source: 'database',
        is_empty_result: hasEmptyResult,
        school_code: schoolCode,
        office_code: officeCode
      });
    }
  } catch (dbError: any) {
    isDbAvailable = false;
    console.warn('⚠️ 과거/미래 데이터 DB 조회 실패 - NEIS API 폴백 사용:', dbError?.message || dbError);
  }
  
  // 3. DB에 없으면 1일치 API 호출
  console.log('DB에 없는 데이터입니다. 1일치 API 호출을 시도합니다.');
  
  const singleData = await fetchMealInfo(schoolCode, officeCode, formattedDate);
  const meals = parseMealInfo(singleData);
  
  // 4. DB에 저장 (캐시용, 실패해도 응답은 계속)
  if (isDbAvailable) {
    try {
      await saveMealData(supabase, schoolCode, officeCode, formattedDate, meals);
      console.log('급식 정보 저장 성공');
    } catch (saveError: any) {
      isDbAvailable = false;
      console.warn('⚠️ DB 캐시 저장 실패 (응답은 계속):', saveError?.message || saveError);
    }
  }
  
  const hasEmptyResult = !meals || meals.length === 0;
  
  return NextResponse.json({
    success: true,
    date: formattedDate,
    meals: hasEmptyResult ? [] : meals,
    source: isDbAvailable ? 'api' : 'api-no-cache',
    is_empty_result: hasEmptyResult,
    school_code: schoolCode,
    office_code: officeCode
  });
}

/**
 * 특정 학교의 급식 정보 조회 API (GET)
 * 
 * Query Parameters:
 * - school_code: 학교 코드
 * - office_code: 교육청 코드
 * - date: 날짜 (YYYYMMDD 형식, 기본값: 오늘)
 */
export async function GET(request: Request) {
  const cookieStore = await cookies(); // cookies 함수 호출 (await 추가)
  const supabase = createServerClient( // createServerClient 사용
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Next.js cookies() API는 객체를 반환하고 메서드는 더 이상 Promise를 반환하지 않음
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        }
      }
    }
  );

  const { searchParams } = new URL(request.url);
  
  // 파라미터 추출
  const schoolCode = searchParams.get('school_code');
  const officeCode = searchParams.get('office_code');
  const date = searchParams.get('date');
  
  if (!schoolCode || !officeCode || !date) {
    return NextResponse.json(
      { error: '필수 파라미터가 누락되었습니다 (school_code, office_code, date)' },
      { status: 400 }
    );
  }

  try {
    // 날짜 형식 확인 및 통일
    let formattedDate = date;
    if (date && date.length === 8 && !date.includes('-')) {
      formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      console.log(`날짜 형식 변환: ${date} -> ${formattedDate}`);
    }
    
    // 오늘 날짜인지 확인 (KST 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const today = kstNow.toISOString().split('T')[0];
    const isToday = formattedDate === today;
    
    console.log('🔍 날짜 확인:', { formattedDate, today, isToday });
    
    if (isToday) {
      // 🎯 오늘 날짜 처리: 7일치 로직
      return await handleTodayRequest(supabase, schoolCode, officeCode, formattedDate, today);
    } else {
      // 📅 과거/미래 날짜 처리: 1일치 로직
      return await handleOtherDateRequest(supabase, schoolCode, officeCode, formattedDate);
    }
  } catch (error) {
    console.error('급식 정보 API 오류:', error);
    
    // 개발 환경에서는 오류 상세 정보 포함
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `급식 정보를 가져오는 중 오류가 발생했습니다: ${error.message}` 
      : '급식 정보를 가져오는 중 오류가 발생했습니다';
      
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 모든 등록된 학교의 급식 정보를 가져와 DB에 저장 (POST)
 * 스케줄러에서 호출하는 용도
 * 
 * @param {Request} request - HTTP 요청 객체
 * @returns {Promise<NextResponse>} HTTP 응답 객체
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Next.js App Router에서 cookies() API 사용
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        }
      }
    }
  );

  const today = formatDate(new Date());
  
  try {
    // 인증 확인 (실제 환경에서는 적절한 인증 체크 필요)
    // const { data: session } = await supabase.auth.getSession();
    // if (!session?.session) {
    //   return NextResponse.json({ error: '인증되지 않은 요청입니다' }, { status: 401 });
    // }
    
    // 1. DB에서 모든 등록된 학교 정보 가져오기 (중복 제거)
    const { data: schools, error: schoolsError } = await supabase
      .from('school_infos')
      .select('school_code, region')
      .order('school_code');
      
    if (schoolsError) {
      throw new Error(`학교 정보 조회 실패: ${schoolsError.message}`);
    }
    
    if (!schools || schools.length === 0) {
      return NextResponse.json({ message: '등록된 학교가 없습니다' });
    }
    
    // 중복 제거를 위한 Map (school_code + office_code 기준)
    const uniqueSchools = new Map();
    schools.forEach(school => {
      // 교육청 코드 매핑 필요 (region에서 추출하거나 다른 방법 사용)
      // 일단 임시로 "B10" (서울) 코드 사용
      const officeCode = "B10"; // TODO: region에서 교육청 코드 매핑 로직 구현
      const key = `${school.school_code}-${officeCode}`;
      
      if (!uniqueSchools.has(key)) {
        uniqueSchools.set(key, {
          school_code: school.school_code,
          office_code: officeCode
        });
      }
    });
    
    console.log(`총 ${uniqueSchools.size}개 학교의 급식 정보를 가져옵니다...`);
    
    // 2. 각 학교별로 급식 정보 가져오기
    const allMeals = [];
    const errors = [];
    
    for (const [key, school] of uniqueSchools.entries()) {
      try {
        // 급식 API 호출
        const mealData = await fetchMealInfo(school.school_code, school.office_code, today);
        const meals = parseMealInfo(mealData);
        
        if (meals.length > 0) {
          allMeals.push(...meals);
        }
      } catch (error) {
        console.error(`${key} 학교 급식 정보 가져오기 실패:`, error);
        errors.push({
          school_code: school.school_code,
          office_code: school.office_code,
          error: error.message
        });
      }
      
      // API 호출 제한을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // 3. 가져온 급식 정보 DB에 저장
    if (allMeals.length > 0) {
      // 새 데이터 저장 (삭제 대신 학교/날짜/급식타입별로 확인하여 추가 또는 업데이트)
      const mealRecords = allMeals.map(meal => ({
        school_code: meal.school_code,
        office_code: meal.office_code,
        meal_date: meal.meal_date,
        meal_type: meal.meal_type,
        menu_items: meal.menu_items,
        kcal: meal.kcal,
        // nutrition_info 필드 제거
        origin_info: meal.origin_info,
        ntr_info: meal.ntr_info
      }));
      
      // 각 급식 데이터별로 처리
      let updatedCount = 0;
      let insertedCount = 0;
      let errorCount = 0;
      
      for (const meal of mealRecords) {
        try {
          // 해당 학교/날짜/급식 타입에 대한 데이터가 있는지 확인
          const { data: existingMeal, error: selectError } = await supabase
            .from('meal_menus')
            .select('id')
            .eq('school_code', meal.school_code)
            .eq('meal_date', meal.meal_date)
            .eq('meal_type', meal.meal_type)
            .maybeSingle();
            
          if (selectError && selectError.code !== 'PGRST116') { // PGRST116: 결과 없음
            console.error(`급식 데이터 조회 오류: ${selectError.message}`);
            errorCount++;
            continue;
          }

          if (existingMeal) {
            // 기존 데이터가 있으면 업데이트
            const { error: updateError } = await supabase
              .from('meal_menus')
              .update({
                menu_items: meal.menu_items, // 이미 정규화된 데이터를 그대로 사용
                kcal: meal.kcal,
                // nutrition_info 필드 제거
                origin_info: meal.origin_info,
                ntr_info: meal.ntr_info,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingMeal.id);

            if (updateError) {
              console.error(`급식 데이터 업데이트 오류: ${updateError.message}`);
              errorCount++;
            } else {
              updatedCount++;
            }
          } else {
            // 없으면 새로 추가
            const { error: insertError } = await supabase
              .from('meal_menus')
              .insert([meal]);
              
            if (insertError) {
              console.error(`급식 데이터 추가 오류: ${insertError.message}`);
              errorCount++;
            } else {
              insertedCount++;
            }
          }
        } catch (err) {
          console.error(`급식 데이터 처리 중 예외 발생: ${err.message}`);
          errorCount++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `${allMeals.length}개의 급식 정보가 성공적으로 저장되었습니다`,
        errors: errors.length > 0 ? errors : undefined,
        date: today // 원래 입력된 date 사용
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '저장할 급식 정보가 없습니다',
        errors,
        date: today // 원래 입력된 date 사용
      });
    }
  } catch (error) {
    console.error('급식 정보 처리 오류:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: `급식 정보 처리 중 오류가 발생했습니다: ${error.message}` 
      },
      { status: 500 }
    );
  }
}
