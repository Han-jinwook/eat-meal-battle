const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 데이터베이스 테이블 구조 확인용 API
 */
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🔍 데이터베이스 구조 확인 시작');

    // 1. school_infos 테이블 구조 확인
    const { data: schoolSample, error: schoolError } = await supabase
      .from('school_infos')
      .select('*')
      .limit(1);

    console.log('📋 school_infos 샘플:', schoolSample);
    if (schoolError) console.log('❌ school_infos 오류:', schoolError);

    // 2. meal_rating_stats 테이블 구조 확인
    const { data: ratingStatsSample, error: ratingStatsError } = await supabase
      .from('meal_rating_stats')
      .select('*')
      .limit(1);

    console.log('📋 meal_rating_stats 샘플:', ratingStatsSample);
    if (ratingStatsError) console.log('❌ meal_rating_stats 오류:', ratingStatsError);

    // 3. menu_item_rating_stats 테이블 구조 확인
    const { data: menuStatsSample, error: menuStatsError } = await supabase
      .from('menu_item_rating_stats')
      .select('*')
      .limit(1);

    console.log('📋 menu_item_rating_stats 샘플:', menuStatsSample);
    if (menuStatsError) console.log('❌ menu_item_rating_stats 오류:', menuStatsError);

    // 4. meal_menus 테이블 구조 확인
    const { data: mealSample, error: mealError } = await supabase
      .from('meal_menus')
      .select('*')
      .limit(1);

    console.log('📋 meal_menus 샘플:', mealSample);
    if (mealError) console.log('❌ meal_menus 오류:', mealError);

    // 5. menu_items 테이블 구조 확인
    const { data: menuItemsSample, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('*')
      .limit(1);

    console.log('📋 menu_items 샘플:', menuItemsSample);
    if (menuItemsError) console.log('❌ menu_items 오류:', menuItemsError);

    // 응답 데이터 구성
    const responseData = {
      success: true,
      tables: {
        school_infos: {
          sample: schoolSample?.[0] || null,
          error: schoolError?.message || null,
          columns: schoolSample?.[0] ? Object.keys(schoolSample[0]) : []
        },
        meal_rating_stats: {
          sample: ratingStatsSample?.[0] || null,
          error: ratingStatsError?.message || null,
          columns: ratingStatsSample?.[0] ? Object.keys(ratingStatsSample[0]) : []
        },
        menu_item_rating_stats: {
          sample: menuStatsSample?.[0] || null,
          error: menuStatsError?.message || null,
          columns: menuStatsSample?.[0] ? Object.keys(menuStatsSample[0]) : []
        },
        meal_menus: {
          sample: mealSample?.[0] || null,
          error: mealError?.message || null,
          columns: mealSample?.[0] ? Object.keys(mealSample[0]) : []
        },
        menu_items: {
          sample: menuItemsSample?.[0] || null,
          error: menuItemsError?.message || null,
          columns: menuItemsSample?.[0] ? Object.keys(menuItemsSample[0]) : []
        }
      }
    };

    console.log('✅ 데이터베이스 구조 확인 완료');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData, null, 2)
    };

  } catch (error) {
    console.error('❌ DB 구조 확인 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
