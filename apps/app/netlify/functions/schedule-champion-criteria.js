/**
 * 장원 조건 스케줄러 함수
 * 
 * 이 함수는 매월 말에 실행되어 다음 달의 장원 조건을 설정합니다.
 * 외부 스케줄러(예: GitHub Actions, CRON 작업)에 의해 호출됩니다.
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  // API 키 검증
  const authToken = event.headers?.['x-api-key']
  const queryApiKey = event.queryStringParameters?.api_key
  
  if (!process.env.ADMIN_API_KEY || (authToken !== process.env.ADMIN_API_KEY && queryApiKey !== process.env.ADMIN_API_KEY)) {
    console.log('API 키 인증 실패');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized', message: '유효한 API 키가 필요합니다' })
    }
  }

  try {
    console.log('장원 조건 스케줄러 시작...')
    
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // URL 파라미터에서 월 지정 (없으면 현재 월)
    const urlParams = new URLSearchParams(event.queryStringParameters || {})
    const targetMonth = urlParams.get('month') ? parseInt(urlParams.get('month')) : new Date().getMonth() + 1
    const targetMonths = [targetMonth]
    const currentYear = 2025

    // 해당 월의 champion_criteria 데이터만 삭제
    console.log(`기존 ${currentYear}년 ${targetMonth}월 champion_criteria 데이터 삭제 중...`)
    const { error: deleteError } = await supabase
      .from('champion_criteria')
      .delete()
      .eq('year', currentYear)
      .eq('month', targetMonth)
    
    if (deleteError) {
      console.log(`${targetMonth}월 데이터 삭제 실패 (무시하고 계속): ${deleteError.message}`)
    } else {
      console.log(`기존 ${currentYear}년 ${targetMonth}월 champion_criteria 데이터 삭제 완료`)
    }

    // 모든 학교 조회 (기존 2개 학교 제외)
    const { data: schools, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, office_code')
      .not('school_code', 'in', '("7310375","7132085")')

    if (schoolError) {
      throw new Error(`학교 목록 조회 실패: ${schoolError.message}`)
    }

    if (!schools || schools.length === 0) {
      throw new Error('등록된 학교 정보가 없습니다');
    }

    console.log(`총 ${schools.length}개 학교 발견`)
    console.log(`${currentYear}년 ${targetMonth}월 급식 데이터 수집 시작`)
    
    // 결과 저장용 변수
    const results = {
      success: 0,
      error: 0,
      details: []
    }

    // 각 학교별로 급식 데이터 수집
    for (const school of schools) {
      try {
        console.log(`[${school.school_code}] 학교 처리 중...`)
        
        // 교육청 코드 유효성 확인
        if (!school.office_code) {
          console.log(`[${school.school_code}] 학교의 교육청 코드가 없습니다`);
          results.error++;
          results.details.push({
            school_code: school.school_code,
            status: 'error',
            message: '교육청 코드 없음'
          });
          continue; // 다음 학교로 이동
        }
        
        // 각 월별로 처리
        for (const targetMonth of targetMonths) {
          try {
            // NEIS API를 통해 급식 데이터 조회
            const mealDays = await fetchMealDaysFromNEIS(school.school_code, school.office_code, currentYear, targetMonth)
            
            // 주차별 급식 일수 계산
            const weeklyMealDays = await calculateWeeklyMealDays(school.school_code, school.office_code, currentYear, targetMonth)
            
            // 주차별 토요일 계산
            const weeklySaturdays = calculateWeeklySaturdays(currentYear, targetMonth)
            
            // 월별 총 급식일수는 해당월만 계산 (1일~말일)
            const monthlyTotal = mealDays.length
            
            await saveChampionCriteria(
              supabase,
              school.school_code,
              currentYear,
              targetMonth,
              weeklyMealDays,
              monthlyTotal,
              weeklySaturdays
            )
            
            console.log(`[${school.school_code}] ${currentYear}년 ${targetMonth}월 장원 조건 설정 완료`);
            
            // 월별 API 호출 제한을 위한 지연 (NEIS API 안정성 확보)
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (monthError) {
            console.error(`[${school.school_code}] ${targetMonth}월 처리 중 오류:`, monthError);
            results.error++;
            results.details.push({
              school_code: school.school_code,
              status: 'error',
              month: targetMonth,
              year: currentYear,
              message: monthError.message
            });
          }
        }
        
        results.success++;
        results.details.push({
          school_code: school.school_code,
          status: 'success',
          months: targetMonths,
          year: currentYear
        });
        
      } catch (schoolError) {
        console.error(`[${school.school_code}] 학교 처리 중 오류:`, schoolError);
        results.error++;
        results.details.push({
          school_code: school.school_code,
          status: 'error',
          message: schoolError.message
        });
      }
      
      // 학교별 API 호출 제한을 위한 지연 (NEIS API 안정성 확보)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${results.success}개 학교의 ${currentYear}년 ${targetMonths.join(',')}월 장원 조건 설정 완료 (오류: ${results.error}개)`,
        results
      })
    }
  } catch (error) {
    console.error('장원 조건 설정 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// NEIS API에서 급식 일수 조회 (학교별, 월별)
async function fetchMealDaysFromNEIS(schoolCode, officeCode, year, month) {
  console.log(`${schoolCode} 학교의 ${year}년 ${month}월 급식 일수 조회 중...`)
  
  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo`
    const params = new URLSearchParams({
      KEY: process.env.NEIS_API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '1000',
      ATPT_OFCDC_SC_CODE: officeCode, // school_infos 테이블의 office_code (지역코드)
      SD_SCHUL_CODE: schoolCode,
      MLSV_YMD: `${year}${month.toString().padStart(2, '0')}`
    })
    
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    const mealDays = []
    
    if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
      const meals = data.mealServiceDietInfo[1].row
      
      for (const meal of meals) {
        const dateStr = meal.MLSV_YMD
        const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
        mealDays.push(formattedDate)
      }
    }
    
    console.log(`${schoolCode} 학교의 ${year}년 ${month}월 실제 급식일수: ${mealDays.length}일`)
    return mealDays
    
  } catch (error) {
    console.error(`NEIS API 호출 오류 (${schoolCode}, ${year}-${month}):`, error)
    return []
  }
}

// 주차별 급식 일수 계산 (월 경계 넘는 주차 포함)
async function calculateWeeklyMealDays(schoolCode, officeCode, year, month) {
  const weeklyCount = {}
  
  // 토요일 계산과 동일한 로직으로 주차별 기간 계산
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const dayOfWeek = firstDayOfMonth.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
  
  const firstMonday = new Date(firstDayOfMonth)
  firstMonday.setDate(1 + daysToMonday)
  
  let saturday = new Date(firstMonday)
  saturday.setDate(firstMonday.getDate() + 5)
  
  // 각 주차별로 급식일 조회
  for (let week = 1; week <= 5; week++) {
    const mondayOfWeek = new Date(saturday)
    mondayOfWeek.setDate(saturday.getDate() - 5)
    
    // 해당 주차의 월요일이 해당 월에 있는지 확인
    if (mondayOfWeek.getMonth() === month - 1) {
      // 주차 전체 기간 (월요일~일요일)
      const weekStart = new Date(mondayOfWeek)
      const weekEnd = new Date(mondayOfWeek)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      // 주차 기간의 급식일 조회 (월 경계 넘어도 포함)
      const weekMealDays = await fetchMealDaysForWeek(schoolCode, officeCode, weekStart, weekEnd)
      weeklyCount[week] = weekMealDays.length
      
      console.log(`${week}주차 (${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}): ${weekMealDays.length}일`)
    } else {
      break
    }
    
    // 다음 주 토요일
    saturday = new Date(saturday)
    saturday.setDate(saturday.getDate() + 7)
  }
  
  return weeklyCount
}

// 특정 주차 기간의 급식일 조회
async function fetchMealDaysForWeek(schoolCode, officeCode, weekStart, weekEnd) {
  const mealDays = []
  
  // 주차가 여러 월에 걸쳐있을 수 있으므로 각 월별로 조회
  const startMonth = weekStart.getMonth() + 1
  const endMonth = weekEnd.getMonth() + 1
  const startYear = weekStart.getFullYear()
  const endYear = weekEnd.getFullYear()
  
  const monthsToCheck = []
  
  if (startYear === endYear && startMonth === endMonth) {
    // 같은 월
    monthsToCheck.push({ year: startYear, month: startMonth })
  } else {
    // 다른 월 (월 경계)
    monthsToCheck.push({ year: startYear, month: startMonth })
    if (endYear !== startYear || endMonth !== startMonth) {
      monthsToCheck.push({ year: endYear, month: endMonth })
    }
  }
  
  // 각 월의 급식일 조회
  for (const { year, month } of monthsToCheck) {
    const monthMealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, year, month)
    
    // 주차 기간에 해당하는 급식일만 필터링
    for (const dateStr of monthMealDays) {
      const mealDate = new Date(dateStr)
      if (mealDate >= weekStart && mealDate <= weekEnd) {
        mealDays.push(dateStr)
      }
    }
  }
  
  return mealDays
}

// 주차별 토요일 날짜 계산 (ISO 8601 기준)
function calculateWeeklySaturdays(year, month) {
  console.log(`${year}년 ${month}월 주차별 토요일 계산 시작...`)
  
  const weeklySaturdays = {}
  
  // 해당 월의 1일
  const firstDayOfMonth = new Date(year, month - 1, 1)
  
  // ISO 8601 첫 주의 월요일 찾기
  const dayOfWeek = firstDayOfMonth.getDay() // 0: 일요일, 1: 월요일, ..., 6: 토요일
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
  
  const firstMonday = new Date(firstDayOfMonth)
  firstMonday.setDate(1 + daysToMonday)
  
  // 첫 주 토요일 계산 (월요일 + 5일)
  let saturday = new Date(firstMonday)
  saturday.setDate(firstMonday.getDate() + 5)
  
  // 최대 5주차까지 계산하되, 해당 월의 월요일만 포함
  for (let week = 1; week <= 5; week++) {
    // 해당 주차의 월요일이 해당 월 범위 내에 있는지 확인
    const mondayOfWeek = new Date(saturday)
    mondayOfWeek.setDate(saturday.getDate() - 5) // 토요일에서 5일 빼면 월요일
    
    if (mondayOfWeek.getMonth() === month - 1) {
      // 토요일 날짜 포맷팅 (YYYY-MM-DD)
      const formattedDate = `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, '0')}-${String(saturday.getDate()).padStart(2, '0')}`
      
      // 결과에 저장
      weeklySaturdays[`week_${week}_saturday`] = formattedDate
    } else {
      // 해당 월에 월요일이 없으면 종료
      break
    }
    
    // 다음 주 토요일 (7일 후)
    saturday = new Date(saturday)
    saturday.setDate(saturday.getDate() + 7)
  }
  
  console.log(`주차별 토요일 계산 완료:`, weeklySaturdays)
  return weeklySaturdays
}

// 장원 조건 저장 함수
async function saveChampionCriteria(
  supabase, 
  schoolCode, 
  year, 
  month, 
  weeklyMealDays,
  monthlyTotal,
  weeklySaturdays
) {
  try {
    // 새 데이터 삽입 (전체 삭제 후이므로 개별 삭제 불필요)
    const { error } = await supabase.from('champion_criteria').insert({
      school_code: schoolCode,
      year,
      month,
      week_1_days: weeklyMealDays[1] || 0,
      week_2_days: weeklyMealDays[2] || 0,
      week_3_days: weeklyMealDays[3] || 0,
      week_4_days: weeklyMealDays[4] || 0,
      week_5_days: weeklyMealDays[5] || 0,
      month_total: monthlyTotal,
      // 주차별 토요일 필드 추가
      week_1_saturday: weeklySaturdays?.week_1_saturday || null,
      week_2_saturday: weeklySaturdays?.week_2_saturday || null,
      week_3_saturday: weeklySaturdays?.week_3_saturday || null,
      week_4_saturday: weeklySaturdays?.week_4_saturday || null,
      week_5_saturday: weeklySaturdays?.week_5_saturday || null,
      created_at: new Date().toISOString()
    })
    
    if (error) {
      throw new Error(`장원 조건 저장 실패: ${error.message}`)
    }
    
    console.log(`${schoolCode} ${year}년 ${month}월 데이터 저장 완료`)
    return true
  } catch (err) {
    console.error('장원 조건 저장 예외:', err)
    throw err
  }
}
