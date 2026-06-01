'use client'

// ProfileClient.tsx - 메인 프로필 페이지 컴포넌트
// 서버 컴포넌트 최적화 - 2025-10-13

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import SchoolRegistrationFlowModal from '@/components/SchoolRegistrationFlowModal'
import { extractBattleRegion } from '@/utils/addressParser'
import { HubProfileCard, HubNotificationCard, HubLogoutCard } from '@/services/merlin-hub-sdk/react'

interface ProfileClientProps {
  initialUser: any
  initialUserProfile: any
  initialSchoolInfo: any
}

interface SchoolRegistrationPayload {
  school: {
    SD_SCHUL_CODE: string
    SCHUL_NM: string
    ATPT_OFCDC_SC_CODE: string
    SCHUL_KND_SC_NM: string
    ORG_RDNMA: string
    LCTN_SC_NM: string
  }
  grade: string
  classNumber: string
}

type EmailAuthPromptType = 'school-setting' | 'email-verify'

export default function ProfileClient({ 
  initialUser, 
  initialUserProfile, 
  initialSchoolInfo 
}: ProfileClientProps) {
  const isMockSchoolMode =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_USE_MOCK_SCHOOL === 'true'

  const [user, setUser] = useState<any>(initialUser)
  const [userProfile, setUserProfile] = useState<any>(initialUserProfile)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [schoolInfo, setSchoolInfo] = useState<any>(initialSchoolInfo)
  const [isSchoolRegistrationFlowOpen, setIsSchoolRegistrationFlowOpen] = useState(false)
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [newNickname, setNewNickname] = useState(initialUserProfile?.nickname || '')
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false)
  const [isEditingProfileInfo, setIsEditingProfileInfo] = useState(false)
  const [newEmail, setNewEmail] = useState(initialUser?.email || '')
  const [newProfileImage, setNewProfileImage] = useState(initialUserProfile?.profile_image || '')
  const [isUpdatingProfileInfo, setIsUpdatingProfileInfo] = useState(false)
  const [showEmailAuthPromptModal, setShowEmailAuthPromptModal] = useState(false)
  const [emailAuthPromptType, setEmailAuthPromptType] = useState<EmailAuthPromptType>('school-setting')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const hydrateProfileState = async () => {
      try {
        if (user?.id && userProfile && schoolInfo) {
          return
        }

        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData.user) {
          return
        }

        setUser(authData.user)

        const [{ data: freshProfile }, { data: freshSchoolInfo }] = await Promise.all([
          supabase.from('users').select('*').eq('id', authData.user.id).maybeSingle(),
          supabase.from('school_infos').select('*').eq('user_id', authData.user.id).maybeSingle(),
        ])

        if (freshProfile) {
          setUserProfile(freshProfile)
          setNewNickname(freshProfile.nickname || '')
          setNewProfileImage(freshProfile.profile_image || '')
        }

        if (freshSchoolInfo) {
          setSchoolInfo(freshSchoolInfo)
        }
      } catch (hydrateError) {
        console.warn('프로필 초기 동기화 실패:', hydrateError)
      }
    }

    void hydrateProfileState()
  }, [supabase, user?.id, userProfile, schoolInfo])

  const canMutate = Boolean(user?.id)
  const displayNickname = userProfile?.nickname || user?.user_metadata?.name || '익명 사용자'
  const displayEmail = user?.email || newEmail || '이메일 미등록'
  const isEmailVerified = Boolean(user?.email_confirmed_at)
  const emailAuthPromptContent =
    emailAuthPromptType === 'school-setting'
      ? {
          title: '학교설정 전에 인증이 필요해요',
          message: '학교정보를 저장하려면 먼저 로그인 후 이메일 인증을 진행해주세요.',
          highlight: '학교정보를 저장하고 싶다면?',
        }
      : {
          title: '이메일 인증이 필요해요',
          message: '계정 보호와 복구 기능을 사용하려면 이메일 인증을 먼저 진행해주세요.',
          highlight: '인증 및 설정을 저장하고 싶다면?',
        }

  const openEmailAuthPromptModal = (type: EmailAuthPromptType) => {
    setEmailAuthPromptType(type)
    setShowEmailAuthPromptModal(true)
  }

  const handleUpdateNickname = async () => {
    console.log('🔍 닉네임 업데이트 시작:', { newNickname, currentNickname: userProfile?.nickname });
    
    if (!newNickname.trim()) {
      setError('닉네임은 공백일 수 없습니다.');
      alert('닉네임은 공백일 수 없습니다.');
      return;
    }
    if (newNickname.trim() === userProfile?.nickname) {
      setIsEditingNickname(false);
      return;
    }

    setIsUpdatingNickname(true);
    setError(null);

    try {
      console.log('🔥 직접 Supabase 호출 시작...');
      
      // 현재 사용자 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      console.log('👤 사용자 ID:', user.id);
      
      // 직접 Supabase에서 닉네임 업데이트
      const { data, error } = await supabase
        .from('users')
        .update({ nickname: newNickname.trim() })
        .eq('id', user.id)
        .select();

      console.log('📊 Supabase 응답:', { data, error });

      if (error) {
        throw new Error(`DB 오류: ${error.message}`);
      }

      // 성공!
      alert('닉네임이 성공적으로 변경되었습니다! 🎉');
      setUserProfile((prev: any) => ({ ...prev, nickname: newNickname.trim() }));
      setIsEditingNickname(false);

    } catch (error: any) {
      console.error('❌ 닉네임 업데이트 오류:', error);
      setError(error.message);
      alert(`오류: ${error.message}`);
    } finally {
      setIsUpdatingNickname(false);
    }
  };

  const handleUpdateProfileInfo = async () => {
    if (!canMutate) {
      setNotice('로그인 후 프로필 정보를 수정할 수 있습니다.')
      return
    }

    const normalizedEmail = newEmail.trim().toLowerCase()
    const normalizedProfileImage = newProfileImage.trim()

    if (!normalizedEmail) {
      setError('이메일을 입력해주세요.')
      return
    }

    setError(null)
    setNotice(null)
    setIsUpdatingProfileInfo(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        throw new Error('로그인이 필요합니다.')
      }

      const currentEmail = (authData.user.email || '').toLowerCase()
      const isEmailChanged = currentEmail !== normalizedEmail

      if (isEmailChanged) {
        const { data: updatedAuth, error: emailUpdateError } = await supabase.auth.updateUser({
          email: normalizedEmail,
        })

        if (emailUpdateError) {
          throw emailUpdateError
        }

        if (updatedAuth.user) {
          setUser(updatedAuth.user)
        }
      }

      const { error: profileError } = await supabase
        .from('users')
        .update({ profile_image: normalizedProfileImage || null })
        .eq('id', authData.user.id)

      if (profileError) {
        throw new Error(`프로필 이미지 업데이트 실패: ${profileError.message}`)
      }

      setUserProfile((prev: any) => ({
        ...(prev || {}),
        profile_image: normalizedProfileImage || null,
      }))
      setIsEditingProfileInfo(false)
      setNotice(
        isEmailChanged
          ? '이메일 변경 인증 메일을 확인해주세요.'
          : '프로필 정보가 저장되었습니다.',
      )
    } catch (updateError: any) {
      console.error('프로필 정보 업데이트 오류:', updateError)
      setError(updateError?.message || '프로필 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingProfileInfo(false)
    }
  }

  const addInterestSchool = async (school: {
    SD_SCHUL_CODE: string
    SCHUL_NM: string
    ATPT_OFCDC_SC_CODE: string
  }) => {
    try {
      const response = await fetch('/api/interest-schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          school_code: school.SD_SCHUL_CODE,
          school_name: school.SCHUL_NM,
          office_code: school.ATPT_OFCDC_SC_CODE,
        }),
      })

      if (!response.ok) {
        console.warn('관심학교 등록 실패')
      }
    } catch (interestError) {
      console.warn('관심학교 등록 중 오류:', interestError)
    }
  }

  const handleCompleteSchoolRegistrationFlow = async (payload: SchoolRegistrationPayload) => {
    if (isMockSchoolMode) {
      const schoolData = {
        user_id: 'mock-user',
        school_code: payload.school.SD_SCHUL_CODE,
        school_name: payload.school.SCHUL_NM,
        school_type: payload.school.SCHUL_KND_SC_NM,
        region: extractBattleRegion(payload.school.ORG_RDNMA || payload.school.LCTN_SC_NM),
        address: payload.school.ORG_RDNMA,
        office_code: payload.school.ATPT_OFCDC_SC_CODE,
        grade: payload.grade,
        class_number: payload.classNumber,
        updated_at: new Date().toISOString(),
      }

      setSchoolInfo(schoolData)
      setNotice('[목업모드] 학교정보가 로컬 상태로 저장되었습니다.')
      return
    }

    if (!user?.id) {
      setError('로그인이 필요합니다.')
      return
    }

    const schoolData = {
      user_id: user.id,
      school_code: payload.school.SD_SCHUL_CODE,
      school_name: payload.school.SCHUL_NM,
      school_type: payload.school.SCHUL_KND_SC_NM,
      region: extractBattleRegion(payload.school.ORG_RDNMA || payload.school.LCTN_SC_NM),
      address: payload.school.ORG_RDNMA,
      office_code: payload.school.ATPT_OFCDC_SC_CODE,
      grade: payload.grade,
      class_number: payload.classNumber,
      updated_at: new Date().toISOString(),
    }

    const { data: existingSchoolInfo, error: schoolInfoError } = await supabase
      .from('school_infos')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (schoolInfoError && schoolInfoError.code !== 'PGRST116') {
      throw new Error(`학교 정보 조회 오류: ${schoolInfoError.message}`)
    }

    const saveResult = existingSchoolInfo
      ? await supabase.from('school_infos').update(schoolData).eq('user_id', user.id)
      : await supabase.from('school_infos').insert([schoolData])

    if (saveResult.error) {
      throw new Error(`학교 정보 저장 오류: ${saveResult.error.message}`)
    }

    await addInterestSchool(payload.school)
    setSchoolInfo(schoolData)
    setNotice('학교정보가 저장되었습니다.')
  }

  // 비로그인 상태에서도 화면 구성 확인이 가능하도록 리다이렉트하지 않음

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error: any) {
      setError(error.message || '로그아웃 중 오류가 발생했습니다')
    }
  }

  const handleDeleteAccount = async () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    
    let confirmResult = false;
    
    if (isIOS) {
      confirmResult = confirm('정말로 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.');
    } else {
      confirmResult = confirm('정말로 계정을 삭제하시겠습니까? \n\n이 작업은 되돌릴 수 없으며, 모든 계정 데이터가 영구적으로 삭제됩니다.');
    }
    
    if (!confirmResult) {
      return
    }

    try {
      setDeletingAccount(true)
      setError(null)
      
      console.log('회원 탈퇴 시작...')
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      console.log('회원 탈퇴 API 호출')
      
      const timeoutMs = isIOS ? 90000 : 60000;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: user.id }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId);
        
        const responseData = await response.json()
        console.log('API 응답:', responseData)
        
        if (!response.ok) {
          if (responseData.isIOSIssue && isIOS) {
            throw new Error('iOS에서 OAuth 연결 해제 중 문제가 발생했습니다. Safari를 완전히 종료한 후 다시 시도해주세요.');
          }
          throw new Error(responseData.error || '계정 삭제 중 API 오류가 발생했습니다.')
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error(isIOS ? 'iOS에서 처리 시간이 초과되었습니다. Safari를 완전히 종료한 후 다시 시도해주세요.' : '요청 시간이 초과되었습니다.');
        }
        throw fetchError;
      }
      
      console.log('로그아웃 처리 시작...')
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        console.error('로그아웃 오류:', signOutError)
        throw new Error(`로그아웃 오류: ${signOutError.message}`)
      }
      
      if (isIOS) {
        alert('회원 탈퇴가 완료되었습니다.\n\nSafari를 완전히 종료한 후 재시작하시면 OAuth 연결이 완전히 해제됩니다.');
        
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        alert('회원 탈퇴가 성공적으로 완료되었습니다.');
        router.push('/');
      }
    } catch (error: any) {
      console.error('계정 삭제 중 오류 발생:', error)
      setError(error.message || '계정 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingAccount(false)
    }
  }
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <div className="w-full space-y-6">
          <HubProfileCard />
          <HubNotificationCard
            title="알림 설정"
            toggleLabel="🔔 스마트 알림"
            description="급식 소식과 뭐먹지? 서비스의 새로운 기능·혜택 알림을 받아보세요."
          />
          <HubLogoutCard onLogout={() => router.push('/')} />
        </div>
      </div>
    </main>
  )
}
