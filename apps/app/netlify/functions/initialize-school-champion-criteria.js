/**
 * 특정 학교의 장원 조건 초기화 함수
 * 
 * 이 함수는 새로운 학교가 추가될 때 해당 학교의 장원 조건을 초기화합니다.
 * 현재 월의 급식 데이터를 가져와 장원 조건을 설정합니다.
 */

const { createClient } = require('@supabase/supabase-js')

// NEIS API 기본 URL
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub'

exports.handler = async (event) => {
  console.log('특정 학교 장원 조건 초기화 함수 실행 시작 - ', new Date().toISOString())
  
  try {
    // 요청 파라미터 확인
    let schoolCode, officeCode
    
    // 요청 방식에 따라 파라미터 추출
    if (event.httpMethod === 'GET') {
      // GET 요청에서 쿼리 파라미터 추출
      schoolCode = event.queryStringParameters?.school_code
      officeCode = event.queryStringParameters?.office_code
    } else if (event.httpMethod === 'POST') {
      // POST 요청에서 본문 파라미터 추출
      try {
        const body = JSON.parse(event.body || '{}')
        schoolCode = body.school_code
        officeCode = body.office_code
      } catch (e) {
        console.error('요청 본문 파싱 오류:', e)
      }
    }
    
    // 필수 파라미터 확인
    if (!schoolCode || !officeCode) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: '필수 파라미터 누락',
          message: 'school_code와 office_code가 필요합니다'
        })
      }
    }
    
    console.log(`학교 코드: ${schoolCode}, 교육청 코드: ${officeCode}`)
    
    // Supabase 환경 변수 확인
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다')
    }
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    console.log('Supabase 클라이언트 초기화 완료')
    
    // 현재 날짜 기준 년/월 계산
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // JavaScript의 월은 0부터 시작
    
    console.log(`${currentYear}년 ${currentMonth}월 급식 데이터 수집 시작`)
    
    // NEIS API를 통해 급식 데이터 조회
    const mealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, currentYear, currentMonth)
    
    // 주차별 급식 일수 계산
    const weeklyMealDays = calculateWeeklyMealDays(mealDays, currentYear, currentMonth)
    
    // 학교별 급식 조건 저장
    const monthlyTotal = Object.values(weeklyMealDays).reduce((sum, count) => sum + count, 0)
    
    await saveChampionCriteria(
      supabase,
      schoolCode,
      currentYear,
      currentMonth,
      weeklyMealDays,
      monthlyTotal
    )
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${schoolCode} 학교의 ${currentYear}년 ${currentMonth}월 장원 조건 설정 완료`,
        data: {
          school_code: schoolCode,
          year: currentYear,
          month: currentMonth,
          weekly: weeklyMealDays,
          monthly: monthlyTotal
        }
      })
    }
  } catch (error) {
    console.error('장원 조건 초기화 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

/**
 * NEIS API에서 급식 일자 데이터 가져오기
 * @param {string} schoolCode - 학교 코드
 * @param {string} officeCode - 교육청 코드
 * @param {number} year - 년도
 * @param {number} month - 월
 * @returns {Array} - 급식이 있는 날짜 목록
 */
async function fetchMealDaysFromNEIS(schoolCode, officeCode, year, month) {
  console.log(`NEIS API 호출: ${schoolCode} (${officeCode}) - ${year}년 ${month}월`)
  
  // NEIS API 키 확인
  if (!process.env.NEIS_API_KEY) {
    throw new Error('NEIS API 키가 설정되지 않았습니다')
  }
  
  try {
    // 월 포맷팅 (1자리 월을 2자리로: 1 -> 01)
    const formattedMonth = month.toString().padStart(2, '0')
    
    // NEIS API 호출 URL 구성
    const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`
    const params = new URLSearchParams({
      KEY: process.env.NEIS_API_KEY,
      Type: 'json',
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      MLSV_YMD: `${year}${formattedMonth}`
    })
    
    // API 호출
    const response = await fetch(`${apiUrl}?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error(`NEIS API 응답 오류: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // API 응답 확인
    if (!data || !data.mealServiceDietInfo) {
      console.log('NEIS API 응답에 급식 정보가 없습니다:', JSON.stringify(data))
      return []
    }
    
    // 급식 정보 추출
    const mealInfo = data.mealServiceDietInfo[1]
    
    if (!mealInfo || !mealInfo.row) {
      console.log('NEIS API 응답에 급식 행 데이터가 없습니다:', JSON.stringify(mealInfo))
      return []
    }
    
    // 급식이 있는 날짜만 추출
    const mealDays = mealInfo.row.map(item => item.MLSV_YMD)
    console.log(`${mealDays.length}일의 급식 데이터 발견`)
    
    return mealDays
  } catch (error) {
    console.error('NEIS API 호출 오류:', error)
    throw error
  }
}

/**
 * 주차별 급식 일수 계산
 * @param {Array} mealDays - 급식이 있는 날짜 목록
 * @param {number} year - 년도
 * @param {number} month - 월
 * @returns {Object} - 주차별 급식 일수
 */
function calculateWeeklyMealDays(mealDays, year, month) {
  console.log(`주차별 급식 일수 계산: ${year}년 ${month}월, ${mealDays.length}일`)
  
  // 결과 저장용 객체
  const weeklyMealDays = {
    week1: 0,
    week2: 0,
    week3: 0,
    week4: 0,
    week5: 0
  }
  
  // 각 날짜별로 주차 계산
  mealDays.forEach(dayStr => {
    // 날짜 문자열을 Date 객체로 변환 (YYYYMMDD 형식)
    const year = parseInt(dayStr.substring(0, 4))
    const month = parseInt(dayStr.substring(4, 6)) - 1 // JavaScript의 월은 0부터 시작
    const day = parseInt(dayStr.substring(6, 8))
    
    const date = new Date(year, month, day)
    
    // 해당 월의 1일
    const firstDayOfMonth = new Date(year, month, 1)
    
    // 1일의 요일 (0: 일요일, 1: 월요일, ..., 6: 토요일)
    const firstDayWeekday = firstDayOfMonth.getDay()
    
    // 날짜의 주차 계산
    // 1일이 월요일(1)이면 해당 주가 1주차, 화요일(2)이면 해당 주가 1주차, ..., 일요일(0)이면 해당 주가 1주차
    const weekOfMonth = Math.ceil((day + firstDayWeekday - 1) / 7)
    
    // 주차별 카운트 증가
    const weekKey = `week${weekOfMonth}`
    if (weeklyMealDays[weekKey] !== undefined) {
      weeklyMealDays[weekKey]++
    }
  })
  
  console.log('주차별 급식 일수:', weeklyMealDays)
  return weeklyMealDays
}

/**
 * 장원 조건 저장
 * @param {Object} supabase - Supabase 클라이언트
 * @param {string} schoolCode - 학교 코드
 * @param {number} year - 년도
 * @param {number} month - 월
 * @param {Object} weeklyMealDays - 주차별 급식 일수
 * @param {number} monthlyTotal - 월 전체 급식 일수
 */
async function saveChampionCriteria(supabase, schoolCode, year, month, weeklyMealDays, monthlyTotal) {
  console.log(`장원 조건 저장: ${schoolCode} - ${year}년 ${month}월`)
  
  try {
    // 기존 데이터가 있는지 확인
    const { data: existingData, error: checkError } = await supabase
      .from('champion_criteria')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('year', year)
      .eq('month', month)
    
    if (checkError) {
      throw new Error(`기존 데이터 확인 오류: ${checkError.message}`)
    }
    
    // 저장할 데이터 준비
    const criteriaData = {
      school_code: schoolCode,
      year,
      month,
      week1_days: weeklyMealDays.week1,
      week2_days: weeklyMealDays.week2,
      week3_days: weeklyMealDays.week3,
      week4_days: weeklyMealDays.week4,
      week5_days: weeklyMealDays.week5,
      monthly_days: monthlyTotal
    }
    
    let result
    
    // 기존 데이터가 있으면 업데이트, 없으면 새로 추가
    if (existingData && existingData.length > 0) {
      console.log(`기존 데이터 업데이트: ${schoolCode} - ${year}년 ${month}월`)
      result = await supabase
        .from('champion_criteria')
        .update(criteriaData)
        .eq('school_code', schoolCode)
        .eq('year', year)
        .eq('month', month)
    } else {
      console.log(`새 데이터 추가: ${schoolCode} - ${year}년 ${month}월`)
      result = await supabase
        .from('champion_criteria')
        .insert(criteriaData)
    }
    
    if (result.error) {
      throw new Error(`데이터 저장 오류: ${result.error.message}`)
    }
    
    console.log(`장원 조건 저장 완료: ${schoolCode} - ${year}년 ${month}월`)
    return true
  } catch (error) {
    console.error('장원 조건 저장 오류:', error)
    throw error
  }
}
