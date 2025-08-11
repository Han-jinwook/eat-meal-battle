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
 * 1단계: 월간 급식 데이터 집계
 * 특정 학교의 특정 월 급식 데이터를 집계하여 반환
 */
async function aggregateMonthlyMealData(schoolCode, year, month) {
  const startTime = Date.now();
  const cacheKey = `monthly_data_${schoolCode}_${year}_${month}`;
  
  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`✅ 캐시에서 데이터 반환: ${cacheKey}`);
    return cached.data;
  }

  try {
    // 해당 월의 시작일과 종료일 계산
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날

    console.log(`📊 월간 데이터 집계 시작: ${schoolCode}, ${year}-${month}`);

    // 1. 기본 급식 정보 조회
    const { data: mealMenus, error: menuError } = await supabase
      .from('meal_menus')
      .select(`
        id,
        meal_date,
        school_code,
        meal_ratings (
          rating,
          user_id
        ),
        meal_rating_stats (
          average_rating,
          total_ratings,
          rating_1_count,
          rating_2_count,
          rating_3_count,
          rating_4_count,
          rating_5_count
        )
      `)
      .eq('school_code', schoolCode)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate)
      .order('meal_date', { ascending: true });

    if (menuError) throw menuError;

    // 2. 메뉴별 상세 데이터 조회
    const mealIds = mealMenus.map(meal => meal.id);
    const { data: menuItems, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        meal_id,
        menu_name,
        menu_item_ratings (
          rating
        ),
        menu_item_rating_stats (
          average_rating,
          total_ratings
        )
      `)
      .in('meal_id', mealIds);

    if (itemError) throw itemError;

    // 3. 데이터 집계 및 분석
    const monthlyStats = {
      // 기본 정보
      school_code: schoolCode,
      year: year,
      month: month,
      period: `${year}년 ${month}월`,
      
      // 급식 통계
      total_meal_days: mealMenus.length,
      total_ratings: 0,
      average_rating: 0,
      
      // 일별 급식 평점 분포
      daily_ratings: [],
      
      // 메뉴별 통계
      menu_stats: {
        total_menus: 0,
        top_menus: [],
        worst_menus: [],
        average_menu_rating: 0
      },
      
      // 평점 분포
      rating_distribution: {
        rating_1: 0,
        rating_2: 0,
        rating_3: 0,
        rating_4: 0,
        rating_5: 0
      }
    };

    // 급식별 데이터 처리
    let totalRatingSum = 0;
    let totalRatingCount = 0;
    
    mealMenus.forEach(meal => {
      const mealStat = meal.meal_rating_stats[0];
      if (mealStat) {
        totalRatingSum += mealStat.average_rating * mealStat.total_ratings;
        totalRatingCount += mealStat.total_ratings;
        
        // 일별 평점 기록
        monthlyStats.daily_ratings.push({
          date: meal.meal_date,
          rating: mealStat.average_rating,
          count: mealStat.total_ratings
        });
        
        // 평점 분포 집계
        monthlyStats.rating_distribution.rating_1 += mealStat.rating_1_count || 0;
        monthlyStats.rating_distribution.rating_2 += mealStat.rating_2_count || 0;
        monthlyStats.rating_distribution.rating_3 += mealStat.rating_3_count || 0;
        monthlyStats.rating_distribution.rating_4 += mealStat.rating_4_count || 0;
        monthlyStats.rating_distribution.rating_5 += mealStat.rating_5_count || 0;
      }
    });

    // 월간 평균 계산
    monthlyStats.total_ratings = totalRatingCount;
    monthlyStats.average_rating = totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0;

    // 메뉴별 데이터 처리
    const menuStatsMap = new Map();
    menuItems.forEach(item => {
      const itemStat = item.menu_item_rating_stats[0];
      if (itemStat && itemStat.total_ratings > 0) {
        if (!menuStatsMap.has(item.menu_name)) {
          menuStatsMap.set(item.menu_name, {
            name: item.menu_name,
            total_ratings: 0,
            rating_sum: 0,
            count: 0
          });
        }
        
        const menuData = menuStatsMap.get(item.menu_name);
        menuData.total_ratings += itemStat.total_ratings;
        menuData.rating_sum += itemStat.average_rating * itemStat.total_ratings;
        menuData.count += 1;
      }
    });

    // 메뉴 통계 계산
    const menuList = Array.from(menuStatsMap.values()).map(menu => ({
      name: menu.name,
      average_rating: menu.rating_sum / menu.total_ratings,
      total_ratings: menu.total_ratings,
      appearance_count: menu.count
    }));

    // 평점 기준으로 정렬
    menuList.sort((a, b) => b.average_rating - a.average_rating);

    monthlyStats.menu_stats.total_menus = menuList.length;
    monthlyStats.menu_stats.top_menus = menuList.slice(0, 5); // 상위 5개
    monthlyStats.menu_stats.worst_menus = menuList.slice(-3); // 하위 3개
    monthlyStats.menu_stats.average_menu_rating = menuList.length > 0 
      ? menuList.reduce((sum, menu) => sum + menu.average_rating, 0) / menuList.length 
      : 0;

    // 응답 시간 기록
    const responseTime = Date.now() - startTime;
    monthlyStats.response_time_ms = responseTime;
    
    console.log(`✅ 월간 데이터 집계 완료: ${responseTime}ms`);

    // 캐시에 저장
    cache.set(cacheKey, {
      data: monthlyStats,
      timestamp: Date.now()
    });

    return monthlyStats;

  } catch (error) {
    console.error('❌ 월간 급식 데이터 집계 오류:', error);
    throw error;
  }
}

/**
 * 2단계: 지역 내 순위 계산
 * 같은 지역(시/도) 내 학교들과 비교하여 순위 계산
 */
async function calculateRegionalRanking(schoolCode, year, month) {
  const startTime = Date.now();
  const cacheKey = `regional_ranking_${schoolCode}_${year}_${month}`;
  
  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`✅ 지역 순위 캐시에서 반환: ${cacheKey}`);
    return cached.data;
  }

  try {
    // 1. 해당 학교 정보 조회 (지역 정보 확인)
    const { data: schoolInfo, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_name, region, district')
      .eq('school_code', schoolCode)
      .single();

    if (schoolError) throw schoolError;

    // 2. 같은 지역의 모든 학교 조회
    const { data: regionalSchools, error: regionalError } = await supabase
      .from('school_infos')
      .select('school_code, school_name')
      .eq('region', schoolInfo.region);

    if (regionalError) throw regionalError;

    const regionalSchoolCodes = regionalSchools.map(school => school.school_code);

    // 3. 해당 월의 지역 내 모든 학교 급식 평점 집계
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: regionalMealStats, error: statsError } = await supabase
      .from('meal_menus')
      .select(`
        school_code,
        meal_rating_stats (
          average_rating,
          total_ratings
        )
      `)
      .in('school_code', regionalSchoolCodes)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate);

    if (statsError) throw statsError;

    // 4. 학교별 월간 평균 계산
    const schoolRankings = new Map();
    
    regionalMealStats.forEach(meal => {
      const stat = meal.meal_rating_stats[0];
      if (stat && stat.total_ratings > 0) {
        if (!schoolRankings.has(meal.school_code)) {
          schoolRankings.set(meal.school_code, {
            school_code: meal.school_code,
            total_rating_sum: 0,
            total_count: 0,
            meal_days: 0
          });
        }
        
        const schoolData = schoolRankings.get(meal.school_code);
        schoolData.total_rating_sum += stat.average_rating * stat.total_ratings;
        schoolData.total_count += stat.total_ratings;
        schoolData.meal_days += 1;
      }
    });

    // 5. 평균 계산 및 순위 매기기
    const rankings = Array.from(schoolRankings.values())
      .map(school => {
        const schoolDetail = regionalSchools.find(s => s.school_code === school.school_code);
        return {
          school_code: school.school_code,
          school_name: schoolDetail?.school_name || '알 수 없음',
          average_rating: school.total_count > 0 ? school.total_rating_sum / school.total_count : 0,
          total_ratings: school.total_count,
          meal_days: school.meal_days
        };
      })
      .filter(school => school.total_ratings > 0) // 평점이 있는 학교만
      .sort((a, b) => b.average_rating - a.average_rating); // 평점 높은 순

    // 6. 현재 학교 순위 찾기
    const mySchoolIndex = rankings.findIndex(school => school.school_code === schoolCode);
    const myRank = mySchoolIndex >= 0 ? mySchoolIndex + 1 : null;
    const mySchoolData = rankings[mySchoolIndex];

    // 7. 지역 평균 계산
    const regionalAverage = rankings.length > 0 
      ? rankings.reduce((sum, school) => sum + school.average_rating, 0) / rankings.length 
      : 0;

    const result = {
      region: schoolInfo.region,
      district: schoolInfo.district,
      my_school: {
        school_code: schoolCode,
        school_name: schoolInfo.school_name,
        rank: myRank,
        rating: mySchoolData?.average_rating || 0,
        total_ratings: mySchoolData?.total_ratings || 0
      },
      regional_stats: {
        total_schools: rankings.length,
        average_rating: regionalAverage,
        top_3_schools: rankings.slice(0, 3),
        bottom_3_schools: rankings.slice(-3).reverse()
      },
      response_time_ms: Date.now() - startTime
    };

    console.log(`✅ 지역 순위 계산 완료: ${result.response_time_ms}ms`);

    // 캐시에 저장
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('❌ 지역 순위 계산 오류:', error);
    throw error;
  }
}

/**
 * 3단계: 전국 평균 비교
 * 전국 모든 학교와 비교하여 전국 순위 및 평균 계산
 */
async function calculateNationalComparison(schoolCode, year, month) {
  const startTime = Date.now();
  const cacheKey = `national_comparison_${year}_${month}`;
  
  // 캐시 확인 (전국 데이터는 학교 무관하게 동일)
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`✅ 전국 비교 캐시에서 반환: ${cacheKey}`);
    // 캐시된 데이터에서 해당 학교 정보만 추출
    const nationalData = cached.data;
    const mySchoolData = nationalData.all_schools.find(school => school.school_code === schoolCode);
    
    return {
      ...nationalData,
      my_school_national: mySchoolData || null,
      response_time_ms: 0 // 캐시에서 가져온 경우
    };
  }

  try {
    console.log(`📊 전국 비교 데이터 계산 시작: ${year}-${month}`);

    // 해당 월의 시작일과 종료일 계산
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // 1. 전국 모든 학교의 해당 월 급식 데이터 조회
    const { data: nationalMealStats, error: statsError } = await supabase
      .from('meal_menus')
      .select(`
        school_code,
        meal_rating_stats (
          average_rating,
          total_ratings
        )
      `)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate);

    if (statsError) throw statsError;

    // 2. 학교 정보 조회 (지역별 분류용)
    const uniqueSchoolCodes = [...new Set(nationalMealStats.map(meal => meal.school_code))];
    const { data: schoolInfos, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, school_name, region, district')
      .in('school_code', uniqueSchoolCodes);

    if (schoolError) throw schoolError;

    // 3. 학교별 월간 평균 계산
    const schoolStatsMap = new Map();
    
    nationalMealStats.forEach(meal => {
      const stat = meal.meal_rating_stats[0];
      if (stat && stat.total_ratings > 0) {
        if (!schoolStatsMap.has(meal.school_code)) {
          schoolStatsMap.set(meal.school_code, {
            school_code: meal.school_code,
            total_rating_sum: 0,
            total_count: 0,
            meal_days: 0
          });
        }
        
        const schoolData = schoolStatsMap.get(meal.school_code);
        schoolData.total_rating_sum += stat.average_rating * stat.total_ratings;
        schoolData.total_count += stat.total_ratings;
        schoolData.meal_days += 1;
      }
    });

    // 4. 전국 학교 순위 계산
    const nationalRankings = Array.from(schoolStatsMap.values())
      .map(school => {
        const schoolInfo = schoolInfos.find(info => info.school_code === school.school_code);
        return {
          school_code: school.school_code,
          school_name: schoolInfo?.school_name || '알 수 없음',
          region: schoolInfo?.region || '알 수 없음',
          district: schoolInfo?.district || '알 수 없음',
          average_rating: school.total_count > 0 ? school.total_rating_sum / school.total_count : 0,
          total_ratings: school.total_count,
          meal_days: school.meal_days
        };
      })
      .filter(school => school.total_ratings >= 10) // 최소 10개 이상 평점이 있는 학교만
      .sort((a, b) => b.average_rating - a.average_rating);

    // 5. 지역별 통계 계산
    const regionStatsMap = new Map();
    nationalRankings.forEach(school => {
      if (!regionStatsMap.has(school.region)) {
        regionStatsMap.set(school.region, {
          region: school.region,
          schools: [],
          total_rating_sum: 0,
          school_count: 0
        });
      }
      
      const regionData = regionStatsMap.get(school.region);
      regionData.schools.push(school);
      regionData.total_rating_sum += school.average_rating;
      regionData.school_count += 1;
    });

    const regionRankings = Array.from(regionStatsMap.values())
      .map(region => ({
        region: region.region,
        average_rating: region.total_rating_sum / region.school_count,
        school_count: region.school_count,
        top_school: region.schools[0] // 이미 정렬되어 있으므로 첫 번째가 최고
      }))
      .sort((a, b) => b.average_rating - a.average_rating);

    // 6. 전국 통계 계산
    const nationalAverage = nationalRankings.length > 0 
      ? nationalRankings.reduce((sum, school) => sum + school.average_rating, 0) / nationalRankings.length 
      : 0;

    // 7. 현재 학교 전국 순위 찾기
    const mySchoolIndex = nationalRankings.findIndex(school => school.school_code === schoolCode);
    const myNationalRank = mySchoolIndex >= 0 ? mySchoolIndex + 1 : null;
    const mySchoolNationalData = nationalRankings[mySchoolIndex];

    const result = {
      national_stats: {
        total_schools: nationalRankings.length,
        average_rating: nationalAverage,
        top_10_schools: nationalRankings.slice(0, 10),
        bottom_10_schools: nationalRankings.slice(-10).reverse()
      },
      regional_comparison: {
        total_regions: regionRankings.length,
        region_rankings: regionRankings,
        top_3_regions: regionRankings.slice(0, 3),
        bottom_3_regions: regionRankings.slice(-3).reverse()
      },
      my_school_national: mySchoolNationalData ? {
        ...mySchoolNationalData,
        national_rank: myNationalRank,
        percentile: Math.round((1 - (myNationalRank - 1) / nationalRankings.length) * 100)
      } : null,
      all_schools: nationalRankings, // 캐시용 전체 데이터
      response_time_ms: Date.now() - startTime
    };

    console.log(`✅ 전국 비교 계산 완료: ${result.response_time_ms}ms`);

    // 캐시에 저장 (전국 데이터는 용량이 크므로 짧은 캐시 시간)
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('❌ 전국 비교 계산 오류:', error);
    throw error;
  }
}

/**
 * 4단계: 메뉴 트렌드 분석
 * 전국적으로 인기있는 메뉴와 해당 학교의 메뉴 비교
 */
async function analyzeMenuTrends(schoolCode, year, month) {
  const startTime = Date.now();
  const cacheKey = `menu_trends_${year}_${month}`;
  
  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`✅ 메뉴 트렌드 캐시에서 반환: ${cacheKey}`);
    return cached.data;
  }

  try {
    console.log(`📊 메뉴 트렌드 분석 시작: ${year}-${month}`);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // 1. 전국 메뉴 데이터 조회
    const { data: nationalMenus, error: menuError } = await supabase
      .from('menu_items')
      .select(`
        menu_name,
        meal_id,
        menu_item_rating_stats (
          average_rating,
          total_ratings
        ),
        meal_menus!inner (
          meal_date,
          school_code
        )
      `)
      .gte('meal_menus.meal_date', startDate)
      .lte('meal_menus.meal_date', endDate);

    if (menuError) throw menuError;

    // 2. 메뉴별 전국 통계 집계
    const menuStatsMap = new Map();
    
    nationalMenus.forEach(item => {
      const stat = item.menu_item_rating_stats[0];
      if (stat && stat.total_ratings > 0) {
        const menuName = item.menu_name.trim();
        
        if (!menuStatsMap.has(menuName)) {
          menuStatsMap.set(menuName, {
            menu_name: menuName,
            total_ratings: 0,
            rating_sum: 0,
            appearance_count: 0,
            schools: new Set()
          });
        }
        
        const menuData = menuStatsMap.get(menuName);
        menuData.total_ratings += stat.total_ratings;
        menuData.rating_sum += stat.average_rating * stat.total_ratings;
        menuData.appearance_count += 1;
        menuData.schools.add(item.meal_menus.school_code);
      }
    });

    // 3. 전국 인기 메뉴 순위
    const nationalPopularMenus = Array.from(menuStatsMap.values())
      .map(menu => ({
        menu_name: menu.menu_name,
        average_rating: menu.rating_sum / menu.total_ratings,
        total_ratings: menu.total_ratings,
        appearance_count: menu.appearance_count,
        school_count: menu.schools.size,
        popularity_score: (menu.rating_sum / menu.total_ratings) * Math.log(menu.total_ratings + 1) // 평점 * 로그(평점수)
      }))
      .filter(menu => menu.total_ratings >= 20) // 최소 20개 평점
      .sort((a, b) => b.popularity_score - a.popularity_score);

    // 4. 해당 학교의 메뉴와 비교
    const mySchoolMenus = nationalMenus.filter(item => 
      item.meal_menus.school_code === schoolCode
    );

    const myMenuComparison = mySchoolMenus
      .map(item => {
        const stat = item.menu_item_rating_stats[0];
        if (!stat || stat.total_ratings === 0) return null;
        
        const menuName = item.menu_name.trim();
        const nationalData = menuStatsMap.get(menuName);
        
        return {
          menu_name: menuName,
          my_school_rating: stat.average_rating,
          my_school_ratings_count: stat.total_ratings,
          national_average: nationalData ? nationalData.rating_sum / nationalData.total_ratings : null,
          national_ratings_count: nationalData ? nationalData.total_ratings : 0,
          rating_difference: nationalData ? 
            stat.average_rating - (nationalData.rating_sum / nationalData.total_ratings) : null,
          is_popular_nationally: nationalPopularMenus.some(popular => popular.menu_name === menuName)
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => (b.rating_difference || -999) - (a.rating_difference || -999));

    const result = {
      national_trends: {
        top_20_popular_menus: nationalPopularMenus.slice(0, 20),
        total_unique_menus: menuStatsMap.size,
        analysis_period: `${year}년 ${month}월`
      },
      my_school_comparison: {
        total_menus: myMenuComparison.length,
        better_than_national: myMenuComparison.filter(menu => menu.rating_difference > 0).length,
        worse_than_national: myMenuComparison.filter(menu => menu.rating_difference < 0).length,
        top_performing_menus: myMenuComparison.slice(0, 5),
        underperforming_menus: myMenuComparison.slice(-5).reverse(),
        nationally_popular_served: myMenuComparison.filter(menu => menu.is_popular_nationally).length
      },
      response_time_ms: Date.now() - startTime
    };

    console.log(`✅ 메뉴 트렌드 분석 완료: ${result.response_time_ms}ms`);

    // 캐시에 저장
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('❌ 메뉴 트렌드 분석 오류:', error);
    throw error;
  }
}

/**
 * Netlify Function 핸들러
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

  // GET 요청만 허용
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
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
          error: 'Missing required parameters: school_code, year, month' 
        })
      };
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // 파라미터 유효성 검증
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid year or month parameter' 
        })
      };
    }

    console.log(`🚀 AI 분석 데이터 요청: ${school_code}, ${year}-${month}`);

    // 병렬로 모든 분석 실행 (성능 최적화)
    const [monthlyData, regionalRanking, nationalComparison, menuTrends] = await Promise.all([
      // 1단계: 월간 급식 데이터 집계
      aggregateMonthlyMealData(school_code, yearNum, monthNum),
      
      // 2단계: 지역 내 순위 계산
      calculateRegionalRanking(school_code, yearNum, monthNum),
      
      // 3단계: 전국 평균 비교
      calculateNationalComparison(school_code, yearNum, monthNum),
      
      // 4단계: 메뉴 트렌드 분석
      analyzeMenuTrends(school_code, yearNum, monthNum)
    ]);

    // 응답 데이터 구성
    const responseData = {
      success: true,
      data: {
        monthly_stats: monthlyData,
        regional_ranking: regionalRanking,
        national_comparison: nationalComparison,
        menu_trends: menuTrends,
        generated_at: new Date().toISOString(),
        total_response_time_ms: monthlyData.response_time_ms + 
                               regionalRanking.response_time_ms + 
                               nationalComparison.response_time_ms + 
                               menuTrends.response_time_ms
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('❌ AI 분석 데이터 처리 오류:', error);
    
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
