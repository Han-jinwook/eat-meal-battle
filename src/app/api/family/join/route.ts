import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/family/join
 * body: { refCode: string }
 *
 * 가족 초대 수락 시 왓잇 DB에 가족 연결 생성
 * 1. refCode로 방장(inviter) 유저 찾기
 * 2. 방장의 family_groups 조회 or 생성
 * 3. 나(invitee)를 family_members에 추가
 * 4. 방장도 family_members에 없으면 추가
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 현재 로그인 유저 확인
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

    // 2. refCode로 방장 유저 찾기 (users 테이블의 referral_code 또는 닉네임 기반)
    //    허브에서 referral_code는 허브 users 테이블에 있으나,
    //    왓잇 users에도 referral_code가 있을 수 있음
    let inviterId: string | null = null;

    // 왓잇 DB users에서 referral_code 매칭 시도
    const { data: inviterByCode } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('referral_code', refCode)
      .maybeSingle();

    if (inviterByCode?.id) {
      inviterId = inviterByCode.id;
    }

    if (!inviterId) {
      // refCode를 user_id로 직접 쓰는 경우도 지원 (UUID 형식이면)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(refCode)) {
        inviterId = refCode;
      }
    }

    if (!inviterId) {
      console.warn('[family/join] inviter not found for refCode:', refCode);
      return NextResponse.json({ error: '초대자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (inviterId === myUserId) {
      return NextResponse.json({ error: '자기 자신을 초대할 수 없습니다.' }, { status: 400 });
    }

    // 3. 방장의 family_groups 조회 or 생성
    let { data: familyGroup } = await supabaseAdmin
      .from('family_groups')
      .select('id, name')
      .eq('owner_id', inviterId)
      .maybeSingle();

    if (!familyGroup) {
      // 방장의 family_group이 없으면 생성
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
        return NextResponse.json({ error: '가족 그룹 생성 실패' }, { status: 500 });
      }
      familyGroup = newGroup;
    }

    const familyId = familyGroup.id;

    // 4. 방장이 family_members에 없으면 추가
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

    // 5. 내가(invitee) 이미 이 가족에 있는지 확인
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
        return NextResponse.json({ error: '가족 멤버 추가 실패' }, { status: 500 });
      }
    }

    console.log('[family/join] 성공:', { myUserId, inviterId, familyId });

    return NextResponse.json({ success: true, familyId, familyName: familyGroup.name });
  } catch (err) {
    console.error('/api/family/join error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
