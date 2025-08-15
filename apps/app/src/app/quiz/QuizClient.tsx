"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'react-hot-toast';
import QuizChallengeCalendar from '@/components/QuizChallengeCalendar';
import ChampionHistory from '@/components/ChampionHistory';
import DateNavigator from '@/components/DateNavigator';
import { useSchoolMode } from '@/hooks/useSchoolMode';
import QuizShareButton from '@/components/QuizShareButton';
import QuizDropdown from '@/components/QuizDropdown';

// Quiz type definition
type Quiz = {
  id: string;
  question: string;
  options: string[];
  correct_answer?: number;
  explanation?: string;
  meal_date: string;
  meal_id?: string;
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
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [generatingQuiz, setGeneratingQuiz] = useState<boolean>(false);
  const [reportingQuiz, setReportingQuiz] = useState<boolean>(false);
  const [noMenu, setNoMenu] = useState<boolean>(false);
  const [noMenuMessage, setNoMenuMessage] = useState<string>('');
  
  // 관람 모드 상태
  const [isViewingMode, setIsViewingMode] = useState<boolean>(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingUserInfo, setViewingUserInfo] = useState<{
    nickname: string;
    school_name: string;
    grade?: number;
    class?: number;
  } | null>(null);
  
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  const schoolMode = useSchoolMode(userSchool);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
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
        .select('school_name, grade, class')
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
        class: schoolData?.class
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
        quiz_exists: !!quiz
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

      const response = await fetch('/.netlify/functions/quiz/answer', {
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

  // 관심학교 모드일 때 접근 차단 (학생/비학생 구분 없이)
  if (schoolMode.selectedInterestSchool) {
    return (
      <>
        {/* @ts-ignore - Next.js styled-jsx 타입 오류 무시 */}
        <style jsx>{styles}</style>
        
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
            <div className="text-amber-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-amber-800 mb-3">
              주의: 개인 기록과 성취 관리를 위한 퀴즈 페이지는<br />
              내 학교에서만 이용 가능합니다!
            </h2>
            <p className="text-amber-700 mb-4 leading-relaxed">
              현재 <strong>{schoolMode.selectedInterestSchool.school_name}</strong> 관심학교 모드입니다.
            </p>
            <button
              onClick={() => {
                window.history.back(); // 직전 페이지로 돌아가기
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              직전으로 돌아가기
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* @ts-ignore - Next.js styled-jsx 타입 오류 무시 */}
      <style jsx>{styles}</style>

      <div className="max-w-4xl mx-auto">
        {/* 학교 정보 헤더 및 관심퀴즈 드롭다운 */}
        {(userSchool || isViewingMode) ? (
          <div className={`shadow-sm rounded p-2 mb-3 border-l-2 flex items-center justify-between ${
            isViewingMode 
              ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-500' 
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500'
          }`}>
            {/* 왼쪽: 학교 정보 또는 관람 정보 */}
            <div className="flex items-center">
              {isViewingMode && viewingUserInfo ? (
                <>
                  <span className="text-purple-600 mr-2">👀</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-base font-semibold">
                    {viewingUserInfo.nickname}님의 퀴즈 관람 중
                  </span>
                  <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                    {viewingUserInfo.school_name}
                    {viewingUserInfo.grade && ` ${viewingUserInfo.grade}학년`}
                    {viewingUserInfo.class && ` ${viewingUserInfo.class}반`}
                  </span>
                </>
              ) : userSchool ? (
                <>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
                    {userSchool.school_name || '학교 정보 없음'}
                  </span>
                  {(userSchool.grade || userSchool.class) && (
                    <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                      {userSchool.grade ? `${userSchool.grade}학년` : ''}
                      {userSchool.class ? ` ${userSchool.class}반` : ''}
                    </span>
                  )}
                </>
              ) : null}
            </div>
            
            {/* 오른쪽: 관심퀴즈 드롭다운 또는 관람 모드 종료 버튼 */}
            {isViewingMode ? (
              <button
                onClick={() => {
                  const newUrl = new URL(window.location.href);
                  newUrl.searchParams.delete('viewing');
                  router.replace(newUrl.pathname + newUrl.search);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300 rounded-md hover:bg-white transition-colors text-sm font-medium shadow-sm"
              >
                <span>관람 종료</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : userSchool ? (
              <QuizDropdown userId={userSchool.user_id || ''} />
            ) : null}
          </div>
        ) : (
          <div className="mb-6"></div>
        )}

        {/* 날짜 선택 - DateNavigator 컴포넌트 사용 */}
        <DateNavigator 
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
        />

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
              <button
                onClick={handleManualQuizGenerate}
                disabled={generatingQuiz}
                className={`px-4 py-2 rounded-lg font-medium ${
                  generatingQuiz
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {generatingQuiz ? '퀴즈 생성 중...' : '학년별 맞춤 AI퀴즈 생성하기'}
              </button>
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
              
              {/* 퀴즈 보기 */}
              <div className="space-y-3 mb-6">
                {quiz.options.map((option, index) => {
                  let optionClass = "border rounded-lg p-4 transition-colors cursor-pointer ";
                  
                  if (submitted && quiz.correct_answer !== undefined) {
                    if (index + 1 === quiz.correct_answer) {
                      optionClass += "bg-green-50 border-green-300";
                    } else if (index + 1 === selectedOption) {
                      optionClass += "bg-red-50 border-red-300";
                    } else {
                      optionClass += "border-gray-200";
                    }
                  } else {
                    optionClass += selectedOption === index + 1
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50 border-gray-200";
                  }
                  
                  return (
                    <div
                      key={index}
                      className={optionClass}
                      onClick={() => {
                        if (!submitted && !isViewingMode) {
                          setSelectedOption(index + 1);
                        }
                      }}
                    >
                      <div className="flex items-start">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-800 dark:text-gray-900 text-sm font-medium mr-3">
                          {index + 1}
                        </span>
                        <span className="dark:text-gray-100">{option}</span>
                        
                        {submitted && quiz.correct_answer !== undefined && (
                          <div className="ml-auto">
                            {index + 1 === quiz.correct_answer ? (
                              <span className="text-green-500">✓</span>
                            ) : index + 1 === selectedOption ? (
                              <span className="text-red-500">✗</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 제출 버튼 또는 결과 */}
              <div>
                {!submitted ? (
                  isViewingMode ? (
                    <div className="w-full py-3 px-4 rounded-lg font-medium bg-purple-100 text-purple-700 text-center border-2 border-purple-200">
                      👀 관람 모드에서는 답변을 제출할 수 없습니다
                    </div>
                  ) : (
                    <button
                      disabled={selectedOption === null || submitting}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                        selectedOption === null || submitting
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      onClick={submitAnswer}
                    >
                      {submitting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>정답제출 & AI채점 중</span>
                        </div>
                      ) : (
                        '정답 제출'
                      )}
                    </button>
                  )
                ) : (
                  <div>
                    <div className="text-center">
                      {/* 결과 메시지 */}
                      {quiz.user_answer && quiz.user_answer.is_correct !== undefined && (
                        <p className="text-lg font-semibold mb-2">
                          {quiz.user_answer.is_correct ? (
                            <span className="text-green-600">정답입니다! 🎉</span>
                          ) : (
                            <span className="text-red-600">틀렸습니다. 다음에 다시 도전해보세요!</span>
                          )}
                        </p>
                      )}
                      
                      {/* 설명 */}
                      {quiz.explanation && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">💡 설명</p>
                          <p className="text-gray-600">{quiz.explanation}</p>
                          
                          {/* 오답 신고 시스템 */}
                          {!isViewingMode && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              {/* 신고 상태별 UI */}
                              {quiz.report_status === 'verified_incorrect' ? (
                                // 오답 확정: 전원 정답 처리 안내 + AI 검증 결과 표시
                                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <span className="text-green-600 text-sm">✅</span>
                                  <div className="flex-1">
                                    <p className="text-sm text-green-700 font-medium mb-1">
                                      출제에 오류가 있어서 전원 맞춘걸로 처리합니다.
                                    </p>
                                    {quiz.ai_verification && (
                                      <details className="text-xs text-green-600">
                                        <summary className="cursor-pointer hover:text-green-800">
                                          AI 출제 검증 결과 보기
                                        </summary>
                                        <div className="mt-2 p-2 bg-white rounded border">
                                          <p className="text-xs text-gray-600 mb-1">
                                            AI 검증 신뢰도: {Math.round((quiz.ai_verification.confidence || 0) * 100)}%
                                          </p>
                                          <p className="text-sm">{quiz.ai_verification.reasoning}</p>
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                </div>
                               ) : quiz.report_status === 'verified_correct' ? (
                                // 정답 확정: 신고 기각 안내 + AI 검증 결과 표시
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <span className="text-blue-600 text-sm">ℹ️</span>
                                    <div className="flex-1">
                                      <p className="text-sm text-blue-700 font-medium mb-1">
                                        신고가 있었지만 출제 내용이 적절함이 확인되었습니다!
                                      </p>
                                      {quiz.ai_verification && (
                                        <details className="text-xs text-blue-600">
                                          <summary className="cursor-pointer hover:text-blue-800">
                                            AI 출제 검증 결과 보기
                                          </summary>
                                          <div className="mt-2 p-2 bg-white rounded border">
                                            <p className="text-xs text-gray-600 mb-1">
                                              AI 검증 신뢰도: {Math.round((quiz.ai_verification.confidence || 0) * 100)}%
                                            </p>
                                            <p className="text-sm">{quiz.ai_verification.reasoning}</p>
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    disabled
                                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                                  >
                                    <span>🚨</span>
                                    <span>오답신고</span>
                                  </button>
                                </div>
                              ) : quiz.report_status === 'pending' ? (
                                // 검증 중: 버튼 비활성화 + 대기 메시지
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <span className="text-yellow-600 text-sm">⏳</span>
                                    <p className="text-sm text-yellow-700 font-medium">
                                      오답 가능성이 있다고 신고 접수중입니다.
                                    </p>
                                  </div>
                                  <button
                                    disabled
                                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                                  >
                                    <span>🚨</span>
                                    <span>오답신고</span>
                                  </button>
                                </div>
                              ) : (
                                // 기본 상태: 신고 가능
                                <button
                                  onClick={handleReportQuiz}
                                  disabled={reportingQuiz}
                                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                                    reportingQuiz 
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                  }`}
                                >
                                  <span>{reportingQuiz ? '⏳' : '🚨'}</span>
                                  <span>{reportingQuiz ? '신고 처리중...' : '오답신고'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
                  <button
                    onClick={handleManualQuizGenerate}
                    className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    학년별 맞춤 AI퀴즈 생성하기
                  </button>
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
            router.push(`/quiz?date=${date}`);
          }}
          onRefreshNeeded={() => {}}
        />
        
        {/* 퀴즈 공유 버튼 - 월간 현황판 바로 아래 배치 */}
        {userSchool?.school_name && (
          <QuizShareButton
            userId={userSchool.user_id || ''}
            schoolName={userSchool.school_name}
            userNickname={userSchool.nickname}
            userGrade={userSchool.grade}
            userClass={userSchool.class}
            className="mt-6 mb-6"
          />
        )}
        
        {/* 장원 히스토리 - 무한 루프 수정 완료 */}
        <ChampionHistory currentMonth={new Date()} />
      </div>
    </>
  );
}
