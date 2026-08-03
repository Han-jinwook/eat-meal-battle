import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/family/join
 * body: { refCode: string }  ← 방장의 user.id (UUID)
 *
 * 왓잇 자체 가족 초대 수락 처리 (허브 무관)
 * 1. refCode = 방장 user.id로 family_groups 조회/생성
 * 2. 방장 + 나를 family_members에 추가
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
      return NextResponse.json({ error: 'refCode(방장 user.id)가 필요합니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const myUserId = user.id;

    // refCode = 방장 user.id (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(refCode)) {
      return NextResponse.json({ error: '유효하지 않은 초대 코드입니다.' }, { status: 400 });
    }

    const inviterId = refCode;

    if (inviterId === myUserId) {
      return NextResponse.json({ error: '자기 자신을 초대할 수 없습니다.' }, { status: 400 });
    }

    // 방장이 실제로 존재하는지 확인
    const { data: inviterUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname')
      .eq('id', inviterId)
      .maybeSingle();

    if (!inviterUser) {
      return NextResponse.json({ error: '초대자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 방장의 family_groups 조회 or 생성
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

    // 방장이 family_members에 없으면 추가
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

    // 나(멤버) 추가 (이미 있으면 스킵)
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
