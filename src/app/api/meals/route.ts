import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

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
 * 급식 정보 API 호출
 * @param schoolCode 학교 코드
 * @param officeCode 교육청 코드
 * @param date 날짜 (YYYYMMDD 형식)
 * @returns 급식 정보
 */
async function fetchMealInfo(schoolCode: string, officeCode: string, date: string) {
  // NEIS API 호출 URL 구성
  const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
  const queryParams = new URLSearchParams({
    KEY: API_KEY,
    Type: 'json',
    pIndex: '1',
    pSize: '100',
    ATPT_OFCDC_SC_CODE: officeCode, // 시도교육청코드
    SD_SCHUL_CODE: schoolCode,      // 표준학교코드
    MLSV_YMD: date,                 // 급식일자
  });

  const fullUrl = `${apiUrl}?${queryParams.toString()}`;
  console.log(`급식 API 요청 URL: ${fullUrl}`);

  // API 호출
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
            .split('<br/>')
            .map((item: string) => item.replace(/\([0-9\.]+\)/g, '').trim())
            .filter((item: string) => item);
        }

        meals.push({
          school_code: meal.SD_SCHUL_CODE,
          office_code: meal.ATPT_OFCDC_SC_CODE,
          meal_date: meal.MLSV_YMD,
          meal_type: meal.MMEAL_SC_NM, // 조식, 중식, 석식
          menu_items: menuItems,
          kcal: meal.CAL_INFO || null,
          nutrition_info: {
            carbohydrate: meal.CRBHYD || null,
            protein: meal.PROTN || null,
            fat: meal.FAT || null,
            calcium: meal.CA || null,
            iron: meal.FE || null,
            vitamin_a: meal.VITA || null,
            vitamin_c: meal.VITC || null,
          },
          origin_info: meal.ORPLC_INFO || null,
          ntr_info: meal.NTR_INFO || null,
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
 * 특정 학교의 급식 정보 조회 API (GET)
 * 
 * Query Parameters:
 * - school_code: 학교 코드
 * - office_code: 교육청 코드
 * - date: 날짜 (YYYYMMDD 형식, 기본값: 오늘)
 */
export async function GET(request: Request) {
  const supabase = createClient();
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
    // 1. DB에서 급식 정보 가져오기
    const { data: dbMeals, error: dbError } = await supabase
      .from('meal_menus')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('meal_date', date);
      
    if (dbError) {
      throw new Error(`DB 조회 오류: ${dbError.message}`);
    }
    
    // DB에 데이터가 있으면 바로 반환
    if (dbMeals && dbMeals.length > 0) {
      console.log(`DB에서 ${dbMeals.length}개의 급식 정보를 가져왔습니다.`);
      
      // 빈 급식 정보 확인 (meal_type이 'empty'인 경우)
      const hasEmptyResult = dbMeals.some(meal => meal.meal_type === 'empty');
      
      return NextResponse.json({
        success: true,
        date,
        meals: hasEmptyResult ? [] : dbMeals, // 빈 결과인 경우 빈 배열 반환
        source: 'database',
        is_empty_result: hasEmptyResult,
        school_code: schoolCode,
        office_code: officeCode
      });
    }
    
    // 2. DB에 없으면 API 호출
    console.log('DB에 없는 데이터입니다. API 호출을 시도합니다.');
    const mealData = await fetchMealInfo(schoolCode, officeCode, date);
    
    // 급식 정보 파싱
    const meals = parseMealInfo(mealData);
    
    // 3. DB에 결과 저장 (급식 정보가 있던 없던 저장)
    // 급식 정보가 없는 경우도 저장하여 중복 API 호출 방지
    try {
      // 이미 저장된 데이터가 있는지 확인
      const { data: existingData, error: checkError } = await supabase
        .from('meal_menus')
        .select('id')
        .eq('school_code', schoolCode)
        .eq('meal_date', date);
        
      if (checkError) {
        console.error('기존 데이터 확인 오류:', checkError);
      }
      
      // 이미 데이터가 있으면 저장하지 않고 기존 데이터 반환
      if (existingData && existingData.length > 0) {
        console.log(`이미 DB에 ${date} 날짜의 급식 정보가 있습니다.`);
        
        // 기존 데이터를 다시 조회하여 반환
        const { data: existingMeals, error: fetchError } = await supabase
          .from('meal_menus')
          .select('*')
          .eq('school_code', schoolCode)
          .eq('meal_date', date);
          
        if (fetchError) {
          console.error('기존 데이터 조회 오류:', fetchError);
          throw new Error(`기존 데이터 조회 오류: ${fetchError.message}`);
        }
        
        // 빈 급식 정보 확인
        const hasEmptyResult = existingMeals && existingMeals.some(meal => meal.meal_type === 'empty');
        
        return NextResponse.json({
          success: true,
          date,
          meals: hasEmptyResult ? [] : existingMeals,
          source: 'database',
          is_empty_result: hasEmptyResult,
          school_code: schoolCode,
          office_code: officeCode
        });
      }
      
      if (meals && meals.length > 0) {
        // 급식 정보가 있는 경우
        const mealRecords = meals.map(meal => ({
          school_code: meal.school_code,
          office_code: meal.office_code,
          meal_date: meal.meal_date,
          meal_type: meal.meal_type,
          menu_items: meal.menu_items,
          kcal: meal.kcal,
          nutrition_info: meal.nutrition_info,
          origin_info: meal.origin_info,
          ntr_info: meal.ntr_info
        }));
        
        // DB에 저장
        const { error: insertError } = await supabase
          .from('meal_menus')
          .insert(mealRecords);
          
        if (insertError) {
          console.error('급식 정보 DB 저장 오류:', insertError);
        } else {
          console.log(`${meals.length}개의 급식 정보를 DB에 저장했습니다.`);
        }
      } else {
        // 급식 정보가 없는 경우에도 빈 레코드 저장 (중복 API 호출 방지)
        const emptyRecord = {
          school_code: schoolCode,
          office_code: officeCode,
          meal_date: date,
          meal_type: 'empty', // 빈 급식 정보를 표시하는 특별 타입
          menu_items: [],
          kcal: null,
          nutrition_info: {},
          origin_info: null,
          ntr_info: null
        };
        
        // DB에 빈 급식 정보 저장
        const { error: insertEmptyError } = await supabase
          .from('meal_menus')
          .insert([emptyRecord]);
          
        if (insertEmptyError) {
          console.error('빈 급식 정보 DB 저장 오류:', insertEmptyError);
        } else {
          console.log(`${date} 날짜의 빈 급식 정보를 DB에 저장했습니다.`);
        }
        
        // API 응답에 오류 코드가 있는지 확인
        if (mealData.RESULT && mealData.RESULT.CODE !== 'INFO-000') {
          console.error(`API 오류: ${mealData.RESULT.CODE} - ${mealData.RESULT.MESSAGE || '알 수 없는 오류'}`);
        }
      }
    } catch (dbError) {
      console.error('DB 저장 중 오류 발생:', dbError);
    }
    
    // 4. 결과 반환
    // 결과 반환 전에 DB에 저장 작업이 완료되었는지 확인
    // DB에서 최신 데이터 다시 조회
    const { data: savedMeals, error: savedError } = await supabase
      .from('meal_menus')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('meal_date', date);
      
    if (savedError) {
      console.error('저장된 데이터 조회 오류:', savedError);
    }
    
    // 실제로 저장된 데이터가 있으면 그것을 반환, 없으면 API 결과 반환
    const finalMeals = (savedMeals && savedMeals.length > 0) ? savedMeals : meals;
    const hasEmptyMeal = (savedMeals && savedMeals.length > 0) ? 
      savedMeals.some(meal => meal.meal_type === 'empty') : (meals.length === 0);
    
    return NextResponse.json({ 
      success: true,
      date,
      meals: hasEmptyMeal ? [] : finalMeals,
      source: (savedMeals && savedMeals.length > 0) ? 'database' : 'api',
      is_empty_result: hasEmptyMeal,
      school_code: schoolCode,
      office_code: officeCode
    });
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
 */
export async function POST(request: Request) {
  const supabase = createClient();
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
      // 기존 오늘 데이터 삭제 (중복 방지)
      const { error: deleteError } = await supabase
        .from('meal_menus')
        .delete()
        .eq('meal_date', today);
        
      if (deleteError) {
        console.error('기존 급식 데이터 삭제 실패:', deleteError);
      }
      
      // 새 데이터 저장
      const mealRecords = allMeals.map(meal => ({
        school_code: meal.school_code,
        office_code: meal.office_code,
        meal_date: meal.meal_date,
        meal_type: meal.meal_type,
        menu_items: meal.menu_items,
        kcal: meal.kcal,
        nutrition_info: meal.nutrition_info,
        origin_info: meal.origin_info,
        ntr_info: meal.ntr_info
      }));
      
      const { error: insertError } = await supabase
        .from('meal_menus')
        .insert(mealRecords);
        
      if (insertError) {
        throw new Error(`급식 정보 저장 실패: ${insertError.message}`);
      }
      
      return NextResponse.json({
        success: true,
        message: `${allMeals.length}개의 급식 정보가 성공적으로 저장되었습니다`,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '저장할 급식 정보가 없습니다',
        errors
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
