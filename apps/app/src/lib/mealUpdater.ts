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
          origin_info: meal.ORPLC_INFO || null,
          ntr_info: meal.NTR_INFO || null,
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
