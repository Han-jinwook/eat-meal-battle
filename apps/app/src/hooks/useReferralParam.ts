import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function useReferralParam() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    
    if (refCode) {
      // 추천 코드를 로컬스토리지에 저장 (7일간 유효)
      const referralData = {
        code: refCode,
        timestamp: Date.now(),
        expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7일
      };
      
      localStorage.setItem('referral_code', JSON.stringify(referralData));
      console.log('추천 코드 저장됨:', refCode);
    }
  }, [searchParams]);

  // 저장된 추천 코드 가져오기
  const getStoredReferralCode = (): string | null => {
    try {
      const stored = localStorage.getItem('referral_code');
      if (!stored) return null;

      const referralData = JSON.parse(stored);
      
      // 만료 확인
      if (Date.now() > referralData.expires) {
        localStorage.removeItem('referral_code');
        return null;
      }

      return referralData.code;
    } catch (error) {
      console.error('추천 코드 조회 오류:', error);
      return null;
    }
  };

  // 추천 코드 사용 후 삭제
  const clearReferralCode = () => {
    localStorage.removeItem('referral_code');
  };

  return { getStoredReferralCode, clearReferralCode };
}
