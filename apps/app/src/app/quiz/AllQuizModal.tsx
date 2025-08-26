'use client';

import { useState, useEffect } from 'react';
import DateNavigator from '@/components/DateNavigator';
import SchoolGradeSelector from '@/components/SchoolGradeSelector';
import QuizOptionsSection from '@/components/QuizOptionsSection';
import QuizResultSection from '@/components/QuizResultSection';
import QuizGenerateButton from '@/components/QuizGenerateButton';

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  created_at: string;
  meal_date: string;
  school_name: string;
  grade: number;
  school_type: 'elementary' | 'middle' | 'high';
}

interface AllQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  universalSchoolName: string;
  universalGrade: number;
  universalSchoolType: '초등학교' | '중학교' | '고등학교';
  onUniversalGradeChange: (grade: number) => void;
  onUniversalSchoolChange: (direction: 'prev' | 'next') => void;
  selectedSchoolLevel: 'elementary' | 'middle' | 'high';
  setSelectedSchoolLevel: (level: 'elementary' | 'middle' | 'high') => void;
}

export default function AllQuizModal({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  universalSchoolName,
  universalGrade,
  universalSchoolType,
  onUniversalGradeChange,
  onUniversalSchoolChange,
  selectedSchoolLevel,
  setSelectedSchoolLevel
}: AllQuizModalProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [reportingQuiz, setReportingQuiz] = useState(false);
  const [noMenu, setNoMenu] = useState(false);
  const [noMenuMessage, setNoMenuMessage] = useState('');
  const [mealImageUrl, setMealImageUrl] = useState<string>('');

  // 학교 변경 핸들러 - AllQuizModal 내부에서 처리
  const handleSchoolChange = async (direction: 'prev' | 'next') => {
    console.log('🔥 AllQuizModal 화살표 클릭:', { direction, currentSchool: universalSchoolName, schoolType: universalSchoolType });
    
    // 부모 컴포넌트의 핸들러 호출
    await onUniversalSchoolChange(direction);
    
    // 학교 변경 후 퀴즈 다시 로드
    console.log('🔄 학교 변경 후 퀴즈 재로드 시작');
    await loadQuiz();
  };

  // 퀴즈 로드 함수
  const loadQuiz = async () => {
    if (!universalSchoolName || !universalGrade) return;
    
    setLoading(true);
    setError(null);
    setQuiz(null);
    setSelectedOption(null);
    setSubmitted(false);
    setNoMenu(false);
    setNoMenuMessage('');
    setMealImageUrl('');

    try {
      const dateStr = selectedDate;
      const response = await fetch(`/api/quiz?date=${dateStr}&schoolName=${encodeURIComponent(universalSchoolName)}&grade=${universalGrade}&schoolType=${universalSchoolType}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 404) {
          if (errorData.reason === 'no_menu') {
            setNoMenu(true);
            setNoMenuMessage(errorData.message || '오늘은 급식이 없는 날입니다.');
          } else {
            setError(errorData.message || '퀴즈를 찾을 수 없습니다.');
          }
        } else {
          setError(errorData.message || '퀴즈를 불러오는데 실패했습니다.');
        }
        return;
      }

      const data = await response.json();
      setQuiz(data.quiz);
      setMealImageUrl(data.mealImageUrl || '');
    } catch (err) {
      console.error('퀴즈 로드 에러:', err);
      setError('퀴즈를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 퀴즈 제출 함수
  const submitAnswer = async () => {
    if (selectedOption === null || !quiz) return;
    
    setSubmitting(true);
    try {
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          selectedOption: selectedOption
        })
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const errorData = await response.json();
        setError(errorData.message || '답안 제출에 실패했습니다.');
      }
    } catch (err) {
      console.error('답안 제출 에러:', err);
      setError('답안 제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };


  // 퀴즈 신고 함수
  const handleReportQuiz = async (reason: string) => {
    if (!quiz) return;
    
    setReportingQuiz(true);
    try {
      const response = await fetch('/api/quiz/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          reason: reason
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || '신고 처리에 실패했습니다.');
      }
    } catch (err) {
      console.error('퀴즈 신고 에러:', err);
      setError('신고 처리에 실패했습니다.');
    } finally {
      setReportingQuiz(false);
    }
  };

  // 날짜나 학교 정보 변경 시 퀴즈 다시 로드
  useEffect(() => {
    if (isOpen && universalSchoolName && universalGrade) {
      loadQuiz();
    }
  }, [isOpen, selectedDate, universalSchoolName, universalGrade, universalSchoolType]);

  if (!isOpen) return null;

  return (
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
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white/50 transition-all duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 모달 내용 */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* 날짜 선택기, 학교학년 선택기, 학급 선택 드롭다운 - 반응형 레이아웃 */}
          <div className="mb-6">
            {/* 웹: 한 줄, 모바일: 2줄 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* 날짜 선택기 */}
              <div className="flex justify-center">
                <DateNavigator 
                  selectedDate={selectedDate}
                  onDateChange={onDateChange}
                />
              </div>
              
              {/* 학교학년 선택기 + 학급 선택 드롭다운 */}
              <div className="flex items-center gap-4">
                {/* 학교학년 선택기 */}
                <SchoolGradeSelector
                  schoolName={universalSchoolName}
                  grade={universalGrade}
                  schoolType={universalSchoolType}
                  onGradeChange={onUniversalGradeChange}
                  onSchoolChange={handleSchoolChange}
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
                <div className="text-6xl mb-4">❌</div>
                <h3 className="text-xl font-bold text-red-600 mb-4">퀴즈를 불러올 수 없습니다</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <p className="text-sm text-gray-500">
                  다른 날짜나 학교를 선택해보세요.
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
                  isViewingMode={false}
                  mealImageUrl={mealImageUrl}
                  onOptionSelect={setSelectedOption}
                  onSubmitAnswer={submitAnswer}
                />
                
                {/* 퀴즈 결과 - 단순하게 정답/해설만 표시 */}
                {submitted && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    {/* 정답 여부 */}
                    <div className="text-center mb-4">
                      {selectedOption === quiz.correct_answer ? (
                        <div className="text-green-600 text-xl font-bold">
                          🎉 정답입니다!
                        </div>
                      ) : (
                        <div className="text-red-600 text-xl font-bold">
                          ❌ 틀렸습니다
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mt-2">
                        정답: {quiz.options[quiz.correct_answer]}
                      </p>
                    </div>
                    
                    {/* 해설 */}
                    {quiz.explanation && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-700 mb-2">💡 해설</p>
                        <p className="text-gray-700">{quiz.explanation}</p>
                      </div>
                    )}
                    
                  </div>
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
                      선택한 날짜/학교/학년에 퀴즈가 없습니다.<br/>
                      다른 날짜, 학교, 학년을 선택해보세요!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
