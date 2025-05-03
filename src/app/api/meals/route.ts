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

        meals.push({
          school_code: meal.SD_SCHUL_CODE,
          office_code: meal.ATPT_OFCDC_SC_CODE,
          meal_date: formattedDate,
          meal_type: mealType,
          menu_items: menuItems,
          kcal: meal.CAL_INFO || '0 kcal',
          origin_info: meal.ORPLC_INFO || null,
          ntr_info: meal.NTR_INFO || {},
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
      // 날짜 형식 확인 및 통일 (DB 조회 시 문제 방지)
      let formattedDate = date;
      // YYYYMMDD 형식이면 YYYY-MM-DD로 변환
      if (date && date.length === 8 && !date.includes('-')) {
        formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        console.log(`날짜 형식 변환: ${date} -> ${formattedDate}`);
      }
      
      // 이미 저장된 데이터가 있는지 확인 (중복 체크 정확도 향상을 위해 날짜 형식 통일)
      const { data: existingData, error: checkError } = await supabase
        .from('meal_menus')
        .select('id, meal_type')
        .eq('school_code', schoolCode)
        .eq('meal_date', formattedDate);
        
      if (checkError) {
        console.error('기존 데이터 확인 오류:', checkError);
      }
      
      // 이미 데이터가 있으면 저장하지 않고 기존 데이터 반환
      if (existingData && existingData.length > 0) {
        console.log(`이미 DB에 ${formattedDate} 날짜의 급식 정보가 ${existingData.length}개 있습니다.`);
        
        // 기존 데이터를 다시 조회하여 반환
        const { data: existingMeals, error: fetchError } = await supabase
          .from('meal_menus')
          .select('*')
          .eq('school_code', schoolCode)
          .eq('meal_date', formattedDate);
          
        if (fetchError) {
          console.error('기존 데이터 조회 오류:', fetchError);
          throw new Error(`기존 데이터 조회 오류: ${fetchError.message}`);
        }
        
        // 빈 급식 정보 확인
        const hasEmptyResult = existingMeals && existingMeals.some(meal => meal.meal_type === 'empty');
        
        return NextResponse.json({
          success: true,
          date: formattedDate, // 통일된 날짜 형식 사용
          meals: hasEmptyResult ? [] : existingMeals,
          source: 'database',
          is_empty_result: hasEmptyResult,
          school_code: schoolCode,
          office_code: officeCode
        });
      }
      
      // API에서 가져온 급식 정보 처리
      if (meals && meals.length > 0) {
        // 중복 확인 및 기존 데이터 삭제 (안전한 upsert를 위한 처리)
        const existingTypes = existingData ? existingData.map(item => item.meal_type) : [];
        console.log('기존 급식 타입:', existingTypes);
        
        // 급식 정보가 있는 경우
        const mealRecords = meals.map(meal => ({
          school_code: meal.school_code,
          office_code: meal.office_code,
          meal_date: meal.meal_date, // 이미 parseMealInfo에서 형식 통일됨
          meal_type: meal.meal_type,
          menu_items: meal.menu_items,
          kcal: meal.kcal,
          origin_info: meal.origin_info,
          ntr_info: meal.ntr_info || {}
        }));
        
        // 각 급식 타입별로 upsert 방식 적용
        for (const mealRecord of mealRecords) {
          // 동일한 학교/날짜/급식타입의 기존 데이터 확인
          const { data: existingMeal, error: findError } = await supabase
            .from('meal_menus')
            .select('id')
            .eq('school_code', mealRecord.school_code)
            .eq('meal_date', mealRecord.meal_date)
            .eq('meal_type', mealRecord.meal_type)
            .maybeSingle();
          
          if (findError && findError.code !== 'PGRST116') { // PGRST116: 결과 없음
            console.error(`급식 데이터 조회 오류: ${findError.message}`);
            continue;
          }
          
          if (existingMeal) {
            // 기존 데이터가 있으면 업데이트
            console.log(`기존 ${mealRecord.meal_type} 데이터 업데이트`);
            const { error: updateError } = await supabase
              .from('meal_menus')
              .update({
                menu_items: mealRecord.menu_items,
                kcal: mealRecord.kcal,
                origin_info: mealRecord.origin_info,
                ntr_info: mealRecord.ntr_info,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingMeal.id);
              
            if (updateError) {
              console.error(`급식 데이터 업데이트 오류: ${updateError.message}`);
            }
          } else {
            // 없으면 새로 추가
            console.log(`새 ${mealRecord.meal_type} 데이터 추가`);
            const { error: insertError } = await supabase
              .from('meal_menus')
              .insert([mealRecord]);
              
            if (insertError) {
              console.error(`급식 데이터 추가 오류: ${insertError.message}`);
            }
          }
        }
        
        console.log(`${meals.length}개의 급식 정보 처리 완료`);
      } else {
        // 급식 정보가 없는 경우에도 빈 레코드 저장 (중복 API 호출 방지)
        const emptyRecord = {
          school_code: schoolCode,
          office_code: officeCode,
          meal_date: formattedDate, // 통일된 날짜 형식 사용
          meal_type: 'empty', // 빈 급식 정보를 표시하는 특별 타입
          menu_items: ['급식 정보가 없습니다'],
          kcal: '0 kcal',
          origin_info: null,
          ntr_info: {}
        };
        
        // 빈 급식 기록이 이미 있는지 확인
        const { data: existingEmpty, error: emptyCheckError } = await supabase
          .from('meal_menus')
          .select('id')
          .eq('school_code', schoolCode)
          .eq('meal_date', formattedDate)
          .eq('meal_type', 'empty')
          .maybeSingle();
          
        if (emptyCheckError && emptyCheckError.code !== 'PGRST116') {
          console.error('빈 급식 정보 확인 오류:', emptyCheckError);
        }
        
        if (!existingEmpty) {
          // 빈 기록이 없을 때만 추가
          try {
            // DB에 빈 급식 정보 저장
            const { error: emptyInsertError } = await supabase
              .from('meal_menus')
              .insert([emptyRecord]);
              
            if (emptyInsertError) {
              console.error('빈 급식 정보 DB 저장 오류:', emptyInsertError);
            } else {
              console.log('빈 급식 정보를 DB에 저장했습니다.');
            }
          } catch (saveError) {
            console.error('빈 급식 정보 저장 오류:', saveError);
          }
        } else {
          console.log('이미 빈 급식 정보가 저장되어 있습니다.');
        }
        
        // API 응답에 오류 코드가 있는지 확인
        if (mealData.RESULT && mealData.RESULT.CODE !== 'INFO-000') {
          console.error(`API 오류: ${mealData.RESULT.CODE} - ${mealData.RESULT.MESSAGE || '알 수 없는 오류'}`);
        }
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
  // 형식화된 날짜로 변경 (YYYYMMDD -> YYYY-MM-DD)
  const todayDate = new Date();
  const todayYMD = formatDate(todayDate);
  // YYYY-MM-DD 형식으로 변환
  const today = `${todayYMD.substring(0, 4)}-${todayYMD.substring(4, 6)}-${todayYMD.substring(6, 8)}`;
  
  console.log(`오늘 날짜: ${today} (월매 스케줄러 실행)`);
  
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
        // 급식 API 호출 (이미 데이터가 있는지 확인)
        const { data: existingData } = await supabase
          .from('meal_menus')
          .select('id, meal_type')
          .eq('school_code', school.school_code)
          .eq('meal_date', today);
        
        // 이미 세 종류(조식, 중식, 석식)의 급식 데이터가 모두 있는 경우 스킵
        const existingTypes = existingData?.map(item => item.meal_type) || [];
        if (existingTypes.includes('조식') && existingTypes.includes('중식') && existingTypes.includes('석식')) {
          console.log(`${key} 학교는 이미 모든 급식 데이터가 있음, 스킵`);
          continue;
        }
        
        // 급식 API 호출
        const mealData = await fetchMealInfo(school.school_code, school.office_code, todayYMD);
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
      // 새 데이터 저장 (upsert 방식으로 저장)
      const mealRecords = allMeals.map(meal => ({
        school_code: meal.school_code,
        office_code: meal.office_code,
        meal_date: meal.meal_date, // 이미 parseMealInfo에서 형식 통일됨
        meal_type: meal.meal_type,
        menu_items: meal.menu_items,
        kcal: meal.kcal,
        origin_info: meal.origin_info,
        ntr_info: meal.ntr_info || {}
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
            console.log(`${meal.school_code}/${meal.meal_date} ${meal.meal_type} 업데이트`);
            const { error: updateError } = await supabase
              .from('meal_menus')
              .update({
                menu_items: meal.menu_items,
                kcal: meal.kcal,
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
            console.log(`${meal.school_code}/${meal.meal_date} ${meal.meal_type} 새로 추가`);
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
