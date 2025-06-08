import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';
import styles from './StarRating.module.css';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  interactive?: boolean;
  size?: 'small' | 'medium' | 'large';
  showValue?: boolean;
  ratingCount?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ 
  value = 0, 
  onChange, 
  interactive = false,
  size = 'medium',
  showValue = false,
  ratingCount
}) => {
  // 컴포넌트 마운트 상태 추적 (웨일 브라우저 호환성용)
  const isMounted = useRef<boolean>(true);
  
  // 클릭 디바운싱 및 연속 클릭 방지
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const processingTimeoutRef = useRef<number | null>(null);
  // 소수점 1자리까지 반올림
  const roundedValue = Math.round(value * 10) / 10;
  
  // 별 크기 설정
  const sizeClass = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large
  }[size];
  
  // 색상 설정 (4.0 이상: 긍정, 3.0-3.9: 중립, 3.0 미만: 부정)
  const colorClass = roundedValue >= 4.0 
    ? styles.positive 
    : roundedValue >= 3.0 
      ? styles.neutral 
      : styles.negative;
  
  // 별 아이콘 렌더링 함수
  const renderStar = (index: number) => {
    const filled = roundedValue >= index + 1;
    const halfFilled = roundedValue >= index + 0.5 && roundedValue < index + 1;
    
    if (filled) {
      return <FaStar className={`${styles.star} ${styles.filled} ${colorClass}`} />;
    }
    if (halfFilled) {
      return <FaStarHalfAlt className={`${styles.star} ${styles.halfFilled} ${colorClass}`} />;
    }
    return <FaRegStar className={`${styles.star} ${styles.empty}`} />;
  };
  
  // 마운트 해제 시 정리
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (processingTimeoutRef.current !== null) {
        window.clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    };
  }, []);

  // 별점 클릭 이벤트 처리 - 웨일 브라우저 호환성 강화
  const handleStarClick = useCallback((index: number, e?: React.MouseEvent) => {
    // 이벤트 버블링 방지
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 처리 중 상태이거나 인터랙티브가 아니면 스킵
    if (processingRef.current || !interactive) return;
    
    // 처리 중 플래그 설정
    processingRef.current = true;

    // 마운트 상태 확인
    if (!isMounted.current) {
      processingRef.current = false;
      return;
    }

    // 조금 더 명확한 시각적 피드백 제공
    setCursor('pointer');
    setOpacity(0.6); // 클릭 시 약간 투명하게

    // 안전한 상태 업데이트
    const newValue = index + 1; // 1부터 5까지의 점수
    
    // setTimeout 대신 requestAnimationFrame 사용하여 렌더링 성능 최적화
    requestAnimationFrame(() => {
      // DOM 업데이트 전에 다시 한 번 마운트 상태 확인
      if (!isMounted.current) {
        processingRef.current = false;
        return;
      }
      
      // 부모 컴포넌트에 변경 통지 (안전하게 호출)
      try {
        if (onChange && isMounted.current) onChange(newValue);
      } catch (err) {
        console.error('별점 변경 호출 오류:', err);
      }

      // 시각적 피드백 상태 초기화
      setTimeout(() => {
        if (isMounted.current) {
          setCursor('default');
          setOpacity(1);
          processingRef.current = false;
        }
      }, 150); // 짧은 시각 피드백
    });
  }, [interactive, onChange]);

      });
    } catch (error) {
      console.error('별점 클릭 처리 중 오류:', error);
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [interactive, onChange, isProcessing]);
  
  // 안전한 렌더링을 위한 별 아이템 배열 메모이제이션
  const starItems = React.useMemo(() => {
    return [0, 1, 2, 3, 4].map((index) => (
      <span 
        key={index} 
        onClick={(e) => {
          // 이벤트 전파 방지로 DOM 이벤트 충돌 방지
          e.stopPropagation();
          // 안전하게 클릭 핸들러 호출
          handleClick(index);
        }}
        style={{
          cursor: interactive && !isProcessing ? 'pointer' : 'default',
          opacity: isProcessing ? 0.7 : 1,
          transition: 'opacity 0.2s ease-in-out' // 부드러운 상태 전환
        }}
        role="button"
        aria-label={`${index + 1}점 평가하기`}
      >
        {renderStar(index)}
      </span>
    ));
  }, [interactive, isProcessing, renderStar, handleClick]);
  
  return (
    <div className={styles.container}>
      <div className={`${styles.starRating} ${sizeClass}`}>
        {starItems}
      </div>
      
      {showValue && roundedValue > 0 && (
        <div className={styles.ratingInfo}>
          <span className={`${styles.ratingValue} ${colorClass}`}>
            {roundedValue.toFixed(1)}
          </span>
          {ratingCount !== undefined && (
            <span className={styles.ratingCount}>
              ({ratingCount}명)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StarRating;
