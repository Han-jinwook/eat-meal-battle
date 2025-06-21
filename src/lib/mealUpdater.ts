import { createClient } from '@supabase/supabase-js';

// 환경변수는 실행 환경에 따라 자동으로 주입됨
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const NEIS_API_KEY = process.env.NEIS_API_KEY!;

// Supabase 클라이언트 (서비스 키는 서버 환경에서만 사용)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function fetchMealInfo(schoolCode: string, officeCode: string, date: string) {
  const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
  const queryParams = new URLSearchParams({
    KEY: NEIS_API_KEY,
    Type: 'json',
    pIndex: '1',
    pSize: '100',
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
    MLSV_YMD: date,
  });
  const fullUrl = `${apiUrl}?${queryParams.toString()}`;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error('교육부 급식 API 호출 실패');
  return response.json();
}

function parseMealInfo(apiResponse: any) {
  const meals = [];
  if (apiResponse.mealServiceDietInfo && Array.isArray(apiResponse.mealServiceDietInfo)) {
    if (apiResponse.mealServiceDietInfo.length > 1 && apiResponse.mealServiceDietInfo[1].row) {
      const mealRows = apiResponse.mealServiceDietInfo[1].row;
      for (const meal of mealRows) {
        // 메뉴 항목 파싱 (불필요한 문자 제거)
        const menuItems = meal.DDISH_NM
          .replace(/<br\s*\/?>|\\n/g, '\n') // HTML 및 문자열 내 \n 줄바꿈을 실제 줄바꿈으로 변환
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
          // 공백으로만 이루어진 항목은 제외
          .filter(item => item && item.length > 0);

        // 원산지 정보 정규화
        let originInfo = meal.ORPLC_INFO || null;
        
        // formatOriginInfo 함수가 정의되어 있다면 호출할 수 있을 텐데, 틀라이트스크립트에서는 구현이 어려움
        // 관련 서버 함수의 공통 성격을 유지하기 위해 이곳에도 동일하게 통합 작업을 적용할 필요가 있음
        // 관리 향상을 위해 문서화 처리
        
        // 원산지 정보 처리는 네틀리파이 함수와 동일한 로직으로 처리됨
        // 고로 update-meals.js와 meals.js에서 formatOriginInfo 함수 참고
        
        if (originInfo) {
          // 문자열로 변환 및 HTML 태그 제거 후 파싱
          let strOriginInfo = typeof originInfo === 'string' ? originInfo : JSON.stringify(originInfo);
          originInfo = strOriginInfo.replace(/<br\s*\/?>/gi, '\n');
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
          meal_date: meal.MLSV_YMD,
          meal_type: meal.MMEAL_SC_NM,
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
          origin_info: originInfo,
          ntr_info: ntrInfo,
          raw_data: meal,
        });
      }
    }
  }
  return meals;
}

export async function updateAllMeals(schools: Array<{ school_code: string; office_code: string }>, date?: Date) {
  const targetDate = date ? formatDate(date) : formatDate(new Date());
  const allMeals = [];
  const errors = [];
  let updatedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  for (const school of schools) {
    try {
      const mealData = await fetchMealInfo(school.school_code, school.office_code, targetDate);
      const meals = parseMealInfo(mealData);
      if (meals.length > 0) {
        allMeals.push(...meals);
      }
    } catch (error: any) {
      errors.push({
        school_code: school.school_code,
        office_code: school.office_code,
        error: error.message,
      });
    }
    // API 호출 제한을 위한 지연
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // 모든 meal 저장을 Next.js API 라우트로 위임
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meals: allMeals }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'API route 오류');
    }
    updatedCount = result.updated || 0;
    insertedCount = result.inserted || 0;
    errorCount = result.errorCount || 0;
    if (result.errors) {
      errors.push(...result.errors);
    }
  } catch (err: any) {
    errorCount = allMeals.length;
    errors.push({ error: err.message || 'API 호출 실패' });
  }

  return {
    total: allMeals.length,
    updated: updatedCount,
    inserted: insertedCount,
    errors,
    errorCount,
  };
}
