const { createClient } = require('@supabase/supabase-js');
const { generateRealisticRating, generateRealisticComment } = require('./utils/mealRatingLogic');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 오늘 날짜 (한국 시간)
function getTodayKST() {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime.toISOString().split('T')[0];
}

// AI 이미지 생성 함수 (기존 함수와 동일한 설정)
async function generateMealImage(menuItems, schoolName) {
  try {
    console.log(`[lunch-activity] AI 이미지 생성 시작: ${schoolName} - ${menuItems.join(', ')}`);
    
    // OpenAI 클라이언트 초기화 (기존 함수와 동일)
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    
    // 메뉴 분류 (기존 로직과 동일)
    let riceMenu = null;
    let soupMenu = null;
    const sideMenus = [];
    
    menuItems.forEach(item => {
      if (item.includes('밥') || item.includes('쌀') || item.includes('현미') || item.includes('잡곡')) {
        riceMenu = item;
      } else if (item.includes('국') || item.includes('찌개') || item.includes('탕') || item.includes('스프')) {
        soupMenu = item;
      } else {
        sideMenus.push(item);
      }
    });
    
    const structuredMenuString = `
    주식(밥): ${riceMenu || '밥'}
    국물: ${soupMenu || '국'}
    반찬: ${sideMenus.join(', ')}`;
    
    console.log(`[lunch-activity] 구조화된 메뉴 정보: ${structuredMenuString}`);
    
    // 기존 함수와 동일한 프롬프트 및 설정
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `한국 학교 급식 스테인리스 식판 - 정확히 6개 칸만 있는 구조${structuredMenuString}

      절대 규칙 (무조건 지켜야 함):
      1. 정확히 6칸만 존재 (5칸 아님, 7칸 아님, 오직 6칸)
      2. 하단 2칸: 왼쪽(사각형/밥), 오른쪽(원형/국)
      3. 상단 4칸: 작은 사각형들 (반찬용)
      4. 식판 전체가 프레임 안에 완전히 들어와야 함 (테두리 잘림 금지)
      5. 위에서 내려다보는 탑다운 뷰

      메뉴 배치:
      - 하단왼쪽(밥): ${riceMenu || (menuItems[0] || '밥')}
      - 하단오른쪽(국): ${soupMenu || (menuItems[1] || '국')}  
      - 상단 4칸(반찬): ${sideMenus.length > 0 ? sideMenus.slice(0, 4).join(', ') : '김치, 나물, 단무지, 미역국'}

      스타일: 실제 한국 학교 급식실 느낌, 자연광, 포토리얼리스틱`,
      n: 1,
      size: "1024x1024",
      quality: "medium"
    });
    
    const imageUrl = imageResponse.data[0].url;
    console.log(`[lunch-activity] AI 이미지 생성 성공: ${imageUrl}`);
    return imageUrl;
    
  } catch (error) {
    console.error('[lunch-activity] AI 이미지 생성 실패:', error);
    // 실패 시 기본 이미지 URL 반환
    return `https://via.placeholder.com/400x300/4CAF50/white?text=${encodeURIComponent('급식 이미지')}`;
  }
}

// 시뮬레이션 계정 조회
async function getSimulationAccounts() {
  const { data: accounts, error } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      nickname,
      email,
      school_infos (
        school_code,
        school_name,
        grade,
        class_number
      )
    `)
    .like('email', '%@simulation.test')
    .not('school_infos', 'is', null);

  if (error) {
    console.error('[lunch-activity] 시뮬레이션 계정 조회 오류:', error);
    throw new Error('시뮬레이션 계정을 조회할 수 없습니다.');
  }

  return accounts.filter(account => account.school_infos);
}

// 오늘 급식 메뉴 조회
async function getTodayMealMenu(schoolCode) {
  const today = getTodayKST();
  
  const { data: mealData, error } = await supabaseAdmin
    .from('meal_menus')
    .select('id, menu_items, meal_date')
    .eq('school_code', schoolCode)
    .eq('meal_date', today)
    .limit(1);

  if (error || !mealData || mealData.length === 0) {
    console.log(`[lunch-activity] ${schoolCode} 오늘 급식 메뉴 없음`);
    return null;
  }

  return mealData[0];
}

// 삭제 - 단순하게 오늘 급식만 사용

// 급식 이미지 업로드 시뮬레이션
async function simulateMealImageUpload(uploader, mealMenu) {
  try {
    console.log(`[lunch-activity] 급식 이미지 업로드 시뮬레이션: ${uploader.nickname}`);
    
    // AI 이미지 생성
    const imageUrl = await generateMealImage(mealMenu.menu_items, uploader.school_infos.school_name);
    
    // meal_images 테이블에 저장
    const { data: imageRecord, error: imageError } = await supabaseAdmin
      .from('meal_images')
      .insert({
        uploaded_by: uploader.id,
        meal_id: mealMenu.id,
        image_url: imageUrl,
        source: 'user_ai',
        status: 'approved',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (imageError) {
      console.error('[lunch-activity] 이미지 레코드 저장 실패:', imageError);
      return null;
    }

    console.log(`[lunch-activity] 급식 이미지 업로드 완료: ${uploader.nickname}`);
    return imageRecord;

  } catch (error) {
    console.error('[lunch-activity] 급식 이미지 업로드 시뮬레이션 오류:', error);
    return null;
  }
}

// 별점 및 댓글 작성 시뮬레이션
async function simulateRatingAndComment(user, mealMenu, imageRecord) {
  try {
    console.log(`[lunch-activity] 별점/댓글 작성: ${user.nickname}`);
    
    // 리얼한 별점 생성
    const rating = generateRealisticRating(
      mealMenu.menu_items, 
      user.nickname, 
      user.school_infos.grade
    );
    
    // 리얼한 댓글 생성
    const comment = generateRealisticComment(
      rating,
      mealMenu.menu_items,
      user.nickname,
      user.school_infos.grade
    );

    // meal_ratings 테이블에 저장
    const { error: ratingError } = await supabaseAdmin
      .from('meal_ratings')
      .insert({
        user_id: user.id,
        meal_id: mealMenu.id,
        rating: rating,
        created_at: new Date().toISOString()
      });

    if (ratingError) {
      console.error('[lunch-activity] 별점 저장 실패:', ratingError);
    }

    // comments 테이블에 저장 (이미지가 있는 경우)
    if (imageRecord) {
      const { error: commentError } = await supabaseAdmin
        .from('comments')
        .insert({
          user_id: user.id,
          meal_id: mealMenu.id,
          content: comment,
          created_at: new Date().toISOString()
        });

      if (commentError) {
        console.error('[lunch-activity] 댓글 저장 실패:', commentError);
      }
    }

    console.log(`[lunch-activity] ${user.nickname}: ${rating}점 "${comment}"`);
    return { rating, comment };

  } catch (error) {
    console.error('[lunch-activity] 별점/댓글 작성 오류:', error);
    return null;
  }
}

// 퀴즈 생성 시뮬레이션 (기존 프롬프트와 동일한 AI 생성)
async function simulateQuizGeneration(uploader, mealMenu) {
  try {
    console.log(`[lunch-activity] 퀴즈 생성: ${uploader.nickname}`);
    
    // 기존 함수와 동일한 AI 퀴즈 생성
    const { generateQuizWithAI } = require('./manual-generate-meal-quiz');
    
    // 학교 정보 조회
    const { data: schoolData } = await supabaseAdmin
      .from('schools')
      .select('school_type')
      .eq('school_code', uploader.school_infos.school_code)
      .single();
    
    const schoolType = schoolData?.school_type || '고등학교';
    
    // 급식 메뉴 객체 구성
    const meal = {
      id: mealMenu.id,
      menu_items: mealMenu.menu_items,
      meal_date: mealMenu.meal_date || getTodayKST(),
      school_code: uploader.school_infos.school_code
    };
    
    // AI로 퀴즈 생성 (기존 함수와 동일)
    const generatedQuiz = await generateQuizWithAI(meal, uploader.school_infos.grade, uploader.id);
    
    if (!generatedQuiz) {
      throw new Error('AI 퀴즈 생성 실패');
    }
    
    const selectedQuiz = {
      question: generatedQuiz.question,
      options: generatedQuiz.options,
      correct_answer: generatedQuiz.correct_answer - 1, // 0-based index로 변환
      explanation: generatedQuiz.explanation
    };
    
    // meal_quizzes 테이블에 저장
    const { data: quizRecord, error: quizError } = await supabaseAdmin
      .from('meal_quizzes')
      .insert({
        school_code: uploader.school_infos.school_code,
        grade: uploader.school_infos.grade,
        meal_id: mealMenu.id,
        meal_date: getTodayKST(),
        question: selectedQuiz.question,
        options: selectedQuiz.options,
        correct_answer: selectedQuiz.correct_answer,
        explanation: selectedQuiz.explanation,
        created_by: uploader.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (quizError) {
      console.error('[lunch-activity] 퀴즈 저장 실패:', quizError);
      return null;
    }

    // 퀴즈 생성자가 자동으로 정답 처리
    const { error: resultError } = await supabaseAdmin
      .from('quiz_results')
      .insert({
        user_id: uploader.id,
        quiz_id: quizRecord.id,
        selected_option: selectedQuiz.correct_answer,
        is_correct: true,
        created_at: new Date().toISOString()
      });

    if (resultError) {
      console.error('[lunch-activity] 퀴즈 결과 저장 실패:', resultError);
    }

    console.log(`[lunch-activity] 퀴즈 생성 완료: ${uploader.nickname}`);
    return quizRecord;

  } catch (error) {
    console.error('[lunch-activity] 퀴즈 생성 오류:', error);
    return null;
  }
}

// 학교급별 활동 가능 시간 체크 (단순 버전)
function canStudentParticipate(grade, currentTime = new Date()) {
  const koreaTime = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000));
  const dayOfWeek = koreaTime.getDay(); // 0=일요일, 6=토요일
  const hour = koreaTime.getHours();
  
  // 주말은 모든 학생이 참여 가능
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true;
  }
  
  // 평일 시간 제약
  if (grade <= 6) {
    // 초등학생: 방과후(15:30) 이후만 가능
    return hour >= 15 && (hour > 15 || koreaTime.getMinutes() >= 30);
  } else if (grade <= 9) {
    // 중학생: 방과후(16:00) 이후만 가능
    return hour >= 16;
  } else {
    // 고등학생: 점심시간(12:00-13:00) 또는 방과후(17:00) 이후 가능
    return (hour >= 12 && hour < 13) || hour >= 17;
  }
}

// 점심시간 활동 시뮬레이션 메인 함수
async function simulateLunchActivity() {
  console.log('[lunch-activity] 점심시간 활동 시뮬레이션 시작');
  
  const currentTime = new Date();
  const koreaTime = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000));
  const dayOfWeek = koreaTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  console.log(`[lunch-activity] 현재 시간: ${koreaTime.toLocaleString('ko-KR')}, 주말: ${isWeekend}`);
  
  try {
    // 1. 시뮬레이션 계정들 조회
    const accounts = await getSimulationAccounts();
    if (accounts.length === 0) {
      throw new Error('시뮬레이션 계정이 없습니다. 먼저 가계정을 생성해주세요.');
    }

    console.log(`[lunch-activity] 시뮬레이션 계정 ${accounts.length}개 발견`);

    // 2. 학교별로 그룹화
    const schoolGroups = {};
    accounts.forEach(account => {
      const schoolCode = account.school_infos.school_code;
      if (!schoolGroups[schoolCode]) {
        schoolGroups[schoolCode] = [];
      }
      schoolGroups[schoolCode].push(account);
    });

    const results = {
      processed_schools: 0,
      uploaded_images: 0,
      created_ratings: 0,
      created_comments: 0,
      created_quizzes: 0,
      activities: []
    };

    // 3. 각 학교별로 점심시간 활동 시뮬레이션
    for (const [schoolCode, schoolAccounts] of Object.entries(schoolGroups)) {
      console.log(`[lunch-activity] ${schoolCode} 학교 처리 시작 (${schoolAccounts.length}명)`);
      
      // 오늘 급식 메뉴 확인
      const mealMenu = await getTodayMealMenu(schoolCode);
      
      if (!mealMenu) {
        console.log(`[lunch-activity] ${schoolCode} 급식 메뉴 없음, 건너뜀`);
        continue;
      }

      // 시간 제약에 따른 참여 가능한 학생 필터링
      const eligibleAccounts = schoolAccounts.filter(account => 
        canStudentParticipate(account.school_infos.grade, currentTime)
      );
      
      if (eligibleAccounts.length === 0) {
        console.log(`[lunch-activity] ${schoolCode} 현재 시간에 참여 가능한 학생 없음`);
        continue;
      }
      
      console.log(`[lunch-activity] ${schoolCode} 참여 가능 학생: ${eligibleAccounts.length}/${schoolAccounts.length}명`);

      // 참여 가능한 학생 중에서 대표 학생 1명 선택 (이미지 업로드 담당)
      const uploader = eligibleAccounts[Math.floor(Math.random() * eligibleAccounts.length)];
      
      // 급식 이미지 업로드
      const imageRecord = await simulateMealImageUpload(uploader, mealMenu);
      if (imageRecord) {
        results.uploaded_images++;
      }

      // 퀴즈 생성 (업로더가 담당)
      const quizRecord = await simulateQuizGeneration(uploader, mealMenu);
      if (quizRecord) {
        results.created_quizzes++;
      }

      // 참여 가능한 학생들만 별점 및 댓글 작성
      for (const account of eligibleAccounts) {
        const ratingResult = await simulateRatingAndComment(account, mealMenu, imageRecord);
        if (ratingResult) {
          results.created_ratings++;
          if (imageRecord) {
            results.created_comments++;
          }
        }
      }

      results.processed_schools++;
      results.activities.push({
        school_code: schoolCode,
        school_name: schoolAccounts[0].school_infos.school_name,
        uploader: uploader.nickname,
        participants: schoolAccounts.length,
        menu_items: mealMenu.menu_items
      });

      console.log(`[lunch-activity] ${schoolCode} 학교 처리 완료`);
    }

    console.log('[lunch-activity] 점심시간 활동 시뮬레이션 완료');
    return {
      success: true,
      message: `점심시간 활동 시뮬레이션이 완료되었습니다.`,
      results: results
    };

  } catch (error) {
    console.error('[lunch-activity] 점심시간 활동 시뮬레이션 오류:', error);
    throw error;
  }
}

// Netlify 함수 핸들러
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    console.log('[lunch-activity] Netlify 함수 시작');
    
    const result = await simulateLunchActivity();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[lunch-activity] Netlify 함수 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || '점심시간 활동 시뮬레이션 중 오류가 발생했습니다.',
      }),
    };
  }
};
