import React, { useState } from 'react';

interface ShareButtonProps {
  mealDate: string;
  schoolName: string;
  schoolCode?: string;
  rating?: number;
  className?: string;
  isBattlePage?: boolean; // 배틀 페이지 여부 구분
  activeTab?: 'menu' | 'meal'; // 배틀 페이지의 현재 활성 탭
}

const ShareButton: React.FC<ShareButtonProps> = ({ 
  mealDate, 
  schoolName, 
  schoolCode, 
  rating, 
  className = '',
  isBattlePage = false,
  activeTab = 'meal'
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    try {
      // 공유할 텍스트와 URL 준비 - 배틀 페이지의 활성 탭에 따라 다르게 설정
      let shareTitle, shareText;
      
      if (isBattlePage) {
        if (activeTab === 'menu') {
          // 메뉴배틀 섹션
          shareTitle = `🍽️ ${schoolName} ${mealDate} 메뉴배틀 결과! 🥇`;
          shareText = `우리학교 인기 메뉴 순위를 확인해보세요! 오늘/이번달 최고의 메뉴는?
#메뉴배틀 #급식메뉴 #인기메뉴 #메뉴순위 #${schoolName.split(' ')[0]}`;
        } else {
          // 급식배틀 섹션 (meal)
          shareTitle = `🏆 ${schoolName} ${mealDate} 급식배틀 결과! 🥇`;
          shareText = `우리동네 급식배틀 순위를 확인해보세요! 메뉴별 배틀 & 학교별 배틀 결과 공개!
#급식배틀 #학교순위 #급식평가 #배틀결과 #${schoolName.split(' ')[0]}`;
        }
      } else {
        // 급식 페이지
        shareTitle = `📋 ${schoolName} ${mealDate} 오늘의 급식 평가! 👀`;
        shareText = `메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!
#급식평가 #맛평가 #학교급식 #급식배틀 #${schoolName.split(' ')[0]}`;
      }
      
      // URL에 필요한 파라미터 추가
      const url = new URL(window.location.href);
      if (!url.searchParams.has('date')) {
        url.searchParams.set('date', mealDate);
      }
      const finalSchoolCode = schoolCode || schoolName.split(' ')[0];
      url.searchParams.set('school_code', finalSchoolCode);
      
      // 레퍼럴 코드 로직 제거됨
      
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
      <div className={`flex justify-end ${className}`}>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className={`w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg flex items-center justify-center gap-2 min-h-[60px] ${isSharing ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          <div className="text-center">
            <div className="font-bold text-sm">
              {isSharing ? '공유 중...' : '공유하기'}
            </div>
            <div className="text-xs opacity-90">
              {isBattlePage 
                ? (activeTab === 'menu' ? '메뉴배틀 결과' : '급식배틀 결과')
                : '급식평가'
              }
            </div>
          </div>
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
                {isBattlePage 
                  ? (activeTab === 'menu' ? '메뉴배틀 결과가 클립보드에 복사되었습니다.' : '급식배틀 결과가 클립보드에 복사되었습니다.')
                  : '급식 평가 내용이 클립보드에 복사되었습니다.'}<br/>
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
