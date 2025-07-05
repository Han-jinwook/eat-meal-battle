/**
 * 월간 장원 조건 설정 스케줄러
 * 
 * 매월 1일에 자동으로 실행되어 다음 달의 장원 조건을 설정합니다.
 * NEIS API에서 급식 일수 데이터를 가져와 학교별/학년별 장원 조건을 계산합니다.
 * 기존 시스템에는 영향을 주지 않습니다.
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  // API 키 검증
  const authToken = event.headers['x-api-key']
  if (authToken !== process.env.CRON_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    }
  }

  // 테스트 모드 확인
  const isTestMode = process.env.CHAMPION_TEST_MODE === 'true'
  
  try {
    console.log(`월간 장원 조건 설정 시작 (테스트 모드: ${isTestMode})`)
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )

    // 학교 목록 가져오기
    const { data: schools, error: schoolError } = await supabase
      .from('schools')
      .select('school_code, name')

    if (schoolError) {
      throw new Error(`학교 목록 조회 실패: ${schoolError.message}`)
    }

    // 다음 달 계산
    const now = new Date()
    let nextMonth = now.getMonth() + 2 // 0-based에서 +1하고 다음 달이니 +1 더
    let nextYear = now.getFullYear()
    
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear++
    }

    console.log(`총 ${schools.length}개 학교에 대해 ${nextYear}년 ${nextMonth}월 급식 데이터 수집 시작`)
    
    const results = []

    // 각 학교별로 다음 달 급식 데이터 수집
    for (const school of schools) {
      // NEIS API를 통해 급식 데이터 조회
      const mealDays = await fetchMealDaysFromNEIS(school.school_code, nextYear, nextMonth)
      
      // 주차별 급식 일수 계산
      const weeklyMealDays = calculateWeeklyMealDays(mealDays, nextYear, nextMonth)
      
      // 학년별로 동일한 조건 적용
      for (let grade = 1; grade <= 6; grade++) {
        // 주간 조건 저장
        for (const [weekNumber, dayCount] of Object.entries(weeklyMealDays)) {
          await saveChampionCriteria(
            supabase,
            school.school_code,
            grade,
            nextYear,
            nextMonth,
            parseInt(weekNumber),
            dayCount,
            'weekly'
          )
        }
        
        // 월간 조건 저장
        const monthlyTotal = Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
        await saveChampionCriteria(
          supabase, 
          school.school_code, 
          grade, 
          nextYear, 
          nextMonth, 
          null, 
          monthlyTotal, 
          'monthly'
        )
      }
      
      results.push({
        school: school.name,
        weekly: weeklyMealDays,
        monthly: Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
      })
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${schools.length}개 학교의 ${nextYear}년 ${nextMonth}월 급식 데이터 처리 완료`,
        summary: results
      })
    }
  } catch (error) {
    console.error('월간 급식 데이터 수집 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// NEIS API에서 급식 일수 조회 (학교별, 월별) - 현재는 시뮬레이션
async function fetchMealDaysFromNEIS(schoolCode, year, month) {
  console.log(`${schoolCode} 학교의 ${year}년 ${month}월 급식 일수 조회 중...`)
  
  // 해당 월의 총 일수
  const daysInMonth = new Date(year, month, 0).getDate()
  const mealDays = []
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay() // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    // 평일(월~금)에는 급식 있음으로 가정
    if (dayOfWeek > 0 && dayOfWeek < 6) {
      mealDays.push(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`)
    }
  }
  
  console.log(`${schoolCode} 학교의 ${year}년 ${month}월 급식일수: ${mealDays.length}일`)
  return mealDays
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

// 장원 조건 저장 함수
async function saveChampionCriteria(
  supabase, 
  schoolCode, 
  grade, 
  year, 
  month, 
  weekNumber, 
  mealCount, 
  periodType
) {
  try {
    const { error } = await supabase.from('champion_criteria').upsert({
      school_code: schoolCode,
      grade,
      year,
      month,
      week_number: weekNumber,
      period_type: periodType,
      required_count: mealCount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'school_code,grade,year,month,week_number,period_type'
    })
    
    if (error) {
      console.error('장원 조건 저장 오류:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('장원 조건 저장 예외:', err)
    return false
  }
}
