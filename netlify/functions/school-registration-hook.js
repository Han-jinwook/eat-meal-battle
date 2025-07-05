/**
 * 학교 등록 훅 함수
 * 
 * 새 학교가 등록되면 자동으로 해당 학교의 장원 조건을 설정합니다.
 * 현재 월과 다음 달의 급식 데이터를 NEIS API에서 가져와 설정합니다.
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  try {
    // 테스트 모드 확인
    const isTestMode = process.env.CHAMPION_TEST_MODE === 'true'
    console.log(`학교 등록 훅 시작 (테스트 모드: ${isTestMode})`)
    
    // 페이로드 파싱
    const payload = JSON.parse(event.body)
    const { record } = payload
    
    // 신규 학교 정보
    const schoolCode = record.school_code
    const name = record.name
    
    console.log(`신규 학교 등록: ${name}(${schoolCode})`)
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
    
    // 현재 년도와 월
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    // 당월과 다음 달, 그리고 테스트 모드면 지난 달까지 데이터 수집
    const months = [currentMonth]
    
    // 다음 달 추가
    if (currentMonth < 12) {
      months.push(currentMonth + 1)
    } else {
      months.push(1) // 12월이면 다음은 1월
    }
    
    // 테스트 모드면 지난 달도 추가
    if (isTestMode && currentMonth > 1) {
      months.unshift(currentMonth - 1)
    } else if (isTestMode && currentMonth === 1) {
      months.unshift(12) // 1월이면 지난 달은 12월
    }
    
    console.log(`${months.join(', ')}월 급식 데이터 수집 시작`)
    
    const results = []
    
    for (const month of months) {
      // 연도 계산 (12월->1월 또는 1월->12월 전환 처리)
      const year = (month === 1 && currentMonth === 12) ? currentYear + 1 : 
                 (month === 12 && currentMonth === 1) ? currentYear - 1 : currentYear
      
      // NEIS API를 통해 급식 데이터 조회
      const mealDays = await fetchMealDaysFromNEIS(schoolCode, year, month)
      
      // 주차별 급식 일수 계산
      const weeklyMealDays = calculateWeeklyMealDays(mealDays, year, month)
      
      // 학년별로 동일한 조건 적용 (1~6학년)
      for (let grade = 1; grade <= 6; grade++) {
        // 주간 조건 저장
        for (const [weekNumber, dayCount] of Object.entries(weeklyMealDays)) {
          await saveChampionCriteria(
            supabase,
            schoolCode,
            grade,
            year,
            month,
            parseInt(weekNumber),
            dayCount,
            'weekly'
          )
        }
        
        // 월간 조건 저장
        const monthlyTotal = Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
        await saveChampionCriteria(
          supabase, 
          schoolCode, 
          grade, 
          year, 
          month, 
          null, 
          monthlyTotal, 
          'monthly'
        )
      }
      
      results.push({
        month,
        year,
        weekly: weeklyMealDays,
        monthly: Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
      })
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `${name} 학교의 급식 데이터 처리 완료`,
        processed_months: results 
      })
    }
  } catch (error) {
    console.error('신규 학교 급식 데이터 처리 오류:', error)
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
