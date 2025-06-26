const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase 설정
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  console.error('SUPABASE_URL:', supabaseUrl ? '설정됨' : '없음');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '설정됨' : '없음');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addTestQuiz() {
  console.log('🔍 테스트 퀴즈 추가 시작...');
  
  // 1. 먼저 해당 학교의 급식 메뉴가 있는지 확인
  const { data: mealMenus, error: mealError } = await supabase
    .from('meal_menus')
    .select('*')
    .eq('school_code', '7310375')
    .order('meal_date', { ascending: false })
    .limit(5);
  
  console.log('📋 급식 메뉴 조회 결과:', { count: mealMenus?.length || 0, mealError });
  
  if (mealError || !mealMenus || mealMenus.length === 0) {
    console.log('❌ 급식 메뉴가 없어서 퀴즈를 생성할 수 없습니다.');
    console.log('먼저 급식 메뉴를 추가해야 합니다.');
    return;
  }
  
  // 2. 최근 급식 메뉴를 기반으로 테스트 퀴즈 생성
  const latestMeal = mealMenus[0];
  console.log('🍽️ 사용할 급식 메뉴:', latestMeal);
  
  // 실제 메뉴 아이템에서 퀴즈 생성
  const menuItems = latestMeal.menu_items;
  const mainDish = menuItems[0]; // 첫 번째 메뉴를 메인 요리로 가정
  
  // 다른 메뉴 아이템들을 오답 선택지로 사용
  const wrongOptions = menuItems.slice(1, 4); // 2-4번째 메뉴 사용
  
  // 선택지 배열 생성 (정답 + 오답들)
  const options = [mainDish, ...wrongOptions];
  
  const testQuiz = {
    school_code: '7310375',
    grade: '3',
    meal_date: latestMeal.meal_date,
    meal_id: latestMeal.id,
    question: `${latestMeal.meal_date} 급식 메뉴에 대한 퀴즈입니다. 다음 중 오늘의 메인 요리는 무엇인가요?`,
    options: options,
    correct_answer: 0, // 첫 번째 옵션(메인 요리)이 정답
    explanation: `오늘의 메인 요리는 "${mainDish}"입니다.`,
    created_at: new Date().toISOString()
  };
  
  // 3. 퀴즈 추가
  const { data: insertedQuiz, error: insertError } = await supabase
    .from('meal_quizzes')
    .insert([testQuiz])
    .select()
    .single();
  
  if (insertError) {
    console.error('❌ 퀴즈 추가 실패:', insertError);
    return;
  }
  
  console.log('✅ 테스트 퀴즈 추가 성공!');
  console.log('📝 추가된 퀴즈:', insertedQuiz);
  
  // 4. 추가된 퀴즈 확인
  const { data: allQuizzes, error: checkError } = await supabase
    .from('meal_quizzes')
    .select('*')
    .eq('school_code', '7310375')
    .eq('grade', '3');
  
  console.log('🔢 현재 퀴즈 총 개수:', allQuizzes?.length || 0);
  console.log('📊 퀴즈 목록:', allQuizzes);
}

// 실행
addTestQuiz().catch(console.error);
