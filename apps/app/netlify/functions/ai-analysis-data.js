const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 메모리 캐시 (간단한 구현)
const cache = new Map();
const CACHE_DURATION = 3600000; // 1시간

/**
 * 올바른 방식: 기존 집계 테이블 활용한 월간 급식 데이터 분석
 */
async function analyzeMonthlyMealData(schoolCode, year, month) {
  const startTime = Date.now();
  const cacheKey = `monthly_analysis_${schoolCode}_${year}_${month}`;
  
  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`✅ 캐시에서 데이터 반환: ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`📊 월간 급식 분석 시작: ${schoolCode}, ${year}-${month}`);

    // 1. 해당 학교의 월간 급식 배틀 데이터 조회 (여러 사용자 고려)
    const { data: mySchoolMealDataArray, error: mealError } = await supabase
      .from('meal_battle_monthly')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('battle_year', year)
      .eq('battle_month', month);

    // 여러 행이 있을 경우 첫 번째 행 사용 (학교별로 동일한 데이터여야 함)
    const mySchoolMealData = mySchoolMealDataArray && mySchoolMealDataArray.length > 0 ? mySchoolMealDataArray[0] : null;

    if (mealError && mealError.code !== 'PGRST116') {
      throw mealError;
    }

    // 2. 해당 학교의 월간 메뉴 배틀 데이터 조회 (기본 데이터만)
    const { data: mySchoolMenuData, error: menuError } = await supabase
      .from('menu_battle_monthly')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('battle_year', year)
      .eq('battle_month', month);

    if (menuError) throw menuError;

    // 3. 메뉴 아이템 정보 별도 조회 (작동하는 패턴 사용)
    const menuItemIds = mySchoolMenuData.map(item => item.menu_item_id);
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('meal_menu_items')
      .select(`
        id, 
        item_name,
        meal_menus!meal_menu_items_meal_id_fkey(
          meal_date,
          meal_type
        )
      `)
      .in('id', menuItemIds);

    if (menuItemsError) throw menuItemsError;

    // 3. 학교 정보 조회 (여러 사용자 고려)
    const { data: schoolInfoArray, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_name, region')
      .eq('school_code', schoolCode);

    // 여러 행이 있을 경우 첫 번째 행 사용 (학교 정보는 동일해야 함)
    const schoolInfo = schoolInfoArray && schoolInfoArray.length > 0 ? schoolInfoArray[0] : null;

    if (schoolError) throw schoolError;
    
    if (!schoolInfo) {
      throw new Error('학교 정보를 찾을 수 없습니다.');
    }

    // 4. 전국 해당 월 급식 배틀 데이터 조회 (순위 계산용)
    const { data: nationalMealData, error: nationalError } = await supabase
      .from('meal_battle_monthly')
      .select('school_code, final_avg_rating, final_rating_count')
      .eq('battle_year', year)
      .eq('battle_month', month)
      .not('final_avg_rating', 'is', null)
      .order('final_avg_rating', { ascending: false });

    if (nationalError) throw nationalError;

    // 5. 같은 지역 학교들 데이터 조회
    const { data: regionalSchools, error: regionalSchoolError } = await supabase
      .from('school_infos')
      .select('school_code')
      .eq('region', schoolInfo.region);

    if (regionalSchoolError) throw regionalSchoolError;

    const regionalSchoolCodes = regionalSchools.map(s => s.school_code);
    
    const { data: regionalMealData, error: regionalError } = await supabase
      .from('meal_battle_monthly')
      .select('school_code, final_avg_rating, final_rating_count')
      .eq('battle_year', year)
      .eq('battle_month', month)
      .in('school_code', regionalSchoolCodes)
      .not('final_avg_rating', 'is', null)
      .order('final_avg_rating', { ascending: false });

    if (regionalError) throw regionalError;

    // 6. 데이터 분석 및 집계
    const result = {
      // 기본 정보
      school_info: {
        school_code: schoolCode,
        school_name: schoolInfo.school_name,
        region: schoolInfo.region,
        period: `${year}년 ${month}월`
      },

      // 우리 학교 급식 성과
      my_school_performance: {
        avg_rating: mySchoolMealData?.final_avg_rating || 0,
        rating_count: mySchoolMealData?.final_rating_count || 0,
        monthly_rank: mySchoolMealData?.monthly_rank || null
      },

      // 우리 학교 메뉴 성과 (상위/하위 메뉴) - 분리된 데이터 매핑
      menu_performance: {
        total_menus: mySchoolMenuData?.length || 0,
        top_menus: mySchoolMenuData
          ?.sort((a, b) => b.final_avg_rating - a.final_avg_rating)
          ?.slice(0, 5)
          ?.map(menu => {
            const menuItem = menuItems?.find(item => item.id === menu.menu_item_id);
            return {
              menu_name: menuItem?.item_name || '메뉴명 없음',
              meal_date: menuItem?.meal_menus?.meal_date || null,
              meal_type: menuItem?.meal_menus?.meal_type || null,
              avg_rating: menu.final_avg_rating,
              rating_count: menu.final_rating_count,
              rank: menu.monthly_rank
            };
          }) || [],
        worst_menus: mySchoolMenuData
          ?.sort((a, b) => a.final_avg_rating - b.final_avg_rating)
          ?.slice(0, 3)
          ?.map(menu => {
            const menuItem = menuItems?.find(item => item.id === menu.menu_item_id);
            return {
              menu_name: menuItem?.item_name || '메뉴명 없음',
              meal_date: menuItem?.meal_menus?.meal_date || null,
              meal_type: menuItem?.meal_menus?.meal_type || null,
              avg_rating: menu.final_avg_rating,
              rating_count: menu.final_rating_count,
              rank: menu.monthly_rank
            };
          }) || []
      },

      // 전국 비교
      national_comparison: {
        total_schools: nationalMealData.length,
        my_national_rank: nationalMealData.findIndex(school => school.school_code === schoolCode) + 1,
        national_average: nationalMealData.length > 0 
          ? nationalMealData.reduce((sum, school) => sum + school.final_avg_rating, 0) / nationalMealData.length 
          : 0,
        top_3_schools: nationalMealData.slice(0, 3),
        my_percentile: nationalMealData.length > 0 
          ? Math.round((1 - (nationalMealData.findIndex(school => school.school_code === schoolCode) / nationalMealData.length)) * 100)
          : 0
      },

      // 지역 비교
      regional_comparison: {
        region: schoolInfo.region,
        total_schools: regionalMealData.length,
        my_regional_rank: regionalMealData.findIndex(school => school.school_code === schoolCode) + 1,
        regional_average: regionalMealData.length > 0 
          ? regionalMealData.reduce((sum, school) => sum + school.final_avg_rating, 0) / regionalMealData.length 
          : 0,
        top_3_schools: regionalMealData.slice(0, 3)
      },

      // 메타 정보
      generated_at: new Date().toISOString(),
      response_time_ms: Date.now() - startTime
    };

    console.log(`✅ 월간 급식 분석 완료: ${result.response_time_ms}ms`);

    // 캐시에 저장
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('❌ 월간 급식 분석 오류:', error);
    throw error;
  }
}

/**
 * Netlify Functions 핸들러
 */
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { school_code, year, month } = event.queryStringParameters || {};

    // 필수 파라미터 검증
    if (!school_code || !year || !month) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: '필수 파라미터가 누락되었습니다.',
          required: ['school_code', 'year', 'month'],
          received: { school_code, year, month }
        })
      };
    }

    console.log(`🚀 AI 분석 데이터 요청: ${school_code}, ${year}-${month}`);

    // 월간 급식 분석 실행
    const result = await analyzeMonthlyMealData(school_code, parseInt(year), parseInt(month));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ AI 분석 데이터 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'AI 분석 데이터 처리 중 오류가 발생했습니다.',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
