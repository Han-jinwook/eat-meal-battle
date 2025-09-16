/**
 * 배틀 계산기 (Functions용 경량 버전)
 * 핵심 함수만 포함
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * 🏆 일별 메뉴 배틀 계산 및 저장 (메뉴 아이템별)
 */
async function calculateDailyMenuBattle(targetDate, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🏆 일별 메뉴 배틀 계산 시작: ${date}`);
  console.log(`📅 현재 시간: ${new Date().toISOString()}`);
  console.log(`🎯 대상 날짜: ${date}`);
  
  try {
    // 해당 날짜의 메뉴 아이템들과 평점 정보 조회 (school_infos 조인 제거)
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
      console.log(`❌ 해당 날짜에 평가된 메뉴가 없습니다: ${date}`);
      console.log(`🔍 쿼리 조건: meal_date = ${date}, rating_count > 0`);
      return { success: true, data: [] };
    }
    
    console.log(`📊 조회된 메뉴 아이템 수: ${menuItems.length}`);

    // 학교 정보 별도 조회
    const schoolCodes = [...new Set(menuItems.map(item => item.meal_menus.school_code))];
    console.log(`🏫 관련 학교 수: ${schoolCodes.length}`);
    const { data: schoolInfos } = await supabase
      .from('school_infos')
      .select('school_code, school_name, region')
      .in('school_code', schoolCodes);
    
    const schoolMap = {};
    schoolInfos?.forEach(school => {
      schoolMap[school.school_code] = {
        school_name: school.school_name,
        region: school.region
      };
    });
    
    // 평점 기준으로 정렬 (평점 높은 순, 평점 수 많은 순)
    const sortedItems = menuItems.sort((a, b) => {
      const ratingDiff = b.menu_item_rating_stats.avg_rating - a.menu_item_rating_stats.avg_rating;
      if (Math.abs(ratingDiff) > 0.01) return ratingDiff;
      return b.menu_item_rating_stats.rating_count - a.menu_item_rating_stats.rating_count;
    });
    
    // 전국 순위 계산 및 결과 생성
    const results = sortedItems.map((item, index) => {
      const schoolInfo = schoolMap[item.meal_menus.school_code] || {};
      return {
        menu_item_id: item.id,
        battle_date: date,
        school_code: item.meal_menus.school_code,
        school_name: schoolInfo.school_name || '',
        region: schoolInfo.region || '',
        final_avg_rating: item.menu_item_rating_stats.avg_rating,
        final_rating_count: item.menu_item_rating_stats.rating_count,
        daily_rank: index + 1,
        national_rank: index + 1 // 전국 순위 추가
      };
    });

    // 지역별 순위 계산
    const regionGroups = {};
    results.forEach(result => {
      // region이 없는 경우 '기타' 지역으로 분류
      const regionKey = result.region || '기타';
      if (!regionGroups[regionKey]) regionGroups[regionKey] = [];
      regionGroups[regionKey].push(result);
    });

    // 각 지역별로 순위 재계산
    Object.keys(regionGroups).forEach(region => {
      const regionItems = regionGroups[region].sort((a, b) => {
        if (b.final_avg_rating !== a.final_avg_rating) {
          return b.final_avg_rating - a.final_avg_rating;
        }
        return b.final_rating_count - a.final_rating_count;
      });
      
      regionItems.forEach((item, index) => {
        const resultIndex = results.findIndex(r => 
          r.menu_item_id === item.menu_item_id && 
          r.school_code === item.school_code
        );
        if (resultIndex !== -1) {
          results[resultIndex].region_rank = index + 1;
        }
      });
    });
    
    // DB에 결과 저장
    if (results.length > 0) {
      const { error: upsertError } = await supabase
        .from('menu_battle_daily')
        .upsert(results);
        
      if (upsertError) {
        console.error('일별 메뉴 배틀 결과 저장 실패:', upsertError);
        return { success: false, error: upsertError };
      }
      
      console.log(`✅ 일별 메뉴 배틀 결과 저장 완료: ${results.length}개 아이템`);
    }
    
    return { success: true, data: results };
    
  } catch (err) {
    console.error('일별 메뉴 배틀 계산 중 오류:', err);
    return { success: false, error: err };
  }
}

/**
 * 🏆 월별 메뉴 배틀 계산 및 저장 (메뉴 아이템별)
 */
async function calculateMonthlyMenuBattle(targetYear, targetMonth, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const year = targetYear || new Date().getFullYear();
  const month = targetMonth || new Date().getMonth() + 1;
  
  console.log(`🏆 월별 메뉴 배틀 계산 시작: ${year}년 ${month}월`);
  
  try {
    // 해당 월의 메뉴 아이템들과 평점 정보 조회 (school_infos 조인 제거)
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
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
      console.log(`${year}년 ${month}월에 평가된 메뉴가 없습니다.`);
      return { success: true, data: [] };
    }

    // 학교 정보 별도 조회
    const schoolCodes = [...new Set(menuItems.map(item => item.meal_menus.school_code))];
    const { data: schoolInfos } = await supabase
      .from('school_infos')
      .select('school_code, school_name, region')
      .in('school_code', schoolCodes);
    
    const schoolMap = {};
    schoolInfos?.forEach(school => {
      schoolMap[school.school_code] = {
        school_name: school.school_name,
        region: school.region
      };
    });
    
    // 메뉴 아이템별로 월간 집계
    const itemStats = {};
    menuItems.forEach(item => {
      const key = `${item.id}_${item.meal_menus.school_code}`;
      if (!itemStats[key]) {
        const schoolInfo = schoolMap[item.meal_menus.school_code] || {};
        itemStats[key] = {
          menu_item_id: item.id,
          school_code: item.meal_menus.school_code,
          school_name: schoolInfo.school_name || '',
          region: schoolInfo.region || '',
          total_rating: 0,
          total_count: 0,
          appearances: 0
        };
      }
      
      const stats = item.menu_item_rating_stats;
      itemStats[key].total_rating += stats.avg_rating * stats.rating_count;
      itemStats[key].total_count += stats.rating_count;
      itemStats[key].appearances += 1;
    });
    
    // 월간 평균 계산 및 정렬
    const monthlyResults = Object.values(itemStats)
      .map(item => ({
        ...item,
        final_avg_rating: item.total_count > 0 ? item.total_rating / item.total_count : 0
      }))
      .sort((a, b) => {
        const ratingDiff = b.final_avg_rating - a.final_avg_rating;
        if (Math.abs(ratingDiff) > 0.01) return ratingDiff;
        return b.total_count - a.total_count;
      });
    
    // 전국 순위 계산 및 결과 생성
    const results = monthlyResults.map((item, index) => ({
      menu_item_id: item.menu_item_id,
      battle_year: year,
      battle_month: month,
      school_code: item.school_code,
      school_name: item.school_name,
      region: item.region,
      final_avg_rating: item.final_avg_rating,
      final_rating_count: item.total_count,
      monthly_rank: index + 1,
      national_rank: index + 1 // 전국 순위 추가
    }));

    // 지역별 순위 계산
    const regionGroups = {};
    results.forEach(result => {
      // region이 없는 경우 '기타' 지역으로 분류
      const regionKey = result.region || '기타';
      if (!regionGroups[regionKey]) regionGroups[regionKey] = [];
      regionGroups[regionKey].push(result);
    });

    // 각 지역별로 순위 재계산
    Object.keys(regionGroups).forEach(region => {
      const regionItems = regionGroups[region].sort((a, b) => {
        if (b.final_avg_rating !== a.final_avg_rating) {
          return b.final_avg_rating - a.final_avg_rating;
        }
        return b.final_rating_count - a.final_rating_count;
      });
      
      regionItems.forEach((item, index) => {
        const resultIndex = results.findIndex(r => 
          r.menu_item_id === item.menu_item_id && 
          r.school_code === item.school_code
        );
        if (resultIndex !== -1) {
          results[resultIndex].region_rank = index + 1;
        }
      });
    });
    
    // DB에 결과 저장
    if (results.length > 0) {
      const { error: upsertError } = await supabase
        .from('menu_battle_monthly')
        .upsert(results);
        
      if (upsertError) {
        console.error('월별 배틀 결과 저장 실패:', upsertError);
        return { success: false, error: upsertError };
      }
      
      console.log(`✅ 월별 메뉴 배틀 결과 저장 완료: ${results.length}개 아이템`);
    }
    
    return { success: true, data: results };
    
  } catch (err) {
    console.error('월별 메뉴 배틀 계산 중 오류:', err);
    return { success: false, error: err };
  }
}


/**
 * 🏆 일별 급식 배틀 계산 및 저장
 */
async function calculateDailyMealBattle(targetDate, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🏆 일별 급식 배틀 계산 시작: ${date}`);
  
  try {
    // 해당 날짜의 급식과 평점 정보 조회
    let query = supabase
      .from('meal_menus')
      .select(`
        id,
        meal_date,
        school_code,
        meal_rating_stats!fk_meal_rating_stats_meal_id!inner(
          avg_rating,
          rating_count
        )
      `)
      .eq('meal_date', date)
      .gt('meal_rating_stats.rating_count', 0);
      
    if (schoolCode) {
      query = query.eq('school_code', schoolCode);
    }
    
    const { data: meals, error } = await query;
    
    if (error) {
      console.error('급식 조회 실패:', error);
      return { success: false, error };
    }
    
    if (!meals || meals.length === 0) {
      console.log('해당 날짜에 평가된 급식이 없습니다.');
      return { success: true, data: [] };
    }

    // 학교 정보 별도 조회
    const schoolCodes = [...new Set(meals.map(meal => meal.school_code))];
    const { data: schoolInfos } = await supabase
      .from('school_infos')
      .select('school_code, school_name, region')
      .in('school_code', schoolCodes);
    
    const schoolMap = {};
    schoolInfos?.forEach(school => {
      schoolMap[school.school_code] = {
        school_name: school.school_name,
        region: school.region
      };
    });
    
    // 평점 기준으로 정렬
    const sortedMeals = meals.sort((a, b) => {
      const ratingDiff = b.meal_rating_stats.avg_rating - a.meal_rating_stats.avg_rating;
      if (Math.abs(ratingDiff) > 0.01) return ratingDiff;
      return b.meal_rating_stats.rating_count - a.meal_rating_stats.rating_count;
    });
    
    // 전국 순위 계산 및 결과 생성
    const results = sortedMeals.map((meal, index) => {
      const schoolInfo = schoolMap[meal.school_code] || {};
      return {
        school_code: meal.school_code,
        battle_date: date,
        avg_rating: meal.meal_rating_stats.avg_rating,
        rating_count: meal.meal_rating_stats.rating_count,
        daily_rank: index + 1,
        national_rank: index + 1,
        school_name: schoolInfo.school_name || '',
        region: schoolInfo.region || ''
      };
    });

    // 지역별 순위 계산
    const regionGroups = {};
    results.forEach(result => {
      // region이 없는 경우 '기타' 지역으로 분류
      const regionKey = result.region || '기타';
      if (!regionGroups[regionKey]) regionGroups[regionKey] = [];
      regionGroups[regionKey].push(result);
    });

    // 각 지역별로 순위 재계산
    Object.keys(regionGroups).forEach(region => {
      const regionMeals = regionGroups[region].sort((a, b) => {
        if (b.avg_rating !== a.avg_rating) {
          return b.avg_rating - a.avg_rating;
        }
        return b.rating_count - a.rating_count;
      });
      
      regionMeals.forEach((meal, index) => {
        const resultIndex = results.findIndex(r => 
          r.school_code === meal.school_code
        );
        if (resultIndex !== -1) {
          // region_rank 필드는 DB 스키마에 없으므로 제거
          // results[resultIndex].region_rank = index + 1;
        }
      });
    });
    
    // DB에 결과 저장
    if (results.length > 0) {
      // 기존 데이터 삭제 후 새로 삽입
      const { error: deleteError } = await supabase
        .from('meal_battle_daily')
        .delete()
        .eq('battle_date', date);
        
      if (deleteError) {
        console.error('기존 일별 급식배틀 데이터 삭제 실패:', deleteError);
      }
      
      const { error: insertError } = await supabase
        .from('meal_battle_daily')
        .insert(results);
        
      if (insertError) {
        console.error('일별 급식배틀 결과 저장 실패:', insertError);
        return { success: false, error: insertError };
      }
      
      console.log(`✅ 일별 급식배틀 결과 저장 완료: ${results.length}개 급식`);
    }
    
    return { success: true, data: results };
    
  } catch (err) {
    console.error('일별 급식배틀 계산 중 오류:', err);
    return { success: false, error: err };
  }
}

/**
 * 🏆 월별 급식 배틀 계산 및 저장
 */
async function calculateMonthlyMealBattle(targetYear, targetMonth, schoolCode, supabaseClient) {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const year = targetYear || new Date().getFullYear();
  const month = targetMonth || new Date().getMonth() + 1;
  
  console.log(`🏆 월별 급식 배틀 계산 시작: ${year}년 ${month}월`);
  
  try {
    // 해당 월의 급식과 평점 정보 조회
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    let query = supabase
      .from('meal_menus')
      .select(`
        id,
        meal_date,
        school_code,
        meal_rating_stats!fk_meal_rating_stats_meal_id!inner(
          avg_rating,
          rating_count
        )
      `)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate)
      .gt('meal_rating_stats.rating_count', 0);
      
    if (schoolCode) {
      query = query.eq('school_code', schoolCode);
    }
    
    const { data: meals, error } = await query;
    
    if (error) {
      console.error('월별 급식 조회 실패:', error);
      return { success: false, error };
    }
    
    if (!meals || meals.length === 0) {
      console.log(`${year}년 ${month}월에 평가된 급식이 없습니다.`);
      return { success: true, data: [] };
    }

    // 학교 정보 별도 조회
    const schoolCodes = [...new Set(meals.map(meal => meal.school_code))];
    const { data: schoolInfos } = await supabase
      .from('school_infos')
      .select('school_code, school_name, region')
      .in('school_code', schoolCodes);
    
    const schoolMap = {};
    schoolInfos?.forEach(school => {
      schoolMap[school.school_code] = {
        school_name: school.school_name,
        region: school.region
      };
    });
    
    // 학교별 월간 집계
    const schoolStats = {};
    meals.forEach(meal => {
      const key = meal.school_code;
      if (!schoolStats[key]) {
        const schoolInfo = schoolMap[meal.school_code] || {};
        schoolStats[key] = {
          school_code: meal.school_code,
          school_name: schoolInfo.school_name || '',
          region: schoolInfo.region || '',
          total_rating: 0,
          total_count: 0,
          meal_count: 0
        };
      }
      
      const stats = meal.meal_rating_stats;
      schoolStats[key].total_rating += stats.avg_rating * stats.rating_count;
      schoolStats[key].total_count += stats.rating_count;
      schoolStats[key].meal_count += 1;
    });
    
    // 월간 평균 계산 및 정렬
    const monthlyResults = Object.values(schoolStats)
      .map(school => ({
        ...school,
        final_avg_rating: school.total_count > 0 ? school.total_rating / school.total_count : 0
      }))
      .sort((a, b) => {
        const ratingDiff = b.final_avg_rating - a.final_avg_rating;
        if (Math.abs(ratingDiff) > 0.01) return ratingDiff;
        return b.total_count - a.total_count;
      });
    
    // 전국 순위 계산 및 결과 생성
    const results = monthlyResults.map((school, index) => ({
      school_code: school.school_code,
      battle_year: year,
      battle_month: month,
      school_name: school.school_name,
      region: school.region,
      final_avg_rating: school.final_avg_rating,
      final_rating_count: school.total_count,
      monthly_rank: index + 1,
      national_rank: index + 1
    }));

    // 지역별 순위 계산
    const regionGroups = {};
    results.forEach(result => {
      // region이 없는 경우 '기타' 지역으로 분류
      const regionKey = result.region || '기타';
      if (!regionGroups[regionKey]) regionGroups[regionKey] = [];
      regionGroups[regionKey].push(result);
    });

    // 각 지역별로 순위 재계산
    Object.keys(regionGroups).forEach(region => {
      const regionSchools = regionGroups[region].sort((a, b) => {
        if (b.final_avg_rating !== a.final_avg_rating) {
          return b.final_avg_rating - a.final_avg_rating;
        }
        return b.final_rating_count - a.final_rating_count;
      });
      
      regionSchools.forEach((school, index) => {
        const resultIndex = results.findIndex(r => 
          r.school_code === school.school_code
        );
        if (resultIndex !== -1) {
          // region_rank 필드는 DB 스키마에 없으므로 제거
          // results[resultIndex].region_rank = index + 1;
        }
      });
    });
    
    // DB에 결과 저장
    if (results.length > 0) {
      const { error: upsertError } = await supabase
        .from('meal_battle_monthly')
        .upsert(results, {
          onConflict: 'school_code,battle_year,battle_month'
        });
        
      if (upsertError) {
        console.error('월별 급식배틀 결과 저장 실패:', upsertError);
        return { success: false, error: upsertError };
      }
      
      console.log(`✅ 월별 급식배틀 결과 저장 완료: ${results.length}개 학교`);
    }
    
    return { success: true, data: results };
    
  } catch (err) {
    console.error('월별 급식배틀 계산 중 오류:', err);
    return { success: false, error: err };
  }
}

module.exports = {
  calculateDailyMenuBattle,
  calculateMonthlyMenuBattle,
  calculateDailyMealBattle,
  calculateMonthlyMealBattle
};
