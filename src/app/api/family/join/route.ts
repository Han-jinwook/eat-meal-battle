import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

const HUB_URL = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';
const CLIENT_ID = process.env.MERLIN_HUB_CLIENT_ID || process.env.NEXT_PUBLIC_MERLIN_CLIENT_ID || 'APP-01';
const CLIENT_SECRET = process.env.MERLIN_HUB_CLIENT_SECRET || process.env.NEXT_PUBLIC_MERLIN_CLIENT_SECRET || 'merlin-family-secret-key-2026';

/**
 * POST /api/family/join
 * body: { refCode: string }
 *
 * 가족 초대 수락 시 왓잇 DB에 가족 연결 생성
 * refCode = 허브의 referral_code (초대자/방장 식별)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { refCode } = await req.json();
    if (!refCode) {
      return NextResponse.json({ error: 'refCode가 필요합니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const myUserId = user.id;
    let inviterId: string | null = null;

    // 1. 허브 API로 refCode → 초대자(방장) 유저 정보 조회
    try {
      const hubRes = await fetch(`${HUB_URL}/api/auth/user-by-referral-code?code=${encodeURIComponent(refCode)}`, {
        headers: {
          'X-Client-Id': CLIENT_ID,
          'X-Client-Secret': CLIENT_SECRET,
        },
      });
      if (hubRes.ok) {
        const hubData = await hubRes.json();
        // 허브 응답에서 user_id (= 왓잇 users.id와 동일한 UUID)
        inviterId = hubData?.user?.id || hubData?.userId || hubData?.user_id || null;
      }
    } catch (e) {
      console.warn('[family/join] 허브 referral lookup 실패:', e);
    }

    // 2. 허브 lookup 실패 시 — refCode가 UUID 형식이면 직접 user_id로 사용
    if (!inviterId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(refCode)) {
        inviterId = refCode;
      }
    }

    // 3. 왓잇 users 테이블에서 referral_code로 조회
    if (!inviterId) {
      const { data: inviterByCode } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('referral_code', refCode)
        .maybeSingle();
      if (inviterByCode?.id) inviterId = inviterByCode.id;
    }

    if (!inviterId) {
      console.warn('[family/join] inviter not found for refCode:', refCode);
      // 방장을 못 찾아도 가족 연결 자체는 실패로 처리하지 않음
      // (허브가 처리하므로) - 단, DB 저장은 못 함
      return NextResponse.json({ 
        success: false, 
        error: '초대자를 찾을 수 없습니다. 허브에만 등록됩니다.',
        refCode 
      }, { status: 200 });
    }

    if (inviterId === myUserId) {
      return NextResponse.json({ error: '자기 자신을 초대할 수 없습니다.' }, { status: 400 });
    }

    // 4. 방장의 family_groups 조회 or 생성
    let { data: familyGroup } = await supabaseAdmin
      .from('family_groups')
      .select('id, name')
      .eq('owner_id', inviterId)
      .maybeSingle();

    if (!familyGroup) {
      const { data: inviterUser } = await supabaseAdmin
        .from('users')
        .select('nickname')
        .eq('id', inviterId)
        .maybeSingle();

      const familyName = inviterUser?.nickname ? `${inviterUser.nickname} 가족` : '우리 가족';

      const { data: newGroup, error: createErr } = await supabaseAdmin
        .from('family_groups')
        .insert({ owner_id: inviterId, name: familyName })
        .select('id, name')
        .single();

      if (createErr || !newGroup) {
        console.error('[family/join] family_groups 생성 실패:', createErr);
        return NextResponse.json({ error: '가족 그룹 생성 실패', detail: createErr }, { status: 500 });
      }
      familyGroup = newGroup;
    }

    const familyId = familyGroup.id;

    // 5. 방장이 family_members에 없으면 추가
    const { data: ownerMember } = await supabaseAdmin
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', inviterId)
      .maybeSingle();

    if (!ownerMember) {
      await supabaseAdmin
        .from('family_members')
        .insert({ family_id: familyId, user_id: inviterId, role: 'owner' });
    }

    // 6. 나(멤버) 추가
    const { data: myMember } = await supabaseAdmin
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', myUserId)
      .maybeSingle();

    if (!myMember) {
      const { error: insertErr } = await supabaseAdmin
        .from('family_members')
        .insert({ family_id: familyId, user_id: myUserId, role: 'member' });

      if (insertErr) {
        console.error('[family/join] family_members 추가 실패:', insertErr);
        return NextResponse.json({ error: '가족 멤버 추가 실패', detail: insertErr }, { status: 500 });
      }
    }

    console.log('[family/join] 성공 ✅', { myUserId, inviterId, familyId, familyName: familyGroup.name });

    return NextResponse.json({ success: true, familyId, familyName: familyGroup.name });
  } catch (err) {
    console.error('/api/family/join error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
