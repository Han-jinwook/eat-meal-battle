/**
 * 6, 7월 장원 일괄 체크 API
 * POST /api/champion/batch-check
 */

import { NextRequest, NextResponse } from 'next/server'
import { batchChampionChecker } from '@/utils/batchChampionChecker'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { school_code, grade, action = 'check_all' } = body

    console.log('=== 6, 7월 장원 일괄 체크 API 호출 ===')
    console.log('요청 파라미터:', { school_code, grade, action })

    if (action === 'check_all') {
      // 6, 7월 전체 사용자 장원 상태 일괄 체크
      const results = await batchChampionChecker.checkAllUsersChampionStatus(
        school_code,
        grade
      )

      return NextResponse.json({
        success: true,
        message: '6, 7월 장원 일괄 체크 완료',
        results: results,
        summary: {
          total_processed: results.june.processed + results.july.processed,
          total_champions: results.june.champions + results.july.champions,
          june_summary: `처리: ${results.june.processed}명, 장원: ${results.june.champions}명`,
          july_summary: `처리: ${results.july.processed}명, 장원: ${results.july.champions}명`
        }
      })
    } else if (action === 'get_summary') {
      // 특정 학교/학년의 장원 현황 조회
      if (!school_code || !grade) {
        return NextResponse.json(
          { error: '학교코드와 학년이 필요합니다' },
          { status: 400 }
        )
      }

      const juneSummary = await batchChampionChecker.getChampionSummary(
        school_code,
        grade,
        2024,
        6
      )

      const julySummary = await batchChampionChecker.getChampionSummary(
        school_code,
        grade,
        2024,
        7
      )

      return NextResponse.json({
        success: true,
        school_code,
        grade,
        june: juneSummary,
        july: julySummary
      })
    } else {
      return NextResponse.json(
        { error: '지원하지 않는 액션입니다', supported_actions: ['check_all', 'get_summary'] },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('일괄 체크 API 오류:', error)
    return NextResponse.json(
      { 
        error: '일괄 체크 중 오류 발생', 
        details: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const school_code = searchParams.get('school_code')
    const grade = searchParams.get('grade') ? parseInt(searchParams.get('grade')!) : null

    if (!school_code || !grade) {
      return NextResponse.json(
        { error: '학교코드와 학년이 필요합니다' },
        { status: 400 }
      )
    }

    // 장원 현황 조회
    const juneSummary = await batchChampionChecker.getChampionSummary(
      school_code,
      grade,
      2024,
      6
    )

    const julySummary = await batchChampionChecker.getChampionSummary(
      school_code,
      grade,
      2024,
      7
    )

    return NextResponse.json({
      success: true,
      school_code,
      grade,
      june: juneSummary,
      july: julySummary
    })
  } catch (error: any) {
    console.error('장원 현황 조회 오류:', error)
    return NextResponse.json(
      { error: '장원 현황 조회 중 오류 발생', details: error?.message },
      { status: 500 }
    )
  }
}
