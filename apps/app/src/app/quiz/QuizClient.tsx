"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';
import { createClient } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import QuizHeaderDatePickerOnly from './QuizHeaderDatePickerOnly';

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
  const supabase = createClient();
  
  // URL에서 날짜 파라미터 처리
  useEffect(() => {
    try {
      const dateParam = searchParams?.get('date');
      
      // 날짜 파라미터 유효성 검사
      if (dateParam && typeof dateParam === 'string') {
        // 날짜 형식 검증 - 엄격한 검증 추가
        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) || /^\d{8}$/.test(dateParam);
        
        if (isValidDate) {
          // 추가 유효성 검사: 실제 존재하는 날짜인지 확인
          try {
            // YYYY-MM-DD 형식인 경우
            if (dateParam.includes('-')) {
              const dateParts = dateParam.split('-');
              if (dateParts.length === 3) {
                const year = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1; // 0-based month
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
            // YYYYMMDD 형식인 경우
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
            
            // 유효하지 않은 날짜인 경우
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
        // 파라미터가 없으면 오늘 날짜 사용
        setSelectedDate(getCurrentDate());
      }
    } catch (err) {
      console.error('URL 파라미터 처리 오류:', err);
      setSelectedDate(getCurrentDate());
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
      if (userSchool && userSchool.school_code) {
        params.set('school_code', String(userSchool.school_code));
      } else {
        throw new Error('학교 코드가 없습니다');
      }
      
      if (userSchool && userSchool.grade !== undefined && userSchool.grade !== null) {
        params.set('grade', String(userSchool.grade));
      } else {
        params.set('grade', '1'); // 기본값 설정
      }
      
      // 날짜 형식 처리
      if (selectedDate) {
        try {
          // 하이픈 제거 처리
          let apiDate = selectedDate;
          // 문자열인지 확실하게 검증 후 replace 메서드 사용
          if (typeof apiDate === 'string') {
            // 하이픈이 있는 경우에만 replace 실행
            if (apiDate.includes('-')) {
              apiDate = apiDate.replace(/-/g, '');
            }
            params.set('date', apiDate);
          } else {
            console.warn('날짜가 문자열이 아닙니다:', apiDate);
            // 기본값으로 오늘 날짜 사용
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            params.set('date', `${year}${month}${day}`);
          }
        } catch (err) {
          console.error('날짜 형식 변환 오류:', err);
          // 현재 날짜 사용
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          params.set('date', `${year}${month}${day}`);
        }
      } else {
        // 날짜가 없으면 오늘 날짜 사용
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        params.set('date', `${year}${month}${day}`);
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
  const handleDateChange = (date: string | null | undefined) => {
    // 날짜 유효성 검사 강화
    if (!date || typeof date !== 'string') {
      console.error('유효하지 않은 날짜가 전달되었습니다:', date);
      return;
    }
    
    // 날짜 형식 검증
    const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(date) || /^\d{8}$/.test(date);
    if (!isValidFormat) {
      console.error('지원되지 않는 날짜 형식입니다:', date);
      return;
    }
    
    setSelectedDate(date);
    
    // URL 업데이트
    try {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.set('date', date);
      router.push(`/quiz?${params.toString()}`);
    } catch (err) {
      console.error('URL 파라미터 처리 오류:', err);
      try {
        // 예외 발생 시 기본 방법으로 시도
        router.push(`/quiz?date=${encodeURIComponent(date)}`);
      } catch (innerErr) {
        console.error('라우팅 오류:', innerErr);
      }
    }
  };

  // 날짜 포맷팅
  const formatDateForDisplay = (date: Date | null): { month: number, day: number, weekday: string } => {
    if (!date || isNaN(date.getTime())) {
      // 유효하지 않은 날짜인 경우 기본값 반환
      return {
        month: 1,
        day: 1,
        weekday: '-'
      };
    }
    
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: weekdays[date.getDay()]
    };
  };

  // 날짜 문자열을 안전하게 처리하는 함수
  const safeFormatDate = (date: Date | null | undefined): string => {
    // 날짜 객체 유효성 검사 강화
    if (!date) return '';
    
    try {
      // getTime()이 유효한지 확인
      const timestamp = date.getTime();
      if (isNaN(timestamp)) {
        console.warn('유효하지 않은 날짜 객체:', date);
        return '';
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    } catch (err) {
      console.error('날짜 포맷팅 오류:', err);
      return '';
    }
  };
  
  // 7일 날짜 범위 생성
  const getDateRange = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    
    if (isNaN(today.getTime())) {
      console.error('유효하지 않은 현재 날짜');
      return [];
    }
    
    try {
      // 오늘 포함 이전 3일
      for (let i = 3; i > 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        // 날짜 유효성 확인
        if (isNaN(date.getTime())) {
          console.warn(`유효하지 않은 날짜 계산 (today - ${i})`);
          continue;
        }
        
        const formattedDate = safeFormatDate(date);
        if (formattedDate) dates.push(formattedDate);
      }
      
      // 오늘
      dates.push(safeFormatDate(today));
      
      // 이후 3일
      for (let i = 1; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // 날짜 유효성 확인
        if (isNaN(date.getTime())) {
          console.warn(`유효하지 않은 날짜 계산 (today + ${i})`);
          continue;
        }
        
        const formattedDate = safeFormatDate(date);
        if (formattedDate) dates.push(formattedDate);
      }
      
      // 날짜가 하나도 없으면 오늘 날짜만 추가
      if (dates.length === 0) {
        const todayFormatted = safeFormatDate(today);
        if (todayFormatted) dates.push(todayFormatted);
      }
    } catch (err) {
      console.error('날짜 범위 생성 오류:', err);
      // 오류 발생 시 오늘 날짜만 반환
      const todayFormatted = safeFormatDate(today);
      if (todayFormatted) dates.push(todayFormatted);
    }
    
    return dates;
  };

  return (
    <>
      {/* @ts-ignore - Next.js styled-jsx 타입 오류 무시 */}
      <style jsx>{styles}</style>

      {/* 날짜 선택기 */}
      <QuizHeaderDatePickerOnly />

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
