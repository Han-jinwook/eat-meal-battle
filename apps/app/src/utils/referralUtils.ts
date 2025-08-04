import { createClient } from '@/lib/supabase';

export interface ReferralResult {
  success: boolean;
  message: string;
  referrerNickname?: string;
}

// 새 사용자의 추천 코드 생성
export function generateReferralCode(email: string, userId: string): string {
  // 이메일 앞 4자리 (@ 앞부분에서)
  const emailPrefix = email.split('@')[0].substring(0, 4).toLowerCase();
  
  // UUID 뒤 4자리 (하이픈 제거 후)
  const idSuffix = userId.replace(/-/g, '').slice(-4);
  
  return `${emailPrefix}${idSuffix}`;
}

// 추천 관계 저장
export async function saveReferralRelationship(
  newUserId: string, 
  newUserEmail: string, 
  referralCode: string
): Promise<ReferralResult> {
  try {
    const supabase = createClient();

    // 1. 추천인 찾기
    const { data: referrer, error: referrerError } = await supabase
      .from('users')
      .select('id, nickname')
      .eq('referral_code', referralCode)
      .single();

    if (referrerError || !referrer) {
      return {
        success: false,
        message: '유효하지 않은 추천 코드입니다.'
      };
    }

    // 자기 자신을 추천하는 경우 방지
    if (referrer.id === newUserId) {
      return {
        success: false,
        message: '자기 자신을 추천할 수 없습니다.'
      };
    }

    // 2. 새 사용자의 추천 코드 생성 및 업데이트
    const newUserReferralCode = generateReferralCode(newUserEmail, newUserId);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ referral_code: newUserReferralCode })
      .eq('id', newUserId);

    if (updateError) {
      console.error('사용자 추천 코드 업데이트 오류:', updateError);
    }

    // 3. 추천 관계 저장
    const { error: referralError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referee_id: newUserId,
        referral_code: referralCode,
        status: 'active'
      });

    if (referralError) {
      console.error('추천 관계 저장 오류:', referralError);
      return {
        success: false,
        message: '추천 관계 저장 중 오류가 발생했습니다.'
      };
    }

    // 4. 추천인 통계 업데이트
    await updateReferralStats(referrer.id);

    return {
      success: true,
      message: `${referrer.nickname}님의 추천으로 가입되었습니다!`,
      referrerNickname: referrer.nickname
    };

  } catch (error) {
    console.error('추천 관계 저장 중 오류:', error);
    return {
      success: false,
      message: '추천 처리 중 오류가 발생했습니다.'
    };
  }
}

// 추천인 통계 업데이트
async function updateReferralStats(referrerId: string) {
  try {
    const supabase = createClient();

    // 현재 추천 통계 조회
    const { data: existingStats } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('user_id', referrerId)
      .single();

    if (existingStats) {
      // 기존 통계 업데이트
      await supabase
        .from('referral_stats')
        .update({
          total_referrals: existingStats.total_referrals + 1,
          active_referrals: existingStats.active_referrals + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', referrerId);
    } else {
      // 새 통계 생성
      await supabase
        .from('referral_stats')
        .insert({
          user_id: referrerId,
          total_referrals: 1,
          active_referrals: 1
        });
    }
  } catch (error) {
    console.error('추천 통계 업데이트 오류:', error);
  }
}
