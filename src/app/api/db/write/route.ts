import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getConfig } from '@/services/merlin-hub-sdk/CoreLogic/config';

// Merlin Hub 세션 검증 헬퍼 함수
async function verifyMerlinSession(token: string) {
  // KCP 심사관용 테스트 토큰 예외 처리
  if (token === 'test-session-token') {
    let testUserId = '00000000-0000-4000-8000-000000000001';
    // 로컬 개발 환경에서 해당 테스트 유저가 auth.users에 없을 경우 첫 번째 사용자의 ID를 사용
    if (process.env.NODE_ENV === 'development') {
      try {
        const { data: firstUser } = await createAdminClient().from('users').select('id').limit(1).maybeSingle();
        if (firstUser) {
          testUserId = firstUser.id;
        }
      } catch (err) {
        console.error('[verifyMerlinSession] Fallback user resolution failed:', err);
      }
    }
    return {
      id: testUserId,
      email: 'test@aggrofilter.com',
      nickname: 'KCP심사관'
    };
  }

  const config = getConfig();
  const url = `${config.hubUrl}/api/auth/me`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Id': config.clientId,
    'X-Client-Secret': config.clientSecret,
    'Authorization': `Bearer ${token}`
  };
  
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.user) {
      return data.user;
    }
  } catch (err) {
    console.error('[verifyMerlinSession] Error:', err);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    // 1. Authorization 헤더 검증
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증 헤더가 유효하지 않습니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyMerlinSession(token);
    if (!user || (!user.id && !user.userId)) {
      return NextResponse.json({ error: '유효하지 않은 세션입니다. 다시 로그인해주세요.' }, { status: 401 });
    }

    const userId = user.userId || user.id;

    // 2. 요청 바디 데이터 파싱
    const { table, action, data, filters } = await request.json();
    
    // 허용된 테이블 목록 정의
    const ALLOWED_TABLES = [
      'meal_images',
      'comments',
      'comment_replies',
      'meal_ratings',
      'school_infos',
      'meal_menus',
      'quiz_viewers',
      'users',
      'interest_schools',
      'notification_recipients',
      'meal_likes',
      'meal_reservations'
    ];

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `허용되지 않은 테이블에 대한 접근입니다: ${table}` }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 3. 작업 유형별 권한 검증 및 실행
    if (action === 'insert' || action === 'upsert') {
      const records = Array.isArray(data) ? data : [data];
      
      // 각 레코드에 대해 본인 여부 검증
      for (const rec of records) {
        if (table === 'meal_images' && rec.uploaded_by && rec.uploaded_by !== userId) {
          return NextResponse.json({ error: '본인의 업로드 정보만 저장할 수 있습니다.' }, { status: 403 });
        }
        if (['comments', 'comment_replies', 'meal_ratings', 'school_infos', 'interest_schools', 'meal_likes', 'meal_reservations'].includes(table)) {
          const recUserId = rec.user_id;
          if (recUserId && recUserId !== userId) {
            return NextResponse.json({ error: '본인의 데이터만 작성할 수 있습니다.' }, { status: 403 });
          }
          // 만약 데이터에 user_id가 없으면 강제 주입
          if (!recUserId && table !== 'school_infos' && table !== 'meal_ratings') {
            rec.user_id = userId;
          }
          if (table === 'school_infos' && !rec.user_id) {
            rec.user_id = userId;
          }
          if (table === 'meal_ratings' && !rec.user_id) {
            rec.user_id = userId;
          }
        }
        if (table === 'users') {
          if (rec.id && rec.id !== userId) {
            return NextResponse.json({ error: '본인의 회원 정보만 생성할 수 있습니다.' }, { status: 403 });
          }
          if (!rec.id) {
            rec.id = userId;
          }
        }
        if (table === 'quiz_viewers') {
          // 공유 퀴즈의 소유자이거나 본인이 뷰어여야 함
          if (rec.quiz_owner_id !== userId && rec.viewer_id !== userId) {
            return NextResponse.json({ error: '본인 관련 퀴즈 공유 관계만 설정할 수 있습니다.' }, { status: 403 });
          }
        }
      }

      // Upsert/Insert 실행
      if (action === 'upsert') {
        // meal_images upsert의 경우 온콘플릭트가 meal_id,status일 수 있음
        const onConflict = table === 'meal_images' ? 'id' : undefined;
        let query = supabaseAdmin.from(table).upsert(data);
        const { data: resData, error } = await query.select();
        if (error) throw error;
        return NextResponse.json({ success: true, data: resData });
      } else {
        const { data: resData, error } = await supabaseAdmin.from(table).insert(data).select();
        if (error) throw error;
        return NextResponse.json({ success: true, data: resData });
      }
    } 
    
    if (action === 'update') {
      // filters 유효성 검증
      if (!filters || (!filters.id && !filters.user_id && !filters.recipient_id)) {
        return NextResponse.json({ error: '업데이트 대상 식별자가 누락되었습니다.' }, { status: 400 });
      }

      // 업데이트 대상 권한 검증
      const recordId = filters.id || filters.user_id || filters.recipient_id;
      const idField = filters.user_id ? 'user_id' : (filters.recipient_id ? 'recipient_id' : 'id');

      // 알림 읽음 처리와 같이 recipient_id 기반 일괄 업데이트인 경우, 수신자가 본인인지 바로 검사
      if (table === 'notification_recipients') {
        if (recordId !== userId) {
          return NextResponse.json({ error: '본인의 알림 정보만 수정할 수 있습니다.' }, { status: 403 });
        }
      } else {
        const { data: existing, error: selectError } = await supabaseAdmin
          .from(table)
          .select('*')
          .eq(idField, recordId)
          .single();

        if (selectError || !existing) {
          return NextResponse.json({ error: '수정할 대상을 찾을 수 없거나 조회가 실패했습니다.' }, { status: 404 });
        }

        // 소유권 확인
        if (table === 'users' && existing.id !== userId) {
          return NextResponse.json({ error: '본인의 회원 정보만 수정할 수 있습니다.' }, { status: 403 });
        }
        if (table === 'meal_images' && existing.uploaded_by !== userId) {
          return NextResponse.json({ error: '본인의 업로드 정보만 수정할 수 있습니다.' }, { status: 403 });
        }
        if (['comments', 'comment_replies', 'comment_likes', 'reply_likes', 'meal_ratings', 'interest_schools', 'meal_reservations'].includes(table) && existing.user_id !== userId) {
          return NextResponse.json({ error: '본인의 데이터만 수정할 수 있습니다.' }, { status: 403 });
        }
        if (table === 'school_infos' && existing.user_id !== userId) {
          return NextResponse.json({ error: '본인의 소속 정보만 수정할 수 있습니다.' }, { status: 403 });
        }
      }

      // 업데이트 실행
      const { data: resData, error: updateError } = await supabaseAdmin
        .from(table)
        .update(data)
        .eq(idField, recordId)
        .select();

      if (updateError) throw updateError;
      return NextResponse.json({ success: true, data: resData });
    }

    if (action === 'delete') {
      // filters 유효성 검증
      if (!filters || (!filters.id && !filters.user_id && !filters.meal_id && !filters.comment_id && !filters.reply_id)) {
        return NextResponse.json({ error: '삭제 조건이 누락되었습니다.' }, { status: 400 });
      }

      // 단일 레코드 삭제 (id가 제공되는 경우)
      if (filters.id) {
        const recordId = filters.id;
        const { data: existing, error: selectError } = await supabaseAdmin
          .from(table)
          .select('*')
          .eq('id', recordId)
          .single();

        if (!selectError && existing) {
          // 소유권 확인
          if (table === 'meal_images' && existing.uploaded_by !== userId) {
            return NextResponse.json({ error: '본인의 업로드 정보만 삭제할 수 있습니다.' }, { status: 403 });
          }
          if (['comments', 'comment_replies', 'meal_ratings', 'interest_schools', 'meal_likes', 'meal_reservations'].includes(table) && existing.user_id !== userId) {
            return NextResponse.json({ error: '본인의 데이터만 삭제할 수 있습니다.' }, { status: 403 });
          }
          if (table === 'school_infos' && existing.user_id !== userId) {
            return NextResponse.json({ error: '본인의 학교 정보만 삭제할 수 있습니다.' }, { status: 403 });
          }
          if (table === 'quiz_viewers') {
            if (existing.quiz_owner_id !== userId && existing.viewer_id !== userId) {
              return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
            }
          }
        }

        // 삭제 실행
        const { error: deleteError } = await supabaseAdmin.from(table).delete().eq('id', recordId);
        if (deleteError) throw deleteError;
      } else {
        if (['meal_ratings', 'meal_likes'].includes(table)) {
          let query = supabaseAdmin.from(table).delete().eq('user_id', userId);
          if (filters.meal_id) query = query.eq('meal_id', filters.meal_id);
          
          const { error: deleteError } = await query;
          if (deleteError) throw deleteError;
        } else if (table === 'comments' && filters.meal_id) {
          // 식사 사진 소유자만 해당 식사의 모든 댓글을 지울 수 있음
          const { data: meal, error: mealErr } = await supabaseAdmin
            .from('meal_images')
            .select('uploaded_by')
            .eq('id', filters.meal_id)
            .single();
            
          if (!mealErr && meal && meal.uploaded_by === userId) {
            const { error: deleteError } = await supabaseAdmin
              .from('comments')
              .delete()
              .eq('meal_id', filters.meal_id);
            if (deleteError) throw deleteError;
          } else {
            return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
          }
        } else if (table === 'school_infos') {
          const { error: deleteError } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
          if (deleteError) throw deleteError;
        } else {
          return NextResponse.json({ error: '이 조건삭제 작업은 허용되지 않습니다.' }, { status: 400 });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '지원하지 않는 Action입니다.' }, { status: 400 });

  } catch (error: any) {
    console.error('[API Route /api/db/write] Error:', error);
    return NextResponse.json({ error: error.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
