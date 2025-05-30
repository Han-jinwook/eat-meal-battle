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

export interface MealImage {
  id: string;
  meal_id: string;
  image_url: string;
  uploaded_by: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  // is_shared 필드 제거됨
  match_score?: number;
  explanation?: string;
  source?: 'user' | 'ai';
}
