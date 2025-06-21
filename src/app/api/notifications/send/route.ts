import { NextResponse } from 'next/server';
import admin from '@/lib/firebase/firebaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { MessagingPayload, MulticastMessage } from 'firebase-admin/messaging';

/**
 * 특정 학교 학생들에게 급식 사진 등록 알림을 전송하는 API
 */
export async function POST(request: Request) {
  // 중복 알림 방지를 위해 이 API 비활성화
  // Netlify 함수에서 직접 알림을 생성하므로 이 API는 사용하지 않음
  try {
    console.log('알림 전송 API가 비활성화되었습니다. 중복 알림 방지를 위해 이 API 호출을 무시합니다.');
    
    return NextResponse.json({
      success: false,
      message: '알림 API가 중복 알림 방지를 위해 비활성화되었습니다. Netlify 함수에서 알림을 처리합니다.',
    }, { status: 200 });
  } catch (error) {
    console.error('비활성화된 알림 API 접근:', error);
    return NextResponse.json(
      { error: '알림 API가 비활성화되었습니다.' },
      { status: 200 }
    );
  }
}
