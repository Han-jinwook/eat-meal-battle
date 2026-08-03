import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

const HUB_URL = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';

/**
 * POST /api/family/join
 * headers: x-hub-token (멀린 허브 세션 토큰)
 * body: { refCode: string }  ← 방장의 user.id (UUID)
 *
 * 왓잇 자체 가족 초대 수락 처리 (허브 무관)
 * 유저 인증: Supabase 세션 대신 허브 토큰 → 허브 /api/auth/me → 이메일 → 왓잇 users 조회
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 허브 토큰으로 현재 유저 확인
    const hubToken = req.headers.get('x-hub-token') || '';
    if (!hubToken) {
      return NextResponse.json({ error: '허브 토큰이 필요합니다.' }, { status: 401 });
    }

    const meRes = await fetch(`${HUB_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${hubToken}` },
    });

    if (!meRes.ok) {
      return NextResponse.json({ error: '허브 인증 실패.' }, { status: 401 });
    }

    const meData = await meRes.json();
    const hubUser = meData?.user;
    if (!hubUser) {
      return NextResponse.json({ error: '허브 유저 정보 없음.' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 2. 허브 이메일 or userId로 왓잇 users에서 내 row 찾기
    const hubEmail = hubUser.email;
    const hubUserId = hubUser.id || hubUser.userId;

    let myUserId: string | null = null;

    // userId로 먼저 조회 (허브 userId = 왓잇 users.id 동일 UUID)
    if (hubUserId) {
      const { data: byId } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', hubUserId)
        .maybeSingle();
      if (byId?.id) myUserId = byId.id;
    }

    // 없으면 이메일로 조회
    if (!myUserId && hubEmail) {
      const { data: byEmail } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', hubEmail)
        .maybeSingle();
      if (byEmail?.id) myUserId = byEmail.id;
    }

    if (!myUserId) {
      return NextResponse.json({ error: '왓잇 유저를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. 요청 바디에서 refCode(방장 UUID) 파싱
    const { refCode } = await req.json();
    if (!refCode) {
      return NextResponse.json({ error: 'refCode(방장 user.id)가 필요합니다.' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(refCode)) {
      return NextResponse.json({ error: '유효하지 않은 초대 코드입니다.' }, { status: 400 });
    }

    const inviterId = refCode;

    if (inviterId === myUserId) {
      return NextResponse.json({ error: '자기 자신을 초대할 수 없습니다.' }, { status: 400 });
    }

    // 4. 방장 존재 확인
    const { data: inviterUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname')
      .eq('id', inviterId)
      .maybeSingle();

    if (!inviterUser) {
      return NextResponse.json({ error: '초대자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 5. 방장의 family_groups 조회 or 생성
    let { data: familyGroup } = await supabaseAdmin
      .from('family_groups')
      .select('id, name')
      .eq('owner_id', inviterId)
      .maybeSingle();

    if (!familyGroup) {
      const familyName = inviterUser.nickname ? `${inviterUser.nickname} 가족` : '우리 가족';
      const { data: newGroup, error: createErr } = await supabaseAdmin
        .from('family_groups')
        .insert({ owner_id: inviterId, name: familyName })
        .select('id, name')
        .single();

      if (createErr || !newGroup) {
        return NextResponse.json({ error: '가족 그룹 생성 실패', detail: createErr }, { status: 500 });
      }
      familyGroup = newGroup;
    }

    const familyId = familyGroup.id;

    // 6. 방장이 family_members에 없으면 추가
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

    // 7. 나(멤버) 추가
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
        return NextResponse.json({ error: '가족 멤버 추가 실패', detail: insertErr }, { status: 500 });
      }
    }

    console.log('[family/join] ✅ 성공:', { myUserId, inviterId, familyId });
    return NextResponse.json({ success: true, familyId, familyName: familyGroup.name });
  } catch (err) {
    console.error('/api/family/join error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
