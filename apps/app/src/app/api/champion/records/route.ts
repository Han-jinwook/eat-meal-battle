/**
 * 장원 기록 API
 * - 신규 테이블 구조를 활용하는 API
 * - 기존 API와 호환되며 점진적 전환 가능
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { ChampionCriteriaService } from '@/utils/championCriteriaService'

const criteriaService = new ChampionCriteriaService();

/**
 * GET /api/champion/records
 * 사용자의 장원 기록을 조회합니다
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const user_id = searchParams.get('user_id')
    const school_code = searchParams.get('school_code')
    const grade = searchParams.get('grade') ? parseInt(searchParams.get('grade')!) : null
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // 필수 파라미터 검증
    if (!user_id || !school_code || !grade || !year || !month) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다', required: ['user_id', 'school_code', 'grade', 'year', 'month'] },
        { status: 400 }
      )
    }

    // Supabase 클라이언트 초기화
    const supabase = createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 클라이언트 초기화 실패' },
        { status: 500 }
      )
    }

    // JWT 토큰 검증
    const { error: authError } = await supabase.auth.getUser()
    if (authError) {
      return NextResponse.json(
        { error: '인증 실패', details: authError.message },
        { status: 401 }
      )
    }

    // 사용자의 장원 기록 조회
    const userChampionRecords = await criteriaService.getUserChampionRecords(
      user_id,
      school_code,
      grade,
      year,
      month
    )

    if (!userChampionRecords) {
      // 장원 기록이 없는 경우, 빈 기록 반환
      return NextResponse.json({
        user_id,
        school_code,
        grade,
        year,
        month,
        week_1_champion: false,
        week_2_champion: false,
        week_3_champion: false,
        week_4_champion: false,
        week_5_champion: false,
        month_champion: false
      })
    }

    // 성공 응답
    return NextResponse.json(userChampionRecords)
  } catch (error: any) {
    console.error('장원 기록 조회 실패:', error)
    return NextResponse.json(
      { error: '장원 기록 조회 중 오류 발생', details: error?.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/champion/records
 * 사용자의 장원 상태를 계산하고 기록합니다
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json()
    
    const {
      user_id,
      school_code,
      grade,
      year,
      month,
      week_number,
      period_type = 'weekly'
    } = body

    // 필수 파라미터 검증
    if (!user_id || !school_code || !grade || !year || !month) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다', required: ['user_id', 'school_code', 'grade', 'year', 'month'] },
        { status: 400 }
      )
    }

    // period_type에 따른 추가 파라미터 검증
    if (period_type === 'weekly' && !week_number) {
      return NextResponse.json(
        { error: '주간 장원 계산에는 week_number가 필요합니다' },
        { status: 400 }
      )
    }

    // Supabase 클라이언트 초기화
    const supabase = createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase 클라이언트 초기화 실패' },
        { status: 500 }
      )
    }

    // JWT 토큰 검증
    const { error: authError } = await supabase.auth.getUser()
    if (authError) {
      return NextResponse.json(
        { error: '인증 실패', details: authError.message },
        { status: 401 }
      )
    }

    // 장원 상태 계산
    let isChampion = false;
    
    if (period_type === 'weekly') {
      isChampion = await criteriaService.checkAndUpdateChampionStatus(
        user_id,
        school_code,
        grade,
        year,
        month,
        week_number
      )
    } else {
      isChampion = await criteriaService.checkAndUpdateChampionStatus(
        user_id,
        school_code,
        grade,
        year,
        month
      )
    }

    // 성공 응답
    return NextResponse.json({
      user_id,
      school_code,
      grade,
      year,
      month,
      week_number: period_type === 'weekly' ? week_number : undefined,
      period_type,
      is_champion: isChampion
    })
  } catch (error: any) {
    console.error('장원 상태 계산 실패:', error)
    return NextResponse.json(
      { error: '장원 상태 계산 중 오류 발생', details: error?.message },
      { status: 500 }
    )
  }
}
