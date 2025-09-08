// 메뉴 아이템 별점 API
const { createClient } = require('@supabase/supabase-js');
const { calculateDailyMenuBattle, calculateMonthlyMenuBattle, calculateDailyMealBattle, calculateMonthlyMealBattle } = require('./utils/battleCalculator');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Supabase Admin 클라이언트 초기화 (RLS 우회용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 평균 별점 업데이트 함수
async function updateAverageRating(menu_item_id) {
  try {
    // 해당 메뉴 아이템의 모든 별점 조회
    const { data: ratings, error } = await supabaseAdmin
      .from('menu_item_ratings')
      .select('rating')
      .eq('menu_item_id', menu_item_id);
      
    if (error || !ratings || ratings.length === 0) {
      console.error('별점 조회 오류 또는 데이터 없음:', error);
      return;
    }
    
    // 평균 계산
    const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
    const avg = sum / ratings.length;
    
    console.log(`메뉴 아이템 ${menu_item_id}의 평균 평점 업데이트: ${avg.toFixed(1)} (${ratings.length}명)`);
    
    // menu_item_rating_stats 테이블에 평점 통계 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('menu_item_rating_stats')
      .upsert({
        menu_item_id: menu_item_id,
        avg_rating: avg,
        rating_count: ratings.length,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'menu_item_id'
      });
      
    if (updateError) {
      console.error('평균 평점 업데이트 오류:', updateError);
    }
  } catch (err) {
    console.error('평균 평점 업데이트 중 오류 발생:', err);
  }
}

// Netlify 함수 핸들러
exports.handler = async function(event, context) {
  try {
    // HTTP 메소드 확인
    if (event.httpMethod === 'POST') {
      // 사용자 인증 확인
      const token = event.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: '인증이 필요합니다' })
        };
      }
      
      // 토큰으로 사용자 정보 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: '유효하지 않은 인증 정보입니다' })
        };
      }
      
      // 요청 데이터 파싱
      const { menu_item_id, rating } = JSON.parse(event.body);
      
      // 필수 파라미터 확인
      if (!menu_item_id || !rating || rating < 1 || rating > 5) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: '올바른 메뉴 아이템 ID와 별점(1-5)이 필요합니다' })
        };
      }
      
      // 별점 저장 또는 업데이트
      const { data, error } = await supabaseAdmin
        .from('menu_item_ratings')
        .upsert({
          user_id: user.id,
          menu_item_id,
          rating,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,menu_item_id',
          returning: 'minimal'
        });
        
      if (error) {
        console.error('별점 저장 오류:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: '별점 저장 중 오류가 발생했습니다' })
        };
      }
      
      // 평균 별점 업데이트
      await updateAverageRating(menu_item_id);
      
      // 🔥 배틀 계산 트리거 - 별점 저장 후 통계 업데이트 및 배틀 계산 실행
      try {
        console.log('🏆 배틀 계산 트리거 시작...');
        console.log('🔍 배틀 계산 함수 import 상태:', typeof calculateDailyMenuBattle, typeof calculateMonthlyMenuBattle);
        
        // 해당 메뉴 아이템의 날짜 정보 조회
        const { data: menuData, error: menuError } = await supabaseAdmin
          .from('meal_menu_items')
          .select(`
            meal_menus!meal_menu_items_meal_id_fkey!inner(
              meal_date,
              school_code
            )
          `)
          .eq('id', menu_item_id)
          .single();
          
        console.log('📊 메뉴 데이터 조회 결과:', { menuError, menuData });
          
        if (!menuError && menuData) {
          const mealDate = menuData.meal_menus.meal_date;
          const schoolCode = menuData.meal_menus.school_code;
          
          console.log(`📅 배틀 계산 대상: 날짜=${mealDate}, 학교=${schoolCode}`);
          
          // Admin 권한의 Supabase 클라이언트 생성
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            }
          );
          
          console.log('🔧 Admin 클라이언트 생성 완료');
          
          // 일별 메뉴 배틀 계산 (Admin 클라이언트 전달) - 모든 학교 데이터 처리
          console.log('🔄 일별 메뉴 배틀 계산 호출 시작...');
          console.log(`📅 배틀 계산 대상 날짜: ${mealDate}`);
          const dailyMenuResult = await calculateDailyMenuBattle(mealDate, null, adminClient);
          console.log(`✅ 일별 메뉴 배틀 계산 완료: ${mealDate}`, dailyMenuResult?.success ? '성공' : '실패');
          if (!dailyMenuResult?.success) {
            console.error('❌ 일별 메뉴 배틀 계산 실패:', dailyMenuResult?.error);
          }
          
          // 일별 급식 배틀 계산 (Admin 클라이언트 전달) - 모든 학교 데이터 처리
          console.log('🔄 일별 급식 배틀 계산 호출 시작...');
          const dailyMealResult = await calculateDailyMealBattle(mealDate, null, adminClient);
          console.log(`✅ 일별 급식 배틀 계산 완료: ${mealDate}`, dailyMealResult?.success ? '성공' : '실패');
          if (!dailyMealResult?.success) {
            console.error('❌ 일별 급식 배틀 계산 실패:', dailyMealResult?.error);
          }
          
          // 월별 메뉴 배틀 계산 (Admin 클라이언트 전달) - 모든 학교 데이터 처리
          console.log('🔄 월별 메뉴 배틀 계산 호출 시작...');
          const date = new Date(mealDate);
          const monthlyMenuResult = await calculateMonthlyMenuBattle(date.getFullYear(), date.getMonth() + 1, null, adminClient);
          console.log(`✅ 월별 메뉴 배틀 계산 완료: ${date.getFullYear()}-${date.getMonth() + 1}`, monthlyMenuResult?.success ? '성공' : '실패');
          
          // 월별 급식 배틀 계산 (Admin 클라이언트 전달) - 모든 학교 데이터 처리
          console.log('🔄 월별 급식 배틀 계산 호출 시작...');
          const monthlyMealResult = await calculateMonthlyMealBattle(date.getFullYear(), date.getMonth() + 1, null, adminClient);
          console.log(`✅ 월별 급식 배틀 계산 완료: ${date.getFullYear()}-${date.getMonth() + 1}`, monthlyMealResult?.success ? '성공' : '실패');
        } else {
          console.log('❌ 메뉴 데이터 조회 실패 또는 데이터 없음');
        }
      } catch (battleError) {
        console.error('❌ 배틀 계산 중 오류 (별점 저장은 성공):', battleError);
        console.error('🔍 오류 스택:', battleError.stack);
        // 배틀 계산 실패해도 별점 저장은 성공으로 처리
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: '별점이 성공적으로 저장되었습니다'
        })
      };
    }
    
    // DELETE 요청 처리 (별점 삭제)
    else if (event.httpMethod === 'DELETE') {
      // 사용자 인증 확인
      const token = event.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: '인증이 필요합니다' })
        };
      }
      
      // 토큰으로 사용자 정보 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: '유효하지 않은 인증 정보입니다' })
        };
      }
      
      // 요청 데이터 파싱
      const { menu_item_id } = JSON.parse(event.body);
      
      // 필수 파라미터 확인
      if (!menu_item_id) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: '메뉴 아이템 ID가 필요합니다' })
        };
      }
      
      // 배틀 계산을 위해 먼저 메뉴 정보 조회
      const { data: menuData, error: menuError } = await supabaseAdmin
        .from('meal_menu_items')
        .select(`
          meal_menus!inner(
            meal_date,
            school_code
          )
        `)
        .eq('id', menu_item_id)
        .single();
      
      // 별점 삭제
      const { error } = await supabaseAdmin
        .from('menu_item_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('menu_item_id', menu_item_id);
        
      if (error) {
        console.error('별점 삭제 오류:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: '별점 삭제 중 오류가 발생했습니다' })
        };
      }
      
      // 평균 별점 업데이트
      await updateAverageRating(menu_item_id);
      
      // 🔥 배틀 계산 트리거 - 별점 삭제 후 통계 업데이트 및 배틀 계산 실행
      try {
        console.log('🏆 배틀 계산 트리거 시작 (삭제)...');
        
        if (!menuError && menuData) {
          const mealDate = menuData.meal_menus.meal_date;
          const schoolCode = menuData.meal_menus.school_code;
          
          // Admin 권한의 Supabase 클라이언트 생성
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            }
          );
          
          // 일별 배틀 계산 - 모든 학교 데이터 처리
          await calculateDailyMenuBattle(mealDate, null, adminClient);
          console.log(`✅ 일별 배틀 계산 완료 (삭제): ${mealDate}`);
          
          // 월별 배틀 계산 - 모든 학교 데이터 처리
          const date = new Date(mealDate);
          await calculateMonthlyMenuBattle(date.getFullYear(), date.getMonth() + 1, null, adminClient);
          console.log(`✅ 월별 배틀 계산 완료 (삭제): ${date.getFullYear()}-${date.getMonth() + 1}`);
        }
      } catch (battleError) {
        console.error('⚠️ 배틀 계산 중 오류 (별점 삭제는 성공):', battleError);
        // 배틀 계산 실패해도 별점 삭제는 성공으로 처리
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: '별점이 성공적으로 삭제되었습니다'
        })
      };
    }
    
    // GET 요청 처리 (특정 사용자의 특정 메뉴 아이템에 대한 별점 조회)
    else if (event.httpMethod === 'GET') {
      const { menu_item_id } = event.queryStringParameters || {};
      const token = event.headers.authorization?.replace('Bearer ', '');
      
      // 메뉴 아이템 ID 확인
      if (!menu_item_id) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: '메뉴 아이템 ID가 필요합니다' })
        };
      }
      
      // 인증된 요청인 경우 사용자의 별점도 함께 반환
      if (token) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          // 사용자의 별점 조회
          const { data: userRating, error: ratingError } = await supabase
            .from('menu_item_ratings')
            .select('rating')
            .eq('user_id', user.id)
            .eq('menu_item_id', menu_item_id)
            .single();
            
          // 메뉴 아이템 정보 조회
          const { data: menuItem, error: menuError } = await supabase
            .from('meal_menu_items')
            .select('id, item_name, avg_rating, rating_count')
            .eq('id', menu_item_id)
            .single();
            
          if (menuError) {
            return {
              statusCode: 404,
              body: JSON.stringify({ error: '메뉴 아이템을 찾을 수 없습니다' })
            };
          }
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              ...menuItem,
              user_rating: userRating?.rating || 0
            })
          };
        }
      }
      
      // 비인증 요청 또는 인증 실패 시 메뉴 아이템 정보만 반환
      const { data: menuItem, error: menuError } = await supabase
        .from('meal_menu_items')
        .select('id, item_name, avg_rating, rating_count')
        .eq('id', menu_item_id)
        .single();
        
      if (menuError) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: '메뉴 아이템을 찾을 수 없습니다' })
        };
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify(menuItem)
      };
    }
    
    // 지원하지 않는 HTTP 메소드
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '지원하지 않는 메소드입니다' })
    };
    
  } catch (error) {
    console.error('별점 API 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '서버 오류가 발생했습니다',
        message: error.message
      })
    };
  }
};
