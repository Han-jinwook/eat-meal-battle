import * as admin from 'firebase-admin';

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  // 로컬 개발 환경과 배포 환경에서의 초기화 처리 분리
  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    // 환경 변수에서 프라이빗 키를 가져옴 (배포 환경)
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // 개행 문자 처리 (환경 변수에서는 \n이 문자열로 저장됨)
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_ADMIN_DATABASE_URL,
    });
  } else {
    // 환경 변수가 없는 경우, 더미 초기화 (CI/CD 환경 또는 배포 환경을 위함)
    console.warn('Firebase Admin 환경 변수가 설정되지 않았습니다. 더미 초기화를 진행합니다.');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

// Firebase Admin 인스턴스 내보내기
export default admin;
