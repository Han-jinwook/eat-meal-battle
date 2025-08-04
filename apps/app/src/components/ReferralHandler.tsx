'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useReferralParam } from '@/hooks/useReferralParam';
import { saveReferralRelationship } from '@/utils/referralUtils';

export default function ReferralHandler() {
  const { getStoredReferralCode, clearReferralCode } = useReferralParam();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    const processReferral = async () => {
      if (processed) return;

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        // 저장된 추천 코드 확인
        const referralCode = getStoredReferralCode();
        if (!referralCode) return;

        // 사용자가 이미 추천 관계가 있는지 확인
        const { data: existingReferral } = await supabase
          .from('referrals')
          .select('id')
          .eq('referee_id', user.id)
          .single();

        if (existingReferral) {
          // 이미 추천 관계가 있으면 저장된 코드 삭제
          clearReferralCode();
          setProcessed(true);
          return;
        }

        // 추천 관계 저장
        const result = await saveReferralRelationship(
          user.id,
          user.email || '',
          referralCode
        );

        if (result.success) {
          console.log('추천 관계 저장 성공:', result.message);
          
          // 성공 시 알림 표시 (선택적)
          if (result.referrerNickname) {
            // 간단한 토스트 알림이나 모달 표시 가능
            console.log(`${result.referrerNickname}님의 추천으로 가입되었습니다!`);
          }
          
          // 사용된 추천 코드 삭제
          clearReferralCode();
        } else {
          console.error('추천 관계 저장 실패:', result.message);
        }

        setProcessed(true);
      } catch (error) {
        console.error('추천 관계 처리 중 오류:', error);
        setProcessed(true);
      }
    };

    // 컴포넌트 마운트 후 잠시 대기 후 실행 (인증 상태 안정화)
    const timer = setTimeout(processReferral, 1000);
    
    return () => clearTimeout(timer);
  }, [processed, getStoredReferralCode, clearReferralCode]);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
}
