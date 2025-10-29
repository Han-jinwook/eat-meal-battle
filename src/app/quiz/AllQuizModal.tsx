'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import DateNavigator from '@/components/DateNavigator';
import SchoolGradeSelector from '@/components/SchoolGradeSelector';
import QuizOptionsSection from '@/components/QuizOptionsSection';
import QuizResultSection from '@/components/QuizResultSection';
import QuizGenerateButton from '@/components/QuizGenerateButton';
import QuizPerformanceCalendar from '@/components/QuizPerformanceCalendar';

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
  report_status?: 'none' | 'pending' | 'verified_incorrect' | 'verified_correct' | string;
  ai_verification?: any;
  quiz_reports?: Array<{
    status: string;
    ai_verification_result: any;
  }>;
  user_answer?: {
    selected_option: number;
    is_correct: boolean;
    attempted_at: string;
  };
  user_selected_option?: number;
  is_correct?: boolean;
  user_answer_time?: string;
}

interface AllQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  universalSchoolName: string;
  universalSchoolCode: string;
  universalGrade: number;
  universalSchoolType: '초등학교' | '중학교' | '고등학교';
  onUniversalGradeChange: (grade: number) => void;
  onUniversalSchoolChange: (direction: 'prev' | 'next') => void;
  onUniversalSchoolTypeChange: (schoolType: '초등학교' | '중학교' | '고등학교', schoolCode?: string, schoolName?: string) => void;
  selectedSchoolLevel: 'elementary' | 'middle' | 'high';
  setSelectedSchoolLevel: (level: 'elementary' | 'middle' | 'high') => void;
}

export default function AllQuizModal({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  universalSchoolName,
  universalSchoolCode,
  universalGrade,
  universalSchoolType,
  onUniversalGradeChange,
  onUniversalSchoolChange,
  onUniversalSchoolTypeChange,
  selectedSchoolLevel,
  setSelectedSchoolLevel,
}: AllQuizModalProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [noMenu, setNoMenu] = useState(false);
  const [noMenuMessage, setNoMenuMessage] = useState('');
  const [mealImageUrl, setMealImageUrl] = useState<string>('');
  const [schools, setSchools] = useState<Array<{school_code: string; school_name: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  // 학교 목록 로드 함수
  const loadSchools = async () => {
    console.log('🏫 loadSchools 함수 호출:', { selectedDate, universalSchoolType, isLoading });
    if (isLoading) return; // 중복 요청 방지
    setIsLoading(true);
    try {
      // 1단계: 해당 날짜에 퀴즈가 있는 모든 학교코드 조회
      const { data: allQuizzes, error: quizError } = await supabase
        .from('meal_quizzes')
        .select('school_code')
        .eq('meal_date', selectedDate);
      
      if (quizError || !allQuizzes || allQuizzes.length === 0) {
        setSchools([]);
        return;
      }
      
      // 2단계: school_infos에서 해당 학교급에 맞는 학교 찾기
      const schoolCodes = [...new Set(allQuizzes.map(q => q.school_code))];
      const { data: schoolInfos, error: schoolError } = await supabase
        .from('school_infos')
        .select('school_code, school_name')
        .in('school_code', schoolCodes)
        .eq('school_type', universalSchoolType)
        .order('school_name');
      
      if (schoolError || !schoolInfos) {
        setSchools([]);
        return;
      }
      
      // 중복 제거
      const uniqueSchoolMap = new Map();
      schoolInfos.forEach(school => {
        if (!uniqueSchoolMap.has(school.school_code)) {
          uniqueSchoolMap.set(school.school_code, school);
        }
      });
      
      const finalSchools = Array.from(uniqueSchoolMap.values());
      console.log('✅ 학교 목록 설정 완료:', finalSchools);
      setSchools(finalSchools);
    } catch (err) {
      console.error('학교 목록 로드 오류:', err);
      setSchools([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 학교 변경 핸들러 - schools 배열에서 찾기
  const handleSchoolChange = (direction: 'prev' | 'next') => {
    console.log('🔄 학교 화살표 클릭:', { direction, schoolsCount: schools.length, schools });
    if (schools.length === 0) {
      console.log('❌ 학교 목록이 비어있어서 변경 불가');
      return;
    }
    
    // 먼저 퀴즈 상태 초기화 (깜빡임 방지)
    setQuiz(null);
    setError(null);
    setSelectedOption(null);
    setSubmitted(false);
    setLoading(true);
    
    const currentIndex = schools.findIndex(s => s.school_code === universalSchoolCode);
    let nextIndex;
    
    if (direction === 'next') {
      nextIndex = currentIndex >= schools.length - 1 ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex <= 0 ? schools.length - 1 : currentIndex - 1;
    }
    
    const nextSchool = schools[nextIndex];
    if (nextSchool) {
      onUniversalSchoolChange(direction);
    }
    
    setLoading(false);
  };

  // 퀴즈 로드 함수
  const loadQuiz = async () => {
    if (!universalSchoolCode || !universalGrade) return;
    
    setLoading(true);
    setError(null);
    setQuiz(null);
    setSelectedOption(null);
    setSubmitted(false);
    setNoMenu(false);
    setNoMenuMessage('');
    setMealImageUrl('');

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('로그인이 필요합니다.');
        return;
      }

      const dateStr = selectedDate;
      const response = await fetch(`/api/all-quiz?school_code=${universalSchoolCode}&grade=${universalGrade}&date=${dateStr}&limit=1`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
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
      
      // all-quiz API는 { quizzes: [...] } 형태로 반환
      const quizzes = data.quizzes || [];
      const quizData = quizzes.length > 0 ? quizzes[0] : null;
      
      if (!quizData) {
        setError('선택한 날짜/학교/학년에 퀴즈가 없습니다.');
        return;
      }
      
      // quiz_reports 데이터 구조 처리 - meal_quizzes.report_status 우선 사용
      console.log('🔍 AllQuizModal 원본 퀴즈 데이터:', quizData);
      console.log('🔍 AllQuizModal quiz_reports 데이터:', quizData.quiz_reports);
      console.log('🔍 AllQuizModal meal_quizzes.report_status:', quizData.report_status);
      
      // meal_quizzes.report_status가 있으면 그것을 우선 사용, 없으면 quiz_reports에서 매핑
      let finalReportStatus = quizData.report_status || 'none';
      
      // meal_quizzes.report_status가 없거나 'none'이고 quiz_reports가 있으면 매핑 시도
      if ((!finalReportStatus || finalReportStatus === 'none') && quizData.quiz_reports?.[0]) {
        const quizReportStatus = quizData.quiz_reports[0].status;
        if (quizReportStatus === 'processed' && quizData.quiz_reports[0].ai_verification_result) {
          const aiResult = quizData.quiz_reports[0].ai_verification_result;
          finalReportStatus = aiResult.isCorrect ? 'verified_correct' : 'verified_incorrect';
        } else {
          finalReportStatus = quizReportStatus || 'none';
        }
      }
      
      const processedQuizData = {
        ...quizData,
        report_status: finalReportStatus,
        ai_verification: quizData.quiz_reports?.[0]?.ai_verification_result || null
      };
      
      console.log('🔍 AllQuizModal 처리된 퀴즈 데이터:', processedQuizData);
      console.log('🔍 AllQuizModal final report_status:', processedQuizData.report_status);
      
      setQuiz(processedQuizData);
      setMealImageUrl('');
      
      // 이미 제출된 답안이 있는지 확인 (all-quiz API는 user_answer 필드 사용)
      if (quizData.user_answer) {
        setSelectedOption(quizData.user_answer.selected_option);
        setSubmitted(true);
      } else {
        setSelectedOption(null);
        setSubmitted(false);
      }
      
      // 급식 이미지 로드
      if (quizData?.meal_id) {
        await fetchMealImage(quizData.meal_id);
      } else {
        setMealImageUrl('');
      }
    } catch (err) {
      console.error('퀴즈 로드 에러:', err);
      setError('퀴즈를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 급식 이미지 로드 함수
  const fetchMealImage = async (mealId: string) => {
    try {
      const { data, error } = await (supabase
        .from('meal_images')
        .select('image_url')
        .eq('meal_id', mealId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1) as any);
      if (error || !data || data.length === 0) {
        setMealImageUrl('');
        return;
      }
      setMealImageUrl(data[0].image_url);
    } catch (err) {
      console.error('AllQuizModal 급식 이미지 로드 오류:', err);
      setMealImageUrl('');
    }
  };

  // 퀴즈 제출 함수
  const submitAnswer = async () => {
    if (selectedOption === null || !quiz) {
      return;
    }
    
    setSubmitting(true);
    try {
      const supabase = createClient();
      let { data: { session } } = await supabase.auth.getSession();
      
      // 세션이 없으면 토큰 새로고침 시도
      if (!session?.access_token) {
        const { data: refreshData } = await (supabase.auth as any).refreshSession();
        session = refreshData.session;
      }
      
      if (!session?.access_token) {
        setError('로그인이 필요합니다. 페이지를 새로고침해주세요.');
        return;
      }

      const makeRequest = async (token) => {
        // 요청 본문 객체 생성
        const requestBody = {
          quiz_id: quiz.id,
          selected_option: Number(selectedOption)
        };
        
        return await fetch('/api/all-quiz', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        });
      };

      let response = await makeRequest(session.access_token);

      // 401 오류 시 토큰 새로고침 후 재시도
      if (response.status === 401) {
        const { data: refreshData } = await (supabase.auth as any).refreshSession();
        
        if (refreshData.session?.access_token) {
          response = await makeRequest(refreshData.session.access_token);
        } else {
          setError('로그인이 만료되었습니다. 페이지를 새로고침해주세요.');
          return;
        }
      }

      const responseText = await response.text();
      
      // 텍스트를 JSON으로 파싱 시도
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('JSON 파싱 에러:', parseError);
        setError('응답 데이터를 처리할 수 없습니다.');
        return;
      }
      
      if (response.ok) {
        // 퀴즈 객체에 결과 정보 추가
        if (quiz) {
          const updatedQuiz: Quiz = {
            ...quiz,
            user_selected_option: selectedOption,
            is_correct: result.isCorrect !== undefined ? result.isCorrect : result.is_correct,
            user_answer_time: result.answer_time
          };
          
          setQuiz(updatedQuiz);
        }
        
        setSubmitted(true);
        
        // 퀴즈 성공 후 달력 데이터 새로고침을 위해 이벤트 발생
        window.dispatchEvent(new CustomEvent('quizCompleted'));
      } else {
        console.error('답안 제출 실패:', { status: response.status, result });
        const errorMessage = result.error || result.message || '답안 제출에 실패했습니다.';
        setError(`[${response.status}] ${errorMessage}`);
      }
    } catch (err) {
      console.error('답안 제출 에러:', err);
      setError('답안 제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };


  // 오답신고 관련 함수 제거됨

  // 날짜나 학교급 변경 시 학교 목록 로드 (디바운스 적용)
  useEffect(() => {
    if (isOpen && selectedDate && universalSchoolType && !isLoading) {
      const timer = setTimeout(() => {
        loadSchools();
      }, 300); // 300ms 디바운스
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedDate, universalSchoolType]);

  // 날짜나 학교 정보 변경 시 퀴즈 다시 로드 (디바운스 + 중복 방지)
  useEffect(() => {
    if (isOpen && universalSchoolCode && universalGrade && !loading) {
      const timer = setTimeout(() => {
        loadQuiz();
      }, 200); // 200ms 디바운스로 빠른 클릭 방지
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedDate, universalSchoolCode, universalGrade]);

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
                <div className="relative z-10">
                  <select
                    value={selectedSchoolLevel}
                    onChange={async (e) => {
                      const newLevel = e.target.value as 'elementary' | 'middle' | 'high';
                      setSelectedSchoolLevel(newLevel);
                      
                      // universalSchoolType 업데이트
                      let newSchoolType: '초등학교' | '중학교' | '고등학교' = '초등학교';
                      if (newLevel === 'middle') newSchoolType = '중학교';
                      if (newLevel === 'high') newSchoolType = '고등학교';
                      
                      console.log('🏫 AllQuizModal에서 학교급 변경:', { from: universalSchoolType, to: newSchoolType });
                      
                      // AllQuizModal에서 직접 학교급 변경 처리
                      setLoading(true);
                      setError(null);
                      
                      try {
                        // 1단계: 해당 날짜에 퀴즈가 있는 모든 학교코드 조회
                        const { data: allQuizzes, error: quizError } = await supabase
                          .from('meal_quizzes')
                          .select('school_code')
                          .eq('meal_date', selectedDate);
                        
                        if (quizError || !allQuizzes || allQuizzes.length === 0) {
                          setError('선택한 날짜/학교/학년에 퀴즈가 없습니다.');
                          console.log(`⚠️ ${selectedDate}에 퀴즈 없음`);
                          return;
                        }
                        
                        // 2단계: school_infos에서 해당 학교급에 맞는 학교 찾기
                        const schoolCodes = [...new Set(allQuizzes.map(q => q.school_code))];
                        const { data: schoolInfos, error: schoolError } = await supabase
                          .from('school_infos')
                          .select('school_code, school_name, school_type')
                          .in('school_code', schoolCodes)
                          .eq('school_type', newSchoolType)
                          .order('school_name')
                          .limit(1);
                        
                        if (schoolError || !schoolInfos || schoolInfos.length === 0) {
                          setError('선택한 날짜/학교/학년에 퀴즈가 없습니다.');
                          console.log(`⚠️ ${selectedDate}에 ${newSchoolType} 퀴즈 없음`);
                          // 에러여도 상태 동기화 (드롭다운 불일치 방지)
                          onUniversalSchoolTypeChange(newSchoolType);
                          setSchools([]);
                        } else {
                          // 첫 번째 학교로 설정하고 부모 컴포넌트에 알림
                          const firstSchool = schoolInfos[0];
                          console.log(`✅ ${newSchoolType} 첫 번째 학교 찾음:`, firstSchool.school_name);
                          
                          // 부모 컴포넌트로 학교급 + 학교 정보 전달
                          onUniversalSchoolTypeChange(newSchoolType, firstSchool.school_code, firstSchool.school_name);
                          
                          // useEffect가 자동으로 loadQuiz() 호출하므로 수동 호출 불필요
                        }
                      } catch (err) {
                        console.error('🚫 학교급 변경 중 오류:', err);
                        setError('학교급 변경 중 오류가 발생했습니다.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="appearance-none bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded px-3 py-2 pr-7 text-sm font-medium text-gray-700 hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors shadow-sm min-h-[44px] touch-manipulation"
                  >
                    <option value="elementary">초등학교</option>
                    <option value="middle">중학교</option>
                    <option value="high">고등학교</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none z-0">
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
                <div className="text-6xl mb-4">🍽️</div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">{error}</h3>
                <p className="text-gray-600">다른 날짜, 학교, 학년을 선택해보세요!</p>
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
                  quiz={quiz as any}
                  selectedOption={selectedOption}
                  submitted={submitted}
                  submitting={submitting}
                  isViewingMode={false}
                  mealImageUrl={mealImageUrl}
                  onOptionSelect={setSelectedOption}
                  onSubmitAnswer={submitAnswer}
                />
                
                {/* 퀴즈 결과 - 메인 퀴즈 페이지와 동일한 스타일 */}
                {submitted && (
                  <div className="text-center">
                    {/* 결과 메시지 */}
                    <p className="text-lg font-semibold mb-2">
                      {selectedOption === quiz.correct_answer ? (
                        <span className="text-green-600">정답입니다! 🎉</span>
                      ) : (
                        <span className="text-red-600">틀렸습니다. 다음에 다시 도전해보세요!</span>
                      )}
                    </p>
                    
                    {/* 해설 */}
                    {quiz.explanation && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">💡 설명</p>
                        <p className="text-gray-600">{quiz.explanation}</p>
                        
                        {/* 오답신고 결과 표시 - 메인 페이지와 동일한 UI */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          {quiz.report_status === 'verified_incorrect' ? (
                            // 오답 확정: 전원 정답 처리 안내 + AI 검증 결과 표시
                            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <span className="text-green-600 text-sm">✅</span>
                              <div className="flex-1">
                                <p className="text-sm text-green-700 font-medium mb-1">
                                  출제에 오류가 있어서 전원 맞춘걸로 처리합니다.
                                </p>
                                {(quiz as any).ai_verification && (
                                  <details className="text-xs text-green-600">
                                    <summary className="cursor-pointer hover:text-green-800 py-2 px-1 -mx-1 rounded">
                                      AI 출제 검증 결과 보기
                                    </summary>
                                    <div className="mt-2 p-2 bg-white rounded border cursor-pointer">
                                      <p className="text-xs text-gray-600 mb-1">
                                        AI 검증 신뢰도: {Math.round(((quiz as any).ai_verification.confidence || 0) * 100)}%
                                      </p>
                                      <p className="text-sm">{(quiz as any).ai_verification.reasoning}</p>
                                    </div>
                                  </details>
                                )}
                              </div>
                            </div>
                          ) : quiz.report_status === 'verified_correct' ? (
                            // 정답 확정: 신고 기각 안내 + AI 검증 결과 표시 + 완료 버튼
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <span className="text-blue-600 text-sm">ℹ️</span>
                                <div className="flex-1">
                                  <p className="text-sm text-blue-700 font-medium mb-1">
                                    신고가 있었지만 출제 내용이 적절함이 확인되었습니다!
                                  </p>
                                  {(quiz as any).ai_verification && (
                                    <details className="text-xs text-blue-600">
                                      <summary className="cursor-pointer hover:text-blue-800 py-2 px-1 -mx-1 rounded">
                                        AI 출제 검증 결과 보기
                                      </summary>
                                      <div className="mt-2 p-2 bg-white rounded border cursor-pointer">
                                        <p className="text-xs text-gray-600 mb-1">
                                          AI 검증 신뢰도: {Math.round(((quiz as any).ai_verification.confidence || 0) * 100)}%
                                        </p>
                                        <p className="text-sm">{(quiz as any).ai_verification.reasoning}</p>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-start">
                                <button
                                  className="p-0 relative overflow-hidden hover:opacity-90 cursor-not-allowed"
                                >
                                  <svg width="200" height="50" viewBox="0 0 200 50" role="img" aria-label="오답신고 완료">
                                    <defs>
                                      <linearGradient id="reportCompletedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#6A00FF"/>
                                        <stop offset="50%" stopColor="#3F55FF"/>
                                        <stop offset="100%" stopColor="#00D1FF"/>
                                      </linearGradient>
                                      <filter id="reportCompletedShadow" x="-20%" y="-20%" width="140%" height="160%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0A1B2B" floodOpacity="0.18"/>
                                      </filter>
                                    </defs>
                                    
                                    {/* Button shape */}
                                    <rect x="2" y="2" rx="10" ry="10" width="196" height="46" fill="url(#reportCompletedGrad)" filter="url(#reportCompletedShadow)"/>
                                    
                                    {/* Robot icon */}
                                    <g id="robot" transform="translate(20,25) scale(0.25)">
                                      {/* Antenna */}
                                      <circle cx="-10" cy="-58" r="8" fill="#1EE6D6"/>
                                      <rect x="-12" y="-48" rx="4" ry="4" width="4" height="16" fill="#1EE6D6"/>
                                      
                                      {/* Head outer */}
                                      <rect x="-80" y="-40" width="140" height="100" rx="28" ry="28" fill="#1EE6D6"/>
                                      
                                      {/* Side ears */}
                                      <rect x="-98" y="-8" width="18" height="36" rx="9" ry="9" fill="#1EE6D6"/>
                                      <rect x="60" y="-8" width="18" height="36" rx="9" ry="9" fill="#1EE6D6"/>
                                      
                                      {/* Face window */}
                                      <rect x="-60" y="-20" width="100" height="60" rx="18" ry="18" fill="#0A1B2B"/>
                                      
                                      {/* Eyes */}
                                      <circle cx="-32" cy="4" r="7" fill="#1EE6D6"/>
                                      <circle cx="8" cy="4" r="7" fill="#1EE6D6"/>
                                      
                                      {/* Smile */}
                                      <path d="M -36 20 Q -26 32 -16 20" fill="none" stroke="#1EE6D6" strokeWidth="4" strokeLinecap="round"/>
                                      
                                      {/* Neck */}
                                      <rect x="-40" y="60" width="60" height="10" rx="5" ry="5" fill="#11BDB0"/>
                                      
                                      {/* Base */}
                                      <path d="M -70 70 h 120 a 20 20 0 0 1 0 40 h -120 a 20 20 0 0 1 0 -40 z" fill="#1EE6D6"/>
                                    </g>
                                    
                                    {/* Text */}
                                    <text x="100" y="30" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
                                      fontWeight="600" fontSize="12" fill="#FFFFFF" textAnchor="middle">AI에게 오답신고 완료</text>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : quiz.report_status === 'pending' ? (
                            // 검증 중: 대기 메시지
                            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <span className="text-yellow-600 text-sm">⏳</span>
                              <p className="text-sm text-yellow-700 font-medium">
                                오답 가능성이 있다고 신고 접수중입니다.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : noMenu ? (
              <div className="text-center py-10">
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-lg shadow-md text-center">
                  <div className="text-5xl mb-2">🏫</div>
                  <h3 className="text-lg font-bold text-amber-700 mb-2">오늘은 쉬는 날!</h3>
                  <p className="text-amber-600">{noMenuMessage}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="text-6xl mb-4">🍽️</div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">선택한 날짜/학교/학년에 퀴즈가 없습니다.</h3>
                <p className="text-gray-600">다른 날짜, 학교, 학년을 선택해보세요!</p>
              </div>
            )}
          </div>
          
          {/* 유저 실적 달력 UI */}
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6 border-t border-gray-100">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">🎯 나의 랜덤퀴즈 챌린지</h3>
              <p className="text-sm text-gray-600">일별 퀴즈 도전 기록을 확인해보세요</p>
            </div>
            <QuizPerformanceCalendar />
          </div>
        </div>
      </div>
    </div>
  );
}
