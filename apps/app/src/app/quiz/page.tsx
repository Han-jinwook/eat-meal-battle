"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import useUserSchool from '@/hooks/useUserSchool';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';

// 타입 정의
type Quiz = {
  id: string;
  question: string;
  options: string[];
  correct_answer?: number;  // 정답 (7시 이후에만 표시)
  explanation?: string;    // 정답 해설 (7시 이후에만 표시)
  meal_date: string;
  menu_items: string[];
};

type QuizResponse = {
  quiz?: Quiz;
  alreadyAnswered?: boolean;
  isCorrect?: boolean;
  error?: string;
};

type AnswerResponse = {
  isCorrect: boolean;
  correctAnswer: number;
  message: string;
  error?: string;
};

type Champion = {
  id: string;
  user_id: string;
  correct_count: number;
  total_count: number;
  avg_answer_time: number;
  users: {
    nickname: string;
    avatar_url: string;
  };
};

type ChampionsResponse = {
  champions?: Champion[];
  error?: string;
};

export default function QuizPage() {
  // CSS 스타일 정의
  const styles = `
    @keyframes confetti-fall {
      0% { transform: translateY(-100vh) rotate(0deg); }
      100% { transform: translateY(100vh) rotate(720deg); }
    }
    
    .confetti-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
      overflow: hidden;
    }
    
    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      top: -10px;
      opacity: 0.8;
      animation: confetti-fall 3s linear forwards;
    }
    
    .option-button {
      transition: all 0.3s ease;
    }
    
    .option-button:hover:not(:disabled) {
      transform: scale(1.02);
    }
    
    .option-button:active:not(:disabled) {
      transform: scale(0.98);
    }
    
    .option-dimmed {
      opacity: 0.6;
    }
  `;
  
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 사용자/학교 정보 훅
  const { user, userSchool, loading: userLoading, error: userError } = useUserSchool();
  
  // URL에서 날짜 매개변수 가져오기
  const [dateParam, setDateParam] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // URL 매개변수를 사용하여 날짜 갱신하는 함수
  const updateDateWithUrl = (date: string) => {
    // 상태 업데이트
    setSelectedDate(date);
    
    // 클라이언트에서만 실행 (window 객체 존재 확인)
    if (typeof window !== 'undefined') {
      try {
        // 현재 URL 매개변수 복사
        const params = new URLSearchParams(window.location.search);
        // 날짜 매개변수 업데이트
        params.set('date', date);
        
        // 히스토리 상태 업데이트 (페이지 새로고침 없이)
        const url = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', url);
      } catch (error) {
        console.error('주소 갱신 오류:', error);
      }
    }
  };
  
  // 날짜 변경 핸들러
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    console.log('날짜 변경:', newDate);
    
    // 날짜 상태 및 URL 업데이트
    updateDateWithUrl(newDate);
    
    // 새 날짜로 퀴즈 다시 불러오기
    fetchQuiz(newDate);
  };
  
  // 클라이언트 사이드에서 URL 매개변수 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dateFromUrl = params.get('date');
      
      // URL에서 날짜 파라미터가 있으면 그 값을 사용, 없으면 오늘 날짜 사용
      const dateToUse = dateFromUrl || getCurrentDate();
      console.log('URL에서 날짜 초기화:', { dateFromUrl, dateToUse });
      
      // 상태 업데이트
      setDateParam(dateFromUrl);
      setSelectedDate(dateToUse);
    }
  }, []);
  
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [answerTime, setAnswerTime] = useState<number | null>(null);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 퀴즈 결과에 따른 색상 매핑
  const resultColors = {
    correct: 'bg-green-100 border-green-400 text-green-700',
    incorrect: 'bg-red-100 border-red-400 text-red-700',
    neutral: 'bg-blue-100 border-blue-400 text-blue-700'
  };

  // 퀴즈 데이터 가져오기
  const fetchQuiz = async (date?: string) => {
    try {
      setLoading(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // 날짜 파라미터 추가
      const quizDate = date || selectedDate || getCurrentDate();
      const response = await fetch(`/api/quiz?date=${quizDate}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('오늘의 퀴즈가 아직 준비되지 않았습니다.');
        } else {
          setError('퀴즈를 불러오는 중 오류가 발생했습니다.');
        }
        setLoading(false);
        return;
      }

      const data: QuizResponse = await response.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (data.quiz) {
        setQuiz(data.quiz);
        setAlreadyAnswered(data.alreadyAnswered || false);
        setIsSubmitting(false);
        
        // 정답을 이미 제출했으면 결과 데이터도 설정
        if (data.alreadyAnswered && data.isCorrect !== undefined) {
          setResult({
            isCorrect: data.isCorrect,
            correctAnswer: data.quiz.correct_answer !== undefined ? data.quiz.correct_answer : 0,
            message: data.isCorrect ? '정답입니다!' : '틀렸습니다.'
          });
        } else {
          // 타이머 시작 (퀴즈를 아직 풀지 않은 경우)
          setStartTime(Date.now());
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('퀴즈 로딩 중 오류:', error);
      setError('퀴즈를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 정답 제출
  const submitAnswer = async (option: number) => {
    if (isSubmitting || alreadyAnswered || !quiz || selectedOption !== null) return;

    try {
      setIsSubmitting(true);
      setSelectedOption(option);

      // 응답 시간 계산 (초 단위)
      const endTime = Date.now();
      const timeTaken = startTime ? Math.round((endTime - startTime) / 1000) : 10;
      setAnswerTime(timeTaken);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quiz_id: quiz.id,
          selected_option: option,
          answer_time: timeTaken
        })
      });

      const data: AnswerResponse = await response.json();

      if (data.error) {
        setError(data.error);
        setIsSubmitting(false);
        return;
      }

      setResult(data);
      setAlreadyAnswered(true);

      // 정답일 경우 축하 애니메이션
      if (data.isCorrect) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      // 장원 목록 새로고침
      fetchChampions();

    } catch (error) {
      console.error('답변 제출 중 오류:', error);
      setError('답변을 제출하는 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 장원 목록 가져오기
  const fetchChampions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/quiz/champions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        console.error('장원 목록 가져오기 실패:', response.status);
        return;
      }

      const data: ChampionsResponse = await response.json();
      
      if (data.error) {
        console.error('장원 목록 에러:', data.error);
        return;
      }

      if (data.champions) {
        setChampions(data.champions);
        
        // 자신의 순위 찾기
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const rank = data.champions.findIndex(champ => champ.user_id === user.id);
          setUserRank(rank !== -1 ? rank + 1 : null);
        }
      }
    } catch (error) {
      console.error('장원 목록 가져오기 중 오류:', error);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchQuiz();
    fetchChampions();
  }, []);

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // 로딩 화면
  if (loading) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">퀴즈를 불러오는 중입니다...</p>
      </main>
    );
  }

  // 에러 화면
  if (error) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
          <p className="font-bold">오류 발생</p>
          <p>{error}</p>
        </div>
        <button 
          onClick={fetchQuiz}
          className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          새로고침
        </button>
      </main>
    );
  }

  // 퀴즈가 없는 경우
  if (!quiz) {
    return (
      <main className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <style jsx>{styles}</style>
      
      {/* 축하 효과 */}
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 100 }).map((_, i) => {
            const color = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'][Math.floor(Math.random() * 16)];
            const left = `${Math.random() * 100}%`;
            const width = `${Math.random() * 10 + 5}px`;
            const height = width;
            const duration = `${Math.random() * 3 + 2}s`;
            const delay = `${Math.random() * 2}s`;
                        
                        return (
                          <>
                            <div className="flex flex-col items-center mr-1">
                              <span className="text-xs text-gray-500">
                                {month}월 {day}일
                              </span>
                              <span className="text-xs font-semibold text-blue-600">
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
              </div>
            ) : userError ? (
              <div className="text-red-600 text-center py-2">
                <p>학교 정보를 불러올 수 없습니다</p>
                <Link href="/school-search" className="text-sm text-blue-600 hover:underline">
                  학교 설정하기
                </Link>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="mb-2">학교 정보가 없습니다</p>
                <Link href="/school-search" className="text-sm text-blue-600 hover:underline">
                  학교 설정하기
                </Link>
              </div>
            )}
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">오늘의 급식 퀴즈</h1>
            <p className="mt-2 text-gray-600">급식 메뉴에 대한 퀴즈를 풀고 점수를 올려보세요!</p>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-yellow-100 rounded-full p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <h3 className="text-lg font-medium text-center mb-2">
              {userSchool?.school_name || '학교'} {formatDisplayDate(selectedDate)} 퀴즈 정보
            </h3>

            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p className="text-gray-700 font-medium">
                {(error || userError) || '해당 날짜의 퀴즈가 아직 준비되지 않았습니다.'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                다른 날짜를 선택해보세요.
              </p>
            </div>
            
            <div className="mt-4 flex justify-center">
              <button 
                onClick={() => fetchQuiz()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      </main>
    );

        {/* 퀴즈 질문 */}
        <div className="mb-6 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">{quiz.question}</h2>

          {/* 선택지 목록 */}
          <div className="space-y-3">
            {quiz.options.map((option, index) => (
              <button
                key={index}
                onClick={() => submitAnswer(index)}
                disabled={alreadyAnswered || isSubmitting}
                className={`w-full p-4 text-left rounded-lg transition-all transform hover:scale-102 border option-button
                  ${selectedOption === index 
                    ? (result?.isCorrect 
                        ? 'bg-green-100 border-green-500' 
                        : 'bg-red-100 border-red-500')
                    : (quiz.correct_answer !== undefined && quiz.correct_answer === index) 
                      ? 'bg-green-100 border-green-500' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
                  ${alreadyAnswered && selectedOption !== index && index !== (quiz.correct_answer !== undefined ? quiz.correct_answer : result?.correctAnswer) ? 'option-dimmed' : ''}`}
              >
                <div className="flex items-center">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white mr-3">
                    {index + 1}
                  </span>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 결과 메시지 */}
          {(result || (alreadyAnswered && quiz.correct_answer !== undefined)) && (
            <div className={`mt-6 p-4 rounded-lg ${result?.isCorrect || (selectedOption === quiz.correct_answer) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <p className="font-bold text-lg">
                {result?.message || (selectedOption === quiz.correct_answer ? "정답입니다!" : "틀렸습니다.")}
              </p>
              {answerTime !== null && (
                <p className="text-sm mt-1">응답 시간: {answerTime}초</p>
              )}
              {quiz.correct_answer !== undefined && selectedOption !== quiz.correct_answer && (
                <p className="mt-2">정답: {quiz.options[quiz.correct_answer]}</p>
              )}
            </div>
          )}
        </div>

        {/* 장원 목록 */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">이달의 퀴즈 장원</h2>
          {champions.length === 0 ? (
            <p className="text-gray-600 text-center py-4">아직 장원 기록이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left">순위</th>
                    <th className="px-4 py-2 text-left">이름</th>
                    <th className="px-4 py-2 text-right">정답률</th>
                    <th className="px-4 py-2 text-right">평균 응답시간</th>
                  </tr>
                </thead>
                <tbody>
                  {champions.map((champion, index) => (
                    <tr 
                      key={champion.id} 
                      className={`border-t ${userRank === index + 1 ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}위`}
                      </td>
                      <td className="px-4 py-3 flex items-center">
                        {champion.users.avatar_url && (
                          <img 
                            src={champion.users.avatar_url} 
                            alt="프로필" 
                            className="w-6 h-6 rounded-full mr-2" 
                          />
                        )}
                        {champion.users.nickname || '사용자'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {champion.correct_count}/{champion.total_count} ({Math.round(champion.correct_count / champion.total_count * 100)}%)
                      </td>
                      <td className="px-4 py-3 text-right">
                        {champion.avg_answer_time.toFixed(1)}초
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {userRank === null && alreadyAnswered && (
            <p className="text-sm text-gray-600 mt-4 text-center">
              더 많은 퀴즈에 참여하여 장원 목록에 이름을 올려보세요!
            </p>
          )}
        </div>
      </div>
      </main>
    );
  }
}
