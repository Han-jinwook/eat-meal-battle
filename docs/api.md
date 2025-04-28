# API 명세

## 1. 사용자 프로필 조회
- **GET** `/api/profile`
- **Response**
  ```json
  {
    "id": "UUID",
    "nickname": "...",
    "profile_image": "URL",
    "email": "..."
  }