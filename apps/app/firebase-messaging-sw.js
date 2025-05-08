// 푸시 알림을 위한 Firebase 메시징 서비스 워커
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase 초기화
firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY,
  authDomain: self.FIREBASE_AUTH_DOMAIN,
  projectId: self.FIREBASE_PROJECT_ID,
  storageBucket: self.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID,
  appId: self.FIREBASE_APP_ID,
});

// Firebase 메시징 인스턴스 가져오기
const messaging = firebase.messaging();

// 백그라운드 메시지 처리
messaging.onBackgroundMessage((payload) => {
  console.log('백그라운드 메시지 수신:', payload);
  
  const notificationTitle = payload.notification.title || '새로운 알림';
  const notificationOptions = {
    body: payload.notification.body || '새로운 알림이 도착했습니다.',
    icon: '/icons/icon-192x192.png', // PWA 아이콘 경로
    badge: '/icons/badge-72x72.png',  // 알림 뱃지 아이콘
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
