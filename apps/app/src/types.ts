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
}
