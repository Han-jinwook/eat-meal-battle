import { NextResponse } from 'next/server';
import admin from '@/lib/firebase/firebaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { MessagingPayload, MulticastMessage } from 'firebase-admin/messaging';

/**
 * 특정 학교 학생들에게 급식 사진 등록 알림을 전송하는 API
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name) {
            const cookieStore = await cookies();
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            // 서버 응답에서는 쿠키를 설정할 수 없으므로 구현하지 않음
          },
          remove(name, options) {
            // 서버 응답에서는 쿠키를 제거할 수 없으므로 구현하지 않음
          }
        }
      }
    );
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
    }

    const { schoolId, mealImageId, title, message } = await request.json();

    if (!schoolId || !mealImageId) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // 학교 정보 가져오기
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single();

    if (schoolError) {
      return NextResponse.json({ error: '학교 정보를 가져오는데 실패했습니다.' }, { status: 500 });
    }

    // 해당 학교 학생들의 FCM 토큰 가져오기
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, user_id, fcm_token')
      .eq('school_id', schoolId)
      .not('fcm_token', 'is', null);

    if (usersError) {
      return NextResponse.json({ error: '사용자 정보를 가져오는데 실패했습니다.' }, { status: 500 });
    }

    // FCM 토큰 목록 추출
    const fcmTokens = usersData
      .filter((user: { fcm_token: string | null }) => user.fcm_token)
      .map((user: { fcm_token: string }) => user.fcm_token);

    if (fcmTokens.length === 0) {
      return NextResponse.json({
        success: false,
        message: '알림을 수신할 사용자가 없습니다.',
      });
    }

    // 알림 메시지 작성
    const notificationTitle = title || `${schoolData.name} 급식 사진이 등록되었습니다!`;
    const notificationMessage = message || '새로운 급식 사진이 등록되었습니다. 지금 확인해보세요!';

    const payload: MessagingPayload = {
      notification: {
        title: notificationTitle,
        body: notificationMessage,
      },
      data: {
        type: 'meal_image',
        mealImageId: mealImageId.toString(),
        schoolId: schoolId.toString(),
        url: `/meals/images/${mealImageId}`,
      },
    };

    // 알림 전송 (최대 500개씩 묶어서 전송)
    const chunkSize = 500;
    const results = [];

    for (let i = 0; i < fcmTokens.length; i += chunkSize) {
      const chunk = fcmTokens.slice(i, i + chunkSize);
      try {
        // @ts-ignore - Firebase Admin SDK 타입 문제를 일시적으로 우회
        const response = await admin.messaging().sendMulticast({
          tokens: chunk,
          ...payload,
        });
        
        results.push({
          success: response.successCount,
          failure: response.failureCount,
        });
        
        console.log(`알림 전송 결과: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
      } catch (error: unknown) {
        console.error('알림 전송 중 오류 발생:', error);
      }
    }

    // 알림 레코드 DB에 저장
    const { data: notificationData, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        title: notificationTitle,
        message: notificationMessage,
        sender_id: session.user.id,
        school_id: schoolId,
        related_type: 'meal_image',
        related_id: mealImageId,
      });

    if (notificationError) {
      console.error('알림 레코드 저장 오류:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: '알림이 성공적으로 전송되었습니다.',
      results,
      fcmTokenCount: fcmTokens.length,
    });
  } catch (error) {
    console.error('알림 전송 API 오류:', error);
    return NextResponse.json(
      { error: `알림 전송 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}
