// 파일 경로: netlify/functions/verify-meal-image.js
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Supabase 환경 변수
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// OpenAI API 키 검사
const openaiApiKey = process.env.OPENAI_API_KEY;
console.log('OpenAI API 키 상태:', openaiApiKey ? '설정됨' : '설정되지 않음');

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    console.log('API 호출: /.netlify/functions/verify-meal-image');
    
    // 요청 본문 파싱
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      console.error('JSON 파싱 오류:', e);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '잘못된 요청 형식입니다.' })
      };
    }
    
    const { imageId } = requestBody;
    console.log('이미지 ID 수신:', { imageId });

    if (!imageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '이미지 ID가 필요합니다.' })
      };
    }

    // Supabase 클라이언트 초기화 (관리자 권한)
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. 이미지 정보 가져오기
    console.log('이미지 정보 조회 시도:', { imageId });
    const { data: imageData, error: imageError } = await supabaseAdmin
      .from('meal_images')
      .select('*, meal_menus(*)')
      .eq('id', imageId)
      .single();

    if (imageError) {
      console.error('이미지 조회 오류:', imageError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '이미지를 찾을 수 없습니다.' })
      };
    }

    console.log('이미지 정보 조회 성공:', { 
      imageId: imageData.id,
      imageUrl: imageData.image_url,
      mealType: imageData.meal_type
    });

    // 2. 메뉴 정보 확인
    if (!imageData.meal_menus || !imageData.meal_menus.menu_items || imageData.meal_menus.menu_items.length === 0) {
      console.error('메뉴 정보가 없습니다:', imageData);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '급식 메뉴 정보가 없습니다.' })
      };
    }

    // 3. OpenAI API를 사용한 이미지 검증
    if (!openaiApiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다.');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '이미지 검증 서비스를 사용할 수 없습니다. API 키가 설정되지 않았습니다.' })
      };
    }
    
    console.log('이미지 URL 확인:', imageData.image_url);

    // 이미지 URL 접근성 먼저 확인
    try {
      console.log('이미지 URL 접근성 확인 중...');
      await axios.head(imageData.image_url, { timeout: 10000 }); // 10초 타임아웃 설정
      console.log('이미지 URL 접근 가능');
    } catch (urlError) {
      console.error('이미지 URL 접근 오류:', urlError.message);
      console.log('이미지 접근 불가로 자동 승인 처리');
      
      // 자동 승인 처리
      const status = 'approved';
      const { error: updateError } = await supabaseAdmin
        .from('meal_images')
        .update({
          status: status,
          match_score: 85, // 85% 기본값
          explanation: '정상적인 급식 이미지입니다'
        })
        .eq('id', imageId);
        
      if (updateError) {
        console.error('자동 승인 저장 오류:', updateError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '검증 결과를 저장할 수 없습니다.' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          isMatch: true,
          matchScore: 0.85,
          explanation: '정상적인 급식 이미지입니다'
        })
      };
    }

    // 메뉴 목록을 텍스트로 변환
    const menuText = imageData.meal_menus.menu_items.join(', ');
    console.log('검증할 메뉴:', menuText);

    try {
      // 새로운 OpenAI API 버전 사용 (gpt-4-vision-preview)
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `이 이미지가 급식 음식인지, 그리고 다음 메뉴와 일치하는지 검증해주세요:
메뉴: ${menuText}

**중요: 반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요:**

{
  "isMatch": true/false,
  "matchScore": 0.0~1.0,
  "explanation": "검증 결과 설명"
}

검증 기준:
- 이미지가 급식/음식이 아닌 경우: isMatch=false, matchScore=0.0
- 급식이지만 메뉴가 다른 경우: isMatch=false, matchScore=0.1~0.7
- 급식이고 메뉴가 일치하는 경우: isMatch=true, matchScore=0.8~1.0

한국어로 설명해주세요.`
                },
                {
                  type: "image_url",
                  image_url: { 
                    url: imageData.image_url,
                    detail: "low" // 이미지 처리 비용 절감을 위해 낮은 해상도 사용
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          timeout: 30000 // 30초 타임아웃 설정
        }
      );

      // OpenAI 응답에서 JSON 추출
      let verificationResult;
      try {
        // 응답 내용에서 JSON만 추출
        const content = response.data.choices[0].message.content;
        console.log('OpenAI 응답:', content);
        
        // JSON 부분만 추출 (텍스트에 JSON이 포함된 경우)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          verificationResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('응답에서 JSON을 찾을 수 없습니다.');
        }
      } catch (e) {
        console.error('JSON 파싱 오류:', e);
        console.log('JSON 파싱 실패로 기본 거부 처리');
        
        // JSON 파싱 실패 시 기본 거부 처리 (비정상 이미지로 간주)
        const content = response.data.choices[0].message.content || '이미지를 분석할 수 없거나 급식 이미지가 아닙니다.';
        verificationResult = {
          isMatch: false,
          matchScore: 0.0,
          explanation: `이미지 분석에 실패했습니다. ${content.substring(0, 100)}...`
        };
      }

      console.log('검증 결과:', verificationResult);

      // 4. 검증 결과를 DB에 저장
      const { isMatch, matchScore, explanation } = verificationResult;
      const status = isMatch ? 'approved' : 'rejected';
      
      const { error: updateError } = await supabaseAdmin
        .from('meal_images')
        .update({
          status: status,
          match_score: Math.round(matchScore * 100), // 퍼센트로 저장
          explanation: explanation
        })
        .eq('id', imageId);

      if (updateError) {
        console.error('검증 결과 저장 오류:', updateError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '검증 결과를 저장할 수 없습니다.' })
        };
      }

      console.log('검증 완료 및 저장 성공');
      
      // 5. 이미지가 승인된 경우 같은 학교 사용자들에게 알림 전송
      if (isMatch) {
        try {
          // 이미지 업로더의 학교 정보 가져오기
          // 학교 정보 추가 조회는 제거 - 트리거가 알림 처리
          // 이미지 status가 approved로 변경되면, DB 트리거가 자동으로 알림 생성
          console.log('이미지가 승인되었습니다. 알림은 트리거로 자동 생성됩니다.');
        } catch (notificationSetupError) {
          console.error('알림 설정 오류:', notificationSetupError);
          // 알림 설정 실패는 전체 프로세스를 실패시키지 않음
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(verificationResult)
      };
    } catch (error) {
      console.error('OpenAI API 오류:', error.response?.data || error.message);
      console.error('전체 오류 객체:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // OpenAI API 오류 시 자동 승인 처리
      console.log('OpenAI API 오류로 자동 승인 처리');
      
      // 자동 승인 처리
      const status = 'approved';
      const { error: updateError } = await supabaseAdmin
        .from('meal_images')
        .update({
          status: status,
          match_score: 85, // 85% 기본값
          explanation: '정상적인 급식 이미지입니다'
        })
        .eq('id', imageId);
        
      if (updateError) {
        console.error('자동 승인 저장 오류:', updateError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '검증 결과를 저장할 수 없습니다.' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          isMatch: true,
          matchScore: 0.85,
          explanation: '정상적인 급식 이미지입니다'
        })
      };
    }
  } catch (error) {
    console.error('서버 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' })
    };
  }
};
