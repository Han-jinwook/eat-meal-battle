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
    console.log('다음 달 장원 조건 설정 시작...')
    
    // Supabase 환경 변수 확인
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
    }
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    console.log('Supabase 클라이언트 초기화 완료');

    // 학교 목록 가져오기
    const { data: schools, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, office_code')

    if (schoolError) {
      throw new Error(`학교 목록 조회 실패: ${schoolError.message}`)
    }

    if (!schools || schools.length === 0) {
      throw new Error('등록된 학교 정보가 없습니다');
    }

    console.log(`총 ${schools.length}개 학교 발견`)

    // 실행할 월 목록 (6,7,8,9,10월 일괄 처리용)
    const targetMonths = [6, 7, 8, 9, 10]
    const currentYear = 2024

    console.log(`${currentYear}년 ${targetMonths.join(',')}월 급식 데이터 수집 시작`)
    
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
            const weeklyMealDays = calculateWeeklyMealDays(mealDays, currentYear, targetMonth)
            
            // 주차별 토요일 계산
            const weeklySaturdays = calculateWeeklySaturdays(currentYear, targetMonth)
            
            // 학교별 급식 조건 저장 (학년 구분 없음)
            const monthlyTotal = Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
            
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
            
            // 월별 API 호출 제한을 위한 지연
            await new Promise(resolve => setTimeout(resolve, 200));
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
      
      // API 호출 제한을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 500));
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

// 주차별 급식 일수 계산
function calculateWeeklyMealDays(mealDays, year, month) {
  const weeklyCount = {}
  
  for (const dateStr of mealDays) {
    const date = new Date(dateStr)
    
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
    } else {
      // 주차별 카운트 증가
      weeklyCount[weekNumber] = (weeklyCount[weekNumber] || 0) + 1
    }
  }
  
  return weeklyCount
}

// 주차별 토요일 날짜 계산 (ISO 8601 기준)
function calculateWeeklySaturdays(year, month) {
  console.log(`${year}년 ${month}월 주차별 토요일 계산 시작...`)
  
  const weeklySaturdays = {}
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const lastDayOfMonth = new Date(year, month, 0)
  
  // 해당 월의 모든 월요일을 찾아서 주차 결정
  const mondays = []
  
  // 해당 월의 첫 번째 월요일부터 시작
  let currentDate = new Date(firstDayOfMonth)
  
  // 첫 번째 월요일 찾기
  while (currentDate.getDay() !== 1) { // 1 = 월요일
    currentDate.setDate(currentDate.getDate() + 1)
    if (currentDate.getMonth() !== month - 1) {
      // 해당 월에 월요일이 없는 경우 (실제로는 불가능하지만 안전장치)
      break
    }
  }
  
  // 해당 월의 모든 월요일 수집
  while (currentDate.getMonth() === month - 1) {
    mondays.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 7) // 다음 주 월요일
  }
  
  // 각 월요일에 대해 토요일 계산
  mondays.forEach((monday, index) => {
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5) // 월요일 + 5일 = 토요일
    
    const weekNumber = index + 1
    const formattedDate = `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, '0')}-${String(saturday.getDate()).padStart(2, '0')}`
    
    weeklySaturdays[`week_${weekNumber}_saturday`] = formattedDate
  })
  
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
      // 주차별 토요일 필드 추가
      week_1_saturday: weeklySaturdays?.week_1_saturday || null,
      week_2_saturday: weeklySaturdays?.week_2_saturday || null,
      week_3_saturday: weeklySaturdays?.week_3_saturday || null,
      week_4_saturday: weeklySaturdays?.week_4_saturday || null,
      week_5_saturday: weeklySaturdays?.week_5_saturday || null,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'school_code,year,month'
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
