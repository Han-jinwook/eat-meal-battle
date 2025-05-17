import React from 'react';
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
  
  // 별점 클릭 핸들러
  const handleClick = (index: number) => {
    if (interactive && onChange) {
      onChange(index + 1);
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={`${styles.starRating} ${sizeClass}`}>
        {[0, 1, 2, 3, 4].map((index) => (
          <span 
            key={index} 
            onClick={() => handleClick(index)}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            {renderStar(index)}
          </span>
        ))}
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
