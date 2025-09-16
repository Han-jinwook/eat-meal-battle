// 댓글 시스템에서 사용하는 공통 타입 정의

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user: {
    id: string;
    email: string;
    user_metadata: {
      name?: string;
      avatar_url?: string;
    };
  };
  likes_count: number;
  user_has_liked: boolean;
  replies_count: number;
}

export interface CommentReply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  comment_id: string;
  user: {
    id: string;
    email: string;
    user_metadata: {
      name?: string;
      avatar_url?: string;
    };
  };
  likes_count: number;
  user_has_liked: boolean;
}
