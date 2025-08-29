import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    // 기본 쿼리
    let query = supabaseAdmin
      .from('meal_image_reports')
      .select('*')
      .order('created_at', { ascending: false });

    // 상태 필터 적용
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('신고 데이터 조회 오류:', error);
      return NextResponse.json(
        { error: '신고 데이터를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 각 신고에 대해 학교명과 메뉴명 정보 추가
    const enrichedReports = await Promise.all(
      (reports || []).map(async (report) => {
        try {
          // 학교명 조회
          const { data: schoolInfo, error: schoolError } = await supabaseAdmin
            .from('school_infos')
            .select('school_name')
            .eq('school_code', report.school_code)
            .limit(1)
            .maybeSingle();

          if (schoolError) {
            console.error('학교명 조회 오류:', schoolError);
          }

          // 메뉴명 조회 - meal_menus 테이블에서 조회
          console.log('메뉴 조회 조건:', {
            school_code: report.school_code,
            meal_date: report.meal_date,
            meal_type: report.meal_type
          });

          const { data: mealInfo, error: mealError } = await supabaseAdmin
            .from('meal_menus')
            .select('menu_items')
            .eq('school_code', report.school_code)
            .eq('meal_date', report.meal_date)
            .eq('meal_type', report.meal_type)
            .limit(1)
            .maybeSingle();

          if (mealError) {
            console.error('메뉴 조회 오류:', mealError);
          }

          console.log('조회된 학교 정보:', schoolInfo);
          console.log('조회된 메뉴 정보:', mealInfo);

          // 메뉴 항목들을 구분자로 분리하여 가독성 개선
          let formattedMenuItems = '메뉴 조회 실패';
          if (mealInfo?.menu_items) {
            try {
              // 기존 메뉴 문자열을 적절한 구분자로 분리
              formattedMenuItems = mealInfo.menu_items
                .replace(/\s+/g, ' ') // 여러 공백을 하나로
                .split(/(?=[가-힣]+[^\s가-힣]*(?:\([^)]*\))?(?:\s|$))/) // 한글로 시작하는 메뉴 항목 기준으로 분리
                .filter(item => item.trim().length > 0)
                .map(item => item.trim())
                .join(' / '); // 슬래시 구분자로 연결
            } catch (formatError) {
              console.error('메뉴 포맷팅 오류:', formatError);
              formattedMenuItems = mealInfo.menu_items; // 원본 그대로 사용
            }
          }

          const result = {
            ...report,
            school_name: schoolInfo?.school_name || '학교명 조회 실패',
            menu_items: formattedMenuItems
          };

          console.log('최종 결과:', {
            school_code: report.school_code,
            school_name: result.school_name,
            menu_items: result.menu_items
          });

          return result;
        } catch (err) {
          console.error('추가 정보 조회 오류:', err);
          return {
            ...report,
            school_name: '알 수 없음',
            menu_items: '메뉴 정보 없음'
          };
        }
      })
    );

    return NextResponse.json({ reports: enrichedReports });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
