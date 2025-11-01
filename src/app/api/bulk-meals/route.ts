import { NextRequest, NextResponse } from 'next/server';

/**
 * 학교 등록 시 전월 1일부터 오늘까지 급식정보 일괄 생성
 * 기존 /api/meals 로직을 재사용하여 안전하게 처리
 */
export async function POST(request: NextRequest) {
  try {
    const { school_code, office_code } = await request.json();
    
    if (!school_code || !office_code) {
      return NextResponse.json(
        { error: '학교 코드와 교육청 코드가 필요합니다' },
        { status: 400 }
      );
    }

    console.log(`🚀 벌크 급식정보 생성 시작: ${school_code}`);

    // 날짜 범위 계산 (전월 1일 ~ 오늘)
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    const dates = [];
    const current = new Date(lastMonth);
    
    while (current <= today) {
      // 주말 제외
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    console.log(`📅 처리 대상 날짜: ${dates.length}개 (${dates[0]} ~ ${dates[dates.length-1]})`);

    let successCount = 0;
    let errorCount = 0;

    // 각 날짜별로 기존 /api/meals API 호출
    for (const date of dates) {
      try {
        // 기존 meals API를 내부적으로 호출
        const mealResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meals?school_code=${school_code}&office_code=${office_code}&date=${date}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (mealResponse.ok) {
          successCount++;
          console.log(`✅ ${date} 급식정보 처리 완료`);
        } else {
          errorCount++;
          console.warn(`⚠️ ${date} 급식정보 처리 실패`);
        }

        // API 호출 제한을 위한 지연 (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (dateError) {
        errorCount++;
        console.error(`❌ ${date} 급식정보 처리 오류:`, dateError);
      }
    }

    console.log(`🎉 벌크 급식정보 생성 완료: 성공 ${successCount}개, 실패 ${errorCount}개`);

    return NextResponse.json({
      success: true,
      message: '벌크 급식정보 생성이 완료되었습니다',
      results: {
        total: dates.length,
        success: successCount,
        error: errorCount,
        dateRange: `${dates[0]} ~ ${dates[dates.length-1]}`
      }
    });

  } catch (error) {
    console.error('벌크 급식정보 생성 오류:', error);
    return NextResponse.json(
      { 
        error: '벌크 급식정보 생성 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
