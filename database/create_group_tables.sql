-- 1. 모임 그룹 테이블 생성
CREATE TABLE IF NOT EXISTS public.whateat_group_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 모임 구성원 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS public.whateat_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.whateat_group_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, user_id)
);

-- 3. 기존 식사 이미지 및 예약 테이블에 group_id 컬럼 추가
ALTER TABLE public.meal_images 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.whateat_group_groups(id) ON DELETE SET NULL;

ALTER TABLE public.meal_reservations 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.whateat_group_groups(id) ON DELETE SET NULL;

-- 4. RLS 정책 활성화 및 전체 SELECT 허용 (클라이언트단 조회용)
ALTER TABLE public.whateat_group_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.whateat_group_groups;
CREATE POLICY "Allow select for all" ON public.whateat_group_groups FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.whateat_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.whateat_group_members;
CREATE POLICY "Allow select for all" ON public.whateat_group_members FOR SELECT TO anon, authenticated USING (true);
