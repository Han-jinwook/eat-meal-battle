// Shared type definitions reused across components

export interface MealInfo {
  id: string;
  school_code: string;
  office_code: string;
  school_name?: string;
  meal_date: string;
  meal_type: string;
  menu_items: string[];
  kcal: string;
  ntr_info?: string;
  origin_info?: string;
  created_at: string;
  menuItems?: MealMenuItem[]; // 개별 메뉴 아이템 배열
}

// 메뉴 아이템 타입
export interface MealMenuItem {
  id: string;
  meal_id: string;
  item_name: string;
  item_order: number;
  created_at: string;
  updated_at: string;
  avg_rating?: number;   // 평균 별점
  rating_count?: number; // 평가 횟수
  user_rating?: number;  // 현재 사용자가 매긴 별점
}
