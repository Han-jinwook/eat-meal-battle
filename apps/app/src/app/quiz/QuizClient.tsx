"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'react-hot-toast';
// ChampionCalendar 컴포넌트가 존재하지 않아 주석 처리
import ChampionHistory from '@/components/ChampionHistory';
import DateNavigator from '@/components/DateNavigator';
import QuizOptionsSection from '@/components/QuizOptionsSection';
import QuizResultSection from '@/components/QuizResultSection';
import SchoolInfoHeader from '@/components/SchoolInfoHeader';
import QuizGenerateButton from '@/components/QuizGenerateButton';
import SchoolGradeSelector from '@/components/SchoolGradeSelector';
import QuizShareButton from '@/components/QuizShareButton';
import QuizDropdown from '@/components/QuizDropdown';
import QuizChallengeCalendar from '@/components/QuizChallengeCalendar';


// Quiz type definition
type Quiz = {
  id: string;
  question: string;
  options: string[];
  correct_answer?: number;
  explanation?: string;
  meal_date: string;
  meal_id?: string;
  meal_image_url?: string; // 급식이미지 URL
  user_answer?: {
    selected_option?: number;
    is_correct?: boolean;
  };
  selected_option?: number;
  is_correct?: boolean;
  // 오답 신고 관련 필드
  report_status?: 'none' | 'pending' | 'verified_correct' | 'verified_incorrect';
  ai_verification?: {
    isCorrect: boolean;
    confidence: number;
    reasoning: string;
  };
};

export default function QuizClient() {
  // CSS styles
  const styles = `
    .quiz-container {
      max-width: 800px;
      margin: 0 auto;
    }
  `;

  // State management
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(2025, 5, 1));
  const [noMenuMessage, setNoMenuMessage] = useState<string>('');
  const [noMenu, setNoMenu] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [generatingQuiz, setGeneratingQuiz] = useState<boolean>(false);
  const [reportingQuiz, setReportingQuiz] = useState<boolean>(false);
  
  // 모든 퀴즈 모달 상태
  const [isAllQuizModalOpen, setIsAllQuizModalOpen] = useState(false);
  const [selectedSchoolLevel, setSelectedSchoolLevel] = useState<'elementary' | 'middle' | 'high'>('elementary');
  const [mealImageUrl, setMealImageUrl] = useState<string | null>(null);
  
  // 만능 선택기 상태 - userSchool 기반 초기값 설정
  const [universalSchoolName, setUniversalSchoolName] = useState<string>('');
  const [universalGrade, setUniversalGrade] = useState<number>(1);
  const [universalSchoolType, setUniversalSchoolType] = useState<'초등학교' | '중학교' | '고등학교'>('초등학교');
  const [universalSchoolCode, setUniversalSchoolCode] = useState<string>('');

  // 만능 선택기 핸들러 함수들
  const handleUniversalGradeChange = (grade: number) => {
    // 학교 종류별 학년 범위 확인
    let minGrade = 1;
    let maxGrade = 6;
    
    if (universalSchoolType === '중학교') {
      minGrade = 1;
      maxGrade = 3;
    } else if (universalSchoolType === '고등학교') {
      minGrade = 1;
      maxGrade = 3;
    }
    
    // 범위 내에서만 변경 허용
    if (grade >= minGrade && grade <= maxGrade) {
      setUniversalGrade(grade);
      console.log('🎯 학년 변경:', grade, `(${universalSchoolType} ${minGrade}-${maxGrade}학년 범위)`);
    } else {
      console.log('🚫 학년 변경 불가:', grade, `(${universalSchoolType} ${minGrade}-${maxGrade}학년 범위 초과)`);
    }
  };

  const handleUniversalSchoolChange = async (direction: 'prev' | 'next') => {
    console.log('🏫 학교 변경:', direction);
    
    try {
      // 현재 학교 종류에 맞는 학교들을 DB에서 조회
      const { data: schoolInfos, error } = await supabase
        .from('school_infos')
        .select('school_name, school_code')
        .ilike('school_name', `%${universalSchoolType}%`)
        .order('school_name');
      
      if (error) {
        console.error('학교 목록 조회 오류:', error);
        return;
      }
      
      if (!schoolInfos || schoolInfos.length === 0) {
        console.log('해당 학교 종류의 학교가 없습니다:', universalSchoolType);
        return;
      }
      
      // 현재 학교의 인덱스 찾기
      const currentIndex = schoolInfos.findIndex(school => 
        school.school_name === universalSchoolName
      );
      
      let nextIndex;
      if (direction === 'next') {
        nextIndex = currentIndex < schoolInfos.length - 1 ? currentIndex + 1 : 0; // 마지막이면 처음으로
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : schoolInfos.length - 1; // 첫번째면 마지막으로
      }
      
      const nextSchool = schoolInfos[nextIndex];
      setUniversalSchoolName(nextSchool.school_name);
      setUniversalSchoolCode(nextSchool.school_code);
      
      console.log('🏫 학교 변경 완료:', {
        direction,
        from: universalSchoolName,
        to: nextSchool.school_name,
        schoolCode: nextSchool.school_code,
        currentIndex,
        nextIndex,
        totalSchools: schoolInfos.length
      });
      
    } catch (err) {
      console.error('학교 변경 중 오류:', err);
    }
  };

  // 만능 선택기 초기값 설정 - userSchool 기반
  useEffect(() => {
    if (userSchool && !userLoading) {
      setUniversalSchoolName(userSchool.school_name || '');
      setUniversalSchoolCode(userSchool.school_code || '');
      setUniversalGrade(typeof userSchool.grade === 'number' ? userSchool.grade : parseInt(String(userSchool.grade)) || 1);
      
      // 학교 종류 결정
      if (userSchool.school_name?.includes('초등학교')) {
        setUniversalSchoolType('초등학교');
        setSelectedSchoolLevel('elementary');
      } else if (userSchool.school_name?.includes('중학교')) {
        setUniversalSchoolType('중학교');
        setSelectedSchoolLevel('middle');
      } else if (userSchool.school_name?.includes('고등학교')) {
        setUniversalSchoolType('고등학교');
        setSelectedSchoolLevel('high');
      }
      
      console.log('🎯 만능 선택기 초기값 설정:', {
        schoolName: userSchool.school_name,
        schoolCode: userSchool.school_code,
        grade: userSchool.grade,
        schoolType: userSchool.school_name?.includes('초등학교') ? '초등학교' : 
                   userSchool.school_name?.includes('중학교') ? '중학교' : '고등학교'
      });
    }
  }, [userSchool, userLoading]);

  // 모든 퀴즈 모달에서 만능 선택기 값 변경 시 퀴즈 로드
  useEffect(() => {
    if (isAllQuizModalOpen && universalSchoolCode && universalGrade && selectedDate) {
      console.log('🔄 만능 선택기 값 변경 감지, 모든 퀴즈 로드:', {
        schoolCode: universalSchoolCode,
        grade: universalGrade,
        date: selectedDate
      });
      fetchAllQuiz();
    }
  }, [isAllQuizModalOpen, universalSchoolCode, universalGrade, selectedDate]);

  // 관람 모드 상태
  const [isViewingMode, setIsViewingMode] = useState<boolean>(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingUserInfo, setViewingUserInfo] = useState<{
    nickname: string;
    school_name: string;
    grade?: number;
    class?: number;
  } | null>(null);
  
  // Handle URL parameters (date and viewer_invite)
  useEffect(() => {
    try {
      const dateParam = searchParams?.get('date');
      const viewerInviteParam = searchParams?.get('viewer_invite');
      const viewingParam = searchParams?.get('viewing');
      
      // 관람 모드 처리
      if (viewingParam) {
        setIsViewingMode(true);
        setViewingUserId(viewingParam);
        loadViewingUserInfo(viewingParam);
      } else {
        setIsViewingMode(false);
        setViewingUserId(null);
        setViewingUserInfo(null);
      }
      
      // 초대 링크 처리
      if (viewerInviteParam) {
        handleViewerInvite(viewerInviteParam);
      }
      
      if (dateParam && typeof dateParam === 'string') {
        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) || /^\d{8}$/.test(dateParam);
        
        if (isValidDate) {
          try {
            if (dateParam.includes('-')) {
              const dateParts = dateParam.split('-');
              if (dateParts.length === 3) {
                const year = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1;
                const day = parseInt(dateParts[2], 10);
                
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime()) && 
                    date.getFullYear() === year && 
                    date.getMonth() === month && 
                    date.getDate() === day) {
                  setSelectedDate(dateParam);
                  return;
                }
              }
            } 
            else if (dateParam.length === 8) {
              const year = parseInt(dateParam.substring(0, 4), 10);
              const month = parseInt(dateParam.substring(4, 6), 10) - 1;
              const day = parseInt(dateParam.substring(6, 8), 10);
              
              const date = new Date(year, month, day);
              if (!isNaN(date.getTime()) && 
                  date.getFullYear() === year && 
                  date.getMonth() === month && 
                  date.getDate() === day) {
                setSelectedDate(dateParam);
                return;
              }
            }
            
            console.warn('유효하지 않은 날짜 값:', dateParam);
            setSelectedDate(getCurrentDate());
          } catch (validationErr) {
            console.error('날짜 유효성 검사 오류:', validationErr);
            setSelectedDate(getCurrentDate());
          }
        } else {
          console.warn('유효하지 않은 날짜 형식:', dateParam);
          setSelectedDate(getCurrentDate());
        }
      } else {
        setSelectedDate(getCurrentDate());
      }
    } catch (err) {
      console.error('URL 파라미터 처리 오류:', err);
      setSelectedDate(getCurrentDate());
    }
  }, [searchParams]);

  // 관람 사용자 정보 로드 함수
  const loadViewingUserInfo = async (userId: string) => {
    try {
      console.log('🔍 관람 사용자 정보 로드:', userId);
      
      // 사용자 닉네임 가져오기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', userId)
        .single();
      
      // 사용자 학교 정보 가져오기
      const { data: schoolData, error: schoolError } = await supabase
        .from('school_infos')
        .select('school_name, grade, class_number')
        .eq('user_id', userId)
        .single();
      
      if (userError || schoolError) {
        console.error('관람 사용자 정보 로드 오류:', userError, schoolError);
        toast.error('관람 사용자 정보를 불러오는데 실패했습니다.');
        return;
      }
      
      const userInfo = {
        nickname: userData?.nickname || '익명',
        school_name: schoolData?.school_name || '알 수 없음',
        grade: schoolData?.grade,
        class_number: schoolData?.class_number
      };
      
      setViewingUserInfo(userInfo);
      console.log('👀 관람 사용자 정보:', userInfo);
      
    } catch (error) {
      console.error('관람 사용자 정보 로드 오류:', error);
      toast.error('관람 사용자 정보를 불러오는데 실패했습니다.');
    }
  };

  // 초대 링크 처리 함수
  const handleViewerInvite = async (token: string) => {
    try {
      console.log('초대 링크 처리 시작:', token);
      
      // 한글 지원 토큰 디코딩
      const base64Decoded = atob(token);
      const utf8Bytes = new Uint8Array([...base64Decoded].map(char => char.charCodeAt(0)));
      const jsonString = new TextDecoder().decode(utf8Bytes);
      const tokenData = JSON.parse(jsonString);
      console.log('디코딩된 토큰:', tokenData);
      
      // 토큰 만료 확인
      if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
        toast.error('초대 링크가 만료되었습니다.');
        return;
      }
      
      // 현재 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      
      // 자기 자신을 초대하는 경우 방지
      if (user.id === tokenData.quiz_owner_id) {
        toast.error('자신의 퀴즈는 공유할 수 없습니다.');
        return;
      }
      
      // 이미 등록된 관람자인지 확인
      const { data: existingViewer } = await supabase
        .from('quiz_viewers')
        .select('id')
        .eq('quiz_owner_id', tokenData.quiz_owner_id)
        .eq('viewer_id', user.id)
        .single();
      
      if (existingViewer) {
        toast.success(`이미 ${tokenData.owner_nickname}님의 퀴즈 관람자로 등록되어 있습니다!`);
      } else {
        // 새 관람자 등록
        const { error: insertError } = await supabase
          .from('quiz_viewers')
          .insert({
            quiz_owner_id: tokenData.quiz_owner_id,
            viewer_id: user.id
          });
        
        if (insertError) {
          console.error('관람자 등록 오류:', insertError);
          toast.error('관람자 등록 중 오류가 발생했습니다.');
          return;
        }
        
        toast.success(`🎉 ${tokenData.owner_nickname}님의 퀴즈 관람자로 등록되었습니다!`);
      }

      // 퀴즈 소유자의 학교 정보를 관심학교에 자동 등록
      try {
        const { data: ownerSchoolInfo } = await supabase
          .from('school_infos')
          .select('school_code, school_name')
          .eq('user_id', tokenData.quiz_owner_id)
          .single();

        if (ownerSchoolInfo) {
          // 관심학교 API를 통해 자동 등록 (중복 체크 포함)
          const response = await fetch('/api/interest-schools', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              school_code: ownerSchoolInfo.school_code,
              school_name: ownerSchoolInfo.school_name
            })
          });

          if (response.ok) {
            console.log(`${ownerSchoolInfo.school_name}이(가) 관심학교에 자동 등록되었습니다.`);
          } else if (response.status === 400) {
            // 이미 등록된 학교인 경우는 정상적인 상황
            console.log(`${ownerSchoolInfo.school_name}은(는) 이미 관심학교에 등록되어 있습니다.`);
          }
        }
      } catch (error) {
        console.error('관심학교 자동 등록 오류:', error);
        // 관심학교 등록 실패는 치명적이지 않으므로 사용자에게 오류 표시하지 않음
      }
      
      // URL에서 viewer_invite 파라미터 제거하고 해당 사용자의 퀴즈로 이동
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('viewer_invite');
      newUrl.searchParams.set('viewing', tokenData.quiz_owner_id);
      
      router.replace(newUrl.pathname + newUrl.search);
      
    } catch (error) {
      console.error('초대 링크 처리 오류:', error);
      toast.error('초대 링크 처리 중 오류가 발생했습니다.');
    }
  };

  // Fetch quiz for selected date
  const fetchQuiz = async () => {
    // 관람 모드일 때는 관람 사용자 정보와 선택된 날짜가 필요
    if (isViewingMode) {
      if (!viewingUserInfo || !selectedDate) return;
    } else {
      if (!userSchool || !selectedDate) return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 인증 토큰 가져오기
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        setError('로그인이 필요합니다.');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      
      // 관람 모드일 때는 관람 대상 사용자의 정보 사용
      if (isViewingMode && viewingUserId) {
        // 관람 대상 사용자의 학교 정보 가져오기
        const { data: viewingSchoolData } = await supabase
          .from('school_infos')
          .select('school_code, grade')
          .eq('user_id', viewingUserId)
          .single();
          
        if (!viewingSchoolData) {
          setError('관람 대상 사용자의 학교 정보를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }
        
        params.set('school_code', viewingSchoolData.school_code);
        params.set('grade', viewingSchoolData.grade?.toString() || '1');
        params.set('viewing_user_id', viewingUserId); // 관람 모드 표시
      } else {
        // 일반 모드 (내 퀴즈)
        params.set('school_code', userSchool.school_code);
        
        if (userSchool.grade) {
          params.set('grade', userSchool.grade.toString());
        } else {
          params.set('grade', '1');
        }
      }
      
      if (selectedDate) {
        params.set('date', selectedDate);
      } else {
        throw new Error('날짜가 선택되지 않았습니다');
      }
      
      const response = await fetch(`/.netlify/functions/quiz?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'Quiz not found') {
          setQuiz(null);
          setError(null); // 퀴즈가 없는 것은 에러가 아님
        } else {
          setError(data.error || '퀴즈를 불러오는데 실패했습니다.');
        }
      } else if (data.noMenu) {
        // 급식이 없는 날 처리
        setQuiz(null);
        setNoMenu(true);
        setNoMenuMessage(data.message || '해당 날짜에 급식 정보가 없습니다.');
        setError(null);
      } else if (data.quiz === null) {
        // 퀴즈가 없는 경우 - 에러 메시지 없이 처리
        setQuiz(null);
        setError(null);
      } else {
        setQuiz(data.quiz);
        
        // 급식 이미지 로드
        if (data.quiz?.meal_id) {
          console.log('🍽️ 퀴즈에서 meal_id 발견:', data.quiz.meal_id);
          fetchMealImage(data.quiz.meal_id);
        } else {
          console.log('🍽️ 퀴즈에 meal_id가 없음:', data.quiz);
          setMealImageUrl(null);
        }
        
        // 서버에서 반환하는 답변 상태 정보 처리
        if (data.alreadyAnswered && data.selectedOption !== undefined) {
          setSelectedOption(Number(data.selectedOption));
          setSubmitted(true);
          
          // 퀴즈 객체에 사용자 답변 정보 추가
          if (data.quiz) {
            setQuiz({
              ...data.quiz,
              user_answer: {
                selected_option: data.selectedOption,
                is_correct: data.isCorrect
              }
            });
          }
        } else {
          setSelectedOption(null);
          setSubmitted(false);
        }
      }
    } catch (err) {
      console.error('퀴즈 로드 오류:', err);
      setError('퀴즈를 불러오는데 실패했습니다.');
    } finally {
      // generatingQuiz가 true일 때는 로딩 상태를 유지
      if (!generatingQuiz) {
        setLoading(false);
      }
    }
  };

  // 급식 이미지 로드 함수
  const fetchMealImage = async (mealId: string) => {
    console.log('🍽️ 급식이미지 로드 시작:', mealId);
    try {
      const { data, error } = await supabase
        .from('meal_images')
        .select('image_url')
        .eq('meal_id', mealId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) {
        setMealImageUrl(null);
        return;
      }
      setMealImageUrl(data[0].image_url);
    } catch (err) {
      console.error('급식 이미지 로드 오류:', err);
      setMealImageUrl(null);
    }
  };

  // 모든 퀴즈 로드 함수
  const fetchAllQuiz = async () => {
    if (!universalSchoolCode || !universalGrade || !selectedDate) {
      console.log('🚫 모든 퀴즈 로드 조건 미충족:', { universalSchoolCode, universalGrade, selectedDate });
      return;
    }

    setLoading(true);
    setError('');
    setQuiz(null);
    setSelectedOption(null);
    setSubmitted(false);
    setMealImageUrl(null);

    try {
      console.log('🔍 모든 퀴즈 로드 시작:', { 
        school_code: universalSchoolCode, 
        grade: universalGrade, 
        date: selectedDate 
      });

      // 인증 토큰 가져오기
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        setError('로그인이 필요합니다.');
        setLoading(false);
        return;
      }

      // 모든 퀴즈 API 호출
      const response = await fetch(`/api/all-quiz?school_code=${universalSchoolCode}&grade=${universalGrade}&date=${selectedDate}&limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.quizzes && data.quizzes.length > 0) {
          const loadedQuiz = data.quizzes[0];
          setQuiz(loadedQuiz);
          
          // 급식 이미지 로드
          if (loadedQuiz.meal_id) {
            await fetchMealImage(loadedQuiz.meal_id);
          }
          
          console.log('✅ 모든 퀴즈 로드 성공:', loadedQuiz.id);
        } else {
          setError('해당 조건의 퀴즈가 없습니다.');
          console.log('📭 퀴즈 없음:', { school_code: universalSchoolCode, grade: universalGrade, date: selectedDate });
        }
      } else {
        setError(data.error || '퀴즈 로드에 실패했습니다.');
        console.error('❌ 모든 퀴즈 로드 실패:', data);
      }
    } catch (err) {
      console.error('모든 퀴즈 로드 오류:', err);
      setError('퀴즈 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 오답 신고 처리
  const handleReportQuiz = async () => {
    if (!quiz || reportingQuiz) return;
    
    setReportingQuiz(true);
    toast.loading('오답 신고를 처리 중입니다...', { id: 'report-loading' });
    
    try {
      // 인증 토큰 가져오기
      const session = await supabase.auth.getSession();
      if (!session?.data?.session?.access_token) {
        toast.error('로그인이 필요합니다.', { id: 'report-loading' });
        return;
      }
      
      const response = await fetch('/.netlify/functions/quiz/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          quiz_id: quiz.id,
          reason: '오답 가능성 신고'
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        toast.error(result.error, { id: 'report-loading' });
      } else {
        toast.success('오답 신고가 접수되었습니다. AI가 검증 중입니다...', { id: 'report-loading' });
        // 퀴즈 상태 새로고침
        fetchQuiz();
        
        // 캘린더 데이터 새로고침 (오답신고 처리 후 달력 업데이트)
        if (typeof (window as any).refreshQuizCalendar === 'function') {
          console.log('🔄 오답신고 후 캘린더 새로고침 호출');
          // 약간의 지연 후 새로고침 (모바일 브라우저 호환성)
          setTimeout(() => {
            (window as any).refreshQuizCalendar();
          }, 500);
        }
      }
    } catch (error) {
      console.error('오답 신고 오류:', error);
      toast.error('신고 처리 중 오류가 발생했습니다.', { id: 'report-loading' });
    } finally {
      setReportingQuiz(false);
    }
  };

  // Submit answer
  const submitAnswer = async () => {
    if (!quiz || selectedOption === null || submitting) return;
    
    setSubmitting(true);
    
    try {
      // 디버깅: quiz 상태 확인
      console.log('🔍 Quiz 상태 확인:', {
        quiz: quiz,
        quiz_id: quiz?.id,
        selectedOption: selectedOption,
        quiz_exists: !!quiz,
        isAllQuizModal: isAllQuizModalOpen
      });
      
      // 인증 토큰 가져오기
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      // 응답 시간 계산 (초 단위)
      const answerTime = Math.floor(Date.now() / 1000);
      
      const requestData = {
        quiz_id: quiz.id,
        selected_option: selectedOption,
        answer_time: answerTime
      };
      
      // 디버깅: 전송할 데이터 확인
      console.log('📤 전송할 데이터:', requestData);
      console.log('📤 JSON 문자열:', JSON.stringify(requestData));

      // 모든 퀴즈 모달에서는 새로운 API 사용
      const apiUrl = isAllQuizModalOpen ? '/api/all-quiz' : '/.netlify/functions/quiz/answer';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify(requestData),
      });
      
      const data = await response.json();
      
      console.log('📥 서버 응답:', data);
    
    if (response.ok && data.success) {
      setSubmitted(true);
      setQuiz(prev => prev ? {
        ...prev,
        correct_answer: data.correctAnswer,
        explanation: data.explanation,
        user_answer: {
          selected_option: selectedOption,
          is_correct: data.isCorrect
        }
      } : null);
      
      console.log('✅ 퀴즈 상태 업데이트 완료:', {
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        selectedOption: selectedOption
      });
      
      // 캘린더 데이터 새로고침 (리얼타임 현황판 업데이트)
      if (typeof (window as any).refreshQuizCalendar === 'function') {
        console.log('🔄 캘린더 새로고침 호출');
        (window as any).refreshQuizCalendar();
      }
      
      // 토스트 메시지 제거 - 페이지 내 메시지만 사용
    } else {
      console.error('❌ 서버 응답 오류:', data);
      // 이미 답변한 퀴즈인 경우 토스트 메시지 제거
      if (data.error !== '이미 답변한 퀴즈입니다.') {
        toast.error(data.error || '답안 제출에 실패했습니다.');
      }
    }
  } catch (err) {
      console.error('답안 제출 오류:', err);
      toast.error('답안 제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // Manual quiz generation
  const handleManualQuizGenerate = async () => {
    if (!userSchool || !selectedDate) return;
    
    setGeneratingQuiz(true);
    setError(null);
    
    try {
      // 인증 토큰 가져오기
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        setError('로그인이 필요합니다.');
        setGeneratingQuiz(false);
        return;
      }

      // 기존 quiz Netlify Function을 POST 방식으로 호출
      const response = await fetch('/.netlify/functions/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          school_code: userSchool.school_code,
          grade: userSchool.grade,
          date: selectedDate,
          action: 'generate'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.noMenu) {
          // 급식 정보가 없는 경우
          setNoMenu(true);
          setNoMenuMessage(data.message || '해당 날짜에 급식 정보가 없습니다.');
          setQuiz(null);
          // toast.info(data.message || '해당 날짜에 급식 정보가 없습니다.');
        } else {
          // 퀴즈 다시 로드
          await fetchQuiz();
        }
      } else {
        console.error('퀴즈 생성 실패:', data);
        setError(data.error || '퀴즈 생성에 실패했습니다.');
        // toast.error(data.error || '퀴즈 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('퀴즈 생성 오류:', err);
      setError('퀴즈 생성에 실패했습니다.');
      // toast.error('퀴즈 생성에 실패했습니다.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // Date change handler
  const handleDateChange = (date: string | null | undefined) => {
    if (date && typeof date === 'string') {
      setSelectedDate(date);
      
      const params = new URLSearchParams(window.location.search);
      params.set('date', date);
      
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  };

  // Date formatting
  const formatDateForDisplay = (date: Date | null): { month: number, day: number, weekday: string } => {
    if (!date || isNaN(date.getTime())) {
      const today = new Date();
      return {
        month: today.getMonth() + 1,
        day: today.getDate(),
        weekday: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()]
      };
    }
    
    return {
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
    };
  };

  // Safe date formatting
  const safeFormatDate = (date: Date | null | undefined): string => {
    if (!date || isNaN(date.getTime())) {
      return getCurrentDate();
    }
    
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (err) {
      console.error('날짜 포맷팅 오류:', err);
      return getCurrentDate();
    }
  };

  // Generate 7-day date range
  const getDateRange = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    
    try {
      for (let i = -3; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const formatted = safeFormatDate(date);
        if (formatted) dates.push(formatted);
      }
    } catch (err) {
      console.error('날짜 범위 생성 오류:', err);
      const todayFormatted = safeFormatDate(today);
      if (todayFormatted) dates.push(todayFormatted);
    }
    
    return dates;
  };

  // Fetch quiz when date, user school, or viewing mode changes
  useEffect(() => {
    if (selectedDate && !userLoading) {
      // 관람 모드일 때는 viewingUserInfo가 필요, 일반 모드일 때는 userSchool이 필요
      const canFetch = isViewingMode ? viewingUserInfo : userSchool;
      
      if (canFetch) {
        // 날짜가 변경되면 모든 상태 초기화
        setNoMenu(false);
        setNoMenuMessage('');
        setGeneratingQuiz(false); // 퀴즈 생성 상태 초기화
        setQuiz(null); // 이전 퀴즈 데이터 초기화
        setSelectedOption(null); // 선택된 옵션 초기화
        setSubmitted(false); // 제출 상태 초기화
        fetchQuiz();
      }
    }
  }, [selectedDate, userSchool, userLoading, isViewingMode, viewingUserInfo]);

  return (
    <>
      {/* @ts-ignore - Next.js styled-jsx 타입 오류 무시 */}
      <style jsx>{styles}</style>

      <div className="max-w-4xl mx-auto">
        {/* 학교 정보 헤더 및 관심퀴즈 드롭다운 */}
        <SchoolInfoHeader
          userSchool={userSchool}
          isViewingMode={isViewingMode}
          viewingUserInfo={viewingUserInfo}
        />

        {/* 날짜 선택 및 퀴즈 버튼 영역 */}
        <div className="flex items-center justify-between mb-4">
          {/* 날짜 선택 - DateNavigator 컴포넌트 사용 */}
          <DateNavigator 
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
          
          {/* 모든 퀴즈 풀어보기 버튼 */}
          <button
            onClick={() => setIsAllQuizModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
          >
            <span>🧩</span>
            <span>모든 퀴즈 풀어보기</span>
          </button>
        </div>

        {/* 퀴즈 콘텐츠 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
              <p className="mt-4 text-gray-600">퀴즈를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-red-600 mb-4">{error}</p>
              <QuizGenerateButton
                isGenerating={generatingQuiz}
                onClick={handleManualQuizGenerate}
                disabled={isViewingMode}
              />
              <p className="text-sm text-gray-500 mt-4">
                또는 다른 날짜를 선택해보세요.
              </p>
            </div>
          ) : quiz ? (
            <div className="quiz-container">
              {/* 퀴즈 문제 */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">오늘의 퀴즈</h3>
                <p className="text-gray-700 dark:text-gray-200">{quiz.question}</p>
              </div>
              
              {/* 퀴즈 옵션 및 제출 버튼 */}
              <QuizOptionsSection
                quiz={quiz}
                selectedOption={selectedOption}
                submitted={submitted}
                submitting={submitting}
                isViewingMode={isViewingMode}
                mealImageUrl={mealImageUrl}
                onOptionSelect={setSelectedOption}
                onSubmitAnswer={submitAnswer}
              />
              
              {/* 퀴즈 결과 */}
              {submitted && (
                <QuizResultSection
                  quiz={quiz}
                  isViewingMode={isViewingMode}
                  reportingQuiz={reportingQuiz}
                  mealImageUrl={mealImageUrl}
                  onReportQuiz={handleReportQuiz}
                  isAllQuizModal={false}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-10">
              {noMenu ? (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-lg shadow-md text-center">
                  <div className="text-5xl mb-2">🏫</div>
                  <h3 className="text-lg font-bold text-amber-700 mb-2">오늘은 쉬는 날!</h3>
                  <p className="text-amber-600">{noMenuMessage}</p>
                </div>
              ) : generatingQuiz ? (
                <div className="py-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      {/* 급식판 애니메이션 */}
                      <div className="w-24 h-24 bg-orange-100 rounded-full border-4 border-orange-300 animate-pulse flex items-center justify-center relative overflow-hidden">
                        <div className="w-16 h-16 bg-white rounded-full shadow-inner flex items-center justify-center">
                          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      </div>
                      <div className="absolute -right-2 -top-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white animate-bounce">
                        <span className="text-xs">AI</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 font-medium mb-2">급식 퀴즈 생성중...</p>
                  <p className="text-sm text-gray-500">AI가 오늘 먹은 급식메뉴로 <br />재미있는 퀴즈를 만들고 있어요!</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">퀴즈가 아직 없네요. AI로 퀴즈 만들고 먼저 풀어보세요!</p>
                  <QuizGenerateButton
                    isGenerating={false}
                    onClick={handleManualQuizGenerate}
                    disabled={isViewingMode}
                  />
                </>
              )}
            </div>
          )}
        </div>
        
        {/* 퀴즈 챌린지 현황 달력 */}
        <QuizChallengeCalendar 
          currentQuizDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
            // 구독 모드일 때는 viewing 파라미터 유지
            if (isViewingMode && viewingUserId) {
              router.push(`/quiz?viewing=${viewingUserId}&date=${date}`);
            } else {
              router.push(`/quiz?date=${date}`);
            }
          }}
          onRefreshNeeded={() => {
            // 캘린더 새로고침이 필요할 때 호출되는 콜백
            console.log('🔄 캘린더 새로고침 콜백 호출됨');
          }}
          onMonthChange={(month) => {
            // 캘린더 월 변경 시 히스토리 월도 동시 업데이트
            console.log('📅 캘린더 월 변경 감지:', month);
            setCalendarMonth(month);
          }}
          viewingUserId={isViewingMode ? viewingUserId : undefined}
        />
        
        {/* 퀴즈 공유 버튼 - 월간 현황판 바로 아래 배치 */}
        {userSchool?.school_name && (
          <QuizShareButton
            userId={userSchool.user_id || ''}
            schoolName={userSchool.school_name}
            userNickname={userSchool.nickname}
            userGrade={typeof userSchool.grade === 'string' ? parseInt(userSchool.grade) : userSchool.grade}
            userClass={typeof userSchool.class === 'string' ? parseInt(userSchool.class) : userSchool.class}
            className="mt-6 mb-6"
          />
        )}
        
        {/* 장원 히스토리 - 무한 루프 수정 완료 */}
        <ChampionHistory 
          currentMonth={calendarMonth} 
          viewingUserId={isViewingMode ? viewingUserId : undefined}
        />
        
        {/* 모든 퀴즈 모달 */}
        {isAllQuizModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
              {/* 모달 헤더 */}
              <div className="relative p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                    ✨ 모든 퀴즈 풀어보기 ✨
                  </h2>
                  <p className="text-sm text-gray-600 font-medium">
                    다양한 날짜의 급식 퀴즈를 자유롭게 도전해보세요!
                  </p>
                </div>
                
                
                <button
                  onClick={() => setIsAllQuizModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white/50 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* 모달 내용 */}
              <div className="flex-1 p-6 overflow-y-auto">
                {/* 날짜 선택기, 학교학년 선택기, 학급 선택 드롭다운 - 2줄 레이아웃 */}
                <div className="mb-6">
                  {/* 첫 번째 줄: 날짜 선택기 */}
                  <div className="flex justify-center mb-4">
                    <DateNavigator 
                      selectedDate={selectedDate}
                      onDateChange={handleDateChange}
                    />
                  </div>
                  
                  {/* 두 번째 줄: 학교학년 선택기 + 학급 선택 드롭다운 */}
                  <div className="flex items-center justify-center gap-4">
                    {/* 학교학년 선택기 */}
                    <SchoolGradeSelector
                      schoolName={universalSchoolName}
                      grade={universalGrade}
                      schoolType={universalSchoolType}
                      onGradeChange={handleUniversalGradeChange}
                      onSchoolChange={handleUniversalSchoolChange}
                    />
                    
                    {/* 학급 선택 드롭다운 */}
                    <div className="relative">
                      <select
                        value={selectedSchoolLevel}
                        onChange={(e) => setSelectedSchoolLevel(e.target.value as 'elementary' | 'middle' | 'high')}
                        className="appearance-none bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded px-3 py-2 pr-7 text-sm font-medium text-gray-700 hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors shadow-sm"
                      >
                        <option value="elementary">초등학교</option>
                        <option value="middle">중학교</option>
                        <option value="high">고등학교</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 퀴즈 콘텐츠 */}
                <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
                  {loading ? (
                    <div className="text-center py-10">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
                      <p className="mt-4 text-gray-600">퀴즈를 불러오는 중...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-10">
                      <p className="text-red-600 mb-4">{error}</p>
                      <QuizGenerateButton
                        isGenerating={generatingQuiz}
                        onClick={handleManualQuizGenerate}
                        disabled={isViewingMode}
                      />
                      <p className="text-sm text-gray-500 mt-4">
                        또는 다른 날짜를 선택해보세요.
                      </p>
                    </div>
                  ) : quiz ? (
                    <div className="quiz-container">
                      {/* 퀴즈 문제 */}
                      <div className="mb-6">
                        <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">오늘의 퀴즈</h3>
                        <p className="text-gray-700 dark:text-gray-200">{quiz.question}</p>
                      </div>
                      
                      {/* 퀴즈 옵션 및 제출 버튼 */}
                      <QuizOptionsSection
                        quiz={quiz}
                        selectedOption={selectedOption}
                        submitted={submitted}
                        submitting={submitting}
                        isViewingMode={isViewingMode}
                        mealImageUrl={mealImageUrl}
                        onOptionSelect={setSelectedOption}
                        onSubmitAnswer={submitAnswer}
                      />
                      
                      {/* 퀴즈 결과 */}
                      {submitted && (
                        <QuizResultSection
                          quiz={quiz}
                          isViewingMode={isViewingMode}
                          reportingQuiz={reportingQuiz}
                          mealImageUrl={mealImageUrl}
                          onReportQuiz={handleReportQuiz}
                          isAllQuizModal={true}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      {noMenu ? (
                        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-lg shadow-md text-center">
                          <div className="text-5xl mb-2">🏫</div>
                          <h3 className="text-lg font-bold text-amber-700 mb-2">오늘은 쉬는 날!</h3>
                          <p className="text-amber-600">{noMenuMessage}</p>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">🧩</div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-4">퀴즈가 없습니다</h3>
                          <p className="text-gray-600 mb-8">
                            선택한 날짜에 퀴즈가 없습니다. 다른 날짜를 선택해보세요!
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
