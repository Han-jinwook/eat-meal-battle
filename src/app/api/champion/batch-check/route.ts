/**
 * 6, 7월 장원 일괄 체크 API
 * POST /api/champion/batch-check
 */

import { NextRequest, NextResponse } from 'next/server'
import { batchChampionChecker } from '@/utils/batchChampionChecker'
import { weekSaturdayCalculator } from '@/utils/weekSaturdayCalculator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { school_code, grade, action = 'check_all', year, month } = body

    console.log('=== 장원 관리 API 호출 ===')
    console.log('요청 파라미터:', { school_code, grade, action, year, month })

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
    } else if (action === 'update_saturdays') {
      // 주차별 토요일 날짜 업데이트
      if (!year || !month) {
        return NextResponse.json(
          { error: '연도와 월이 필요합니다' },
          { status: 400 }
        )
      }

      console.log(`=== ${year}년 ${month}월 주차별 토요일 계산 시작 ===`)

      const result = await weekSaturdayCalculator.updateAllSchoolsSaturdays(
        year,
        month,
        school_code ? [school_code] : undefined
      )

      return NextResponse.json({
        success: result.success,
        message: `${year}년 ${month}월 주차별 토요일 설정 ${result.success ? '완료' : '실패'}`,
        processed_schools: result.processed,
        failed_schools: result.failed,
        details: result.results
      })
    } else {
      return NextResponse.json(
        { error: '지원하지 않는 액션입니다', supported_actions: ['check_all', 'get_summary', 'update_saturdays'] },
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
    const action = searchParams.get('action')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    console.log('=== GET 장원 API 호출 ===', { school_code, grade, action, year, month })

    // action에 따른 처리
    if (action === 'execute') {
      console.log('🚀 주소창에서 일괄 장원 처리 실행')
      
      const results = await batchChampionChecker.checkAllUsersChampionStatus(
        school_code || undefined,
        grade || undefined
      )
      
      return NextResponse.json({
        success: true,
        message: '🎉 주소창에서 6, 7월 장원 일괄 체크 완료!',
        executed_via: 'GET_URL',
        results: results,
        summary: {
          total_processed: results.june.processed + results.july.processed,
          total_champions: results.june.champions + results.july.champions,
          june_summary: `처리: ${results.june.processed}명, 장원: ${results.june.champions}명`,
          july_summary: `처리: ${results.july.processed}명, 장원: ${results.july.champions}명`
        },
        url_used: request.url
      })
    } else if (action === 'update_saturdays') {
      // 주차별 토요일 계산 및 업데이트
      if (!month) {
        return NextResponse.json({
          error: '월(month) 파라미터가 필요합니다',
          example: '/api/champion/batch-check?action=update_saturdays&month=7&year=2025'
        }, { status: 400 })
      }
      
      console.log(`🗓️ ${year}년 ${month}월 주차별 토요일 계산 실행`)
      
      const result = await weekSaturdayCalculator.updateAllSchoolsSaturdays(
        year,
        month,
        school_code ? [school_code] : undefined
      )
      
      return NextResponse.json({
        success: result.success,
        message: `${year}년 ${month}월 주차별 토요일 설정 ${result.success ? '완료' : '실패'}`,
        processed_schools: result.processed,
        failed_schools: result.failed,
        details: result.results,
        url_used: request.url
      })


    }

    // 기본: 현황 조회만
    if (!school_code || !grade) {
      return NextResponse.json({
        info: '장원 일괄 처리 API',
        usage: {
          '현황 조회': '?school_code=B100000658&grade=1',
          '일괄 실행': '?action=execute (전체)',
          '특정 실행': '?action=execute&school_code=B100000658&grade=1'
        },
        note: 'school_code와 grade 없이 action=execute하면 전체 사용자 처리됩니다'
      })
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
