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
    const officeCode = record.office_code
    const name = record.name
    
    console.log(`신규 학교 등록: ${name}(${schoolCode})`)
    
    // 교육청 코드 확인
    if (!officeCode) {
      console.error('교육청 코드가 없습니다')
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '교육청 코드가 필요합니다' })
      }
    }
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
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
      
      try {
        // NEIS API를 통해 급식 데이터 조회
        const mealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, year, month)
        
        // 주차별 급식 일수 계산
        const weeklyMealDays = calculateWeeklyMealDays(mealDays, year, month)
        
        // 월간 총 급식일수 계산
        const monthlyTotal = Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
        
        // 실제 테이블 구조에 맞게 champion_criteria 저장
        await saveChampionCriteria(
          supabase,
          schoolCode,
          year,
          month,
          weeklyMealDays,
          monthlyTotal
        )
        
        results.push({
          month,
          year,
          weekly: weeklyMealDays,
          monthly: monthlyTotal
        })
        
        console.log(`${schoolCode} ${year}년 ${month}월 장원 조건 설정 완료`)
        
      } catch (monthError) {
        console.error(`${year}년 ${month}월 데이터 처리 오류:`, monthError)
        results.push({
          month,
          year,
          error: monthError.message
        })
      }
      
      // API 호출 간격 조절
      await new Promise(resolve => setTimeout(resolve, 500))
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
  const weeklyCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  
  for (const dateStr of mealDays) {
    const date = new Date(dateStr)
    
    // ISO 주차 계산 (월요일 시작)
    const firstDayOfMonth = new Date(year, month - 1, 1)
    let firstMonday = new Date(firstDayOfMonth)
    
    // 첫 번째 월요일 찾기
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1)
    }
    
    const timeDiff = date.getTime() - firstMonday.getTime()
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    
    if (daysDiff >= 0) {
      const weekNumber = Math.floor(daysDiff / 7) + 1
      if (weekNumber >= 1 && weekNumber <= 6) {
        weeklyCount[weekNumber]++
      }
    }
  }
  
  return weeklyCount
}

// 장원 조건 저장 함수 (실제 테이블 구조에 맞게)
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
      week1_days: weeklyMealDays[1] || 0,
      week2_days: weeklyMealDays[2] || 0,
      week3_days: weeklyMealDays[3] || 0,
      week4_days: weeklyMealDays[4] || 0,
      week5_days: weeklyMealDays[5] || 0,
      week6_days: weeklyMealDays[6] || 0,
      monthly_days: monthlyTotal,
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
