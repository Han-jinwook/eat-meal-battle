import React from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 기본 버튼 컴포넌트
 * @example
 * <Button variant=\
primary\ size=\md\ onClick={() => console.log('clicked')}>
 *   버튼 텍스트
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
}) => {
  // 이 컴포넌트는 기본 HTML만 사용하며, 스타일링은 각 앱에서 처리합니다.
  // 실제 구현에서는 Tailwind나 다른 CSS 프레임워크를 활용할 수 있습니다.
  return (
    <button
      type=\button\
      onClick={onClick}
      disabled={disabled}
      className={tn btn-\ btn-\ \}
    >
      {children}
    </button>
  );
};
