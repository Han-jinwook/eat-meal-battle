"use client";

import React from 'react';
import { toast } from 'react-hot-toast';

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correct_answer?: number;
  explanation?: string;
  meal_date: string;
  meal_id?: string;
  meal_image_url?: string;
  user_answer?: {
    selected_option?: number;
    is_correct?: boolean;
  };
  selected_option?: number;
  is_correct?: boolean;
  report_status?: 'none' | 'pending' | 'verified_correct' | 'verified_incorrect';
  ai_verification?: {
    isCorrect: boolean;
    confidence: number;
    reasoning: string;
  };
}

interface QuizResultSectionProps {
  quiz: Quiz;
  isViewingMode: boolean;
  reportingQuiz: boolean;
  mealImageUrl: string | null;
  onReportQuiz: () => void;
}

const QuizResultSection: React.FC<QuizResultSectionProps> = ({
  quiz,
  isViewingMode,
  reportingQuiz,
  mealImageUrl,
  onReportQuiz
}) => {
  return (
    <div>
      <div className="text-center">
        {/* 결과 메시지 */}
        {quiz.user_answer && quiz.user_answer.is_correct !== undefined && (
          <div className="flex items-center gap-4">
            {/* 급식이미지 - 왼쪽에 크게 배치 */}
            {mealImageUrl && (
              <img 
                src={mealImageUrl}
                alt="급식 이미지"
                className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300 shadow-sm flex-shrink-0"
              />
            )}
            
            <p className="text-lg font-semibold">
              {quiz.user_answer.is_correct ? (
                <span className="text-green-600">정답입니다! 🎉</span>
              ) : (
                <span className="text-red-600">틀렸습니다. 다음에 다시 도전해보세요!</span>
              )}
            </p>
          </div>
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
                          <summary className="cursor-pointer hover:text-green-800 py-2 px-1 -mx-1 rounded">
                            AI 출제 검증 결과 보기
                          </summary>
                          <div className="mt-2 p-2 bg-white rounded border cursor-pointer" onClick={(e) => {
                            // 모바일에서 터치 영역 확대: 검증 결과 영역 클릭 시 details 토글
                            const details = e.currentTarget.closest('details');
                            if (details) {
                              details.open = !details.open;
                            }
                          }}>
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
                            <summary className="cursor-pointer hover:text-blue-800 py-2 px-1 -mx-1 rounded">
                              AI 출제 검증 결과 보기
                            </summary>
                            <div className="mt-2 p-2 bg-white rounded border cursor-pointer" onClick={(e) => {
                              // 모바일에서 터치 영역 확대: 검증 결과 영역 클릭 시 details 토글
                              const details = e.currentTarget.closest('details');
                              if (details) {
                                details.open = !details.open;
                              }
                            }}>
                              <p className="text-xs text-gray-600 mb-1">
                                AI 검증 신뢰도: {Math.round((quiz.ai_verification.confidence || 0) * 100)}%
                              </p>
                              <p className="text-sm">{quiz.ai_verification.reasoning}</p>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <button
                        onClick={async () => {
                          // 토스트 메시지 표시 (react-hot-toast 사용)
                          toast('이미 오답신고 되었습니다', {
                            icon: '⚠️',
                            duration: 2000,
                          });
                        }}
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
                    onClick={onReportQuiz}
                    disabled={reportingQuiz || isViewingMode}
                    className="p-0 relative overflow-hidden hover:opacity-90"
                  >
                    {reportingQuiz ? (
                      <svg width="200" height="50" viewBox="0 0 200 50" role="img" aria-label="오답신고 처리중">
                        <defs>
                          <linearGradient id="reportProcessingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6A00FF"/>
                            <stop offset="50%" stopColor="#3F55FF"/>
                            <stop offset="100%" stopColor="#00D1FF"/>
                          </linearGradient>
                          <filter id="reportProcessingShadow" x="-20%" y="-20%" width="140%" height="160%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0A1B2B" floodOpacity="0.18"/>
                          </filter>
                        </defs>
                        
                        {/* Button shape */}
                        <rect x="2" y="2" rx="10" ry="10" width="196" height="46" fill="url(#reportProcessingGrad)" filter="url(#reportProcessingShadow)"/>
                        
                        {/* Loading spinner */}
                        <g transform="translate(20,25)">
                          <circle cx="0" cy="0" r="6" fill="none" stroke="#1EE6D6" strokeWidth="2" strokeLinecap="round">
                            <animate attributeName="stroke-dasharray" values="0 40;20 20;0 40" dur="1.5s" repeatCount="indefinite"/>
                            <animateTransform attributeName="transform" type="rotate" values="0;360" dur="1.5s" repeatCount="indefinite"/>
                          </circle>
                        </g>
                        
                        {/* Text */}
                        <text x="40" y="30" fontFamily="Pretendard, 'Noto Sans KR', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
                          fontWeight="600" fontSize="14" fill="#FFFFFF">신고 처리중...</text>
                      </svg>
                    ) : (
                      <svg width="200" height="50" viewBox="0 0 200 50" role="img" aria-label="AI에게 오답신고">
                        <defs>
                          <linearGradient id="reportGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6A00FF"/>
                            <stop offset="50%" stopColor="#3F55FF"/>
                            <stop offset="100%" stopColor="#00D1FF"/>
                          </linearGradient>
                          <filter id="reportShadow" x="-20%" y="-20%" width="140%" height="160%">
                            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0A1B2B" floodOpacity="0.18"/>
                          </filter>
                        </defs>
                        
                        {/* Button shape */}
                        <rect x="2" y="2" rx="10" ry="10" width="196" height="46" fill="url(#reportGrad)" filter="url(#reportShadow)"/>
                        
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
                          fontWeight="600" fontSize="14" fill="#FFFFFF" textAnchor="middle">AI에게 오답신고</text>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizResultSection;
