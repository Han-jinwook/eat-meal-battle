'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase';

interface QuizShareButtonProps {
  userId: string;
  schoolName: string;
  userNickname?: string;
  userGrade?: number;
  userClass?: number;
  className?: string;
}

const QuizShareButton: React.FC<QuizShareButtonProps> = ({
  userId,
  schoolName,
  userNickname,
  userGrade,
  userClass,
  className = ''
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 초대 토큰 생성 함수 (iOS Safari 호환)
  const generateInviteToken = async (ownerId: string, ownerInfo: any) => {
    try {
      const tokenData = {
        quiz_owner_id: ownerId,
        owner_nickname: ownerInfo.nickname || '익명',
        school_name: ownerInfo.school_name || schoolName,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7일 후 만료
      };

      // iOS Safari 호환성을 위한 안전한 UTF-8 인코딩 후 Base64 변환
      const jsonString = JSON.stringify(tokenData);
      let base64String;
      
      if (typeof TextEncoder !== 'undefined') {
        // 최신 브라우저: TextEncoder 사용
        try {
          const utf8Bytes = new TextEncoder().encode(jsonString);
          base64String = btoa(String.fromCharCode(...utf8Bytes));
          console.log('TextEncoder로 토큰 생성 성공');
        } catch (textEncoderError) {
          console.warn('TextEncoder 실패, fallback 사용:', textEncoderError);
          const encodedString = unescape(encodeURIComponent(jsonString));
          base64String = btoa(encodedString);
        }
      } else {
        // iOS Safari 호환: escape/unescape 사용
        console.log('TextEncoder 없음, fallback 사용');
        try {
          const encodedString = unescape(encodeURIComponent(jsonString));
          base64String = btoa(encodedString);
          console.log('escape/unescape로 토큰 생성 성공');
        } catch (fallbackError) {
          console.warn('escape/unescape 실패, 직접 Base64 사용:', fallbackError);
          // 최종 fallback: 직접 Base64 인코딩
          base64String = btoa(jsonString);
        }
      }
      
      console.log('토큰 생성 완료, 길이:', base64String.length);
      
      return base64String;
    } catch (error) {
      console.error('토큰 생성 오류:', error);
      throw error;
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      // 초대 토큰 생성
      const token = await generateInviteToken(userId, {
        nickname: userNickname,
        school_name: schoolName
      });

      // 공유 URL 생성
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/quiz?viewer_invite=${token}`;

      // 학년/반 정보 구성
      const gradeClassInfo = userGrade && userClass ? `${userGrade}학년 ${userClass}반 ` : '';
      
      // 공유 내용 구성
      const shareTitle = `📚 ${userNickname || '학생'}님의 급식퀴즈 초대! 🎯`;
      const shareText = `${schoolName} ${gradeClassInfo}${userNickname || '학생'}님이 급식퀴즈 결과를 공유했어요!

📊 퀴즈 성적과 도전 현황을 확인해보세요
🏆 매일매일 새로운 급식퀴즈 도전 중!

#급식퀴즈 #학습현황 #부모자녀소통 #${schoolName.replace(/\s+/g, '')}`;

      // 네이티브 공유 API 지원 확인
      if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          });
          return;
        } catch (shareError: any) {
          if (shareError.name !== 'AbortError') {
            console.warn('네이티브 공유 실패, 클립보드 복사로 대체:', shareError);
          } else {
            return; // 사용자가 공유를 취소한 경우
          }
        }
      }

      // 클립보드 복사 (PC 또는 네이티브 공유 실패 시)
      const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
      await navigator.clipboard.writeText(fullShareContent);
      setShowSuccessModal(true);

    } catch (error) {
      console.error('공유 오류:', error);
      alert('공유 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <div className={`my-4 px-4 ${className}`}>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className={`w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${
            isSharing ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
          <div className="text-center">
            <div className="font-bold text-sm">
              {isSharing ? '초대 링크 생성중...' : '내 퀴즈 관심 공유하기'}
            </div>
            <div className="text-xs opacity-90">
              부모님, 가족, 즐친에게만
            </div>
          </div>
        </button>
      </div>

      {/* 성공 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">초대 링크 복사 완료! 🎉</h3>
              <p className="text-sm text-gray-600 mb-4">
                퀴즈 초대 링크가 클립보드에 복사되었습니다.<br/>
                카카오톡, 문자 등으로 가족에게 공유해보세요!
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-purple-700">
                  💡 <strong>팁:</strong> 링크를 받은 분이 클릭하면 자동으로 내 퀴즈를 구경할 수 있어요!
                </p>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-md hover:from-yellow-500 hover:to-yellow-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuizShareButton;
