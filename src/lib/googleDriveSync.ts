export type GoogleDriveAuthToken = {
  accessToken: string
  expiresAt: number
  scope: string
  tokenType: string
}

export type DriveBackupStatus = {
  connected: boolean
  lastBackupAt: number | null
}

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_SYNC_DB = 'whateat-google-drive-sync'
const DRIVE_SYNC_STORE = 'kv'
const KEY_DRIVE_AUTH = 'drive_auth'
const KEY_LAST_BACKUP_AT = 'last_backup_at'
const KEY_FOLDER_ID = 'whateat_folder_id'
const KEY_PHOTOS_FOLDER_ID = 'whateat_photos_folder_id'

type RawFileInfo = { id: string; name: string; modifiedTime: string; size?: number }
type DbValue = GoogleDriveAuthToken | string | number | null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'))
      return
    }
    const req = indexedDB.open(DRIVE_SYNC_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DRIVE_SYNC_STORE)) {
        db.createObjectStore(DRIVE_SYNC_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
  })
}

async function dbGet<T extends DbValue>(key: string): Promise<T> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRIVE_SYNC_STORE, 'readonly')
      const store = tx.objectStore(DRIVE_SYNC_STORE)
      const req = store.get(key)
      req.onsuccess = () => resolve((req.result ?? null) as T)
      req.onerror = () => reject(req.error || new Error(`IndexedDB get failed: ${key}`))
    })
  } catch (e) {
    return null as any
  }
}

async function dbSet(key: string, value: DbValue): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRIVE_SYNC_STORE, 'readwrite')
      tx.objectStore(DRIVE_SYNC_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error || new Error(`IndexedDB set failed: ${key}`))
    })
  } catch (e) {
    // ignore
  }
}

function ensureGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const already = document.querySelector('script[data-gsi-client="true"]')
    if (already) {
      already.addEventListener('load', () => resolve(), { once: true })
      already.addEventListener('error', () => reject(new Error('Google Identity SDK load failed')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.gsiClient = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity SDK load failed'))
    document.head.appendChild(script)
  })
}

export async function getStoredDriveAuth() {
  return dbGet<GoogleDriveAuthToken | null>(KEY_DRIVE_AUTH)
}

export async function storeDriveAuth(token: GoogleDriveAuthToken): Promise<void> {
  await dbSet(KEY_DRIVE_AUTH, token)
}

export async function clearStoredDriveAuth(): Promise<void> {
  await dbSet(KEY_DRIVE_AUTH, null)
  await dbSet(KEY_FOLDER_ID, null)
  await dbSet(KEY_PHOTOS_FOLDER_ID, null)
}

async function requestDriveAccessToken(interactive = false) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '971048682102-lnqdka2neo99kti37qulkc48bvjifcg5.apps.googleusercontent.com'
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않았습니다.')
  }

  await ensureGoogleIdentityScript()
  const existing = await getStoredDriveAuth()

  return new Promise<GoogleDriveAuthToken>((resolve, reject) => {
    let settled = false
    const rejectOnce = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const resolveOnce = (token: GoogleDriveAuthToken) => {
      if (settled) return
      settled = true
      resolve(token)
    }

    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      prompt: interactive || !existing ? 'consent' : '',
      callback: async (response: any) => {
        if (settled) return
        if (response.error || !response.access_token) {
          rejectOnce(new Error(`Google Drive OAuth 실패: ${response.error || 'unknown'}`))
          return
        }
        try {
          const token: GoogleDriveAuthToken = {
            accessToken: response.access_token,
            expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
            scope: response.scope || DRIVE_SCOPE,
            tokenType: response.token_type || 'Bearer',
          }
          await dbSet(KEY_DRIVE_AUTH, token)
          resolveOnce(token)
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error('Google Drive 토큰 저장 중 오류가 발생했습니다.'))
        }
      },
      error_callback: (error: any) => {
        const type = error?.type || 'unknown'
        if (type === 'popup_closed') {
          rejectOnce(new Error('Google 로그인 팝업이 닫혀 백업금고 연결이 취소되었습니다.'))
          return
        }
        if (type === 'popup_failed_to_open') {
          rejectOnce(new Error('Google 로그인 팝업을 열지 못했습니다. 팝업 차단을 해제하고 다시 시도해 주세요.'))
          return
        }
        rejectOnce(new Error(`Google Drive OAuth 요청 실패: ${type}`))
      },
    })

    tokenClient.requestAccessToken()
  })
}

export async function ensureDriveAccessToken(interactive = false): Promise<string> {
  const token = await getStoredDriveAuth()
  if (token && token.expiresAt > Date.now() + 60_000) {
    return token.accessToken
  }
  if (!token && !interactive) {
    throw new Error('구글 드라이브 백업 서비스가 연결되지 않았습니다.')
  }
  const refreshed = await requestDriveAccessToken(interactive)
  return refreshed.accessToken
}

async function fetchDriveJson(path: string, accessToken?: string, init?: RequestInit) {
  const token = accessToken || (await ensureDriveAccessToken())
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...(init || {}),
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try {
      const parsed = JSON.parse(text)
      detail = parsed?.error?.message || parsed?.error?.status || detail
    } catch {
      // keep raw text
    }
    throw new Error(`Google Drive 요청 실패 (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  return response.json()
}

// ─── 폴더 구조화 및 조회 (WhatEat/ 및 WhatEat/Photos/) ───────────────────────

export async function getOrCreateWhatEatFolders(accessToken?: string): Promise<{
  parentFolderId: string
  photosFolderId: string
}> {
  const token = accessToken || (await ensureDriveAccessToken())

  let parentFolderId = await dbGet<string | null>(KEY_FOLDER_ID)
  let photosFolderId = await dbGet<string | null>(KEY_PHOTOS_FOLDER_ID)

  // 1. 부모 WhatEat 폴더 검증 및 생성
  if (parentFolderId) {
    try {
      await fetchDriveJson(`files/${encodeURIComponent(parentFolderId)}?fields=id`, token)
    } catch {
      parentFolderId = null
      await dbSet(KEY_FOLDER_ID, null)
    }
  }

  if (!parentFolderId) {
    const query = new URLSearchParams({
      q: "name='WhatEat' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
      pageSize: '1',
    })
    const list = await fetchDriveJson(`files?${query.toString()}`, token)
    if (list?.files && list.files.length > 0) {
      parentFolderId = list.files[0].id
    } else {
      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'WhatEat',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      })
      if (!res.ok) throw new Error('WhatEat 루트 폴더 생성 실패')
      const folder = await res.json()
      parentFolderId = folder.id
    }
    await dbSet(KEY_FOLDER_ID, parentFolderId)
  }

  // 2. 하위 Photos 폴더 검증 및 생성
  if (photosFolderId) {
    try {
      await fetchDriveJson(`files/${encodeURIComponent(photosFolderId)}?fields=id`, token)
    } catch {
      photosFolderId = null
      await dbSet(KEY_PHOTOS_FOLDER_ID, null)
    }
  }

  if (!photosFolderId) {
    const query = new URLSearchParams({
      q: `name='Photos' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: '1',
    })
    const list = await fetchDriveJson(`files?${query.toString()}`, token)
    if (list?.files && list.files.length > 0) {
      photosFolderId = list.files[0].id
    } else {
      const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Photos',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        }),
      })
      if (!res.ok) throw new Error('WhatEat/Photos 폴더 생성 실패')
      const folder = await res.json()
      photosFolderId = folder.id
    }
    await dbSet(KEY_PHOTOS_FOLDER_ID, photosFolderId)
  }

  return {
    parentFolderId: parentFolderId!,
    photosFolderId: photosFolderId!,
  }
}

// ─── 파일 전송용 바디 빌더 ────────────────────────────────────────────────────

function buildMultipartBody(metadata: Record<string, unknown>, mediaData: string | Blob, mediaType = 'application/json; charset=UTF-8') {
  const boundary = `whateat_${Math.random().toString(36).slice(2)}`
  
  if (typeof mediaData === 'string') {
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${mediaType}`,
      '',
      mediaData,
      `--${boundary}--`,
    ].join('\r\n')
    return { boundary, body }
  }

  // Blob/Binary data handling using FormData or arrayBuffer concatenation
  // Note: For simplicity and safety in Browser environment, we can construct multipart using Blob
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
  const startBoundary = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
  const midBoundary = `\r\n--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`
  const endBoundary = `\r\n--${boundary}--`

  const parts = [
    startBoundary,
    metadataBlob,
    midBoundary,
    mediaData,
    endBoundary
  ]
  const body = new Blob(parts)
  return { boundary, body }
}

async function uploadSingleFile(
  token: string,
  mediaData: string | Blob,
  fileName: string,
  existingId?: string,
  parentFolderId?: string,
  mediaType = 'application/json; charset=UTF-8'
): Promise<{ fileId: string; modifiedTime: string }> {
  const metadata: Record<string, any> = { name: fileName }
  if (!existingId && parentFolderId) {
    metadata.parents = [parentFolderId]
  }

  const { boundary, body } = buildMultipartBody(metadata, mediaData, mediaType)
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=multipart&fields=id,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime'

  const response = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Drive 업로드 실패 (${response.status})${text ? `: ${text}` : ''}`)
  }

  const payload = await response.json()
  return {
    fileId: String(payload?.id || existingId || ''),
    modifiedTime: String(payload?.modifiedTime || new Date().toISOString()),
  }
}

async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Drive 파일 삭제 실패 (${response.status})`)
  }
}

async function renameDriveFile(token: string, fileId: string, newName: string): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  })
  if (!response.ok) {
    throw new Error(`Drive 파일 이름 변경 실패 (${response.status})`)
  }
}

// ─── 이중 백업 로테이션 (Double Backup Rotation) ─────────────────────────────

export async function uploadDoubleBackup(snapshot: unknown): Promise<{ modifiedTime: string }> {
  const token = await ensureDriveAccessToken(false)
  const jsonText = JSON.stringify(snapshot, null, 2)

  // 1. 부모 WhatEat 폴더 획득
  const { parentFolderId } = await getOrCreateWhatEatFolders(token)

  // 2. 기존 백업 파일(current 및 previous) 검색
  const query = new URLSearchParams({
    q: `(name='whateat_backup_current.json' or name='whateat_backup_previous.json') and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id,name)',
  })
  const payload = await fetchDriveJson(`files?${query.toString()}`, token)
  const files: RawFileInfo[] = Array.isArray(payload?.files) ? payload.files : []

  const currentFile = files.find(f => f.name === 'whateat_backup_current.json')
  const previousFile = files.find(f => f.name === 'whateat_backup_previous.json')

  // 3. 로테이션 알고리즘 실행
  // A. 기존 previous 파일이 있으면 삭제
  if (previousFile) {
    await deleteDriveFile(token, previousFile.id).catch(() => {})
  }

  // B. 기존 current 파일이 존재하면 previous로 이름 변경
  if (currentFile) {
    await renameDriveFile(token, currentFile.id, 'whateat_backup_previous.json').catch(() => {})
  }

  // C. 신규 데이터를 current로 업로드
  const result = await uploadSingleFile(token, jsonText, 'whateat_backup_current.json', undefined, parentFolderId)

  await dbSet(KEY_LAST_BACKUP_AT, new Date(result.modifiedTime).getTime())

  return { modifiedTime: result.modifiedTime }
}

// ─── 백업 다운로드 ────────────────────────────────────────────────────────────

export async function downloadLatestBackup(): Promise<unknown> {
  const token = await ensureDriveAccessToken(false)
  const { parentFolderId } = await getOrCreateWhatEatFolders(token)

  // 최신 백업 파일 찾기
  const query = new URLSearchParams({
    q: `name='whateat_backup_current.json' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: '1',
  })
  const payload = await fetchDriveJson(`files?${query.toString()}`, token)
  const file = payload?.files?.[0]
  if (!file?.id) {
    throw new Error('드라이브에 저장된 백업 파일이 없습니다.')
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error('백업 파일 다운로드 실패')
  }

  return response.json()
}

// ─── 드라이브에 이미지 개별 업로드 ─────────────────────────────────────────────

/**
 * Base64 Data URL 또는 Blob을 구글 드라이브 WhatEat/Photos/ 폴더에 업로드
 * @returns 구글 드라이브 웹 보기용 공유 URL
 */
export async function uploadImageToDrive(imageSource: string | Blob, fileName = `food_${Date.now()}.jpg`): Promise<string> {
  const token = await ensureDriveAccessToken(false)
  const { photosFolderId } = await getOrCreateWhatEatFolders(token)

  let blob: Blob
  if (typeof imageSource === 'string') {
    // data:image/jpeg;base64,... 형태 파싱
    const match = imageSource.match(/^data:([^;]+);base64,(.*)$/)
    if (!match) throw new Error('올바르지 않은 이미지 데이터 포맷입니다.')
    const contentType = match[1]
    const base64Data = match[2]
    
    // base64 to binary
    const binary = atob(base64Data)
    const array = []
    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i))
    }
    blob = new Blob([new Uint8Array(array)], { type: contentType })
  } else {
    blob = imageSource
  }

  // Drive 업로드 실행
  const result = await uploadSingleFile(token, blob, fileName, undefined, photosFolderId, blob.type)

  // 업로드한 파일의 공유 링크 권한 추가 (누구나 링크가 있으면 볼 수 있도록 설정해야 앱 내 이미지 태그에서 접근 가능)
  // Note: drive.file 권한 범위 상에서 웹 링크 획득을 위해 Permissions API 호출
  await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(result.fileId)}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  }).catch(() => {})

  // webViewLink 또는 webContentLink 획득
  const fileMeta = await fetchDriveJson(`files/${encodeURIComponent(result.fileId)}?fields=webContentLink,webViewLink`, token)
  
  // webContentLink는 direct download URL 역할을 하므로 모바일/웹 이미지 태그에 가장 적합
  // 단, 가끔 contentLink 오류 시 webViewLink에서 ID 파싱하여 직접 direct link 구축
  const directLink = fileMeta.webContentLink || `https://docs.google.com/uc?export=view&id=${result.fileId}`
  return directLink
}

// ─── 드라이브 연동 상태 ───────────────────────────────────────────────────────

export async function getDriveBackupStatus(): Promise<DriveBackupStatus> {
  const auth = await getStoredDriveAuth()
  const lastBackupAt = await dbGet<number | null>(KEY_LAST_BACKUP_AT)
  return {
    connected: Boolean(auth),
    lastBackupAt: lastBackupAt ? Number(lastBackupAt) : null,
  }
}

export async function connectDriveBackup(): Promise<DriveBackupStatus> {
  const token = await requestDriveAccessToken(true)
  await getOrCreateWhatEatFolders(token.accessToken)
  const status = await getDriveBackupStatus()
  return {
    ...status,
    connected: true,
  }
}

export async function disconnectDriveBackup(): Promise<void> {
  await clearStoredDriveAuth()
}
