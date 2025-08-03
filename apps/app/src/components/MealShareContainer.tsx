import React, { useState } from 'react';
import { MealInfo } from '@/types';
import MealCard from './MealCard';
import ShareButton from './ShareButton';
import ShareModal from './ShareModal';

interface MealShareContainerProps {
  meal: MealInfo;
  onShowOrigin: (info: string) => void;
  onShowNutrition: (meal: MealInfo) => void;
  onUploadSuccess: () => void;
  onUploadError: (error: string) => void;
  // 추후 댓글 관련 props 추가 가능
}

/**
 * MealCard와 ShareButton, ShareModal을 조합한 컨테이너 컴포넌트
 * MealCard와 댓글 컴포넌트 사이에 ShareButton을 배치
 */
const MealShareContainer: React.FC<MealShareContainerProps> = ({
  meal,
  onShowOrigin,
  onShowNutrition,
  onUploadSuccess,
  onUploadError,
}) => {
  // 공유 모달 상태 관리
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // 공유 모달 열기
  const openShareModal = () => {
    console.log('공유 모달 열기');
    setIsShareModalOpen(true);
  };
  
  // 공유 모달 닫기
  const closeShareModal = () => {
    console.log('공유 모달 닫기');
    setIsShareModalOpen(false);
  };

  return (
    <div>
      {/* 급식 카드 컴포넌트 */}
      <MealCard
        meal={meal}
        onShowOrigin={onShowOrigin}
        onShowNutrition={onShowNutrition}
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />
      
      {/* 공유 버튼 컴포넌트 */}
      <ShareButton 
        onClick={openShareModal} 
      />
      
      {/* 여기에 댓글 컴포넌트가 들어갈 수 있음 */}
      {/* <CommentSection mealId={meal.id} /> */}
      
      {/* 공유 모달 */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={closeShareModal}
        mealDate={meal.meal_date}
        schoolName={meal.school_name || '학교정보 없음'}
        rating={4.1} // 실제 평점 데이터로 대체 필요
      />
    </div>
  );
};

export default MealShareContainer;
