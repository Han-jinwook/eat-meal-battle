-- 가계정 생성 SQL 스크립트 (실제 거점 학교 정보 적용)

-- 1. 거점 학교 확인
SELECT school_code, school_name, region FROM seed_schools WHERE is_active = true;

-- 2. 가계정 생성 (15개 거점 학교에 각각 2-3명씩)

-- === 서울 지역 ===
-- 가계정 1: 콩순이 (서울한강초등학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, 
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_b100000003_kongsooni@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_b100000003_kongsooni@simulation.test'),
  'sim_b100000003_kongsooni@simulation.test', '콩순이',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=콩순이', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_b100000003_kongsooni@simulation.test'),
  'B100000003', '서울한강초등학교', 4, 2, now()
);

-- 가계정 2: 토마토킹 (서울명덕중학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_b100000002_tomatoking@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_b100000002_tomatoking@simulation.test'),
  'sim_b100000002_tomatoking@simulation.test', '토마토킹',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=토마토킹', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_b100000002_tomatoking@simulation.test'),
  'B100000002', '서울명덕중학교', 2, 1, now()
);

-- 가계정 3: 피카츄 (서울청라고등학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_b100000001_pikachu@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_b100000001_pikachu@simulation.test'),
  'sim_b100000001_pikachu@simulation.test', '피카츄',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=피카츄', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_b100000001_pikachu@simulation.test'),
  'B100000001', '서울청라고등학교', 1, 3, now()
);

-- === 경기 지역 ===
-- 가계정 4: 딸기공주 (안양평촌초등학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_c100000003_strawberry@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_c100000003_strawberry@simulation.test'),
  'sim_c100000003_strawberry@simulation.test', '딸기공주',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=딸기공주', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_c100000003_strawberry@simulation.test'),
  'C100000003', '안양평촌초등학교', 5, 1, now()
);

-- 가계정 5: 바나나킹 (성남분당중학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_c100000002_banana@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_c100000002_banana@simulation.test'),
  'sim_c100000002_banana@simulation.test', '바나나킹',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=바나나킹', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_c100000002_banana@simulation.test'),
  'C100000002', '성남분당중학교', 3, 2, now()
);

-- 가계정 6: 쿠키몬스터 (수원영통고등학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_c100000001_cookie@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_c100000001_cookie@simulation.test'),
  'sim_c100000001_cookie@simulation.test', '쿠키몬스터',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=쿠키몬스터', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_c100000001_cookie@simulation.test'),
  'C100000001', '수원영통고등학교', 2, 4, now()
);

-- === 기타 지역 (각 지역별 1명씩) ===
-- 가계정 7: 라이언 (인천송도고등학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_d100000001_ryan@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_d100000001_ryan@simulation.test'),
  'sim_d100000001_ryan@simulation.test', '라이언',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=라이언', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_d100000001_ryan@simulation.test'),
  'D100000001', '인천송도고등학교', 1, 2, now()
);

-- 가계정 8: 어피치 (부산해운대고등학교)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'sim_e100000001_apeach@simulation.test',
  crypt('simulation123!', gen_salt('bf')), now(), now(), now(),
  'authenticated', 'authenticated'
);

INSERT INTO users (id, email, nickname, profile_image, is_student, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_e100000001_apeach@simulation.test'),
  'sim_e100000001_apeach@simulation.test', '어피치',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=어피치', true, now()
);

INSERT INTO school_infos (user_id, school_code, school_name, grade, class_number, created_at) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sim_e100000001_apeach@simulation.test'),
  'E100000001', '부산해운대고등학교', 3, 1, now()
);

-- 생성 확인 쿼리
SELECT 
  u.nickname,
  u.email,
  si.school_name,
  si.grade,
  si.class_number
FROM users u
JOIN school_infos si ON u.id = si.user_id
WHERE u.email LIKE '%@simulation.test'
ORDER BY u.created_at DESC;
