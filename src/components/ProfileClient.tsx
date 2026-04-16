'use client'

// ProfileClient.tsx - 메인 프로필 페이지 컴포넌트
// 서버 컴포넌트 최적화 - 2025-10-13

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BirthConsentModal from '@/components/BirthConsentModal'
import SchoolRegistrationFlowModal from '@/components/SchoolRegistrationFlowModal'
import { extractBattleRegion } from '@/utils/addressParser'

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
  const [user, setUser] = useState<any>(initialUser)
  const [userProfile, setUserProfile] = useState<any>(initialUserProfile)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [schoolInfo, setSchoolInfo] = useState<any>(initialSchoolInfo)
  const [showBirthConsentModal, setShowBirthConsentModal] = useState(false)
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
    <div className="fixed inset-0 z-40 h-dvh overflow-y-auto bg-black/35 backdrop-blur-[1px]">
      <div className="flex min-h-full items-center justify-center px-4 py-6 sm:py-8">
        <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute right-4 top-4 text-2xl leading-none text-slate-400 transition hover:text-slate-700"
          aria-label="프로필 닫기"
        >
          ×
        </button>
        <h1 className="mb-4 text-center text-2xl font-bold text-slate-900">프로필 설정</h1>

        {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow">
              {newProfileImage || userProfile?.profile_image ? (
                <img
                  src={newProfileImage || userProfile?.profile_image}
                  alt="프로필"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-100 to-cyan-200 text-2xl font-bold text-cyan-700">
                  {(displayNickname || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {isEditingNickname ? (
              <div className="mb-2 flex w-full items-center justify-center gap-2">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-44 rounded-lg border border-slate-300 px-2 py-1 text-center text-lg font-bold"
                  autoFocus
                />
                <button
                  onClick={handleUpdateNickname}
                  disabled={isUpdatingNickname}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {isUpdatingNickname ? '저장중' : '저장'}
                </button>
              </div>
            ) : (
              <div className="mb-2 flex items-center gap-2">
                <p className="text-2xl font-bold text-slate-900">{displayNickname}</p>
                <button
                  type="button"
                  onClick={() => setIsEditingNickname(true)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  변경
                </button>
              </div>
            )}

            <p className="text-sm text-slate-600">{displayEmail}</p>
          </div>

          {isEditingProfileInfo ? (
            <div className="mt-4 space-y-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="이메일"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={newProfileImage}
                onChange={(e) => setNewProfileImage(e.target.value)}
                placeholder="프로필 이미지 URL"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUpdateProfileInfo}
                  disabled={isUpdatingProfileInfo}
                  className="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {isUpdatingProfileInfo ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfileInfo(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingProfileInfo(true)}
              className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              이메일 / 이미지 수정
            </button>
          )}
        </section>

        {!isEmailVerified && (
          <section className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
            <p className="mb-1 text-sm font-semibold text-cyan-900">📧 이메일 인증이 필요해요</p>
            <p className="mb-3 text-xs leading-5 text-cyan-800">
              이메일 인증을 완료하면 계정 보안과 복구 기능을 안정적으로 사용할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!canMutate) {
                  openEmailAuthPromptModal('email-verify')
                  return
                }
                setIsEditingProfileInfo(true)
              }}
              className="w-full rounded-lg bg-gradient-to-r from-slate-800 to-cyan-800 px-3 py-2 text-sm font-semibold text-white"
            >
              이메일 인증 설정하기
            </button>
          </section>
        )}

        <section className="mb-5 rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">학교정보</h2>
            {userProfile?.birth_date && userProfile?.is_student === false ? (
              <button
                disabled
                className="rounded-lg bg-slate-300 px-3 py-1.5 text-sm font-semibold text-white"
                title="비학생은 학교설정을 할 수 없습니다"
              >
                학교설정
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const { data: authData, error: authError } = await supabase.auth.getUser()

                    if (authError || !authData.user) {
                      openEmailAuthPromptModal('school-setting')
                      return
                    }

                    setUser(authData.user)

                    const { data: latestProfile, error: latestProfileError } = await supabase
                      .from('users')
                      .select('*')
                      .eq('id', authData.user.id)
                      .maybeSingle()

                    if (latestProfileError) {
                      setError(`프로필 정보를 확인할 수 없습니다: ${latestProfileError.message}`)
                      return
                    }

                    const resolvedProfile = latestProfile || userProfile
                    if (latestProfile) {
                      setUserProfile(latestProfile)
                    }

                    const authProvider = authData.user.app_metadata?.provider
                    const isEmailAuthUser = authProvider === 'email'

                    if ((!resolvedProfile?.birth_date || resolvedProfile?.is_student == null) && !isEmailAuthUser) {
                      setShowBirthConsentModal(true)
                      return
                    }

                    setIsSchoolRegistrationFlowOpen(true)
                  } catch (openError: any) {
                    setError(openError?.message || '학교설정 화면을 여는 중 오류가 발생했습니다.')
                  }
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                학교설정
              </button>
            )}
          </div>

          {schoolInfo ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{schoolInfo.school_name}</p>
              <p>{schoolInfo.grade}학년 {schoolInfo.class_number}반</p>
              <p className="mt-1 text-xs text-slate-500">
                {schoolInfo.region} {schoolInfo.address && schoolInfo.address.substring(0, 24)}
                {schoolInfo.address && schoolInfo.address.length > 24 ? '...' : ''}
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
              {userProfile?.birth_date && userProfile?.is_student === false
                ? '비학생은 학교정보를 설정할 수 없습니다'
                : '학교정보가 설정되지 않았습니다'}
            </p>
          )}
        </section>

        <div className="flex gap-2">
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            로그아웃
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deletingAccount ? '탈퇴 처리중...' : '회원 탈퇴'}
          </button>
        </div>

        {deletingAccount && (
          <div className="mt-3 text-center text-xs text-amber-700">회원 탈퇴 처리 중입니다. 잠시만 기다려주세요.</div>
        )}

        <BirthConsentModal
          isOpen={showBirthConsentModal}
          onClose={() => setShowBirthConsentModal(false)}
          onSuccess={() => {
            setShowBirthConsentModal(false)
            setIsSchoolRegistrationFlowOpen(true)
          }}
          userId={user?.id || ''}
        />

        <SchoolRegistrationFlowModal
          isOpen={isSchoolRegistrationFlowOpen}
          onClose={() => setIsSchoolRegistrationFlowOpen(false)}
          familyMembers={[
            {
              id: user?.id || 'me',
              name: displayNickname,
              avatar: (displayNickname || '나').charAt(0),
              relation: '본인',
            },
          ]}
          currentUserId={user?.id || 'me'}
          allowFamilyRegistration={false}
          onComplete={handleCompleteSchoolRegistrationFlow}
        />

        {showEmailAuthPromptModal && (
          <div className="fixed inset-0 z-[70] h-dvh overflow-y-auto bg-black/45">
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md rounded-2xl border border-violet-100 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400" />
                  <p className="text-4xl font-black leading-none text-slate-900">WhatEat</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailAuthPromptModal(false)}
                  className="text-xl text-slate-400 hover:text-slate-700"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>

              <p className="mb-4 text-xl font-semibold text-slate-900">{emailAuthPromptContent.title}</p>
              <p className="mb-4 text-base text-slate-600">{emailAuthPromptContent.message}</p>

              <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-center text-base font-semibold text-violet-600">
                {emailAuthPromptContent.highlight}
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-700">이메일 주소</label>
              <input
                type="email"
                placeholder="example@email.com"
                className="mb-4 w-full rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3 text-sm text-slate-700"
              />

              <button
                type="button"
                disabled
                className="mb-3 w-full rounded-xl bg-gradient-to-r from-slate-400 to-slate-500 px-4 py-3 text-base font-bold text-white opacity-80"
              >
                인증 코드 받기 (준비중)
              </button>

              <button
                type="button"
                onClick={() => setShowEmailAuthPromptModal(false)}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                뒤로 가기
              </button>
            </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
