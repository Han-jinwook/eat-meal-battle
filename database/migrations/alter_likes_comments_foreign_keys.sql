-- meal_likes 및 comments 테이블의 meal_id 컬럼 외래키 제약조건 제거
-- 가족 위시리스트/예약 카드(meal_reservations)에 대한 좋아요 및 댓글 작성을 허용하기 위해
-- meal_images(식사 이미지 일지) 테이블에만 결합되어 있던 외래키 제약조건을 해제합니다.

ALTER TABLE public.meal_likes DROP CONSTRAINT IF EXISTS meal_likes_meal_id_fkey;
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_meal_id_fkey;
