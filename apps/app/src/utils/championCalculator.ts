/**
 * 주/월장원 통계 계산 시스템
 * 
 * 핵심 원칙:
 * - 급식일수 = 정답수 (완전 일치)
 * - ISO 기준 주차 계산 (월요일 기준)
 * - 매주 금요일, 매월 마지막날 결정
 */

import { createClient } from '@/lib/supabase'
import { createClient as createServerClient } from '@/lib/supabase-server'

export interface ChampionStatistics {
  user_id: string
  school_code: string
  year: number
  month: number
  week_number?: number
  period_type: 'weekly' | 'monthly'
  total_meal_days: number    // 실제 급식 제공 일수
  total_count: number        // 퀴즈 출제 일수
  correct_count: number      // 유저 정답수
  is_champion: boolean       // 장원 여부
  determined_at?: Date
}

export interface WeekInfo {
  year: number
  month: number
  week_number: number
  start_date: Date
  end_date: Date
}

export class ChampionCalculator {
  private getSupabaseClient() {
    // 서버 환경에서는 서버용 클라이언트 사용
    if (typeof window === 'undefined') {
      try {
        return createServerClient()
      } catch (error) {
        console.log('서버 클라이언트 생성 실패, 기본 클라이언트 사용:', error)
        return createClient()
      }
    }
    return createClient()
  }
  
  private get supabase() {
    return this.getSupabaseClient()
  }

  /**
   * ISO 기준 주차 계산 (월요일이 속한 달 기준)
   */
  getWeekInfo(date: Date): WeekInfo {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // 해당 월의 첫 번째 월요일 찾기
    const firstOfMonth = new Date(year, month, 1)
    const firstMonday = new Date(firstOfMonth)
    const dayOfWeek = firstOfMonth.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    firstMonday.setDate(1 + daysToMonday)

    // 주차 계산
    const timeDiff = date.getTime() - firstMonday.getTime()
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const week_number = Math.floor(daysDiff / 7) + 1

    // 해당 주의 시작일/종료일 (월-일)
    const start_date = new Date(firstMonday)
    start_date.setDate(firstMonday.getDate() + (week_number - 1) * 7)
    
    const end_date = new Date(start_date)
    end_date.setDate(start_date.getDate() + 6)

    return {
      year,
      month: month + 1, // 1-based month
      week_number,
      start_date,
      end_date
    }
  }

  /**
   * 특정 기간의 급식 제공 일수 계산
   * 
   * 로직: meal_menus 테이블에서 해당 기간 + 학교의 급식 데이터 카운트
   */
  async calculateMealDays(
    schoolCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      console.log('급식일수 계산 시도:', {
        schoolCode,
        startDateStr,
        endDateStr
      })

      // meal_menus 테이블에서 해당 기간의 급식 데이터 조회
      const { data, error } = await this.supabase
        .from('meal_menus')
        .select('meal_date')
        .eq('school_code', schoolCode)
        .gte('meal_date', startDateStr)
        .lte('meal_date', endDateStr)

      if (error) {
        console.error('급식일수 계산 오류:', error)
        // 에러 발생시 기본값으로 주 5일, 월 20일 가정
        const diffTime = endDate.getTime() - startDate.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const estimatedMealDays = Math.floor(diffDays * 0.7) // 대략 70% 급식 제공 가정
        console.log('급식일수 추정값 사용:', estimatedMealDays)
        return estimatedMealDays
      }

      const mealDays = data?.length || 0
      console.log('급식일수 계산 완료:', mealDays)
      return mealDays
    } catch (error) {
      console.error('급식일수 계산 예외:', error)
      // 예외 발생시 기본값 반환
      const diffTime = endDate.getTime() - startDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const estimatedMealDays = Math.floor(diffDays * 0.7)
      console.log('급식일수 예외시 추정값 사용:', estimatedMealDays)
      return estimatedMealDays
    }
  }

  /**
   * 특정 기간의 퀴즈 결과 조회
   * 
   * 참고: quiz_results 테이블에는 school_code, grade, date 필드가 없음
   * - user_id로만 필터링
   * - created_at으로 기간 필터링
   * - answer_time 필드 없으므로 기본값 0 사용
   */
  async getQuizResults(
    userId: string,
    schoolCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total_quiz_days: number
    correct_count: number
  }> {
    try {
      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      console.log('퀴즈 결과 조회 시도 (quiz_results 테이블):', {
        userId,
        schoolCode,
        startDateStr,
        endDateStr,
        note: 'school_code, grade 필드 없음 - user_id로만 필터링'
      })

      // quiz_results 테이블 구조: id, user_id, quiz_id, is_correct, selected_option, created_at
      const { data, error } = await this.supabase
        .from('quiz_results')
        .select('id, user_id, is_correct, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)

      if (error) {
        console.error('퀴즈 결과 조회 오류:', error)
        console.log('퀴즈 결과 기본값 반환')
        return { total_quiz_days: 0, correct_count: 0 }
      }

      const results = data || []
      const correct_count = results.filter(r => r.is_correct).length
      const total_quiz_days = results.length
      
      console.log('퀴즈 결과 조회 완료:', {
        total_quiz_days,
        correct_count
      })
      
      return {
        total_quiz_days,
        correct_count
      }
    } catch (error) {
      console.error('퀴즈 결과 조회 예외:', error)
      console.log('퀴즈 결과 예외시 기본값 반환')
      return { total_quiz_days: 0, correct_count: 0 }
    }
  }

  /**
   * 주장원 통계 계산 (특정 주차)
   */
  async calculateWeeklyStatistics(
    userId: string,
    schoolCode: string,
    year: number,
    month: number,
    weekNumber: number
  ): Promise<ChampionStatistics | null> {
    try {
      // 해당 주차의 날짜 범위 계산
      const weekInfo = this.getWeekInfoByWeekNumber(year, month - 1, weekNumber)
      if (!weekInfo) return null

      // 급식일수 계산 (월-금만)
      const weekdayStart = new Date(weekInfo.start_date)
      const weekdayEnd = new Date(weekInfo.end_date)
      
      // 월-금만 계산하도록 조정
      if (weekdayStart.getDay() === 0) weekdayStart.setDate(weekdayStart.getDate() + 1) // 일요일이면 월요일로
      if (weekdayEnd.getDay() === 6) weekdayEnd.setDate(weekdayEnd.getDate() - 1) // 토요일이면 금요일로
      
      const total_meal_days = await this.calculateMealDays(schoolCode, weekdayStart, weekdayEnd)
      const quizResults = await this.getQuizResults(userId, schoolCode, weekdayStart, weekdayEnd)

      // 장원 조건: 급식일수 = 정답수
      const is_champion = total_meal_days > 0 && quizResults.correct_count === total_meal_days

      return {
        user_id: userId,
        school_code: schoolCode,
        year,
        month,
        week_number: weekNumber,
        period_type: 'weekly',
        total_meal_days,
        total_count: quizResults.total_quiz_days,
        correct_count: quizResults.correct_count,
        is_champion,
        determined_at: is_champion ? new Date() : undefined
      }
    } catch (error) {
      console.error('주장원 통계 계산 오류:', error)
      return null
    }
  }

  /**
   * 월장원 통계 계산
   */
  async calculateMonthlyStatistics(
    userId: string,
    schoolCode: string,
    year: number,
    month: number
  ): Promise<ChampionStatistics | null> {
    try {
      // 해당 월의 시작일/종료일
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      const total_meal_days = await this.calculateMealDays(schoolCode, startDate, endDate)
      const quizResults = await this.getQuizResults(userId, schoolCode, startDate, endDate)

      // 장원 조건: 급식일수 = 정답수
      const is_champion = total_meal_days > 0 && quizResults.correct_count === total_meal_days

      return {
        user_id: userId,
        school_code: schoolCode,
        year,
        month,
        period_type: 'monthly',
        total_meal_days,
        total_count: quizResults.total_quiz_days,
        correct_count: quizResults.correct_count,
        is_champion,
        determined_at: is_champion ? new Date() : undefined
      }
    } catch (error) {
      console.error('월장원 통계 계산 오류:', error)
      return null
    }
  }

  /**
   * 주차 번호로 주차 정보 계산
   */
  private getWeekInfoByWeekNumber(year: number, month: number, weekNumber: number): WeekInfo | null {
    try {
      // 유효성 검사
      if (weekNumber <= 0) {
        console.error('유효하지 않은 주차 번호:', weekNumber)
        return null
      }

      if (month < 0 || month > 11) {
        console.error('유효하지 않은 월 (0-11 범위를 벗어남):', month)
        return null
      }

      // 해당 월의 첫 번째 날짜
      const firstOfMonth = new Date(year, month, 1)
      
      // 해당 월의 첫 번째 월요일 찾기
      const firstMonday = new Date(firstOfMonth)
      const dayOfWeek = firstOfMonth.getDay()
      const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
      firstMonday.setDate(1 + daysToMonday)

      // 요청된 주차의 시작일
      const start_date = new Date(firstMonday)
      start_date.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
      
      // 요청된 주차의 시작일이 다음 달로 넘어가면 null 반환
      if (start_date.getMonth() !== month) {
        console.error(`주차 번호 ${weekNumber}는 ${year}년 ${month+1}월에 존재하지 않음`)
        return null
      }
      
      // 요청된 주차의 종료일
      const end_date = new Date(start_date)
      end_date.setDate(start_date.getDate() + 6)

      return {
        year,
        month: month + 1, // 1-based month 반환
        week_number: weekNumber,
        start_date,
        end_date
      }
    } catch (error) {
      console.error('주차 정보 계산 오류:', error)
      return null
    }
  }

  /**
   * 통계 저장
   */
  async saveStatistics(stats: ChampionStatistics): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('quiz_champion_history')
        .upsert([{
          user_id: stats.user_id,
          school_code: stats.school_code,
          year: stats.year,
          month: stats.month,
          week_number: stats.week_number,
          period_type: stats.period_type,
          total_meal_days: stats.total_meal_days,
          total_count: stats.total_count,
          correct_count: stats.correct_count,
          is_champion: stats.is_champion,
          determined_at: stats.determined_at?.toISOString(),
          is_current: true
        }], {
          onConflict: 'user_id,school_code,year,month,week_number,period_type'
        })

      if (error) {
        console.error('통계 저장 오류:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('통계 저장 예외:', error)
      return false
    }
  }
}

// 싱글톤 인스턴스
export const championCalculator = new ChampionCalculator()
