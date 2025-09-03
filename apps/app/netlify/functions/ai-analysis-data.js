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
 * 월간 급식 데이터 분석 (단순화된 버전)
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

    // 1. 해당 학교의 월간 급식 배틀 데이터 조회
    const { data: mySchoolMealDataArray, error: mealError } = await supabase
      .from('meal_battle_monthly')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('battle_year', year)
      .eq('battle_month', month);

    console.log(`🏫 급식 배틀 데이터 조회:`, {
      dataCount: mySchoolMealDataArray?.length || 0,
      firstItem: mySchoolMealDataArray?.[0] || null,
      error: mealError
    });

    const mySchoolMealData = mySchoolMealDataArray?.[0] || null;
    if (mealError && mealError.code !== 'PGRST116') throw mealError;

    // 2. 해당 학교의 월간 메뉴 배틀 데이터 조회
    const { data: mySchoolMenuData, error: menuError } = await supabase
      .from('menu_battle_monthly')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('battle_year', year)
      .eq('battle_month', month);
    
    console.log(`📋 메뉴 배틀 데이터 조회:`, {
      dataCount: mySchoolMenuData?.length || 0,
      firstItem: mySchoolMenuData?.[0] || null,
      error: menuError
    });

    if (menuError) throw menuError;

    // 3. 메뉴 아이템 정보 조회
    const menuItemIds = mySchoolMenuData?.map(item => item.menu_item_id).filter(Boolean) || [];
    console.log(`🔍 메뉴 아이템 ID 목록:`, menuItemIds);
    
    let menuItems = [];
    let mealMenus = [];
    
    if (menuItemIds.length > 0) {
      const { data: menuItemsData, error: menuItemsError } = await supabase
        .from('meal_menu_items')
        .select('id, item_name, meal_id')
        .in('id', menuItemIds);

      if (menuItemsError) throw menuItemsError;
      menuItems = menuItemsData || [];
      
      console.log(`🍜 메뉴 아이템 조회:`, {
        dataCount: menuItems.length,
        firstItem: menuItems[0] || null
      });

      // 4. 급식 정보 조회
      const mealIds = menuItems.map(item => item.meal_id).filter(Boolean);
      if (mealIds.length > 0) {
        const { data: mealMenusData, error: mealMenusError } = await supabase
          .from('meal_menus')
          .select('id, meal_date, meal_type')
          .in('id', mealIds);
        
        if (mealMenusError) throw mealMenusError;
        mealMenus = mealMenusData || [];
        
        console.log(`📅 급식 메뉴 조회:`, {
          dataCount: mealMenus.length,
          firstItem: mealMenus[0] || null
        });
      }
    }

    // 5. 결과 구성
    const result = {
      school_info: {
        school_name: mySchoolMealData?.school_name || '학교명 없음',
        region: mySchoolMealData?.region || '지역 없음'
      },
      meal_performance: {
        avg_rating: mySchoolMealData?.final_avg_rating || 0,
        rating_count: mySchoolMealData?.final_rating_count || 0,
        rank: mySchoolMealData?.monthly_rank || 0
      },
      menu_performance: mySchoolMenuData?.map(menu => {
        const menuItem = menuItems.find(item => item.id === menu.menu_item_id);
        const mealMenu = mealMenus.find(meal => meal.id === menuItem?.meal_id);
        
        const menuPerformance = {
          menu_name: menuItem?.item_name || '메뉴명 없음',
          meal_date: mealMenu?.meal_date || null,
          meal_type: mealMenu?.meal_type || null,
          avg_rating: menu.final_avg_rating || 0,
          rating_count: menu.final_rating_count || 0,
          rank: menu.monthly_rank || 0,
          region_rank: menu.region_rank || null
        };
        
        console.log(`🍜 메뉴 성과:`, {
          menu_item_id: menu.menu_item_id,
          menu_name: menuPerformance.menu_name,
          avg_rating: menuPerformance.avg_rating,
          rank: menuPerformance.rank
        });
        
        return menuPerformance;
      }) || [],
      analysis_period: `${year}년 ${month}월`
    };
    
    console.log(`✅ 최종 AI 분석 결과:`, {
      school_name: result.school_info.school_name,
      region: result.school_info.region,
      meal_avg_rating: result.meal_performance.avg_rating,
      menu_count: result.menu_performance.length,
      response_time: Date.now() - startTime + 'ms'
    });

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
