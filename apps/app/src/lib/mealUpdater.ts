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
        let menuItems = [];
        if (meal.DDISH_NM) {
          menuItems = meal.DDISH_NM
            .split(/<br\s*\/?\>/i)
            .map(item =>
              item
                .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, '')
                .replace(/-?u$/gi, '')
                .trim()
            )
            .filter(Boolean);
            .filter((item: string) => item);
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

  for (const meal of allMeals) {
    try {
      const { data: existingMeal, error: selectError } = await supabase
        .from('meal_menus')
        .select('id')
        .eq('school_code', meal.school_code)
        .eq('meal_date', meal.meal_date)
        .eq('meal_type', meal.meal_type)
        .maybeSingle();
      if (selectError && selectError.code !== 'PGRST116') {
        errorCount++;
        continue;
      }
      if (existingMeal) {
        const { error: updateError } = await supabase
          .from('meal_menus')
          .update({
            menu_items: meal.menu_items,
            kcal: meal.kcal,
            nutrition_info: meal.nutrition_info,
            origin_info: meal.origin_info,
            ntr_info: meal.ntr_info,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMeal.id);
        if (updateError) {
          errorCount++;
        } else {
          updatedCount++;
        }
      } else {
        const { error: insertError } = await supabase.from('meal_menus').insert([meal]);
        if (insertError) {
          errorCount++;
        } else {
          insertedCount++;
        }
      }
    } catch (err) {
      errorCount++;
    }
  }

  return {
    total: allMeals.length,
    updated: updatedCount,
    inserted: insertedCount,
    errors,
    errorCount,
  };
}
