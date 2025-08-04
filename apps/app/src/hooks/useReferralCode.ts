import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export function useReferralCode() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReferralCode() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('referral_code, nickname')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('추천 코드 조회 오류:', error);
        } else {
          setReferralCode(data?.referral_code || null);
          setNickname(data?.nickname || null);
        }
      } catch (error) {
        console.error('추천 코드 조회 중 오류:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchReferralCode();
  }, []);

  return { referralCode, nickname, loading };
}
