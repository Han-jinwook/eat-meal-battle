import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

const HUB_URL = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';

/**
 * GET /api/family/members
 * headers: x-hub-token (선택)
 *
 * 왓잇 전용 '먹자 가족' 조회
 * - whateat_family_groups (방장 + 가족 사진)
 * - whateat_family_members (구성원 목록)
 * 인증: x-hub-token 헤더 우선 검증 → 없거나 실패 시 Supabase 세션 검증
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    let userId: string | null = null;

    // 1. x-hub-token 헤더로 유저 확인
    const hubToken = req.headers.get('x-hub-token') || '';
    if (hubToken) {
      try {
        const meRes = await fetch(`${HUB_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${hubToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          const hubUser = meData?.user;
          const hubEmail = hubUser?.email;
          const hubUserId = hubUser?.id || hubUser?.userId;

          if (hubUserId) {
            const { data: byId } = await supabaseAdmin
              .from('users')
              .select('id')
              .eq('id', hubUserId)
              .maybeSingle();
            if (byId?.id) userId = byId.id;
          }

          if (!userId && hubEmail) {
            const { data: byEmail } = await supabaseAdmin
              .from('users')
              .select('id')
              .eq('email', hubEmail)
              .maybeSingle();
            if (byEmail?.id) userId = byEmail.id;
          }
        }
      } catch (e) {
        console.warn('[family/members] hub token lookup error:', e);
      }
    }

    // 2. hubToken으로 못 찾은 경우 Supabase 세션으로 찾기
    if (!userId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 3. 내가 속한 whateat_family_members row 찾기 → family_id 획득
    const { data: myMembership } = await supabaseAdmin
      .from('whateat_family_members')
      .select('family_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!myMembership) {
      // 가족에 속해 있지 않음
      return NextResponse.json({
        isOwner: false,
        hostId: null,
        hostUser: null,
        refereeIds: [],
        membersData: [],
        familyGroup: null,
        _noFamily: true,
      });
    }

    const familyId = myMembership.family_id;

    // 4. whateat_family_groups에서 방장 및 가족 사진 조회
    const { data: familyGroup } = await supabaseAdmin
      .from('whateat_family_groups')
      .select('id, owner_id, name, family_photo')
      .eq('id', familyId)
      .maybeSingle();

    const ownerId = familyGroup?.owner_id || userId;
    const isOwner = ownerId === userId;

    // 5. 같은 가족의 전체 멤버 목록 조회 (방장 + 멤버 모두)
    const { data: allMembers } = await supabaseAdmin
      .from('whateat_family_members')
      .select('user_id, role')
      .eq('family_id', familyId);

    const memberIds = (allMembers || [])
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== ownerId); // 방장 제외한 멤버들

    // 6. 방장 정보 조회
    const { data: hostUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname, profile_image')
      .eq('id', ownerId)
      .maybeSingle();

    // 7. 멤버 상세 정보 조회
    let membersData: any[] = [];
    if (memberIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, nickname, profile_image')
        .in('id', memberIds);
      if (usersData) membersData = usersData;
    }

    console.log('[family/members] userId:', userId, '| familyId:', familyId, '| isOwner:', isOwner, '| memberCount:', memberIds.length);

    return NextResponse.json({
      isOwner,
      hostId: ownerId,
      hostUser: hostUser || null,
      refereeIds: memberIds,
      membersData,
      familyGroup: familyGroup || null,
    });
  } catch (err) {
    console.error('/api/family/members error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
