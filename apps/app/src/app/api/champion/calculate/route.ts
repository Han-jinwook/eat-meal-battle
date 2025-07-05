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
 * 사용자별 장원 통계 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const school_code = searchParams.get('school_code')
    const grade = searchParams.get('grade')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const period_type = searchParams.get('period_type')

    if (!user_id || !school_code || !grade || !year || !month) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    let query = supabase
      .from('quiz_champion_history')
      .select('*')
      .eq('user_id', user_id)
      .eq('school_code', school_code)
      .eq('grade', parseInt(grade))
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))

    if (period_type) {
      query = query.eq('period_type', period_type)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('장원 통계 조회 오류:', error)
      return NextResponse.json(
        { error: '통계 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('장원 통계 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
