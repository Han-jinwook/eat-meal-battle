-- RLS 정책 수정 및 추가 (인증/세션 안정성 개선)
-- Supabase Security Advisor에서 발견된 RLS 미적용 오류 해결

-- 1. meal_quizzes 테이블 RLS 정책
ALTER TABLE public.meal_quizzes ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 퀴즈를 볼 수 있음
CREATE POLICY "인증된 사용자는 퀴즈를 볼 수 있음" ON public.meal_quizzes
  FOR SELECT 
  TO authenticated
  USING (true);

-- 서비스 역할만 퀴즈를 생성할 수 있음 (자동 생성용)
CREATE POLICY "서비스 역할만 퀴즈 생성 가능" ON public.meal_quizzes
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- 2. quiz_results 테이블 RLS 정책
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 퀴즈 결과만 볼 수 있음
CREATE POLICY "사용자는 자신의 퀴즈 결과만 조회 가능" ON public.quiz_results
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

-- 사용자는 자신의 퀴즈 결과만 생성할 수 있음
CREATE POLICY "사용자는 자신의 퀴즈 결과만 생성 가능" ON public.quiz_results
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 퀴즈 결과만 수정할 수 있음
CREATE POLICY "사용자는 자신의 퀴즈 결과만 수정 가능" ON public.quiz_results
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. quiz_champions 테이블 RLS 정책
ALTER TABLE public.quiz_champions ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 챔피언 정보를 볼 수 있음
CREATE POLICY "인증된 사용자는 챔피언 정보 조회 가능" ON public.quiz_champions
  FOR SELECT 
  TO authenticated
  USING (true);

-- 사용자는 자신의 챔피언 기록만 생성할 수 있음
CREATE POLICY "사용자는 자신의 챔피언 기록만 생성 가능" ON public.quiz_champions
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 챔피언 기록만 수정할 수 있음
CREATE POLICY "사용자는 자신의 챔피언 기록만 수정 가능" ON public.quiz_champions
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. rating_settings 테이블 RLS 정책
ALTER TABLE public.rating_settings ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 평점 설정을 볼 수 있음
CREATE POLICY "인증된 사용자는 평점 설정 조회 가능" ON public.rating_settings
  FOR SELECT 
  TO authenticated
  USING (true);

-- 관리자만 평점 설정을 수정할 수 있음 (필요시 추가)
CREATE POLICY "서비스 역할만 평점 설정 수정 가능" ON public.rating_settings
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. 추가 보안 강화: meal_ratings 테이블 정책 개선 (이미 존재할 수 있지만 확인)
DO $$
BEGIN
  -- meal_ratings 테이블이 존재하는지 확인 후 RLS 활성화
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meal_ratings' AND table_schema = 'public') THEN
    ALTER TABLE public.meal_ratings ENABLE ROW LEVEL SECURITY;
    
    -- 기존 정책이 없다면 생성
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meal_ratings' AND policyname = '사용자는 자신의 평점만 관리 가능') THEN
      CREATE POLICY "사용자는 자신의 평점만 관리 가능" ON public.meal_ratings
        FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- 6. menu_item_ratings 테이블 RLS 정책 강화
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_ratings' AND table_schema = 'public') THEN
    ALTER TABLE public.menu_item_ratings ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_ratings' AND policyname = '사용자는 자신의 메뉴 평점만 관리 가능') THEN
      CREATE POLICY "사용자는 자신의 메뉴 평점만 관리 가능" ON public.menu_item_ratings
        FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- 완료 메시지
SELECT 'RLS 정책 적용 완료 - 인증/세션 안정성 개선됨' as status;
