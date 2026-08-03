---
제목: 뭐먹지? (WhatEat) 데이터베이스 스키마 명세서
버전: v1.6
일시: 2026-08-03
---

# 💾 뭐먹지? (WhatEat) 데이터베이스 스키마 명세서

본 문서는 '뭐먹지?(WhatEat)' 서비스의 Supabase DB에 활성화되어 있는 핵심 테이블과 컬럼 구조를 정리한 스키마 명세서입니다.

---

## 📋 전체 스키마 테이블

| table_name            | column_name       | data_type                   | is_nullable |
| --------------------- | ----------------- | --------------------------- | ----------- |
| comment_replies       | id                | uuid                        | NO          |
| comment_replies       | comment_id        | uuid                        | YES         |
| comment_replies       | user_id           | uuid                        | YES         |
| comment_replies       | content           | text                        | NO          |
| comment_replies       | created_at        | timestamp with time zone    | YES         |
| comment_replies       | updated_at        | timestamp with time zone    | YES         |
| comment_replies       | is_deleted        | boolean                     | YES         |
| comment_replies       | reply_to_user_id  | uuid                        | YES         |
| comments              | id                | uuid                        | NO          |
| comments              | meal_id           | uuid                        | YES         |
| comments              | user_id           | uuid                        | YES         |
| comments              | content           | text                        | NO          |
| comments              | created_at        | timestamp with time zone    | YES         |
| comments              | updated_at        | timestamp with time zone    | YES         |
| comments              | is_deleted        | boolean                     | YES         |
| interest_schools      | id                | uuid                        | NO          |
| interest_schools      | user_id           | uuid                        | NO          |
| interest_schools      | school_code       | character varying           | NO          |
| interest_schools      | school_name       | character varying           | NO          |
| interest_schools      | created_at        | timestamp without time zone | YES         |
| interest_schools      | updated_at        | timestamp without time zone | YES         |
| interest_schools      | office_code       | character varying           | YES         |
| interest_schools      | region            | text                        | YES         |
| interest_schools      | school_type       | text                        | YES         |
| meal_image_reports    | id                | uuid                        | NO          |
| meal_image_reports    | image_id          | uuid                        | YES         |
| meal_image_reports    | reporter_id       | uuid                        | NO          |
| meal_image_reports    | school_code       | text                        | NO          |
| meal_image_reports    | meal_date         | date                        | NO          |
| meal_image_reports    | meal_type         | text                        | NO          |
| meal_image_reports    | image_url         | text                        | NO          |
| meal_image_reports    | uploader_nickname | text                        | YES         |
| meal_image_reports    | report_reason     | text                        | YES         |
| meal_image_reports    | status            | text                        | YES         |
| meal_image_reports    | admin_notes       | text                        | YES         |
| meal_image_reports    | created_at        | timestamp with time zone    | YES         |
| meal_image_reports    | reviewed_at       | timestamp with time zone    | YES         |
| meal_image_reports    | reviewed_by       | uuid                        | YES         |
| meal_images           | id                | uuid                        | NO          |
| meal_images           | meal_id           | uuid                        | YES         |
| meal_images           | image_url         | text                        | NO          |
| meal_images           | uploaded_by       | uuid                        | YES         |
| meal_images           | match_score       | integer                     | YES         |
| meal_images           | status            | text                        | YES         |
| meal_images           | created_at        | timestamp with time zone    | YES         |
| meal_images           | explanation       | text                        | YES         |
| meal_images           | source            | text                        | YES         |
| meal_images           | title             | text                        | YES         |
| meal_images           | rating            | integer                     | YES         |
| meal_images           | meal_type         | text                        | YES         |
| meal_images           | link_url          | text                        | YES         |
| meal_images           | link_thumbnail    | text                        | YES         |
| meal_images           | place_name        | text                        | YES         |
| meal_images           | place_address     | text                        | YES         |
| meal_images           | description       | text                        | YES         |
| meal_likes            | id                | uuid                        | NO          |
| meal_likes            | meal_id           | uuid                        | YES         |
| meal_likes            | user_id           | uuid                        | YES         |
| meal_likes            | created_at        | timestamp with time zone    | YES         |
| meal_menu_items       | id                | uuid                        | NO          |
| meal_menu_items       | meal_id           | uuid                        | NO          |
| meal_menu_items       | item_name         | text                        | NO          |
| meal_menu_items       | item_order        | integer                     | NO          |
| meal_menu_items       | created_at        | timestamp with time zone    | YES         |
| meal_menu_items       | updated_at        | timestamp with time zone    | YES         |
| meal_menus            | id                | uuid                        | NO          |
| meal_menus            | school_code       | text                        | NO          |
| meal_menus            | meal_date         | text                        | NO          |
| meal_menus            | meal_type         | text                        | NO          |
| meal_menus            | menu_items        | jsonb                       | YES         |
| meal_menus            | kcal              | text                        | YES         |
| meal_menus            | origin_info       | text                        | YES         |
| meal_menus            | ntr_info          | text                        | YES         |
| meal_menus            | created_at        | timestamp with time zone    | YES         |
| meal_menus            | updated_at        | timestamp with time zone    | YES         |
| meal_menus            | is_empty_result   | boolean                     | YES         |
| meal_menus            | office_code       | character varying           | YES         |
| meal_menus            | is_temporary      | boolean                     | YES         |
| meal_quizzes          | id                | uuid                        | NO          |
| meal_quizzes          | school_code       | text                        | NO          |
| meal_quizzes          | grade             | integer                     | NO          |
| meal_quizzes          | meal_date         | date                        | NO          |
| meal_quizzes          | meal_id           | uuid                        | YES         |
| meal_quizzes          | question          | text                        | NO          |
| meal_quizzes          | options           | jsonb                       | NO          |
| meal_quizzes          | correct_answer    | integer                     | NO          |
| meal_quizzes          | created_at        | timestamp with time zone    | YES         |
| meal_quizzes          | explanation       | text                        | YES         |
| meal_quizzes          | report_status     | character varying           | YES         |
| meal_rating_stats     | meal_id           | uuid                        | NO          |
| meal_rating_stats     | school_code       | text                        | NO          |
| meal_rating_stats     | avg_rating        | numeric                     | YES         |
| meal_rating_stats     | rating_count      | integer                     | YES         |
| meal_rating_stats     | grade1_avg        | numeric                     | YES         |
| meal_rating_stats     | grade1_count      | integer                     | YES         |
| meal_rating_stats     | grade2_avg        | numeric                     | YES         |
| meal_rating_stats     | grade2_count      | integer                     | YES         |
| meal_rating_stats     | grade3_avg        | numeric                     | YES         |
| meal_rating_stats     | grade3_count      | integer                     | YES         |
| meal_rating_stats     | grade4_avg        | numeric                     | YES         |
| meal_rating_stats     | grade4_count      | integer                     | YES         |
| meal_rating_stats     | grade5_avg        | numeric                     | YES         |
| meal_rating_stats     | grade5_count      | integer                     | YES         |
| meal_rating_stats     | grade6_avg        | numeric                     | YES         |
| meal_rating_stats     | grade6_count      | integer                     | YES         |
| meal_rating_stats     | updated_at        | timestamp with time zone    | YES         |
| meal_ratings          | id                | uuid                        | NO          |
| meal_ratings          | user_id           | uuid                        | YES         |
| meal_ratings          | meal_id           | uuid                        | NO          |
| meal_ratings          | rating            | real                        | NO          |
| meal_ratings          | created_at        | timestamp with time zone    | YES         |
| meal_ratings          | updated_at        | timestamp with time zone    | YES         |
| school_infos          | user_id           | uuid                        | NO          |
| school_infos          | school_code       | text                        | YES         |
| school_infos          | school_name       | text                        | YES         |
| school_infos          | school_type       | text                        | YES         |
| school_infos          | region            | text                        | YES         |
| school_infos          | address           | text                        | YES         |
| school_infos          | grade             | integer                     | YES         |
| school_infos          | class_number      | integer                     | YES         |
| school_infos          | created_at        | timestamp with time zone    | YES         |
| school_infos          | updated_at        | timestamp with time zone    | YES         |
| school_infos          | office_code       | character varying           | YES         |
| schools               | id                | bigint                      | NO          |
| schools               | created_at        | timestamp with time zone    | YES         |
| schools               | name              | text                        | NO          |
| schools               | code              | text                        | NO          |
| schools               | office_code       | text                        | NO          |
| schools               | region            | text                        | YES         |
| schools               | address           | text                        | YES         |
| seed_schools          | id                | bigint                      | NO          |
| seed_schools          | school_name       | text                        | NO          |
| seed_schools          | school_code       | text                        | NO          |
| seed_schools          | region            | text                        | YES         |
| seed_schools          | is_active         | boolean                     | YES         |
| seed_schools          | created_at        | timestamp with time zone    | YES         |
| users                 | id                | uuid                        | NO          |
| users                 | nickname          | character varying           | NO          |
| users                 | email             | character varying           | NO          |
| users                 | profile_image     | text                        | NO          |
| users                 | birth_date        | date                        | YES         |
| users                 | provider          | character varying           | NO          |
| users                 | provider_id       | character varying           | NO          |
| users                 | created_at        | timestamp with time zone    | YES         |
| users                 | is_student        | boolean                     | NO          |
| users                 | updated_at        | timestamp with time zone    | YES         |
| users                 | referral_code     | character varying           | YES         |
| users                 | is_activated      | boolean                     | YES         |
| users                 | accumulated_seconds | integer                   | YES         |
| users                 | region            | text                        | YES         |
| whateat_family_groups | id                | uuid                        | NO          |
| whateat_family_groups | owner_id          | uuid                        | NO          |
| whateat_family_groups | name              | character varying           | NO          |
| whateat_family_groups | family_photo      | text                        | YES         |
| whateat_family_groups | created_at        | timestamp with time zone    | YES         |
| whateat_family_members| id                | uuid                        | NO          |
| whateat_family_members| family_id         | uuid                        | NO          |
| whateat_family_members| user_id           | uuid                        | NO          |
| whateat_family_members| role              | character varying           | NO          |
| whateat_family_members| joined_at         | timestamp with time zone    | YES         |

---

## 🔗 주요 테이블 관계 (Relations)

| 관계                                                                    | 설명                        |
| ----------------------------------------------------------------------- | --------------------------- |
| `whateat_family_groups.owner_id` → `users.id`                           | 가족 그룹의 방장(owner)     |
| `whateat_family_members.family_id` → `whateat_family_groups.id`         | 가족 그룹 소속              |
| `whateat_family_members.user_id` → `users.id`                           | 가족 구성원 유저            |
| `comments.user_id` → `users.id`                                         | 댓글 작성자                 |
| `comments.meal_id` → `meal_images.id`                                   | 댓글 대상 식사 이미지       |
| `comment_replies.comment_id` → `comments.id`                            | 답글 대상 댓글              |
| `comment_replies.user_id` → `users.id`                                  | 답글 작성자                 |
| `comment_replies.reply_to_user_id` → `users.id`                         | 답글 대상 유저              |
| `meal_images.meal_id` → `meal_menus.id`                                 | 이미지 연결 급식 메뉴       |
| `meal_images.uploaded_by` → `users.id`                                  | 이미지 업로더               |
| `meal_image_reports.reporter_id` → `users.id`                           | 신고자                      |
| `meal_likes.meal_id` → `meal_images.id`                                 | 좋아요 대상 이미지          |
| `meal_likes.user_id` → `users.id`                                       | 좋아요 유저                 |
| `meal_ratings.meal_id` → `meal_menus.id`                                | 평가 대상 급식              |
| `meal_ratings.user_id` → `users.id`                                     | 평가 유저                   |
| `meal_rating_stats.meal_id` → `meal_menus.id`                           | 집계 대상 급식              |
| `meal_menu_items.meal_id` → `meal_menus.id`                             | 메뉴 항목 소속 급식         |
| `meal_quizzes.meal_id` → `meal_menus.id`                                | 퀴즈 대상 급식              |
| `interest_schools.user_id` → `users.id`                                 | 관심 학교 등록 유저         |
| `school_infos.user_id` → `users.id`                                     | 유저 학교 정보              |

---

## 📝 테이블별 주요 비고

### `whateat_family_groups`
- `owner_id`: 가족 그룹의 방장(1인). `users.id` 참조
- 허브(Merlin Hub) 패밀리와 명확한 구분을 위해 `whateat_family_groups` 테이블명으로 운영

### `whateat_family_members`
- `role`: `'owner'` 또는 `'member'` (character varying)
- 한 유저는 하나의 가족 그룹에만 속할 수 있음
- 허브(Merlin Hub) 패밀리와 명확한 구분을 위해 `whateat_family_members` 테이블명으로 운영

### `meal_menus`
- `is_temporary`: 임시 데이터 여부 플래그
- `is_empty_result`: 급식 없는 날(공결) 여부
- `menu_items`: jsonb 타입 (파싱된 메뉴 항목 배열)

### `meal_images`
- `source`: 이미지 출처 (`'user_upload'`, `'web_crawl'` 등)
- `status`: 검토 상태 (`'pending'`, `'approved'`, `'rejected'` 등)
- `match_score`: AI 매칭 점수

### `meal_rating_stats`
- 집계 뷰(View) 또는 통계 테이블로, `meal_id` + `school_code` 기준으로 학년별 평점 집계

### `users`
- `is_student`: 학생 여부
- `accumulated_seconds`: 누적 앱 사용 시간(초)
- `provider`: 소셜 로그인 제공자 (`'kakao'`, `'google'` 등)

---

> **참고**: 본 문서는 `whateat_family_groups`, `whateat_family_members` 테이블명 변경 사항을 반영하여 업데이트되었습니다. (v1.6, 2026-08-03)
