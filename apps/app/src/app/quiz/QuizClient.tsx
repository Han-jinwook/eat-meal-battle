"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'react-hot-toast';

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
  const [generatingQuiz, setGeneratingQuiz] = useState<boolean>(false);
  const [noMenu, setNoMenu] = useState<boolean>(false);
  const [noMenuMessage, setNoMenuMessage] = useState<string>('');
  
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
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
          console.log(`${selectedDate} 날짜에 퀴즈가 없습니다.`);
          setQuiz(null);
          setError(null); // 퀴즈가 없는 것은 에러가 아님
        } else {
          setError(data.error || '퀴즈를 불러오는데 실패했습니다.');
        }
      } else if (data.noMenu) {
        // 급식이 없는 날 처리
        console.log(`${selectedDate} 날짜에 급식이 없습니다:`, data.message);
        setQuiz(null);
        setNoMenu(true);
        setNoMenuMessage(data.message || '해당 날짜에 급식 정보가 없습니다.');
        setError(null);
      } else {
        setQuiz(data.quiz);
        
        if (data.quiz && typeof data.quiz === 'object') {
          const quizData = data.quiz as Quiz;
          
          if (quizData.user_answer && 
              typeof quizData.user_answer === 'object' && 
              quizData.user_answer.selected_option !== undefined) {
            setSelectedOption(Number(quizData.user_answer.selected_option));
            setSubmitted(true);
          } else {
            setSelectedOption(null);
            setSubmitted(false);
          }
        } else {
          setQuiz(null);
          setError('퀴즈 데이터 형식이 올바르지 않습니다.');
        }
      }
    } catch (err) {
      console.error('퀴즈 로드 오류:', err);
      setError('퀴즈를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Submit answer
  const submitAnswer = async () => {
    if (!quiz || selectedOption === null) return;
    
    try {
      // 인증 토큰 가져오기
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      const response = await fetch('/.netlify/functions/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          quizId: quiz.id,
          selectedOption: selectedOption,
          action: 'submit'
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSubmitted(true);
        setQuiz(prev => prev ? {
          ...prev,
          user_answer: {
            selected_option: selectedOption,
            is_correct: data.isCorrect
          }
        } : null);
        toast.success(data.isCorrect ? '정답입니다!' : '틀렸습니다. 다음에 다시 도전해보세요!');
      } else {
        toast.error(data.error || '답안 제출에 실패했습니다.');
      }
    } catch (err) {
      console.error('답안 제출 오류:', err);
      toast.error('답안 제출에 실패했습니다.');
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
          console.log('급식 정보 없음:', data.message);
          setNoMenu(true);
          setNoMenuMessage(data.message || '해당 날짜에 급식 정보가 없습니다.');
          setQuiz(null);
          toast.info(data.message || '해당 날짜에 급식 정보가 없습니다.');
        } else {
          toast.success('퀴즈가 생성되었습니다!');
          // 퀴즈 다시 로드
          await fetchQuiz();
        }
      } else {
        console.error('퀴즈 생성 실패:', data);
        setError(data.error || '퀴즈 생성에 실패했습니다.');
        toast.error(data.error || '퀴즈 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('퀴즈 생성 오류:', err);
      setError('퀴즈 생성에 실패했습니다.');
      toast.error('퀴즈 생성에 실패했습니다.');
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
      // 날짜가 변경되면 상태 초기화
      setNoMenu(false);
      setNoMenuMessage('');
      fetchQuiz();
    }
  }, [selectedDate, userSchool, userLoading]);

  return (
    <>
      {/* @ts-ignore - Next.js styled-jsx 타입 오류 무시 */}
      <style jsx>{styles}</style>

      <div className="max-w-4xl mx-auto">
        {/* 학교 정보 표시 - 급식페이지와 동일한 UI */}
        {userSchool ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
              {userSchool.school_name}
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

        {/* 날짜 선택 - 급식페이지와 동일한 UI */}
        <div className="mb-2 mt-1">
          <input
            type="date"
            id="quiz-date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="sr-only" // 화면에서 숨김
          />
          <button 
            onClick={() => {
              const dateInput = document.getElementById('quiz-date') as HTMLInputElement;
              dateInput?.showPicker?.();
            }} 
            className="w-full flex items-center justify-between px-2 py-1.5 bg-blue-50 rounded border border-blue-100 shadow-sm"
          >
            {selectedDate && (() => {
              const date = new Date(selectedDate);
              if (!isNaN(date.getTime())) {
                const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const weekday = weekdays[date.getDay()];
                
                return (
                  <>
                    <div className="flex items-center">
                      <span className="text-blue-600 mr-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {`${year}-${month}-${day}`}
                      </span>
                      <span className="ml-1 text-xs font-medium px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {weekday}
                      </span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                );
              }
              return selectedDate;
            })()}
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
              <button
                onClick={handleManualQuizGenerate}
                disabled={generatingQuiz}
                className={`px-4 py-2 rounded-lg font-medium ${
                  generatingQuiz
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {generatingQuiz ? '퀴즈 생성 중...' : '퀴즈 생성하기'}
              </button>
              <p className="text-sm text-gray-500 mt-4">
                또는 다른 날짜를 선택해보세요.
              </p>
            </div>
          ) : quiz ? (
            <div className="quiz-container">
              {/* 퀴즈 문제 */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">오늘의 퀴즈</h3>
                <p className="text-gray-700">{quiz.question}</p>
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
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-800 text-sm font-medium mr-3">
                          {index + 1}
                        </span>
                        <span>{option}</span>
                        
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
                    disabled={selectedOption === null}
                    className={`w-full py-3 px-4 rounded-lg font-medium ${selectedOption === null
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    onClick={submitAnswer}
                  >
                    정답 제출
                  </button>
                ) : (
                  <div>
                    {quiz.correct_answer !== undefined && quiz.user_answer && (
                      <div className="text-center">
                        <p className="text-lg font-semibold mb-2">
                          {quiz.user_answer.is_correct ? (
                            <span className="text-green-600">정답입니다! 🎉</span>
                          ) : (
                            <span className="text-red-600">틀렸습니다. 다음에 다시 도전해보세요!</span>
                          )}
                        </p>
                        
                        {/* 설명 */}
                        {quiz.explanation && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-1">💡 설명</p>
                            <p className="text-gray-600">{quiz.explanation}</p>
                          </div>
                        )}
                      </div>
                    )}
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
                  <p className="text-gray-600 mb-4">퀴즈가 없습니다.</p>
                  <button
                    onClick={handleManualQuizGenerate}
                    className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    퀴즈 생성하기
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
