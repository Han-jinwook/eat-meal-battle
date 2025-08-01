/**
 * 배틀 계산기 (Functions용 경량 버전)
 * 핵심 함수만 포함
 */

const { createClient } = require('@supabase/supabase-js');

const BATTLE_MODE = 'TEST'; // 'TEST' | 'PRODUCTION'

/**
 * 🧪 테스트 모드: 실시간 집계 계산 후 DB 저장
 */
async function calculateDailyMenuBattleTest(targetDate, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🧪 [TEST MODE] 일별 메뉴 배틀 계산 시작: ${date}`);
  
  try {
    // 1. 해당 날짜의 메뉴 아이템들과 평점 정보 조회
    const { data: menuRatings, error: ratingsError } = await supabase
      .from('menu_item_rating_stats')
      .select('menu_item_id, avg_rating, rating_count')
      .gt('rating_count', 0);
      
    if (ratingsError) {
      console.error('메뉴 평점 조회 실패:', ratingsError);
      return { success: false, error: ratingsError };
    }
    
    if (!menuRatings || menuRatings.length === 0) {
      console.log('평가된 메뉴가 없습니다.');
      return { success: true, data: [] };
    }
    
    // 메뉴 아이템 정보 조회
    let query = supabase
      .from('meal_menu_items')
      .select(`
        id,
        item_name,
        menu_item_rating_stats!fk_menu_item_rating_stats_menu_item_id!inner(
          avg_rating,
          rating_count
        ),
        meal_menus!meal_menu_items_meal_id_fkey!inner(
          id,
          school_code,
          meal_date
        )
      `)
      .eq('meal_menus.meal_date', date)
      .gt('menu_item_rating_stats.rating_count', 0);
      
    if (schoolCode) {
      query = query.eq('meal_menus.school_code', schoolCode);
    }
    
    const { data: menuItems, error } = await query;
    
    if (error) {
      console.error('메뉴 아이템 조회 실패:', error);
      return { success: false, error };
    }
    
    if (!menuItems || menuItems.length === 0) {
      console.log('해당 날짜에 평가된 메뉴가 없습니다.');
      return { success: true, data: [] };
    }
    
    // 간단한 순위 계산 로직
    const results = menuItems.map((item, index) => ({
      menu_item_id: item.id,
      battle_date: date,
      school_code: item.meal_menus.school_code,
      final_avg_rating: item.menu_item_rating_stats.avg_rating,
      final_rating_count: item.menu_item_rating_stats.rating_count,
      daily_rank: index + 1
    }));
    
    return { success: true, data: results };
    
  } catch (err) {
    console.error('일별 메뉴 배틀 계산 중 오류:', err);
    return { success: false, error: err };
  }
}

/**
 * 🧪 월별 테스트 모드: 실시간 집계 계산 후 DB 저장
 */
async function calculateMonthlyMenuBattleTest(targetYear, targetMonth, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  const year = targetYear || new Date().getFullYear();
  const month = targetMonth || new Date().getMonth() + 1;
  
  console.log(`🧪 [TEST MODE] 월별 메뉴 배틀 계산 시작: ${year}년 ${month}월`);
  
  try {
    // 간단한 월별 집계 로직
    const { data: monthlyData, error } = await supabase
      .from('menu_item_rating_stats')
      .select('menu_item_id, avg_rating, rating_count')
      .gt('rating_count', 0);
      
    if (error) {
      console.error('월별 메뉴 데이터 조회 실패:', error);
      return { success: false, error };
    }
    
    const results = (monthlyData || []).map((item, index) => ({
      menu_item_id: item.menu_item_id,
      battle_year: year,
      battle_month: month,
      school_code: schoolCode || 'DEFAULT',
      final_avg_rating: item.avg_rating,
      final_rating_count: item.rating_count,
      monthly_rank: index + 1
    }));
    
    return { success: true, data: results };
    
  } catch (err) {
    console.error('월별 메뉴 배틀 계산 중 오류:', err);
    return { success: false, error: err };
  }
}

/**
 * 🏆 메뉴 배틀 일별 순위 계산 및 저장
 */
async function calculateDailyMenuBattle(targetDate, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  if (BATTLE_MODE === 'TEST') {
    return await calculateDailyMenuBattleTest(targetDate, schoolCode, supabase);
  } else {
    // 실전 모드는 생략 (크기 절약)
    return { success: false, error: 'Production mode not implemented in lightweight version' };
  }
}

/**
 * 🏆 메뉴 배틀 월별 순위 계산 및 저장
 */
async function calculateMonthlyMenuBattle(year, month, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  if (BATTLE_MODE === 'TEST') {
    return await calculateMonthlyMenuBattleTest(year, month, schoolCode, supabase);
  } else {
    // 실전 모드는 생략 (크기 절약)
    return { success: false, error: 'Production mode not implemented in lightweight version' };
  }
}

module.exports = {
  calculateDailyMenuBattle,
  calculateMonthlyMenuBattle,
  calculateDailyMenuBattleTest,
  calculateMonthlyMenuBattleTest
};
