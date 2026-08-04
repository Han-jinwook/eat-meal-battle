-- meal_ratings 테이블의 meal_id 외래키(Foreign Key) 제약조건 수정
-- meal_ratings는 학교 급식(meal_menus)뿐만 아니라 가족방 직접 등록 식사(meal_images)도
-- 평점을 부여해야 하므로, meal_menus(id)에 걸려 있는 외래키 제약조건을 제거합니다.

-- 1. 기존 meal_menus(id)를 참조하는 잘못된 외래키 제약조건 삭제
ALTER TABLE public.meal_ratings DROP CONSTRAINT IF EXISTS meal_ratings_meal_id_fkey;
ALTER TABLE public.meal_ratings DROP CONSTRAINT IF EXISTS meal_ratings_meal_id_fkey1;
