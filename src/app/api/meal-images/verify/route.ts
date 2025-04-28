import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 이미지-메뉴 매칭 검증 API
export async function POST(request: Request) {
  try {
    console.log('API 호출: /api/meal-images/verify');
    
    // 서비스 롤 키를 사용하여 관리자 권한으로 Supabase 클라이언트 생성
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // 일반 클라이언트는 사용하지 않음 - 모든 작업은 관리자 권한으로 수행
    const { imageId } = await request.json();
    console.log('이미지 ID 수신:', { imageId });

    if (!imageId) {
      return NextResponse.json(
        { error: '이미지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 이미지 정보 가져오기
    console.log('이미지 정보 조회 시도:', { imageId });
    const { data: imageData, error: imageError } = await supabaseAdmin
      .from('meal_images')
      .select('*, meal_menus(*)')
      .eq('id', imageId)
      .single();

    if (imageError) {
      console.error('이미지 조회 오류:', imageError);
      return NextResponse.json(
        { error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 이미지가 이미 검증되었는지 확인
    if (imageData.status !== 'pending') {
      return NextResponse.json(
        { 
          message: '이미 검증된 이미지입니다.',
          status: imageData.status,
          matchScore: imageData.match_score 
        },
        { status: 200 }
      );
    }

    // 3. 메뉴 정보 확인
    const mealMenu = imageData.meal_menus;
    if (!mealMenu || !mealMenu.menu_items || mealMenu.menu_items.length === 0) {
      return NextResponse.json(
        { error: '메뉴 정보를 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 4. 메뉴 아이템 문자열로 변환
    const menuItems = mealMenu.menu_items.join(', ');
    
    // 5. 이미지 URL 가져오기 및 유효성 검증
    const imageUrl = imageData.image_url;
    
    // 이미지 URL이 유효한지 확인
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      return NextResponse.json({ 
        error: '유효하지 않은 이미지 URL입니다.',
        success: false 
      }, { status: 400 });
    }

    // 6. OpenAI API 호출하여 이미지-메뉴 매칭 검증 (최신 모델 사용)
    console.log('OpenAI API 호출 시도...');
    console.log('이미지 URL:', imageUrl);
    console.log('메뉴 항목:', menuItems);
    
    // 검증 결과 변수들을 try-catch 블록 밖에 선언
    let matchScore = 0.1; // 기본값
    let explanation = '이미지 분석 중 오류가 발생했습니다.';
    let isMatch = false;
    
    try {
      // 최신 GPT-4o 모델을 사용하여 이미지 분석
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 급식 이미지와 메뉴 목록을 비교하여 일치 여부를 판단하는 전문가입니다."
          },
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `이 이미지에 표시된 음식이 다음 급식 메뉴와 얼마나 일치하는지 평가해주세요: ${menuItems}. 일치도를 0.0부터 1.0 사이의 숫자로 표현해주세요. 1.0은 완벽히 일치, 0.0은 전혀 일치하지 않음을 의미합니다. JSON 형식으로 다음 같이 만 답변해주세요: {"matchScore": 0.X, "explanation": "일치 여부에 대한 설명"}` 
              },
              { 
                type: "image_url", 
                image_url: { 
                  url: imageUrl,
                  detail: "low" // 이미지 처리 비용 절감을 위해 낮은 해상도 사용
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        response_format: { type: "json_object" }
      });
      
      console.log('OpenAI API 응답 받음');
      const content = response.choices[0]?.message?.content || '{"matchScore": 0.1, "explanation": "응답을 받지 못했습니다."}';
      console.log('API 응답 내용:', content);
      
      // 응답 파싱
      const result = JSON.parse(content);
      matchScore = result.matchScore;
      explanation = result.explanation;
      isMatch = matchScore >= 0.8; // 80% 이상이면 매칭 성공
      
      console.log('검증 결과:', { matchScore, isMatch, explanation });
    } catch (error) {
      console.error('OpenAI API 오류:', error);
      // 기본값은 이미 위에서 설정했으니 여기서는 로그만 출력
      console.log('오류 발생 시 기본값 사용:', { matchScore, isMatch, explanation });
    }

    // 7. 검증 결과는 이제 try-catch 블록 밖에서 사용 가능

    // 8. 검증 결과 업데이트
    console.log('검증 결과 업데이트 시도:', { 
      imageId, 
      matchScore, 
      isMatch, 
      status: isMatch ? 'approved' : 'rejected' 
    });
    // 업데이트할 데이터 객체 생성 - explanation 필드 포함
    // match_score는 정수형으로 변환하여 저장 (0.4 -> 40)
    const matchScoreInt = Math.round(Number(matchScore) * 100);
    const updateData = {
      match_score: matchScoreInt,
      status: isMatch ? 'approved' : 'rejected',
      is_shared: isMatch, // 매칭 성공 시 공유 상태로 변경
      explanation: explanation // 검증 결과 설명 추가
    };
    
    console.log('업데이트할 데이터:', updateData);
    
    const { error: updateError } = await supabaseAdmin
      .from('meal_images')
      .update(updateData)
      .eq('id', imageId);

    if (updateError) {
      console.error('업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '검증 결과 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 9. 결과 반환
    return NextResponse.json({
      success: true,
      matchScore,
      status: isMatch ? 'approved' : 'rejected',
      isMatch,
      explanation
    });

  } catch (error: any) {
    console.error('검증 API 오류:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
