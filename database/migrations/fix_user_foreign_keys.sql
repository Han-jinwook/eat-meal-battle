-- 모든 테이블의 사용자 ID 외래키(Foreign Key) 제약조건 수정
-- 기존 auth.users(id) 참조에서 public.users(id) 참조로 변경합니다.
-- (Merlin Hub를 통한 외부 인증 사용자는 로컬 auth.users 테이블에 생성되지 않고 public.users 테이블에만 동기화되므로)

-- 1. 기존 외래키 제약조건 삭제
ALTER TABLE public.meal_images DROP CONSTRAINT IF EXISTS meal_images_uploaded_by_fkey;
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE public.comment_replies DROP CONSTRAINT IF EXISTS comment_replies_user_id_fkey;
ALTER TABLE public.comment_replies DROP CONSTRAINT IF EXISTS comment_replies_reply_to_user_id_fkey;
ALTER TABLE public.comment_likes DROP CONSTRAINT IF EXISTS comment_likes_user_id_fkey;
ALTER TABLE public.reply_likes DROP CONSTRAINT IF EXISTS reply_likes_user_id_fkey;
ALTER TABLE public.meal_ratings DROP CONSTRAINT IF EXISTS meal_ratings_user_id_fkey;
ALTER TABLE public.school_infos DROP CONSTRAINT IF EXISTS school_infos_user_id_fkey;
ALTER TABLE public.interest_schools DROP CONSTRAINT IF EXISTS interest_schools_user_id_fkey;


-- 2. public.users 테이블에 존재하지 않는 사용자 ID를 가지는 고아(Orphan) 데이터 정리
-- (제약조건 추가 시 에러 방지를 위해 먼저 수행합니다.)
DELETE FROM public.meal_images 
WHERE uploaded_by IS NOT NULL AND uploaded_by NOT IN (SELECT id FROM public.users);

DELETE FROM public.comments 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.comment_replies 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.comment_replies 
WHERE reply_to_user_id IS NOT NULL AND reply_to_user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.comment_likes 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.reply_likes 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.meal_ratings 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.school_infos 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.interest_schools 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);


-- 3. public.users(id)를 참조하도록 새로운 외래키 제약조건 추가
ALTER TABLE public.meal_images 
ADD CONSTRAINT meal_images_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

ALTER TABLE public.comment_replies
ADD CONSTRAINT comment_replies_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

ALTER TABLE public.comment_replies
ADD CONSTRAINT comment_replies_reply_to_user_id_fkey
FOREIGN KEY (reply_to_user_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

ALTER TABLE public.comment_likes
ADD CONSTRAINT comment_likes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

ALTER TABLE public.reply_likes
ADD CONSTRAINT reply_likes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

ALTER TABLE public.meal_ratings
ADD CONSTRAINT meal_ratings_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

ALTER TABLE public.school_infos
ADD CONSTRAINT school_infos_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

ALTER TABLE public.interest_schools
ADD CONSTRAINT interest_schools_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;
