'use client';

import dynamic from 'next/dynamic';

const FirebaseMessaging = dynamic(
  () => import('./FirebaseMessaging'),
  { ssr: false }
);

export default function FirebaseMessagingWrapper() {
  return <FirebaseMessaging />;
}
