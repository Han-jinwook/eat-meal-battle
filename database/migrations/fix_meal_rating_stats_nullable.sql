-- meal_rating_stats 테이블의 school_code 컬럼에 대해 NOT NULL 제약조건 제거
-- 가족방 직접 등록 식사는 학교 코드가 존재하지 않으므로(NULL),
-- 평점 통계 집계 시 에러가 나지 않도록 NULL을 허용합니다.

ALTER TABLE public.meal_rating_stats ALTER COLUMN school_code DROP NOT NULL;
