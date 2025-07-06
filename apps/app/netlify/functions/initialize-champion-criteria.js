/**
 * 장원 조건 초기화 함수
 * 
 * 이 함수는 테스트 기간 중 6-8월 데이터를 일괄적으로 설정합니다.
 * NEIS 데이터를 시뮬레이션하여 각 학교별/학년별 장원 조건을 설정합니다.
 * 기존 시스템에는 영향을 주지 않습니다.
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  // API 키 검증 (임시 비활성화)
  // const authToken = event.headers['x-api-key']
  // if (authToken !== process.env.ADMIN_API_KEY) {
  //   return {
  //     statusCode: 401,
  //     body: JSON.stringify({ error: 'Unauthorized' })
  //   }
  // }

  try {
    console.log('장원 조건 초기화 시작...')
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // 학교 목록 가져오기
    const { data: schools, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, office_code')

    if (schoolError) {
      throw new Error(`학교 목록 조회 실패: ${schoolError.message}`)
    }

    console.log(`총 ${schools.length}개 학교 발견`)

    // 수집할 월 목록 (6, 7, 8월)
    const months = [6, 7, 8]
    const year = 2025  // 현재 연도

    console.log(`${year}년 ${months.join(', ')}월 급식 데이터 수집 시작`)
    
    let processedCount = 0
    const results = []

    // 각 학교별로 급식 데이터 수집
    for (const school of schools) {
      console.log(`${school.school_code} 학교 처리 중...`)
      
      for (const month of months) {
        // NEIS API를 통해 급식 데이터 조회
        const mealDays = await fetchMealDaysFromNEIS(school.school_code, school.office_code, year, month)
        
        // 주차별 급식 일수 계산
        const weeklyMealDays = calculateWeeklyMealDays(mealDays, year, month)
        
        // 학교별 급식 조건 저장 (학년 구분 없음)
        const monthlyTotal = Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
        
        await saveChampionCriteria(
          supabase,
          school.school_code,
          year,
          month,
          weeklyMealDays,
          monthlyTotal
        )
        
        results.push({
          school: school.school_code,
          month,
          weekly: weeklyMealDays,
          monthly: Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
        })
      }
      
      processedCount++
      console.log(`진행 상황: ${processedCount}/${schools.length} 학교 처리 완료`)
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${schools.length}개 학교의 ${year}년 ${months.join(', ')}월 급식 데이터 처리 완료`,
        summary: results
      })
    }
  } catch (error) {
    console.error('급식 데이터 초기화 오류:', error)
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

// 장원 조건 저장 함수
async function saveChampionCriteria(
  supabase, 
  schoolCode, 
  year, 
  month, 
  weeklyMealDays,
  monthlyTotal
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
      week_6_days: weeklyMealDays[6] || 0,
      month_total: monthlyTotal,
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
