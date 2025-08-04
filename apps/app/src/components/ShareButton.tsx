import React, { useState } from 'react';

interface ShareButtonProps {
  mealDate: string;
  schoolName: string;
  schoolCode?: string;
  rating?: number;
  className?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ 
  mealDate, 
  schoolName, 
  schoolCode, 
  rating, 
  className = '' 
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    try {
      // 공유할 텍스트와 URL 준비
      const shareTitle = `📋 ${schoolName} ${mealDate} 오늘의 급식 평가! 👀`;
      const shareText = `메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!
#급식평가 #맛평가 #학교급식 #급식배틀 #${schoolName.split(' ')[0]}`;
      
      // URL에 필요한 파라미터 추가
      const url = new URL(window.location.href);
      if (!url.searchParams.has('date')) {
        url.searchParams.set('date', mealDate);
      }
      const finalSchoolCode = schoolCode || schoolName.split(' ')[0];
      url.searchParams.set('school_code', finalSchoolCode);
      const shareUrl = url.toString();
      
      // 모바일 체크
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (navigator.share && isMobile) {
        // 모바일: 바로 네이티브 공유
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } else {
        // PC: 클립보드 복사 + 성공 모달
        const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullShareContent);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('공유 중 오류 발생:', error);
      alert('공유 중 문제가 발생했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <div className={`my-4 flex justify-end ${className}`}>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className={`w-1/2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 ${isSharing ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
          {isSharing ? '공유 중...' : '급식평가 공유하기'}
        </button>
      </div>

      {/* PC 전용 성공 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-sm mx-4 p-6">
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">복사 완료!</h3>
              <p className="text-sm text-gray-600 mb-4">
                급식 평가 내용이 클립보드에 복사되었습니다.<br/>
                카카오톡, 이메일 등 원하는 곳에 붙여넣으세요!
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
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

export default ShareButton;
