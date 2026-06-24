-- comments 테이블의 meal_id 외래키(Foreign Key) 제약조건 수정
-- 기존 meal_menus(id) 참조에서 public.meal_images(id) 참조로 변경합니다.
-- (comments는 사용자의 식사 일지 기록(meal_images)에 대한 댓글을 저장하는 테이블이므로)

-- 1. 기존 잘못된 외래키 제약조건 삭제
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_meal_id_fkey;

-- 2. meal_images 테이블에 존재하지 않는 meal_id를 가진 고아(Orphan) 댓글 데이터 정리
-- (제약조건 추가 시 오류 방지를 위해 수행합니다.)
DELETE FROM public.comments 
WHERE meal_id IS NOT NULL AND meal_id NOT IN (SELECT id FROM public.meal_images);

-- 3. public.meal_images(id)를 참조하도록 올바른 외래키 제약조건 추가
ALTER TABLE public.comments
ADD CONSTRAINT comments_meal_id_fkey
FOREIGN KEY (meal_id)
REFERENCES public.meal_images(id)
ON DELETE CASCADE;
