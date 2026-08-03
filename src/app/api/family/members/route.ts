import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/family/members
 *
 * 왓잇 전용 '먹자 가족' 조회
 * - whateat_family_groups (방장 + 가족 사진)
 * - whateat_family_members (구성원 목록)
 * 두 테이블 모두 왓잇 Supabase DB에 있음. 허브와 무관.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 현재 로그인 유저 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const userId = user.id;

    // 2. 내가 속한 whateat_family_members row 찾기 → family_id 획득
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

    // 3. whateat_family_groups에서 방장 및 가족 사진 조회
    const { data: familyGroup } = await supabaseAdmin
      .from('whateat_family_groups')
      .select('id, owner_id, name, family_photo')
      .eq('id', familyId)
      .maybeSingle();

    const ownerId = familyGroup?.owner_id || userId;
    const isOwner = ownerId === userId;

    // 4. 같은 가족의 전체 멤버 목록 조회
    const { data: allMembers } = await supabaseAdmin
      .from('whateat_family_members')
      .select('user_id, role')
      .eq('family_id', familyId);

    const memberIds = (allMembers || [])
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== ownerId); // 방장 제외한 멤버들

    // 5. 방장 정보 조회
    const { data: hostUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname, profile_image')
      .eq('id', ownerId)
      .maybeSingle();

    // 6. 멤버 상세 정보 조회
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
