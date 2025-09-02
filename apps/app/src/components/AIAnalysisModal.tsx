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
  prompt: string; // AI 분석 프롬프트 추가
}

const AIAnalysisModal = ({ 
  isOpen, 
  onClose, 
  schoolName, 
  monthYear, 
  isViewingMode,
  onSelectApp,
  prompt
}: AIAnalysisModalProps) => {
  
  // AI 앱 직접 실행 함수
  const handleDirectAIExecution = async (app: AIApp) => {
    onClose(); // 모달 먼저 닫기
    
    try {
      // 1. 프롬프트 생성 (기존 handleAIAppSelection 로직 사용)
      const currentSchool = { school_name: schoolName };
      const targetDate = new Date();
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      // 로딩 토스트
      showToast('📊 급식 데이터 분석 중...', '잠시만 기다려주세요', 'blue');

      // 급식 데이터 집계
      const apiUrl = `/.netlify/functions/ai-analysis-data?school_code=${schoolName}&year=${year}&month=${month}`;
      const analysisResponse = await fetch(apiUrl);
      
      if (!analysisResponse.ok) {
        throw new Error('데이터 집계 실패');
      }
      
      const analysisData = await analysisResponse.json();
      
      // AI 프롬프트 생성
      const promptPayload = {
        analysis_data: analysisData,
        school_code: schoolName
      };
      
      const promptResponse = await fetch('/.netlify/functions/generate-ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptPayload)
      });
      
      if (!promptResponse.ok) {
        throw new Error('프롬프트 생성 실패');
      }
      
      const promptData = await promptResponse.json();
      const generatedPrompt = promptData.prompt;

      // 2. 클립보드에 복사
      await navigator.clipboard.writeText(generatedPrompt);
      console.log('✅ 클립보드 복사 완료');
      
      // 프롬프트를 외부 스코프에서 접근 가능하도록 저장
      (window as any).lastGeneratedPrompt = generatedPrompt;
      
      // 2. 앱 감지 및 실행
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      let appOpened = false;
      const startTime = Date.now();
      
      // 앱 열림 감지 이벤트
      const handleVisibilityChange = () => {
        if (document.hidden || Date.now() - startTime > 500) {
          appOpened = true;
          console.log(`✅ ${app.name} 앱이 열린 것으로 감지됨`);
        }
      };
      
      const handleBlur = () => {
        appOpened = true;
        console.log(`✅ ${app.name} 앱이 열린 것으로 감지됨 (blur)`);
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      
      // 3. 딥링크 시도
      if (app.deepLink) {
        try {
          const encodedPrompt = encodeURIComponent(generatedPrompt);
          window.location.href = `${app.deepLink}?text=${encodedPrompt}`;
          
          // 2초 후 앱 열림 여부 확인
          setTimeout(() => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            
            if (!appOpened) {
              // 앱이 없으면 웹 열기
              console.log(`❌ ${app.name} 앱이 열리지 않음, 웹으로 폴백`);
              window.open(app.webUrl, '_blank');
              showToast(`📋 ${app.name} 웹 열림`, '클립보드에 복사됨 - Ctrl+V로 붙여넣기', 'blue');
            } else {
              showToast(`🚀 ${app.name} 앱 열림`, '자동으로 붙여넣기됩니다', 'green');
            }
          }, 2000);
          
        } catch (error) {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('blur', handleBlur);
          // 딥링크 실패 시 바로 웹 열기
          window.open(app.webUrl, '_blank');
          showToast(`📋 ${app.name} 웹 열림`, '클립보드에 복사됨 - Ctrl+V로 붙여넣기', 'blue');
        }
      } else {
        // 딥링크 없으면 바로 웹 열기
        window.open(app.webUrl, '_blank');
        showToast(`📋 ${app.name} 웹 열림`, '클립보드에 복사됨 - Ctrl+V로 붙여넣기', 'blue');
      }
      
    } catch (error) {
      console.warn('클립보드 복사 실패:', error);
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      
      // iOS 클립보드 실패 시 모달 표시
      if (isIOS) {
        setTimeout(() => {
          const modal = document.createElement('div');
          modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000;
            background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
          `;
          modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 12px; max-width: 90%; max-height: 80%; overflow-y: auto;">
              <h3 style="margin: 0 0 15px 0; color: #333;">📋 텍스트를 복사하세요</h3>
              <textarea readonly style="width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: none;">${(window as any).lastGeneratedPrompt || '프롬프트 생성 실패'}</textarea>
              <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button onclick="window.open('${app.webUrl}', '_blank')" style="flex: 1; padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 6px; font-size: 16px;">${app.name} 웹 열기</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 6px; font-size: 16px;">닫기</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
        }, 1000);
      } else {
        // iOS가 아니면 그냥 웹 열기
        window.open(app.webUrl, '_blank');
      }
      
      showToast(`📋 ${app.name} 열림`, '수동으로 분석 요청해주세요', 'orange');
    }
  };
  
  // 토스트 메시지 표시 함수
  const showToast = (title: string, message: string, color: string) => {
    const toast = document.createElement('div');
    const bgColor = color === 'green' ? '#10b981' : color === 'orange' ? '#f59e0b' : '#3b82f6';
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      background: ${bgColor}; color: white; padding: 12px 20px; border-radius: 8px;
      font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
    `;
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">${color === 'green' ? '🚀' : color === 'orange' ? '⚠️' : '📋'}</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">${title}</div>
          <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 4000);
  };
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

          {/* AI 앱 선택 - 통합 버튼 */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">AI 앱 선택</h4>
            <div className="grid grid-cols-1 gap-3">
              {aiApps.map(app => (
                <button
                  key={app.id}
                  onClick={() => handleDirectAIExecution(app)}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 group-hover:scale-110 transition-transform flex items-center justify-center">
                      <img 
                        src={app.icon} 
                        alt={`${app.name} 로고`}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-gray-800 group-hover:text-purple-700 text-lg mb-1">
                        {app.name}
                      </div>
                      <div className="text-sm text-gray-600 group-hover:text-purple-600">
                        📋 복사 + 🌐 웹열기 + 🚀 자동분석
                      </div>
                    </div>
                    <div className="text-purple-500 group-hover:text-purple-700 text-2xl">
                      →
                    </div>
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
                  <li>• <strong>앱 있으면:</strong> 자동으로 앱 열림 + 자동 붙여넣기</li>
                  <li>• <strong>앱 없으면:</strong> 웹 열림 + Ctrl+V로 붙여넣기</li>
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
