'use client';

import { useEffect, useRef, useState } from 'react';
import { useHub } from '@/services/merlin-hub-sdk/react';
import { showToast } from '@/services/merlin-hub-sdk/react';

const REQUIRED_SECONDS = 180; // 3분 (180초)
const SYNC_INTERVAL = 10;     // 10초마다 DB와 동기화

export default function WhatEatTimer() {
  const { isLoggedIn, user, isLoading } = useHub();
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [isActivated, setIsActivated] = useState(false);
  const [isFetched, setIsFetched] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedSecondsRef = useRef(0);

  // 1. Fetch initial status from DB when logged in
  useEffect(() => {
    if (isLoading || !isLoggedIn || !user?.id) {
      // Clear states if logged out
      setAccumulatedSeconds(0);
      setIsActivated(false);
      setIsFetched(false);
      return;
    }

    const fetchInitialStatus = async () => {
      try {
        const res = await fetch(`/api/auth/activate-local?userId=${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch user activation status');
        
        const data = await res.json();
        
        // Use database value, fallback to localStorage if database is 0
        const localSavedKey = `whateat_timer_sec_${user.id}`;
        const localSaved = localStorage.getItem(localSavedKey);
        const localSec = localSaved ? parseInt(localSaved, 10) : 0;
        
        const initialSeconds = Math.max(data.accumulated_seconds || 0, localSec);
        const initialActivated = data.is_activated || initialSeconds >= REQUIRED_SECONDS;

        setAccumulatedSeconds(initialSeconds);
        setIsActivated(initialActivated);
        lastSyncedSecondsRef.current = data.accumulated_seconds || 0;
        setIsFetched(true);

        // If not registered in DB yet, create user entry immediately
        if (!data.exists) {
          await syncWithDatabase(user.id, initialSeconds, initialActivated);
        }
      } catch (err) {
        console.error('Error fetching initial timer status:', err);
        setIsFetched(true); // Proceed even on error with default values
      }
    };

    fetchInitialStatus();
  }, [isLoggedIn, user?.id, isLoading]);

  // 2. Synchronize function to DB
  const syncWithDatabase = async (userId: string, seconds: number, activated: boolean) => {
    try {
      const res = await fetch('/api/auth/activate-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: user?.email,
          nickname: user?.nickname,
          profileImage: user?.avatar_url,
          accumulatedSeconds: seconds,
          isActivated: activated,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        lastSyncedSecondsRef.current = data.accumulated_seconds;
        return data;
      }
    } catch (err) {
      console.error('Failed to sync timer with database:', err);
    }
  };

  // 3. Timer logic
  useEffect(() => {
    // Only run timer if user data is fully fetched, logged in, and not yet activated
    if (!isFetched || !isLoggedIn || !user?.id || isActivated) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const userId = user.id;

    // Start timer interval
    timerRef.current = setInterval(async () => {
      setAccumulatedSeconds(prev => {
        const nextSeconds = prev + 1;
        
        // Save to localStorage immediately
        localStorage.setItem(`whateat_timer_sec_${userId}`, nextSeconds.toString());

        // Check if limit is reached
        if (nextSeconds >= REQUIRED_SECONDS) {
          if (timerRef.current) clearInterval(timerRef.current);
          
          setIsActivated(true);
          // Sync with database (set is_activated = true)
          syncWithDatabase(userId, nextSeconds, true);
          showToast('success', '🎉 3분 체류 완료! 계정이 성공적으로 활성화되었습니다.');
          
          return nextSeconds;
        }

        // Periodic Sync with DB every 10 seconds
        if (nextSeconds - lastSyncedSecondsRef.current >= SYNC_INTERVAL) {
          syncWithDatabase(userId, nextSeconds, false);
        }

        return nextSeconds;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isFetched, isLoggedIn, user?.id, isActivated]);

  // Visual helper indicator: Run in the background logic only (hide the UI indicator)
  return null;
}
