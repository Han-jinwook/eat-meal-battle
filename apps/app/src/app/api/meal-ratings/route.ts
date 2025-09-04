import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase Admin 클라이언트 생성 함수
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {}
      }
    }
  );
}

// 일반 Supabase 클라이언트 생성 함수
function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        }
      }
    }
  );
}

// 급식 평균 평점 업데이트 함수
async function updateMealAverageRating(mealId: string) {
  const supabaseAdmin = createAdminClient();
  
  try {
    // 해당 급식의 모든 평점 조회
    const { data: ratings, error } = await supabaseAdmin
      .from('meal_ratings')
      .select('rating')
      .eq('meal_id', mealId);
      
    if (error || !ratings || ratings.length === 0) {
      console.error('급식 평점 조회 오류 또는 데이터 없음:', error);
      return;
    }
    
    // 평균 계산
    const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
    const avg = sum / ratings.length;
    
    console.log(`급식 ${mealId}의 평균 평점 업데이트: ${avg.toFixed(1)} (${ratings.length}명)`);
    
    // meal_rating_stats 테이블에 평점 통계 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('meal_rating_stats')
      .upsert({
        meal_id: mealId,
        avg_rating: avg,
        rating_count: ratings.length,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'meal_id'
      });
      
    if (updateError) {
      console.error('급식 평균 평점 업데이트 오류:', updateError);
    }
  } catch (err) {
    console.error('급식 평균 평점 업데이트 중 오류 발생:', err);
  }
}

// 급식배틀 계산 함수들 import
const { calculateDailyMealBattle, calculateMonthlyMealBattle } = require('../../../../netlify/functions/utils/battleCalculator');

/**
 * 급식 평점 저장 API (POST)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const supabaseAdmin = createAdminClient();
  
  try {
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }
    
    // 요청 데이터 파싱
    const { meal_id, rating } = await request.json();
    
    // 필수 파라미터 확인
    if (!meal_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: '올바른 급식 ID와 평점(1-5)이 필요합니다' },
        { status: 400 }
      );
    }
    
    // 평점 저장 또는 업데이트
    const { error } = await supabaseAdmin
      .from('meal_ratings')
      .upsert({
        user_id: user.id,
        meal_id,
        rating,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,meal_id'
      });
      
    if (error) {
      console.error('급식 평점 저장 오류:', error);
      return NextResponse.json(
        { error: '평점 저장 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }
    
    // 평균 평점 업데이트
    await updateMealAverageRating(meal_id);
    
    // 🔥 급식배틀 계산 트리거
    try {
      console.log('🏆 급식배틀 계산 트리거 시작...');
      
      // 해당 급식의 날짜 정보 조회
      const { data: mealData, error: mealError } = await supabaseAdmin
        .from('meal_menus')
        .select('meal_date, school_code')
        .eq('id', meal_id)
        .single();
        
      console.log('📊 급식 데이터 조회 결과:', { mealError, mealData });
        
      if (!mealError && mealData) {
        const mealDate = mealData.meal_date;
        const schoolCode = mealData.school_code;
        
        console.log(`📅 급식배틀 계산 대상: 날짜=${mealDate}, 학교=${schoolCode}`);
        
        // 일별 급식배틀 계산
        console.log('🔄 일별 급식배틀 계산 호출 시작...');
        await calculateDailyMealBattle(mealDate, schoolCode, supabaseAdmin);
        console.log(`✅ 일별 급식배틀 계산 완료: ${mealDate}`);
        
        // 월별 급식배틀 계산
        console.log('🔄 월별 급식배틀 계산 호출 시작...');
        const date = new Date(mealDate);
        await calculateMonthlyMealBattle(date.getFullYear(), date.getMonth() + 1, schoolCode, supabaseAdmin);
        console.log(`✅ 월별 급식배틀 계산 완료: ${date.getFullYear()}-${date.getMonth() + 1}`);
      } else {
        console.log('❌ 급식 데이터 조회 실패 또는 데이터 없음');
      }
    } catch (battleError) {
      console.error('❌ 급식배틀 계산 중 오류 (평점 저장은 성공):', battleError);
      console.error('🔍 오류 스택:', battleError.stack);
      // 배틀 계산 실패해도 평점 저장은 성공으로 처리
    }
    
    return NextResponse.json({ 
      success: true,
      message: '급식 평점이 성공적으로 저장되었습니다'
    });
    
  } catch (error) {
    console.error('급식 평점 API 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * 급식 평점 삭제 API (DELETE)
 */
export async function DELETE(request: Request) {
  const supabase = createClient();
  const supabaseAdmin = createAdminClient();
  
  try {
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }
    
    // 요청 데이터 파싱
    const { meal_id } = await request.json();
    
    // 필수 파라미터 확인
    if (!meal_id) {
      return NextResponse.json(
        { error: '급식 ID가 필요합니다' },
        { status: 400 }
      );
    }
    
    // 배틀 계산을 위해 먼저 급식 정보 조회
    const { data: mealData, error: mealError } = await supabaseAdmin
      .from('meal_menus')
      .select('meal_date, school_code')
      .eq('id', meal_id)
      .single();
    
    // 평점 삭제
    const { error } = await supabaseAdmin
      .from('meal_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('meal_id', meal_id);
      
    if (error) {
      console.error('급식 평점 삭제 오류:', error);
      return NextResponse.json(
        { error: '평점 삭제 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }
    
    // 평균 평점 업데이트
    await updateMealAverageRating(meal_id);
    
    // 🔥 급식배틀 계산 트리거
    try {
      console.log('🏆 급식배틀 계산 트리거 시작 (삭제)...');
      
      if (!mealError && mealData) {
        const mealDate = mealData.meal_date;
        const schoolCode = mealData.school_code;
        
        // 일별 급식배틀 계산
        await calculateDailyMealBattle(mealDate, schoolCode, supabaseAdmin);
        console.log(`✅ 일별 급식배틀 계산 완료 (삭제): ${mealDate}`);
        
        // 월별 급식배틀 계산
        const date = new Date(mealDate);
        await calculateMonthlyMealBattle(date.getFullYear(), date.getMonth() + 1, schoolCode, supabaseAdmin);
        console.log(`✅ 월별 급식배틀 계산 완료 (삭제): ${date.getFullYear()}-${date.getMonth() + 1}`);
      }
    } catch (battleError) {
      console.error('⚠️ 급식배틀 계산 중 오류 (평점 삭제는 성공):', battleError);
      // 배틀 계산 실패해도 평점 삭제는 성공으로 처리
    }
    
    return NextResponse.json({ 
      success: true,
      message: '급식 평점이 성공적으로 삭제되었습니다'
    });
    
  } catch (error) {
    console.error('급식 평점 삭제 API 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * 급식 평점 조회 API (GET)
 */
export async function GET(request: Request) {
  const supabase = createClient();
  
  const { searchParams } = new URL(request.url);
  const meal_id = searchParams.get('meal_id');
  
  // 급식 ID 확인
  if (!meal_id) {
    return NextResponse.json(
      { error: '급식 ID가 필요합니다' },
      { status: 400 }
    );
  }
  
  try {
    // 사용자 인증 확인 (선택적)
    const { data: { user } } = await supabase.auth.getUser();
    
    // 급식 정보 조회
    const { data: meal, error: mealError } = await supabase
      .from('meal_menus')
      .select('id, meal_date, school_code')
      .eq('id', meal_id)
      .single();
      
    if (mealError) {
      return NextResponse.json(
        { error: '급식을 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    
    // 급식 평점 통계 조회
    const { data: stats } = await supabase
      .from('meal_rating_stats')
      .select('avg_rating, rating_count')
      .eq('meal_id', meal_id)
      .single();
    
    let userRating = 0;
    if (user) {
      // 사용자의 평점 조회
      const { data: rating } = await supabase
        .from('meal_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('meal_id', meal_id)
        .single();
        
      userRating = rating?.rating || 0;
    }
    
    return NextResponse.json({
      ...meal,
      avg_rating: stats?.avg_rating || 0,
      rating_count: stats?.rating_count || 0,
      user_rating: userRating
    });
    
  } catch (error) {
    console.error('급식 평점 조회 API 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다',
        message: error.message
      },
      { status: 500 }
    );
  }
}
