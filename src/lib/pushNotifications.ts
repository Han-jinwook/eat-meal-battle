// 푸시 알림 발송을 위한 유틸리티 함수들

interface SendPushNotificationOptions {
  title: string;
  body: string;
  targetUsers?: string[];
  schoolCode?: string;
  grade?: number;
  data?: Record<string, string>;
  imageUrl?: string;
}

export async function sendPushNotification(options: SendPushNotificationOptions) {
  try {
    const response = await fetch('/api/notifications/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('푸시 알림 발송 실패:', error);
    throw error;
  }
}

// 급식 관련 알림 발송
export async function sendMealNotification(schoolCode: string, mealDate: string, mealType: string) {
  return sendPushNotification({
    title: '🍽️ 새로운 급식 메뉴',
    body: `${mealDate} ${mealType} 메뉴가 등록되었습니다!`,
    schoolCode,
    data: {
      type: 'meal',
      schoolCode,
      mealDate,
      mealType,
    }
  });
}

// 퀴즈 챔피언 알림 발송
export async function sendQuizChampionNotification(userId: string, period: string, rank: number) {
  return sendPushNotification({
    title: '🏆 퀴즈 챔피언 결과',
    body: rank === 1 ? `축하합니다! ${period} 퀴즈 챔피언이 되셨습니다!` : `${period} 퀴즈에서 ${rank}등을 달성하셨습니다!`,
    targetUsers: [userId],
    data: {
      type: 'quiz_champion',
      period,
      rank: rank.toString(),
    }
  });
}

// 배틀 초대 알림 발송
export async function sendBattleInviteNotification(targetUserId: string, inviterName: string) {
  return sendPushNotification({
    title: '⚔️ 배틀 초대',
    body: `${inviterName}님이 배틀에 초대했습니다!`,
    targetUsers: [targetUserId],
    data: {
      type: 'battle_invite',
      inviterName,
    }
  });
}

// 공지사항 알림 발송
export async function sendAnnouncementNotification(title: string, body: string, schoolCode?: string) {
  return sendPushNotification({
    title: `📢 ${title}`,
    body,
    schoolCode,
    data: {
      type: 'announcement',
    }
  });
}
