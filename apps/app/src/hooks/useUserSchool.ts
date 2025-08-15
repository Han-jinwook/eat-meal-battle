import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

interface SchoolInfo {
  id: string;
  user_id: string;
  school_code: string;
  school_name?: string;
  office_code?: string;
  region?: string;
  school_type?: string; // 학교 유형 (초등학교/중학교/고등학교)
  grade?: string | number; // 학년
  class?: string | number; // 반
  nickname?: string; // 사용자 별명
  created_at: string;
}

interface UseUserSchoolReturn {
  user: any;
  userSchool: SchoolInfo | null;
  loading: boolean;
  error: string;
  refresh: () => void;
}

/**
 * 현재 로그인된 사용자와 학교 정보를 가져오는 커스텀 훅
 */
export default function useUserSchool(): UseUserSchoolReturn {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [userSchool, setUserSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshFlag, setRefreshFlag] = useState(0);

  const refresh = useCallback(() => {
    setRefreshFlag((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const fetchUserSchool = async () => {
      try {
        setLoading(true);
        setError('');

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;

        setUser(user);

        if (user) {
          // 학교 정보와 사용자 닉네임을 함께 가져오기
          const [schoolResult, userResult] = await Promise.all([
            supabase
              .from('school_infos')
              .select('*')
              .eq('user_id', user.id)
              .single(),
            supabase
              .from('users')
              .select('nickname, is_student, birth_date')
              .eq('id', user.id)
              .single()
          ]);

          const { data: schoolInfo, error: schoolError } = schoolResult;
          const { data: userInfo } = userResult;

          if (schoolError && schoolError.code !== 'PGRST116') {
            throw new Error(`학교 정보 조회 에러: ${schoolError.message}`);
          }

          // DB 프로필 정보를 user 객체에 추가
          if (userInfo) {
            setUser({
              ...user,
              db_profile: {
                nickname: userInfo.nickname,
                is_student: userInfo.is_student,
                birth_date: userInfo.birth_date
              }
            });
          }

          if (schoolInfo) {
            setUserSchool({
              ...schoolInfo,
              class: schoolInfo.class_number,
              nickname: userInfo?.nickname || '익명'
            });
          } else {
            setUserSchool(null);
          }
        } else {
          setUserSchool(null);
        }
      } catch (err: any) {
        console.error('useUserSchool 오류:', err);
        setError(err.message || '사용자 정보를 불러오는 중 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchUserSchool();
  }, [supabase, refreshFlag]);

  return { user, userSchool, loading, error, refresh };
}
