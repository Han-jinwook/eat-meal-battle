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
  const [noMenu, setNoMenu] = useState<boolean>(false);
  const [noMenuMessage, setNoMenuMessage] = useState<string>('');
  
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  const schoolMode = useSchoolMode(userSchool);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // Handle date parameter from URL
  useEffect(() => {
    try {
      const dateParam = searchParams?.get('date');
      
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

  // Fetch quiz for selected date
  const fetchQuiz = async () => {
    if (!userSchool || !selectedDate) return;
    
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
      params.set('school_code', userSchool.school_code);
      
      if (userSchool.grade) {
        params.set('grade', userSchool.grade.toString());
      } else {
        params.set('grade', '1');
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

  // Fetch quiz when date or user school changes
  useEffect(() => {
    if (selectedDate && userSchool && !userLoading) {
      // 날짜가 변경되면 모든 상태 초기화
      setNoMenu(false);
      setNoMenuMessage('');
      setGeneratingQuiz(false); // 퀴즈 생성 상태 초기화
      setQuiz(null); // 이전 퀴즈 데이터 초기화
      setSelectedOption(null); // 선택된 옵션 초기화
      setSubmitted(false); // 제출 상태 초기화
      fetchQuiz();
    }
  }, [selectedDate, userSchool, userLoading]);

  // 관심학교 모드일 때 접근 차단
  if (!schoolMode.isStudentMode && userSchool) {
    return (
      <>
        {/* @ts-ignore - Next.js styled-jsx 타입 오류 무시 */}
        <style jsx>{styles}</style>
        
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <div className="text-blue-600 text-5xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-blue-800 mb-3">
              개인 기록과 성취 관리를 위한 공간인 퀴즈 페이지는<br />
              내 학교에서만 이용 가능합니다!
            </h2>
            <p className="text-blue-700 mb-6 leading-relaxed">
              (퀴즈를 푼 학생이 초대하면 볼 수 있음)
            </p>
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
        {/* 학교 정보 표시 - 급식페이지와 동일한 UI */}
        {userSchool ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
              {userSchool.school_name || '학교 정보 없음'}
            </span>
            {(userSchool.grade || userSchool.class) && (
              <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                {userSchool.grade ? `${userSchool.grade}학년` : ''}
                {userSchool.class ? ` ${userSchool.class}반` : ''}
              </span>
            )}
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
                        if (!submitted) {
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
        
        {/* 장원 히스토리 - 무한 루프 수정 완료 */}
        <ChampionHistory currentMonth={new Date()} />
      </div>
    </>
  );
}
