import { createClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 🔧 모드 설정 (주석 처리로 전환)
const BATTLE_MODE = 'TEST'; // 'TEST' | 'PRODUCTION'
// const BATTLE_MODE = 'PRODUCTION';

interface MenuBattleResult {
  menu_item_id: string;
  battle_date: string;
  school_code: string;
  final_avg_rating: number;
  final_rating_count: number;
  daily_rank: number;
}

interface MonthlyBattleResult {
  menu_item_id: string;
  battle_year: number;
  battle_month: number;
  school_code: string;
  final_avg_rating: number;
  final_rating_count: number;
  monthly_rank: number;
}

/**
 * 🏆 메뉴 배틀 일별 순위 계산 및 저장
 */
export async function calculateDailyMenuBattle(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  
  if (BATTLE_MODE === 'TEST') {
    return await calculateDailyMenuBattleTest(targetDate, schoolCode, supabase);
  } else {
    return await calculateDailyMenuBattleProduction(targetDate, schoolCode, supabase);
  }
}

/**
 * 🧪 테스트 모드: 실시간 집계 계산 후 DB 저장
 */
export async function calculateDailyMenuBattleTest(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🧪 [TEST MODE] 일별 메뉴 배틀 계산 시작: ${date}`);
  console.log(`📋 입력 파라미터: targetDate=${targetDate}, schoolCode=${schoolCode}`);
  
  // 1. 해당 날짜의 메뉴 아이템들과 평점 정보 조회
  // 다중 관계 문제를 방지하기 위해 조인 대신 별도 쿼리로 분리
  const { data: menuRatings, error: ratingsError } = await supabase
    .from('menu_item_rating_stats')
    .select('menu_item_id, avg_rating, rating_count')
    .gt('rating_count', 0); // 평가가 있는 메뉴만
    
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
<<<<<<< HEAD
      meal_menus!inner(
        meal_id,
=======
      menu_item_rating_stats!fk_menu_item_rating_stats_menu_item_id!inner(
        avg_rating,
        rating_count
      ),
      meal_menus!meal_menu_items_meal_id_fkey!inner(
        id,
>>>>>>> d0766ab409d2788c11f96f2e927a76722d844976
        school_code,
        meal_date
      )
    `)
    .eq('meal_menus.meal_date', date)
<<<<<<< HEAD
    .in('id', menuRatings.map(item => item.menu_item_id))
=======
    .gt('menu_item_rating_stats.rating_count', 0); // 평가가 있는 메뉴만
>>>>>>> d0766ab409d2788c11f96f2e927a76722d844976
    
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
  
  // 메뉴 아이템에 평점 정보 추가
  const menuItemsWithRatings = menuItems.map(item => {
    const ratingInfo = menuRatings.find(rating => rating.menu_item_id === item.id);
    return {
      ...item,
      rating_info: ratingInfo || { avg_rating: 0, rating_count: 0 }
    };
  });
  
  // 2. 학교별로 그룹화하여 순위 계산
  const schoolGroups = menuItemsWithRatings.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const battleResults: MenuBattleResult[] = [];
  
  // 3. 각 학교별로 순위 매기기
  for (const [school, items] of Object.entries(schoolGroups)) {
    // 평점 순으로 정렬 (높은 순)
    const sortedItems = items.sort((a, b) => b.menu_item_rating_stats.avg_rating - a.menu_item_rating_stats.avg_rating);
    
    console.log(`📊 학교별 메뉴 아이템 정렬 결과: ${school}`);
    console.log(`📝 정렬된 메뉴 아이템 개수: ${sortedItems.length}`);
    
    // 표준 동점자 순위 처리: 동일한 평점이면 동일한 순위를 가지고, 다음 순위는 그만큼 건너뜀
    let currentRank = 1;
    let previousRating = -1;
    let sameRankCount = 0;
    
    sortedItems.forEach((item, index) => {
      const currentRating = Number(item.menu_item_rating_stats.avg_rating);
      
      // 동점자 처리: 이전 평점과 현재 평점 비교
      if (index > 0 && currentRating === previousRating) {
        // 동점이면 이전 순위를 유지
        sameRankCount++;
      } else if (index > 0) {
        // 다른 점수면 건너뛴 만큼 순위 증가
        currentRank += sameRankCount + 1;
        sameRankCount = 0;
      }
      
      previousRating = currentRating;
      
      console.log(`📝 순위 매기기: ${item.item_name} (평점: ${currentRating}, 순위: ${currentRank})`);
      
      battleResults.push({
        menu_item_id: item.id,
        battle_date: date,
        school_code: school,
        final_avg_rating: currentRating,
        final_rating_count: item.menu_item_rating_stats.rating_count,
        daily_rank: currentRank
      });
    });
  }
  
  // 4. 🔥 테스트 모드: 계산 후 즉시 DB에 저장
  console.log(`📊 배틀 결과 계산 완료: ${battleResults.length}개 항목`);
  
  if (battleResults.length > 0) {
<<<<<<< HEAD
    // 로깅: 저장할 배틀 결과
    console.log(`🔍 일별 배틀 저장 시도: ${battleResults.length}개 항목, 날짜: ${date}`);
    console.log(`🔄 첫번째 항목 예시:`, battleResults[0]);
=======
    console.log(`🔍 첫 번째 배틀 결과:`, battleResults[0]);
    // 기존 데이터 삭제 (해당 날짜)
    await supabase
      .from('menu_battle_daily')
      .delete()
      .eq('battle_date', date);
>>>>>>> d0766ab409d2788c11f96f2e927a76722d844976
    
    try {
      // 기존 데이터 삭제 후 신규 저장
      const { error: deleteError } = await supabase
        .from('menu_battle_daily')
        .delete()
        .eq('battle_date', date);
        
      if (deleteError) {
        console.error('❌ 일별 배틀 데이터 삭제 실패:', deleteError);
      } else {
        console.log(`✅ 일별 배틀 기존 데이터 삭제 성공: ${date}`);
      }
      
      // 삽입할 데이터 구조 로깅
      const insertData = battleResults.map(result => ({
        menu_item_id: result.menu_item_id,
        battle_date: result.battle_date,
        school_code: result.school_code,
        final_avg_rating: result.final_avg_rating,
        final_rating_count: result.final_rating_count,
        daily_rank: result.daily_rank
      }));
      
      console.log(`📝 일별 배틀 데이터 삽입 시도:`, insertData[0]);
      
      // 신규 배틀 결과 저장
      const { data: insertedData, error: insertError } = await supabase
        .from('menu_battle_daily')
        .insert(insertData)
        .select();
      
      if (insertError) {
        console.error('❌ 일별 테스트 모드 DB 저장 실패:', insertError);
        return { success: false, error: insertError };
      }
      
      console.log(`✅ 일별 배틀 데이터 저장 성공: ${insertedData?.length || 0}개`);
    } catch (err) {
      console.error('❌ 일별 배틀 데이터 저장 중 예외 발생:', err);
      return { success: false, error: err };
    }
  }
  
  console.log(`🧪 [TEST MODE] 계산 완료 및 DB 저장: ${battleResults.length}개 메뉴`);
  
  return { 
    success: true, 
    data: battleResults,
    mode: 'TEST',
    message: '테스트 모드: 실시간 계산 후 DB 저장 완료'
  };
}

/**
 * 🚀 실전 모드: 스케줄러용 배치 처리
 */
async function calculateDailyMenuBattleProduction(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🚀 [PRODUCTION MODE] 일별 메뉴 배틀 배치 처리 시작: ${date}`);
  
  // 1. 해당 날짜의 메뉴 아이템들과 평점 정보 조회 (테스트 모드와 동일)
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
      avg_rating,
      rating_count,
      meal_menus!inner(
        meal_id,
        school_code,
        meal_date
      )
    `)
    .eq('meal_menus.meal_date', date)
    .gt('rating_count', 0);
    
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
  
  // 2. 학교별로 그룹화하여 순위 계산 (테스트 모드와 동일)
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const battleResults: any[] = [];
  
  // 3. 각 학교별로 순위 매기기
  for (const [school, items] of Object.entries(schoolGroups)) {
    const sortedItems = items.sort((a, b) => b.avg_rating - a.avg_rating);
    
    sortedItems.forEach((item, index) => {
      battleResults.push({
        menu_item_id: item.id,
        battle_date: date,  // 중요: 누락된 battle_date 필드 추가
        final_avg_rating: Number(item.avg_rating),
        final_rating_count: item.rating_count,
        daily_rank: index + 1
      });
    });
  }
  
  console.log(`📊 생성된 배틀 결과 개수: ${battleResults.length}개`);
  if (battleResults.length > 0) {
    console.log('📝 첫 번째 배틀 결과 예시:', battleResults[0]);
  }
  
  // 4. 실전 모드에서는 DB에 실제 저장
  if (battleResults.length > 0) {
    try {
      console.log(`🔄 날짜별 배틀 데이터 처리 시작 - 날짜: ${date}`);
      
      // 기존 데이터 삭제 방식 변경 - 날짜 기준으로 삭제
      const { error: deleteError } = await supabase
        .from('menu_battle_daily')
        .delete()
        .eq('battle_date', date);
      
      if (deleteError) {
        console.error('❌ 일별 배틀 데이터 삭제 실패:', deleteError);
      } else {
        console.log(`✅ 일별 배틀 기존 데이터 삭제 성공 - 날짜: ${date}`);
      }
      
      // 삽입할 데이터 로깅
      console.log(`📥 일별 배틀 데이터 ${battleResults.length}개 삽입 시작`);
      
      // 새 데이터 삽입
      const { data: insertedData, error: insertError } = await supabase
        .from('menu_battle_daily')
        .insert(battleResults)
        .select();
      
      if (insertError) {
        console.error('❌ 일별 배틀 결과 저장 실패:', insertError);
        return { success: false, error: insertError };
      }
      
      console.log(`✅ 일별 배틀 데이터 저장 성공: ${insertedData?.length || 0}개`);
    } catch (err) {
      console.error('❌ 일별 배틀 데이터 저장 중 예외 발생:', err);
      return { success: false, error: err };
    }
  }
  
  console.log(`🚀 [PRODUCTION MODE] 배치 처리 완료: ${battleResults.length}개 메뉴 저장`);
  
  return { 
    success: true, 
    data: battleResults,
    mode: 'PRODUCTION',
    message: `일별 배틀 결과 DB 저장 완료: ${battleResults.length}개`
  };
}

/**
 * 🏆 메뉴 배틀 월별 순위 계산 및 저장
 */
export async function calculateMonthlyMenuBattle(year?: number, month?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  
  if (BATTLE_MODE === 'TEST') {
    return await calculateMonthlyMenuBattleTest(year, month, schoolCode, supabase);
  } else {
    return await calculateMonthlyMenuBattleProduction(year, month, schoolCode, supabase);
  }
}

/**
 * 🧪 월별 테스트 모드: 실시간 집계 계산 후 DB 저장
 */
export async function calculateMonthlyMenuBattleTest(targetYear?: number, targetMonth?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const year = targetYear || new Date().getFullYear();
  const month = targetMonth || new Date().getMonth() + 1;
  
  console.log(`🧪 [TEST MODE] 월별 메뉴 배틀 계산 시작: ${year}년 ${month}월`);
  
  // 1. 해당 월의 모든 메뉴 아이템들과 평점 정보 조회
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
  
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
<<<<<<< HEAD
      menu_item_rating_stats!inner(avg_rating, rating_count),
      meal_menus!inner(
        meal_id,
=======
      menu_item_rating_stats!fk_menu_item_rating_stats_menu_item_id!inner(
        avg_rating,
        rating_count
      ),
      meal_menus!meal_menu_items_meal_id_fkey!inner(
        id,
>>>>>>> d0766ab409d2788c11f96f2e927a76722d844976
        school_code,
        meal_date
      )
    `)
    .gte('meal_menus.meal_date', startDate)
    .lte('meal_menus.meal_date', endDate)
    .gt('menu_item_rating_stats.rating_count', 0);
    
  if (schoolCode) {
    query = query.eq('meal_menus.school_code', schoolCode);
  }
  
  const { data: menuItems, error } = await query;
  
  if (error) {
    console.error('월별 메뉴 아이템 조회 실패:', error);
    return { success: false, error };
  }
  
  if (!menuItems || menuItems.length === 0) {
    console.log('해당 월에 평가된 메뉴가 없습니다.');
    return { success: true, data: [] };
  }
  
  // 2. 학교별로 그룹화하여 순위 계산 (각 menu_item_id는 개별 경쟁자)
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const monthlyResults: MonthlyBattleResult[] = [];
  
  // 3. 각 학교별로 순위 매기기 (각 menu_item_id별 개별 경쟁)
  for (const [school, items] of Object.entries(schoolGroups)) {
    // 평점 순으로 정렬 (높은 순) - 7/3 김치 vs 7/11 김치 개별 경쟁
    const sortedItems = items.sort((a, b) => b.menu_item_rating_stats.avg_rating - a.menu_item_rating_stats.avg_rating);
    
    console.log(`📊 월별 배틀: 학교별 메뉴 아이템 정렬 결과: ${school}`);
    console.log(`📝 정렬된 메뉴 아이템 개수: ${sortedItems.length}`);
    
    // 표준 동점자 순위 처리: 동일한 평점이면 동일한 순위를 가지고, 다음 순위는 그만큼 건너뜀
    let currentRank = 1;
    let previousRating = -1;
    let sameRankCount = 0;
    
    sortedItems.forEach((item, index) => {
      const currentRating = Number(item.menu_item_rating_stats.avg_rating);
      
      // 동점자 처리: 이전 평점과 현재 평점 비교
      if (index > 0 && currentRating === previousRating) {
        // 동점이면 이전 순위를 유지
        sameRankCount++;
      } else if (index > 0) {
        // 다른 점수면 건너뛴 만큼 순위 증가
        currentRank += sameRankCount + 1;
        sameRankCount = 0;
      }
      
      previousRating = currentRating;
      
      console.log(`📝 월별 순위 매기기: ${item.item_name} (평점: ${currentRating}, 순위: ${currentRank})`);
      monthlyResults.push({
        menu_item_id: item.id,
        battle_year: year,
        battle_month: month,
        school_code: school,
        final_avg_rating: currentRating,
        final_rating_count: item.menu_item_rating_stats.rating_count,
        monthly_rank: currentRank
      });
    });
  }
  
  // 4. 🔥 테스트 모드: 계산 후 즉시 DB에 저장
  if (monthlyResults.length > 0) {
    // 로깅: 저장할 배틀 결과
    console.log(`🔍 월별 배틀 저장 시도: ${monthlyResults.length}개 항목, 년/월: ${year}/${month}`);
    console.log(`🔄 첫번째 항목 예시:`, monthlyResults[0]);
    console.log(`📊 배틀 필드 확인: 년=${year}, 월=${month}, menu_item_id=${monthlyResults[0].menu_item_id}`);
    
    try {
      // 기존 데이터 삭제 후 신규 저장
      const { error: deleteError } = await supabase
        .from('menu_battle_monthly')
        .delete()
        .eq('battle_year', year)
        .eq('battle_month', month);
        
      if (deleteError) {
        console.error('❌ 월별 배틀 데이터 삭제 실패:', deleteError);
      } else {
        console.log(`✅ 월별 배틀 기존 데이터 삭제 성공: ${year}/${month}`);
      }
      
      // 삽입할 데이터 구조 로깅
      const insertData = monthlyResults.map(result => ({
        menu_item_id: result.menu_item_id,
        battle_year: result.battle_year,
        battle_month: result.battle_month,
        school_code: result.school_code,
        final_avg_rating: result.final_avg_rating,
        final_rating_count: result.final_rating_count,
        monthly_rank: result.monthly_rank
      }));
      
      console.log(`📝 월별 배틀 데이터 삽입 시도:`, insertData[0]);
      
      // 새 데이터 저장
      const { data: insertedData, error: insertError } = await supabase
        .from('menu_battle_monthly')
        .insert(insertData)
        .select();
      
      if (insertError) {
        console.error('❌ 월별 테스트 모드 DB 저장 실패:', insertError);
        return { success: false, error: insertError };
      }
      
      console.log(`✅ 월별 배틀 데이터 저장 성공: ${insertedData?.length || 0}개`);
    } catch (err) {
      console.error('❌ 월별 배틀 데이터 저장 중 예외 발생:', err);
      return { success: false, error: err };
    }
  }
  
  console.log(`🧪 [TEST MODE] 월별 계산 완료 및 DB 저장: ${monthlyResults.length}개 메뉴`);
  console.log(`🔍 마지막 저장 결과:`, monthlyResults.slice(0, 2));
  
  return { 
    success: true, 
    data: monthlyResults,
    mode: 'TEST',
    message: `테스트 모드: 실시간 월별 계산 후 DB 저장 완료 (${year}년 ${month}월)`
  };
}

/**
 * 🚀 월별 실전 모드: 스케줄러용 배치 처리
 */
async function calculateMonthlyMenuBattleProduction(year?: number, month?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const targetYear = year || new Date().getFullYear();
  const targetMonth = month || new Date().getMonth() + 1;
  
  console.log(`🚀 [PRODUCTION MODE] 월별 메뉴 배틀 배치 처리 시작: ${targetYear}년 ${targetMonth}월`);
  
  try {
    // 1. 해당 월의 메뉴 아이템들 조회 (테스트 모드와 유사한 로직)
    const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
    
    console.log(`📆 조회 기간: ${startDate} ~ ${endDate}`);
    
    // 메뉴 아이템 평점 통계 조회 (테스트 모드와 유사)
    const { data: ratingStats, error: statsError } = await supabase
      .from('menu_item_rating_stats')
      .select(`
        menu_item_id,
        avg_rating,
        rating_count
      `);
      
    if (statsError) {
      console.error('❌ 평점 통계 조회 실패:', statsError);
      return { success: false, error: statsError };
    }
    
    // 월별 메뉴 아이템 조회
    let query = supabase
      .from('meal_menu_items')
      .select(`
        id,
        item_name,
        meal_menus!inner(
          meal_id,
          school_code,
          meal_date
        )
      `)
      .gte('meal_menus.meal_date', startDate)
      .lte('meal_menus.meal_date', endDate);
      
    if (schoolCode) {
      query = query.eq('meal_menus.school_code', schoolCode);
    }
    
    const { data: menuItems, error } = await query;
    
    if (error) {
      console.error('❌ 메뉴 아이템 조회 실패:', error);
      return { success: false, error };
    }
    
    if (!menuItems || menuItems.length === 0) {
      console.log(`❗ 해당 월(${targetYear}년 ${targetMonth}월)에 등록된 메뉴가 없습니다.`);
      return { success: true, data: [] };
    }
    
    console.log(`✅ 메뉴 아이템 ${menuItems.length}개 조회됨`);
    
    // 통계 정보와 조인
    const menuItemsWithStats = menuItems.map(item => {
      const stats = ratingStats?.find(s => s.menu_item_id === item.id);
      return {
        ...item,
        avg_rating: stats?.avg_rating || 0,
        rating_count: stats?.rating_count || 0
      };
    }).filter(item => item.rating_count > 0);
    
    if (menuItemsWithStats.length === 0) {
      console.log(`❗ 해당 월(${targetYear}년 ${targetMonth}월)에 평가된 메뉴가 없습니다.`);
      return { success: true, data: [] };
    }
    
    console.log(`✅ 평가된 메뉴 아이템 ${menuItemsWithStats.length}개 필터링됨`);
    
    // 2. 학교별로 그룹화
    const schoolGroups = menuItemsWithStats.reduce((acc, item) => {
      const school = item.meal_menus.school_code;
      if (!acc[school]) acc[school] = [];
      acc[school].push(item);
      return acc;
    }, {} as Record<string, any[]>);
    
    const monthlyResults: any[] = [];
    
    // 3. 각 학교별로 순위 매기기
    for (const [school, items] of Object.entries(schoolGroups)) {
      const sortedItems = items.sort((a, b) => b.avg_rating - a.avg_rating);
      
      sortedItems.forEach((item, index) => {
        monthlyResults.push({
          menu_item_id: item.id,
          battle_year: targetYear,  // 중요: 필수 필드 추가
          battle_month: targetMonth,  // 중요: 필수 필드 추가
          school_code: school,
          final_avg_rating: Number(item.avg_rating),
          final_rating_count: item.rating_count,
          monthly_rank: index + 1
        });
      });
    }
    
    console.log(`📊 생성된 월별 배틀 결과 개수: ${monthlyResults.length}개`);
    if (monthlyResults.length > 0) {
      console.log('📝 첫 번째 월별 배틀 결과 예시:', monthlyResults[0]);
    }
    
    // 4. DB에 저장
    if (monthlyResults.length > 0) {
      try {
        console.log(`🔄 월별 배틀 데이터 처리 시작 - ${targetYear}년 ${targetMonth}월`);
        
        // 기존 데이터 삭제
        const { error: deleteError } = await supabase
          .from('menu_battle_monthly')
          .delete()
          .eq('battle_year', targetYear)
          .eq('battle_month', targetMonth);
        
        if (deleteError) {
          console.error('❌ 월별 배틀 데이터 삭제 실패:', deleteError);
        } else {
          console.log(`✅ 월별 배틀 기존 데이터 삭제 성공 - ${targetYear}년 ${targetMonth}월`);
        }
        
        // 삽입할 데이터 로깅
        console.log(`📥 월별 배틀 데이터 ${monthlyResults.length}개 삽입 시작`);
        
        // 새 데이터 삽입
        const { data: insertedData, error: insertError } = await supabase
          .from('menu_battle_monthly')
          .insert(monthlyResults)
          .select();
        
        if (insertError) {
          console.error('❌ 월별 배틀 결과 저장 실패:', insertError);
          return { success: false, error: insertError };
        }
        
        console.log(`✅ 월별 배틀 데이터 저장 성공: ${insertedData?.length || 0}개`);
      } catch (err) {
        console.error('❌ 월별 배틀 데이터 저장 중 예외 발생:', err);
        return { success: false, error: err };
      }
    }
    
    console.log(`🚀 [PRODUCTION MODE] 월별 배치 처리 완료: ${monthlyResults.length}개 메뉴 저장`);
    
    return { 
      success: true, 
      data: monthlyResults,
      mode: 'PRODUCTION',
      message: `월별 배틀 결과 DB 저장 완료: ${monthlyResults.length}개`
    };
  } catch (err) {
    console.error('❌ 월별 배틀 계산 중 예상치 못한 오류:', err);
    return { success: false, error: err };
  }
}

/**
 * 📊 배틀 결과 조회 (UI용) - 항상 DB에서만 조회
 */
export async function getBattleResults(type: 'daily' | 'monthly', date?: string, schoolCode?: string) {
  const supabase = createClient();
  
  console.log(`📊 배틀 결과 조회: ${type}, 날짜: ${date}`);
  
  try {
    // 🔥 핵심: 테스트/출시 모드 관계없이 항상 DB에서만 조회
    if (type === 'daily') {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // 메뉴 배틀 결과 조회 (명시적 조인으로 다중 관계 문제 방지)
      let query = supabase
        .from('menu_battle_daily')
        .select(`
          menu_item_id,
          battle_date,
          final_avg_rating,
          final_rating_count,
          daily_rank,
          meal_menu_items!menu_battle_daily_menu_item_id_fkey(
            item_name
          )
        `)
        .eq('battle_date', targetDate)
        .order('daily_rank');
      
      if (schoolCode) {
        query = query.eq('meal_menu_items.meal_menus.school_code', schoolCode);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('일별 배틀 결과 조회 실패:', error);
        throw new Error('배틀 데이터를 조회하는데 실패했습니다.');
      }
      
      return { success: true, data: data || [] };
    } else {
      // 월별 조회
      const targetDate = date ? new Date(date) : new Date();
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      
      let query = supabase
        .from('menu_battle_monthly')
        .select(`
          menu_item_id,
          battle_year,
          battle_month,
          final_avg_rating,
          final_rating_count,
          monthly_rank,
          meal_menu_items!menu_battle_monthly_menu_item_id_fkey(
            item_name
          )
        `)
        .eq('battle_year', year)
        .eq('battle_month', month)
        .order('monthly_rank');
      
      if (schoolCode) {
        query = query.eq('meal_menu_items.meal_menus.school_code', schoolCode);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('월별 배틀 결과 조회 실패:', error);
        throw new Error('배틀 데이터를 조회하는데 실패했습니다.');
      }
      
      return { success: true, data: data || [] };
    }
  } catch (error) {
    console.error('배틀 결과 조회 중 오류:', error);
    throw error;
  }
}
