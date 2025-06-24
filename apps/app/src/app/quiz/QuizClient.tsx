"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';

// Quiz 타입 정의
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
};

export default function QuizClient() {
  // CSS 스타일 정의
  const styles = `
    .date-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
    }
    
    .date-button {
      padding: 0.5rem;
      border-radius: 0.375rem;
      text-align: center;
      transition: all 0.2s;
    }
    
    .date-button:hover {
      background-color: #e5e7eb;
    }
    
    .date-button.selected {
      background-color: #dbeafe;
      color: #1d4ed8;
      font-weight: 600;
    }
  `;

  // 상태 관리
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  const supabase = useSupabaseClient();
  
  // URL에서 날짜 파라미터 처리
  useEffect(() => {
    const dateParam = searchParams?.get('date');
    if (dateParam && typeof dateParam === 'string') {
      setSelectedDate(dateParam);
    }
  }, [searchParams]);

  // 퀴즈 데이터 가져오기
  useEffect(() => {
    if (userSchool) {
      fetchQuiz();
    }
  }, [userSchool, selectedDate]);
  
  // 퀴즈 데이터 로드 함수
  const fetchQuiz = async () => {
    if (!userSchool) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // JWT 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('인증 세션이 없습니다. 로그인이 필요합니다.');
        setLoading(false);
        return;
      }
      
      // API 엔드포인트 구성
      const params = new URLSearchParams();
      
      // 안전하게 파라미터 추가
      if (userSchool.school_code) {
        params.set('school_code', String(userSchool.school_code));
      }
      
      if (userSchool.grade !== undefined && userSchool.grade !== null) {
        params.set('grade', String(userSchool.grade));
      }
      
      if (selectedDate) {
        params.set('date', selectedDate);
      }
      
      // 퀴즈 API 호출
      const response = await fetch(`/.netlify/functions/quiz?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '퀴즈를 가져오는데 실패했습니다');
      }
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setQuiz(null);
      } else {
        setQuiz(data.quiz);
        
        // 이미 답변한 경우 선택 옵션 설정
        if (data.quiz && typeof data.quiz === 'object') {
          // 데이터 타입 검사 추가
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
      console.error('퀴즈 데이터 로딩 오류:', err);
      setError(err instanceof Error ? err.message : '퀴즈 데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };
  
  // 퀴즈 답변 제출
  const submitAnswer = async () => {
    if (!quiz || selectedOption === null) return;
    
    try {
      // JWT 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('로그인이 필요합니다');
        return;
      }
      
      // 답변 시간 계산 (현재는 간단히 1초로 고정)
      const answer_time = 1;
      
      // API 호출
      const response = await fetch('/.netlify/functions/quiz/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          quiz_id: quiz.id,
          selected_option: selectedOption,
          answer_time
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '답변 제출에 실패했습니다');
      }
      
      const result = await response.json();
      
      if (result.error) {
        toast.error(result.error);
      } else {
        setSubmitted(true);
        toast.success('답변이 제출되었습니다');
        // 새로운 데이터 로드
        fetchQuiz();
      }
    } catch (err) {
      console.error('답변 제출 오류:', err);
      toast.error(err instanceof Error ? err.message : '답변 제출 중 오류가 발생했습니다');
    }
  };

  // 날짜 변경 핸들러
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    
    // URL 업데이트
    try {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.set('date', date);
      router.push(`/quiz?${params.toString()}`);
    } catch (err) {
      console.error('URL 파라미터 처리 오류:', err);
      router.push(`/quiz?date=${date}`);
    }
  };

  // 날짜 포맷팅
  const formatDateForDisplay = (date: Date): { month: number, day: number, weekday: string } => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: weekdays[date.getDay()]
    };
  };

  // 7일 날짜 범위 생성
  const getDateRange = () => {
    const dates = [];
    const today = new Date();
    
    // 오늘 포함 이전 3일
    for (let i = 3; i > 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      dates.push(formatApiDate(date));
    }
    
    // 오늘
    dates.push(formatApiDate(today));
    
    // 이후 3일
    for (let i = 1; i <= 3; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      dates.push(formatApiDate(date));
    }
    
    return dates;
  };

  return (
    <>
      <style jsx>{styles}</style>
      
      {/* 학교/학년/반 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900">{userSchool?.school_name || '학교'}</h1>
          <span className="text-md text-gray-600 ml-2">{userSchool?.grade}학년 {userSchool?.class_number}반</span>
        </div>
      </div>
      
      {/* 날짜 선택기 */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">날짜 선택</h2>
          <div className="date-grid">
            {getDateRange().map(date => {
              const dateObj = new Date(date);
              const { month, day, weekday } = formatDateForDisplay(dateObj);
              return (
                <button
                  key={date}
                  className={`date-button ${selectedDate === date ? 'selected' : ''}`}
                  onClick={() => handleDateChange(date)}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500">
                      {month}월 {day}일
                    </span>
                    <span className={`text-xs font-medium ${selectedDate === date ? 'text-blue-600' : 'text-gray-700'}`}>
                      {weekday}
                    </span>
                  </div>
                </button>
              );
            })}
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
            <p className="text-lg font-medium text-red-500">오류가 발생했습니다</p>
            <p className="mt-2 text-gray-600">{error}</p>
          </div>
        ) : !quiz ? (
          <div className="text-center py-10">
            <p className="text-lg font-medium text-gray-900">퀴즈가 없습니다</p>
            <p className="mt-2 text-gray-600">선택한 날짜에 해당하는 퀴즈가 없습니다.</p>
          </div>
        ) : (
          <div className="quiz-container">
            {/* 퀴즈 문제 */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">오늘의 퀴즈</h3>
              <p className="text-gray-700">{quiz.question}</p>
            </div>
            
            {/* 퀴즈 보기 */}
            <div className="space-y-3 mb-6">
              {quiz.options.map((option, index) => {
                // 제출 후 정답 여부 표시를 위한 클래스
                let optionClass = "border rounded-lg p-4 transition-colors cursor-pointer ";
                
                if (submitted && quiz.correct_answer !== undefined) {
                  if (index + 1 === quiz.correct_answer) {
                    // 정답
                    optionClass += "bg-green-50 border-green-300";
                  } else if (index + 1 === selectedOption) {
                    // 내가 고른 오답
                    optionClass += "bg-red-50 border-red-300";
                  } else {
                    // 나머지 보기
                    optionClass += "border-gray-200";
                  }
                } else {
                  // 제출 전: 선택한 옵션 강조
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
                      
                      {/* 제출 후 정답/오답 아이콘 */}
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
                  정답 제출하기
                </button>
              ) : (
                <div>
                  {quiz.correct_answer !== undefined && quiz.user_answer && (
                    <div className="text-center">
                      <p className="text-lg font-semibold mb-2">
                        {quiz.user_answer.is_correct ? (
                          <span className="text-green-600">정답입니다! 🎉</span>
                        ) : (
                          <span className="text-red-600">아쉽게도 오답입니다.</span>
                        )}
                      </p>
                      
                      {/* 해설 */}
                      {quiz.explanation && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">💡 해설</p>
                          <p className="text-gray-600">{quiz.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
