import React from 'react';
import { getSafeImageUrl, handleImageError } from '@/utils/imageUtils';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 이미지 로딩 오류를 자동으로 처리하는 안전한 이미지 컴포넌트
 * URL을 자동으로 안전하게 변환하고 오류를 처리합니다.
 */
const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  style = {}
}) => {
  const safeUrl = getSafeImageUrl(src);
  
  return (
    <img
      src={safeUrl}
      alt={alt}
      className={className}
      style={style}
      onError={handleImageError}
      loading="lazy"
    />
  );
};

export default ImageWithFallback;
