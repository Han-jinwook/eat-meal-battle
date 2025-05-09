import { useState, useCallback } from 'react';
import { formatApiDate } from '@/utils/DateUtils';
import { fetchWithAuth, API_ENDPOINTS } from '@/lib/api-helper';

export interface MealInfo {
  id: string;
  school_code: string;
  office_code: string;
  school_name?: string;
  meal_date: string;
  meal_type: string;
  menu_items: string[];
  kcal: string;
  ntr_info?: string;
  origin_info?: string;
  created_at: string;
}

interface UseMealsReturn {
  meals: MealInfo[];
  isLoading: boolean;
  error: string;
  dataSource: string;
  fetchMealInfo: (
    schoolCode: string,
    date: string,
    officeCode?: string
  ) => Promise<void>;
}

/**
 * 급식 정보를 가져오고 상태를 관리하는 커스텀 훅
 * Home 페이지 외의 다른 곳에서도 간단히 재사용할 수 있습니다.
 */
export default function useMeals(): UseMealsReturn {
  const [meals, setMeals] = useState<MealInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState('');

  const fetchMealInfo = useCallback(
    async (schoolCode: string, date: string, officeCode: string = 'E10') => {
      if (!schoolCode || !date) {
        setError('학교 코드와 날짜가 필요합니다.');
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        const apiDate = formatApiDate(date); // YYYYMMDD로 변환

        // 인증된 API 요청으로 급식 정보 가져오기
        const response = await fetchWithAuth(
          `${API_ENDPOINTS.MEALS}?school_code=${schoolCode}&office_code=${officeCode}&date=${apiDate}`
        );

        if (response.status === 404) {
          // 데이터 없음: 404는 정상 상황으로 처리
          setMeals([]);
          setDataSource('database');
          setError('해당 날짜의 급식 정보가 없습니다.');
          return;
        }

        if (!response.ok) {
          throw new Error(`API 호출 실패: ${response.statusText}`);
        }

        const data = await response.json();
        setDataSource(data.source || 'unknown');

        if (data.meals && data.meals.length > 0) {
          setMeals(data.meals);
        } else {
          setMeals([]);
          setError('해당 날짜의 급식 정보가 없습니다.');
        }
      } catch (err: any) {
        console.error('급식 정보 조회 오류:', err);
        setMeals([]);
        setError(
          `급식 정보를 가져오는 중 오류가 발생했습니다: ${err.message}`
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { meals, isLoading, error, dataSource, fetchMealInfo };
}
