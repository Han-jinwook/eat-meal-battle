// AI 이미지 생성 함수
// OpenAI API를 사용하여 급식 메뉴에 맞는 이미지 생성

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

// dotenv 사용 - 로컬 개발 환경용
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv 모듈을 로드할 수 없습니다. Netlify 환경에서는 정상입니다.');
}

exports.handler = async (event) => {
  console.log('[generate-meal-image] 함수 시작');
  
  try {
    // 요청 데이터 파싱
    const { menu_items, meal_id, school_code, meal_date, meal_type } = JSON.parse(event.body);
    
    if (!menu_items || !meal_id) {
      throw new Error('필수 매개변수가 누락되었습니다 (menu_items, meal_id)');
    }
    
    console.log(`[generate-meal-image] 급식 ID: ${meal_id}, 메뉴 항목 수: ${menu_items.length}`);
    
    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase 환경 변수가 올바르게 설정되지 않았습니다.');
    }
    
    // 메뉴 항목을 문자열로 변환
    const menuString = menu_items.join(', ');
    console.log(`[generate-meal-image] 메뉴 문자열: ${menuString}`);
    
    // DALL-E 3으로 이미지 생성
    console.log('[generate-meal-image] OpenAI API 호출 중...');
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A detailed, appetizing photo of a Korean school lunch served on a traditional stainless steel compartment tray containing: ${menuString}.

Specific tray structure: The tray has 6 compartments - 4 small rectangular compartments on the top row for side dishes, a wide shallow rectangular compartment on the bottom left for rice/main dish, and a deep circular bowl-shaped compartment on the bottom right for soup.

Style requirements: Soft metallic sheen on the stainless steel tray, evenly diffused lighting, solid neutral background, photorealistic style. Capture from a top-down view to clearly show all food items in their designated compartments.

Make sure the food appears authentic to Korean school lunch cuisine with proper portion sizes and traditional presentation.`,
      n: 1,
      size: "1024x1024",
    });
    
    if (!imageResponse.data || imageResponse.data.length === 0) {
      throw new Error('이미지 생성에 실패했습니다.');
    }
    
    const imageUrl = imageResponse.data[0].url;
    console.log(`[generate-meal-image] 이미지 생성 완료: ${imageUrl.substring(0, 30)}...`);
    
    // 이미지 다운로드
    console.log('[generate-meal-image] 이미지 다운로드 중...');
    const imageRes = await fetch(imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    // 파일명 생성
    const fileName = `ai_generated_${meal_id}_${Date.now()}.png`;
    
    // 이미지를 Supabase Storage에 업로드
    console.log(`[generate-meal-image] Supabase Storage에 업로드 중: ${fileName}`);
    const { data: fileData, error: uploadError } = await supabase.storage
      .from('meal-images')
      .upload(fileName, Buffer.from(base64Image, 'base64'), {
        contentType: 'image/png',
        upsert: true
      });
      
    if (uploadError) {
      console.error('[generate-meal-image] 이미지 업로드 오류:', uploadError);
      throw uploadError;
    }
    
    // 이미지 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('meal-images')
      .getPublicUrl(fileName);
      
    const publicUrl = urlData.publicUrl;
    console.log(`[generate-meal-image] 공개 URL 생성: ${publicUrl.substring(0, 30)}...`);
    
    // 시스템 사용자 정보 가져오기 (관리자 또는 시스템)
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();
      
    const userId = adminUser?.id || 'system';
    
    // DB에 이미지 정보 저장
    console.log('[generate-meal-image] 이미지 정보 DB에 저장 중...');
    console.log(`[generate-meal-image] 저장할 데이터:`, {
      meal_id,
      school_code,
      // meal_date와 meal_type 필드는 테이블에 존재하지 않음
    });
    
    const { data: imageRecord, error: dbError } = await supabase
      .from('meal_images')
      .insert({
        meal_id: meal_id,
        image_url: publicUrl,
        uploaded_by: userId,
        school_code: school_code,
        // meal_date와 meal_type 필드 제거 - 테이블에 없는 필드
        status: 'approved', // AI 생성 이미지는 자동 승인
        is_shared: true,    // 자동으로 공유 설정
        match_score: 90,    // 높은 매치 스코어
        source: 'ai',       // AI 생성 이미지 표시
        explanation: 'AI가 생성한 급식 이미지입니다.'
      })
      .select()
      .single();
      
    if (dbError) {
      console.error('[generate-meal-image] DB 저장 오류:', dbError);
      throw dbError;
    }
    
    console.log(`[generate-meal-image] 성공: 이미지 ID ${imageRecord.id}`);
    
    // 학교 ID 가져오기
    const { data: mealData } = await supabase
      .from('meals')
      .select('school_id')
      .eq('id', meal_id)
      .single();
      
    if (mealData && mealData.school_id) {
      // 알림 생성 - 필드 이름 통일하여 중복 방지
      console.log('[generate-meal-image] 알림 생성 중...');
      try {
        // 학교 이름 가져오기
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .select('name')
          .eq('id', mealData.school_id)
          .single();
          
        const schoolName = schoolData?.name || '학교';
        
        const { data: notification, error: notificationError } = await supabase
          .from('notifications')
          .insert({
            title: `${schoolName} 급식 사진이 AI에 의해 생성되었습니다!`,
            message: '새로운 급식 사진이 등록되었습니다. 지금 확인해보세요!',
            sender_id: userId,
            school_code: school_code,
            related_type: 'meal_image',
            related_id: imageRecord.id
          })
          .select()
          .single();
          
        if (notificationError) {
          console.error('[generate-meal-image] 알림 생성 오류:', notificationError);
        } else if (notification) {
          // 학교 사용자들에게 알림 전송
          const { data: schoolUsers } = await supabase
            .from('user_schools')
            .select('user_id')
            .eq('school_id', mealData.school_id);
            
          if (schoolUsers && schoolUsers.length > 0) {
            const notificationRecipients = schoolUsers.map(user => ({
              notification_id: notification.id,
              user_id: user.user_id,
              is_read: false
            }));
            
            const { error: recipientsError } = await supabase
              .from('notification_recipients')
              .insert(notificationRecipients);
              
            if (recipientsError) {
              console.error('[generate-meal-image] 알림 수신자 저장 오류:', recipientsError);
            } else {
              console.log(`[generate-meal-image] 알림 전송 완료: ${schoolUsers.length}명에게 전송`);
            }
          }
        }
      } catch (notifyError) {
        console.error('[generate-meal-image] 알림 처리 중 오류:', notifyError);
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        image: imageRecord
      })
    };
  } catch (error) {
    console.error('[generate-meal-image] 오류:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || '서버 오류가 발생했습니다'
      })
    };
  }
};
