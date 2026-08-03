import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-server';

const HUB_URL = process.env.NEXT_PUBLIC_MERLIN_HUB_URL || 'https://os.sundreamer.app';

/**
 * 사용자 ID 식별 헬퍼 (x-hub-token 우선 → Supabase 세션 Fallback)
 */
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const supabaseAdmin = createAdminClient();
  let userId: string | null = null;

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

  if (!userId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  }

  return userId;
}

/**
 * GET /api/family/members
 * headers: x-hub-token (선택)
 *
 * 왓잇 전용 '먹자 가족' 조회
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. 내가 속한 whateat_family_members row 찾기 → family_id 획득
    const { data: myMembership } = await supabaseAdmin
      .from('whateat_family_members')
      .select('family_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!myMembership) {
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

    // 2. whateat_family_groups에서 방장, 셰프 및 가족 사진 조회
    const { data: familyGroup } = await supabaseAdmin
      .from('whateat_family_groups')
      .select('id, owner_id, name, family_photo, chef_id')
      .eq('id', familyId)
      .maybeSingle();

    const ownerId = familyGroup?.owner_id || userId;
    const chefId = (familyGroup as any)?.chef_id || ownerId; // 셰프 미지정 시 방장이 디폴트 셰프!
    const isOwner = ownerId === userId;

    // 3. 같은 가족의 전체 멤버 목록 조회 (방장 + 멤버 모두)
    const { data: allMembers } = await supabaseAdmin
      .from('whateat_family_members')
      .select('user_id, role')
      .eq('family_id', familyId);

    const memberIds = (allMembers || [])
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== ownerId); // 방장 제외한 멤버들

    // 4. 방장 정보 조회
    const { data: hostUser } = await supabaseAdmin
      .from('users')
      .select('id, nickname, profile_image')
      .eq('id', ownerId)
      .maybeSingle();

    // 5. 멤버 상세 정보 조회
    let membersData: any[] = [];
    if (memberIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, nickname, profile_image')
        .in('id', memberIds);
      if (usersData) membersData = usersData;
    }

    console.log('[family/members GET] userId:', userId, '| familyId:', familyId, '| isOwner:', isOwner, '| chefId:', chefId);

    return NextResponse.json({
      isOwner,
      hostId: ownerId,
      chefId: chefId,
      hostUser: hostUser || null,
      refereeIds: memberIds,
      membersData,
      familyGroup: familyGroup ? { ...familyGroup, chef_id: chefId } : null,
    });
  } catch (err) {
    console.error('/api/family/members GET error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/family/members
 * headers: x-hub-token (선택)
 * body: { targetUserId: string }
 *
 * 방장이 특정 가족 멤버를 가족 그룹에서 제거
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: '삭제할 targetUserId가 필요합니다.' }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: '방장 자신을 가족에서 제거할 수 없습니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. 내 멤버십 및 가족 정보 확인
    const { data: myMembership } = await supabaseAdmin
      .from('whateat_family_members')
      .select('family_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!myMembership) {
      return NextResponse.json({ error: '가족 그룹에 속해 있지 않습니다.' }, { status: 404 });
    }

    const familyId = myMembership.family_id;

    // 2. 방장 권한 확인 (family_groups.owner_id 또는 role === 'owner')
    const { data: familyGroup } = await supabaseAdmin
      .from('whateat_family_groups')
      .select('owner_id')
      .eq('id', familyId)
      .maybeSingle();

    const isOwner = familyGroup?.owner_id === userId || myMembership.role === 'owner';
    if (!isOwner) {
      return NextResponse.json({ error: '가족 멤버 제거 권한은 방장에게만 있습니다.' }, { status: 403 });
    }

    // 3. whateat_family_members에서 targetUserId 삭제
    const { error: deleteErr } = await supabaseAdmin
      .from('whateat_family_members')
      .delete()
      .eq('family_id', familyId)
      .eq('user_id', targetUserId);

    if (deleteErr) {
      console.error('[family/members DELETE] DB delete error:', deleteErr);
      return NextResponse.json({ error: '멤버 제거에 실패했습니다.', detail: deleteErr }, { status: 500 });
    }

    console.log('[family/members DELETE] ✅ 멤버 제거 성공:', { familyId, removedUserId: targetUserId, ownerUserId: userId });
    return NextResponse.json({ success: true, removedUserId: targetUserId });
  } catch (err) {
    console.error('/api/family/members DELETE error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * PUT /api/family/members
 * headers: x-hub-token (선택)
 * body: { chefUserId: string }
 *
 * 방장이 가족의 셰프(chef_id)를 지정/변경
 */
export async function PUT(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { chefUserId } = await req.json();
    if (!chefUserId) {
      return NextResponse.json({ error: 'chefUserId가 필요합니다.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. 내 멤버십 및 가족 정보 확인
    const { data: myMembership } = await supabaseAdmin
      .from('whateat_family_members')
      .select('family_id, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!myMembership) {
      return NextResponse.json({ error: '가족 그룹에 속해 있지 않습니다.' }, { status: 404 });
    }

    const familyId = myMembership.family_id;

    // 2. 방장 권한 검증
    const { data: familyGroup } = await supabaseAdmin
      .from('whateat_family_groups')
      .select('owner_id')
      .eq('id', familyId)
      .maybeSingle();

    const isOwner = familyGroup?.owner_id === userId || myMembership.role === 'owner';
    if (!isOwner) {
      return NextResponse.json({ error: '셰프 지정 권한은 방장에게만 있습니다.' }, { status: 403 });
    }

    // 3. whateat_family_groups의 chef_id 업데이트
    const { data: updatedGroup, error: updateErr } = await supabaseAdmin
      .from('whateat_family_groups')
      .update({ chef_id: chefUserId })
      .eq('id', familyId)
      .select();

    if (updateErr) {
      console.error('[family/members PUT] DB update error:', updateErr);
      return NextResponse.json({ error: '셰프 변경에 실패했습니다.', detail: updateErr }, { status: 500 });
    }

    console.log('[family/members PUT] ✅ 셰프 변경 성공:', { familyId, newChefUserId: chefUserId });
    return NextResponse.json({ success: true, chefUserId, familyGroup: updatedGroup?.[0] });
  } catch (err) {
    console.error('/api/family/members PUT error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
