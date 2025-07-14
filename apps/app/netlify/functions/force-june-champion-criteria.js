const { createClient } = require('@supabase/supabase-js');

/**
 * 6월 챔피언 크리테리아 강제 업데이트 함수 (1회성)
 * 모든 등록된 학교에 대해 6월 데이터를 강제로 재생성
 */

// NEIS API에서 급식 데이터 조회
async function fetchMealDaysFromNEIS(schoolCode, officeCode, year, month) {
  const NEIS_API_KEY = process.env.NEIS_API_KEY;
  
  if (!NEIS_API_KEY) {
    throw new Error('NEIS API 키가 설정되지 않았습니다');
  }

  const paddedMonth = month.toString().padStart(2, '0');
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${year}${paddedMonth}`;
  
  console.log(`NEIS API 호출: ${schoolCode} (${year}-${paddedMonth})`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.mealServiceDietInfo || !data.mealServiceDietInfo[1] || !data.mealServiceDietInfo[1].row) {
      console.log(`${schoolCode}: ${year}-${paddedMonth} 급식 데이터 없음`);
      return [];
    }
    
    const meals = data.mealServiceDietInfo[1].row;
    console.log(`${schoolCode} 전체 급식 데이터 수: ${meals.length}개`);
    
    // 중식만 필터링 (MMEAL_SC_CODE: '2')
    const lunchMeals = meals.filter(meal => meal.MMEAL_SC_CODE === '2');
    console.log(`${schoolCode} 중식만 필터링 후: ${lunchMeals.length}개`);
    
    const mealDays = lunchMeals.map(item => item.MLSV_YMD);
    console.log(`${schoolCode}: ${year}-${paddedMonth} 최종 급식일수 ${mealDays.length}일`);
    return mealDays;
    
  } catch (error) {
    console.error(`NEIS API 호출 오류 (${schoolCode}):`, error);
    return [];
  }
}

// 주차별 급식 일수 계산 (원본 함수와 동일한 로직)
function calculateWeeklyMealDays(mealDays, year, month) {
  const weeklyCount = {}
  console.log(`주차별 계산 시작: ${mealDays.length}개 날짜 처리`)
  
  for (const dateStr of mealDays) {
    // YYYYMMDD 형식을 Date 객체로 변환
    const dateYear = parseInt(dateStr.substring(0, 4))
    const dateMonth = parseInt(dateStr.substring(4, 6)) - 1 // JavaScript는 0부터 시작
    const dateDay = parseInt(dateStr.substring(6, 8))
    const date = new Date(dateYear, dateMonth, dateDay)
    
    // ISO 주차 계산 (월요일 시작)
    const firstDayOfMonth = new Date(year, month - 1, 1)
    const dayOfWeek = firstDayOfMonth.getDay() // 0: 일요일, 1: 월요일, ..., 6: 토요일
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    
    const firstMonday = new Date(firstDayOfMonth)
    firstMonday.setDate(1 + daysToMonday)
    
    const timeDiff = date.getTime() - firstMonday.getTime()
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(daysDiff / 7) + 1
    
    // 해당 날짜가 첫 번째 월요일보다 앞서면 0주차로 처리
    if (daysDiff < 0) {
      weeklyCount[0] = (weeklyCount[0] || 0) + 1
      console.log(`${dateStr} -> 0주차 (첫 월요일 이전)`)
    } else if (weekNumber <= 5) {
      // 해당 월의 주차에 속하는 날짜만 카운트
      // 다음 달 날짜라도 해당 월 주차에 속하면 포함
      const targetMonthStart = new Date(year, month - 1, 1)
      const targetMonthEnd = new Date(year, month, 0) // 마지막 날
      
      // 해당 주차의 월요일 계산
      const weekStartDate = new Date(firstMonday)
      weekStartDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
      
      // 해당 주차가 해당 월에 속하는지 확인 (주차 시작일이 해당 월 내에 있으면 OK)
      if (weekStartDate <= targetMonthEnd) {
        weeklyCount[weekNumber] = (weeklyCount[weekNumber] || 0) + 1
        console.log(`${dateStr} -> ${weekNumber}주차 (해당 월 주차)`)
      } else {
        console.log(`${dateStr} -> ${weekNumber}주차 (다음 월 주차로 제외)`)
      }
    } else {
      console.log(`${dateStr} -> ${weekNumber}주차 (제외: 5주차 초과)`)
    }
  }
  
  console.log('주차별 급식일 계산 결과:', weeklyCount)
  return weeklyCount
}

// 장원 조건 저장
async function saveChampionCriteria(supabase, schoolCode, year, month, weeklyMealDays, monthlyTotal) {
  try {
    const { error } = await supabase.from('champion_criteria').upsert({
      school_code: schoolCode,
      year,
      month,
      week_1_days: weeklyMealDays[1] || 0,
      week_2_days: weeklyMealDays[2] || 0,
      week_3_days: weeklyMealDays[3] || 0,
      week_4_days: weeklyMealDays[4] || 0,
      week_5_days: weeklyMealDays[5] || 0,
      month_total: monthlyTotal,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'school_code,year,month'
    })
    
    if (error) {
      throw new Error(`장원 조건 저장 실패: ${error.message}`)
    }
    
    console.log(`✅ ${schoolCode}: 6월 크리테리아 저장 완료 (총 ${monthlyTotal}일)`);
    
  } catch (error) {
    console.error(`❌ ${schoolCode}: 장원 조건 저장 오류:`, error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  console.log('🚀 6월 챔피언 크리테리아 강제 업데이트 시작!');
  
  try {
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 모든 학교 목록 가져오기
    const { data: schools, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, office_code')
      .not('school_code', 'is', null)
      .not('office_code', 'is', null);
    
    if (schoolError) {
      throw new Error(`학교 목록 조회 실패: ${schoolError.message}`);
    }
    
    console.log(`📋 처리할 학교 수: ${schools.length}개`);
    
    // 기존 6월, 7월 데이터 삭제
    console.log('🗑️ 기존 6월, 7월 데이터 삭제 중...');
    const { error: deleteError } = await supabase
      .from('champion_criteria')
      .delete()
      .in('month', [6, 7])
      .eq('year', 2025);
    
    if (deleteError) {
      console.warn('기존 데이터 삭제 오류:', deleteError);
    } else {
      console.log('✅ 기존 6월, 7월 데이터 삭제 완료');
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // 각 학교별로 6월, 7월 데이터 처리
    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      const { school_code: schoolCode, office_code: officeCode } = school;
      
      console.log(`\n📍 [${i + 1}/${schools.length}] ${schoolCode} 처리 중...`);
      
      try {
        // NEIS API에서 6월, 7월, 8월 데이터 처리 (주차 경계 처리용)
        const juneMealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, 2025, 6);
        const julyMealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, 2025, 7);
        const augustMealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, 2025, 8);
        
        // 6월 처리
        if (juneMealDays.length > 0) {
          const juneAllMealDays = [...juneMealDays, ...julyMealDays];
          const juneWeeklyMealDays = calculateWeeklyMealDays(juneAllMealDays, 2025, 6);
          const juneMonthlyTotal = juneMealDays.length;
          
          await saveChampionCriteria(supabase, schoolCode, 2025, 6, juneWeeklyMealDays, juneMonthlyTotal);
          console.log(`✅ ${schoolCode}: 6월 데이터 저장 완료`);
        } else {
          console.log(`⚠️ ${schoolCode}: 6월 급식 데이터 없음`);
        }
        
        // 7월 처리
        if (julyMealDays.length > 0) {
          const julyAllMealDays = [...julyMealDays, ...augustMealDays];
          const julyWeeklyMealDays = calculateWeeklyMealDays(julyAllMealDays, 2025, 7);
          const julyMonthlyTotal = julyMealDays.length;
          
          await saveChampionCriteria(supabase, schoolCode, 2025, 7, julyWeeklyMealDays, julyMonthlyTotal);
          console.log(`✅ ${schoolCode}: 7월 데이터 저장 완료`);
        } else {
          console.log(`⚠️ ${schoolCode}: 7월 급식 데이터 없음`);
        }
        
        results.push({
          school_code: schoolCode,
          status: 'success',
          june_processed: juneMealDays.length > 0,
          july_processed: julyMealDays.length > 0
        });
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ ${schoolCode} 처리 오류:`, error);
        results.push({
          school_code: schoolCode,
          status: 'error',
          error: error.message
        });
        errorCount++;
      }
      
      // 진행 상황 출력
      if ((i + 1) % 5 === 0 || i === schools.length - 1) {
        console.log(`📊 진행 상황: ${i + 1}/${schools.length} (성공: ${successCount}, 오류: ${errorCount})`);
      }
    }
    
    console.log('\n🎉 6월 챔피언 크리테리아 강제 업데이트 완료!');
    console.log(`📈 최종 결과: 성공 ${successCount}개, 오류 ${errorCount}개`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: '6월 챔피언 크리테리아 강제 업데이트 완료',
        summary: {
          total_schools: schools.length,
          success_count: successCount,
          error_count: errorCount
        },
        results: results
      }, null, 2)
    };
    
  } catch (error) {
    console.error('💥 6월 크리테리아 업데이트 실패:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: '6월 챔피언 크리테리아 업데이트 실패'
      }, null, 2)
    };
  }
};
