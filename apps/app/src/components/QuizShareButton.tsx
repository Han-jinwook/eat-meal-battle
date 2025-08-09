'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useReferralCode } from '@/hooks/useReferralCode';

interface QuizShareButtonProps {
  userId: string;
  schoolName: string;
  userNickname?: string;
  className?: string;
}

const QuizShareButton: React.FC<QuizShareButtonProps> = ({
  userId,
  schoolName,
  userNickname,
  className = ''
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { referralCode } = useReferralCode();

  // 초대 토큰 생성 함수
  const generateInviteToken = async (ownerId: string, ownerInfo: any) => {
    try {
      const tokenData = {
        quiz_owner_id: ownerId,
        owner_nickname: ownerInfo.nickname || '익명',
        school_name: ownerInfo.school_name || schoolName,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7일 후 만료
        referral_code: referralCode
      };

      // Base64 인코딩으로 간단한 토큰 생성 (실제 운영에서는 JWT 등 사용 권장)
      const token = btoa(JSON.stringify(tokenData));
      return token;
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

      // 공유 내용 구성
      const shareTitle = `📚 ${userNickname || '학생'}님의 급식퀴즈 초대! 🎯`;
      const shareText = `${schoolName} ${userNickname || '학생'}님이 급식퀴즈 결과를 공유했어요!

📊 퀴즈 성적과 도전 현황을 확인해보세요
🏆 매일매일 새로운 급식퀴즈 도전 중!

#급식퀴즈 #학습현황 #부모자녀소통 #${schoolName.split(' ')[0]}`;

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
      <div className={`my-4 flex justify-center ${className}`}>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className={`px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105 ${
            isSharing ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
          <span className="font-medium">
            {isSharing ? '초대 링크 생성중...' : '내 퀴즈 공유하기'}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
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
                className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:from-purple-600 hover:to-pink-600 transition-colors"
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
