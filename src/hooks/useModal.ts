import { useCallback, useState } from 'react';

/**
 * 공통 모달 상태 및 제어 로직을 캡슐화한 커스텀 훅
 *
 * 1. 모달 열기(openModal) 시 제목과 내용을 전달
 * 2. 모달 닫기(closeModal)
 * 3. 컴포넌트에서는 isOpen, title, content 값을 활용해 모달 UI를 렌더링
 */
export default function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // 모달 열기 (제목, 내용 설정)
  const openModal = useCallback((titleText: string, contentText: string) => {
    setTitle(titleText);
    setContent(contentText);
    setIsOpen(true);
  }, []);

  // 모달 닫기
  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    title,
    content,
    openModal,
    closeModal,
  } as const;
}
