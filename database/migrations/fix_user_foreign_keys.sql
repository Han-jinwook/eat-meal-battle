-- 모든 테이블의 사용자 ID 외래키(Foreign Key) 제약조건 수정
-- 기존 auth.users(id) 참조에서 public.users(id) 참조로 변경합니다.
-- (Merlin Hub를 통한 외부 인증 사용자는 로컬 auth.users 테이블에 생성되지 않고 public.users 테이블에만 동기화되므로)

-- 1. meal_images 테이블 수정
ALTER TABLE public.meal_images 
DROP CONSTRAINT IF EXISTS meal_images_uploaded_by_fkey;

ALTER TABLE public.meal_images 
ADD CONSTRAINT meal_images_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;


-- 2. comments 테이블 수정
ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;


-- 3. comment_replies 테이블 수정
ALTER TABLE public.comment_replies
DROP CONSTRAINT IF EXISTS comment_replies_user_id_fkey;

ALTER TABLE public.comment_replies
ADD CONSTRAINT comment_replies_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

ALTER TABLE public.comment_replies
DROP CONSTRAINT IF EXISTS comment_replies_reply_to_user_id_fkey;

ALTER TABLE public.comment_replies
ADD CONSTRAINT comment_replies_reply_to_user_id_fkey
FOREIGN KEY (reply_to_user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;


-- 4. comment_likes 테이블 수정
ALTER TABLE public.comment_likes
DROP CONSTRAINT IF EXISTS comment_likes_user_id_fkey;

ALTER TABLE public.comment_likes
ADD CONSTRAINT comment_likes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;


-- 5. reply_likes 테이블 수정
ALTER TABLE public.reply_likes
DROP CONSTRAINT IF EXISTS reply_likes_user_id_fkey;

ALTER TABLE public.reply_likes
ADD CONSTRAINT reply_likes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;


-- 6. meal_ratings 테이블 수정
ALTER TABLE public.meal_ratings
DROP CONSTRAINT IF EXISTS meal_ratings_user_id_fkey;

ALTER TABLE public.meal_ratings
ADD CONSTRAINT meal_ratings_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;


-- 7. school_infos 테이블 수정
ALTER TABLE public.school_infos
DROP CONSTRAINT IF EXISTS school_infos_user_id_fkey;

ALTER TABLE public.school_infos
ADD CONSTRAINT school_infos_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;


-- 8. interest_schools 테이블 수정
ALTER TABLE public.interest_schools
DROP CONSTRAINT IF EXISTS interest_schools_user_id_fkey;

ALTER TABLE public.interest_schools
ADD CONSTRAINT interest_schools_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;
