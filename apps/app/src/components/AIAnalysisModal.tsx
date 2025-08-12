'use client';

import { useState } from 'react';

interface AIApp {
  id: string;
  name: string;
  icon: string;
  deepLink: string;
  webUrl: string;
  storeUrl: {
    ios: string;
    android: string;
  };
}

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  monthYear: string;
  isViewingMode: boolean;
  onSelectApp: (app: AIApp) => void;
}

const AIAnalysisModal = ({ 
  isOpen, 
  onClose, 
  schoolName, 
  monthYear, 
  isViewingMode,
  onSelectApp 
}: AIAnalysisModalProps) => {
  const aiApps: AIApp[] = [
    { 
      id: 'chatgpt', 
      name: 'ChatGPT', 
      icon: '/images/ai-logos/chatgpt.png',
      deepLink: 'chatgpt://',
      webUrl: 'https://chat.openai.com',
      storeUrl: {
        ios: 'https://apps.apple.com/app/chatgpt/id1448792446',
        android: 'https://play.google.com/store/apps/details?id=com.openai.chatgpt'
      }
    },
    { 
      id: 'gemini', 
      name: '제미나이', 
      icon: '/images/ai-logos/gemini.png',
      deepLink: 'gemini://',
      webUrl: 'https://gemini.google.com',
      storeUrl: {
        ios: 'https://apps.apple.com/app/google-gemini/id1640946313',
        android: 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard'
      }
    },
    { 
      id: 'claude', 
      name: '클로드', 
      icon: '/images/ai-logos/claude.png',
      deepLink: 'claude://',
      webUrl: 'https://claude.ai',
      storeUrl: {
        ios: 'https://apps.apple.com/app/claude-by-anthropic/id6448311069',
        android: 'https://play.google.com/store/apps/details?id=com.anthropic.claude'
      }
    },
    { 
      id: 'grok', 
      name: '그록', 
      icon: '/images/ai-logos/grok.png',
      deepLink: 'twitter://grok',
      webUrl: 'https://x.com/i/grok',
      storeUrl: {
        ios: 'https://apps.apple.com/app/x/id333903271',
        android: 'https://play.google.com/store/apps/details?id=com.twitter.android'
      }
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                🤖 AI 급식분석 리포트
              </h3>
              <p className="text-sm text-gray-600">
                {isViewingMode ? `${schoolName}` : '우리학교'} {monthYear} 분석
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* 설명 */}
          <div className="mb-6">
            <p className="text-gray-700 mb-3">
              유저님의 모바일에 깔려 있는 AI앱으로 {isViewingMode ? '관심학교' : '우리학교'} 급식데이터를 전송하여 
              <span className="font-semibold text-blue-600"> 무료 분석</span>을 받아보세요!
            </p>

            {/* 사용법 강조 */}
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-orange-500 text-lg">📋</span>
                <div>
                  <div className="font-bold text-orange-800 mb-2">사용법 (중요!)</div>
                  <div className="text-sm text-orange-700">
                    <div className="font-medium mb-1">클립보드에 복사되어 있으니</div>
                    <div className="font-bold text-base">
                      <span className="bg-orange-200 px-2 py-1 rounded mr-2">붙여넣기</span> + 
                      <span className="bg-orange-200 px-2 py-1 rounded ml-2">엔터</span>
                    </div>
                  </div>
                  <div className="text-xs text-orange-600 mt-2">
                    💡 PC와 모바일에서 동일한 방식
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <div className="font-medium mb-1">📊 분석 내용</div>
              <ul className="text-xs space-y-1">
                <li>• 급식 현황 종합 평가</li>
                <li>• 지역 내 순위 및 비교 분석</li>
                <li>• 전국 평균과의 비교</li>
                <li>• 구체적인 개선 방안 제시</li>
              </ul>
            </div>
          </div>

          {/* AI 앱 선택 */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">AI 앱 선택</h4>
            <div className="grid grid-cols-2 gap-3">
              {aiApps.map(app => (
                <button
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 mb-2 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <img 
                      src={app.icon} 
                      alt={`${app.name} 로고`}
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                  <div className="font-medium text-gray-800 group-hover:text-purple-700">
                    {app.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-blue-500">💡</span>
              <div>
                <div className="font-medium mb-1">이용 안내</div>
                <ul className="space-y-1">
                  <li>• 앱이 설치되지 않은 경우 자동으로 스토어로 이동합니다</li>
                  <li>• 분석 완료 후 추가 질문으로 심화 분석이 가능합니다</li>
                  <li>• 모든 분석은 선택하신 AI 앱의 무료 크레딧을 사용합니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisModal;
