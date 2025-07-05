/**
 * 주/월장원 통계 계산 API
 * 
 * POST /api/champion/calculate
 * - 특정 사용자의 주/월장원 통계 계산 및 저장
 * - 완전히 독립적인 시스템 (기존 기능에 영향 없음)
 */

import { NextRequest, NextResponse } from 'next/server'
import { championCalculator } from '@/utils/championCalculator'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      user_id, 
      school_code, 
      grade, 
      year, 
      month, 
      week_number, // optional, 없으면 월장원 계산
      period_type 
    } = body

    // 필수 파라미터 검증
    if (!user_id || !school_code || !grade || !year || !month || !period_type) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!['weekly', 'monthly'].includes(period_type)) {
      return NextResponse.json(
        { error: 'period_type은 weekly 또는 monthly여야 합니다.' },
        { status: 400 }
      )
    }

    let statistics = null

    if (period_type === 'weekly') {
      if (!week_number) {
        return NextResponse.json(
          { error: '주장원 계산시 week_number가 필요합니다.' },
          { status: 400 }
        )
      }

      statistics = await championCalculator.calculateWeeklyStatistics(
        user_id,
        school_code,
        grade,
        year,
        month,
        week_number
      )
    } else {
      statistics = await championCalculator.calculateMonthlyStatistics(
        user_id,
        school_code,
        grade,
        year,
        month
      )
    }

    if (!statistics) {
      return NextResponse.json(
        { error: '통계 계산에 실패했습니다.' },
        { status: 500 }
      )
    }

    // DB에 저장
    const saved = await championCalculator.saveStatistics(statistics)
    if (!saved) {
      return NextResponse.json(
        { error: '통계 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      statistics,
      message: `${period_type === 'weekly' ? '주장원' : '월장원'} 통계가 계산되었습니다.`
    })

  } catch (error) {
    console.error('장원 통계 계산 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 사용자별 장원 통계 조회 및 자동 계산
 * GET 방식으로 쉽게 데이터 조회 가능
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const school_code = searchParams.get('school_code')
    const grade = searchParams.get('grade')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const week_number = searchParams.get('week_number') // 선택사항
    const period_type = searchParams.get('period_type') || (week_number ? 'weekly' : 'monthly')
    
    console.log('🔍 장원 통계 조회 API 호출:', {
      user_id, school_code, grade, year, month, week_number, period_type
    })

    if (!user_id || !school_code || !grade || !year || !month) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // 먼저 기존 데이터 조회
    let query = supabase
      .from('quiz_champion_history')
      .select('*')
      .eq('user_id', user_id)
      .eq('school_code', school_code)
      .eq('grade', parseInt(grade))
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .eq('period_type', period_type)

    if (week_number && period_type === 'weekly') {
      query = query.eq('week_number', parseInt(week_number))
    }

    const { data: existingData, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('장원 통계 조회 오류:', error)
      return NextResponse.json(
        { error: '통계 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 기존 데이터가 있으면 반환
    if (existingData && existingData.length > 0) {
      const result = existingData[0]
      console.log('✅ 기존 통계 데이터 반환:', result)
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          is_champion: result.is_champion,
          total_meal_days: result.total_meal_days || 0,
          correct_answers: result.correct_count // 필드 이름 매핑 추가
        }
      })
    }

    // 기존 데이터가 없으면 자동 계산
    console.log('📊 기존 데이터 없음, 자동 계산 시작...')
    
    let statistics = null
    
    try {
      if (period_type === 'weekly' && week_number) {
        statistics = await championCalculator.calculateWeeklyStatistics(
          user_id,
          school_code,
          parseInt(grade),
          parseInt(year),
          parseInt(month),
          parseInt(week_number)
        )
      } else if (period_type === 'monthly') {
        statistics = await championCalculator.calculateMonthlyStatistics(
          user_id,
          school_code,
          parseInt(grade),
          parseInt(year),
          parseInt(month)
        )
      }

      if (statistics) {
        // 계산된 통계 저장
        const saved = await championCalculator.saveStatistics(statistics)
        console.log(saved ? '✅ 통계 저장 성공' : '❌ 통계 저장 실패')
        
        return NextResponse.json({
          success: true,
          data: {
            ...statistics,
            is_champion: statistics.is_champion,
            total_meal_days: statistics.total_meal_days || 0,
            correct_answers: statistics.correct_count // 필드 이름 매핑 추가
          }
        })
      } else {
        // 계산 실패시 기본값 반환
        console.log('⚠️ 통계 계산 실패, 기본값 반환')
        return NextResponse.json({
          success: true,
          data: {
            user_id: user_id,
            school_code: school_code,
            grade: parseInt(grade),
            year: parseInt(year),
            month: parseInt(month),
            week_number: week_number ? parseInt(week_number) : null,
            period_type: period_type,
            total_meal_days: 0,
            total_count: 0,
            correct_count: 0,
            correct_answers: 0, // 추가된 필드
            accuracy_rate: 0,
            avg_answer_time: 0,
            is_champion: false
          }
        })
      }
    } catch (calcError) {
      console.error('자동 계산 중 오류:', calcError)
      // 계산 오류시에도 기본값 반환
      return NextResponse.json({
        success: true,
        data: {
          user_id: user_id,
          school_code: school_code,
          grade: parseInt(grade),
          year: parseInt(year),
          month: parseInt(month),
          week_number: week_number ? parseInt(week_number) : null,
          period_type: period_type,
          total_meal_days: 0,
          total_count: 0,
          correct_count: 0,
          correct_answers: 0, // 추가된 필드
          accuracy_rate: 0,
          avg_answer_time: 0,
          is_champion: false
        }
      })
    }

  } catch (error) {
    console.error('장원 통계 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
