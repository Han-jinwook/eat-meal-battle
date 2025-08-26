import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import admin from 'firebase-admin';

// Firebase Admin 초기화 (싱글톤 패턴)
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

interface PushNotificationRequest {
  title: string;
  body: string;
  targetUsers?: string[]; // 특정 사용자들에게 발송
  schoolCode?: string; // 특정 학교 사용자들에게 발송
  grade?: number; // 특정 학년 사용자들에게 발송
  data?: Record<string, string>; // 추가 데이터
  imageUrl?: string; // 이미지 URL
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 관리자 권한 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 역할 확인 (필요시 구현)
    // const isAdmin = await checkAdminRole(session.user.id);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    // }

    const body: PushNotificationRequest = await request.json();
    const { title, body: messageBody, targetUsers, schoolCode, grade, data, imageUrl } = body;

    if (!title || !messageBody) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // 대상 사용자의 FCM 토큰 조회
    let tokensQuery = supabase
      .from('user_fcm_tokens')
      .select('token, user_id')
      .eq('is_active', true);

    // 조건에 따른 필터링
    if (targetUsers && targetUsers.length > 0) {
      tokensQuery = tokensQuery.in('user_id', targetUsers);
    } else if (schoolCode || grade) {
      // 학교/학년 조건이 있으면 user_schools 테이블과 조인
      const { data: schoolUsers } = await supabase
        .from('user_schools')
        .select('user_id')
        .eq('school_code', schoolCode || '')
        .eq('grade', grade || 0);

      if (schoolUsers && schoolUsers.length > 0) {
        const userIds = schoolUsers.map(u => u.user_id);
        tokensQuery = tokensQuery.in('user_id', userIds);
      } else {
        return NextResponse.json({ message: 'No users found for the specified criteria' });
      }
    }

    const { data: tokens, error: tokensError } = await tokensQuery;

    if (tokensError) {
      console.error('토큰 조회 오류:', tokensError);
      return NextResponse.json({ error: 'Failed to fetch FCM tokens' }, { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ message: 'No active FCM tokens found' });
    }

    // FCM 메시지 구성
    const fcmTokens = tokens.map(t => t.token);
    const message = {
      notification: {
        title,
        body: messageBody,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      tokens: fcmTokens
    };

    // Firebase Admin SDK로 푸시 알림 발송
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log('푸시 알림 발송 결과:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: fcmTokens.length
    });

    // 실패한 토큰들 비활성화 처리
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          console.error(`토큰 ${fcmTokens[idx]} 발송 실패:`, error?.code, error?.message);
          
          // 토큰이 무효한 경우 비활성화 대상에 추가
          if (error?.code === 'messaging/invalid-registration-token' || 
              error?.code === 'messaging/registration-token-not-registered') {
            failedTokens.push(fcmTokens[idx]);
          }
        }
      });

      // 무효한 토큰들 비활성화
      if (failedTokens.length > 0) {
        await supabase
          .from('user_fcm_tokens')
          .update({ is_active: false })
          .in('token', failedTokens);
        
        console.log(`${failedTokens.length}개의 무효한 토큰을 비활성화했습니다.`);
      }
    }

    // 알림 기록 저장 (선택사항)
    await supabase.from('notifications').insert({
      title,
      message: messageBody,
      related_type: 'push_notification',
      sender_id: session.user.id,
      school_code: schoolCode,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Push notifications sent successfully',
      results: {
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: fcmTokens.length
      }
    });

  } catch (error) {
    console.error('푸시 알림 발송 오류:', error);
    return NextResponse.json(
      { error: 'Failed to send push notifications' },
      { status: 500 }
    );
  }
}
