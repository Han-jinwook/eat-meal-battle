const fs = require('fs');
const path = require('path');

const targetFile = 'd:/WhatEat/src/components/whateat/talk-page.tsx';
let code = fs.readFileSync(targetFile, 'utf8');

// 1. getLocalizedSampleRegion 헬퍼 함수 추가
const helperCode = `
function getLocalizedSampleRegion(sampleId, city, gu, dong, scope) {
  let resCity = city === "인천" ? "인천광역시" : city === "서울" ? "서울특별시" : city === "경기" ? "경기도" : city;
  if (!resCity.endsWith("시") && !resCity.endsWith("도") && !resCity.endsWith("군")) {
    resCity = resCity + "광역시";
  }
  let resGu = gu;
  let resDong = dong;

  const idNum = typeof sampleId === "number" ? sampleId : 1;

  if (scope === "dong") {
    resDong = dong;
  } else if (scope === "gu") {
    if (gu === "서구") {
      const dongs = ["청라동", "가정동", "석남동"];
      resDong = dongs[(idNum - 1) % dongs.length];
    } else if (gu === "강남구") {
      const dongs = ["논현동", "역삼동", "삼성동"];
      resDong = dongs[(idNum - 1) % dongs.length];
    } else if (gu === "연수구") {
      const dongs = ["송도동", "연수동", "동춘동"];
      resDong = dongs[(idNum - 1) % dongs.length];
    } else {
      resDong = gu + " " + idNum + "동";
    }
  } else if (scope === "city") {
    const isSameCityA = (c1, c2) => c1.substring(0, 2) === c2.substring(0, 2);
    if (isSameCityA(resCity, "인천광역시")) {
      const regions = [
        { gu: "서구", dong: "청라동" },
        { gu: "부평구", dong: "부평동" },
        { gu: "연수구", dong: "송도동" }
      ];
      const r = regions[(idNum - 1) % regions.length];
      resGu = r.gu;
      resDong = r.dong;
    } else if (isSameCityA(resCity, "서울특별시")) {
      const regions = [
        { gu: "마포구", dong: "서교동" },
        { gu: "강남구", dong: "논현동" },
        { gu: "종로구", dong: "혜화동" }
      ];
      const r = regions[(idNum - 1) % regions.length];
      resGu = r.gu;
      resDong = r.dong;
    } else {
      resGu = resCity + " " + idNum + "구";
      resDong = resCity + " " + idNum + "동";
    }
  } else {
    if (idNum === 1) {
      resCity = "인천광역시"; resGu = "서구"; resDong = "청라동";
    } else if (idNum === 2) {
      resCity = "서울특별시"; resGu = "강남구"; resDong = "논현동";
    } else {
      resCity = "인천광역시"; resGu = "연수구"; resDong = "송도동";
    }
  }

  return { city: resCity, gu: resGu, dong: resDong };
}
`;

// parseRegionFromAddress 뒤에 helperCode 삽입
const targetAnchor = '  return { city, gu, dong }\\r\\n}';
const targetAnchorLf = '  return { city, gu, dong }\\n}';

if (code.includes(targetAnchor)) {
  code = code.replace(targetAnchor, '  return { city, gu, dong }\\r\\n}\\r\\n' + helperCode);
} else if (code.includes(targetAnchorLf)) {
  code = code.replace(targetAnchorLf, '  return { city, gu, dong }\\n}\\n' + helperCode);
}

// 2. TalkPage 필터 로직 전면 수정
const rawFilterTarget = `  const filteredPostsRaw = posts.filter(post => {
    if (categoryFilter !== "all" && post.type !== categoryFilter) return false
    if (showOnlyNew && !isTodayPost(post.createdAt)) return false
    if (showOnlyLiked && !post.isLiked) return false
    if (showOnlySubscribed && !post.isSubscribed) return false
    
    // 샘플 카데고리 카드는 필터를 타지 않고 항상 통과
    if (post.isSample) return true

    // 지역 필터: 검색 지역이 있으면 우선, 없으면 내 지역 + 범위
    const targetRegion = searchRegion || userRegion
    const postRegion = post.author?.region || post.region?.dong || ""
    
    if (scopeFilter === "dong") {
      if (searchRegion) {
        return postRegion === targetRegion
      } else {
        return isSameCity(post.region.city, userAddress.city) &&
               post.region.gu === userAddress.gu &&
               postRegion === targetRegion
      }
    } else if (scopeFilter === "gu") {
      return isSameCity(post.region.city, userAddress.city) && post.region.gu === userAddress.gu
    } else if (scopeFilter === "city") {
      return isSameCity(post.region.city, userAddress.city)
    }
    // all: 모든 지역
    return true
  })

  // 샘플 카드 개별 소멸 여부 판단 (지역 범위 및 실제 카드 등록 여부 매칭)
  const shouldHideSample = (sample: TalkPost, realPosts: TalkPost[]) => {
    const isSameCityA = (c1?: string, c2?: string) => {
      if (!c1 || !c2) return false
      return c1.substring(0, 2) === c2.substring(0, 2)
    }

    return realPosts.some(real => {
      const cityMatch = isSameCityA(real.region.city, sample.region.city)
      const guMatch = cityMatch && real.region.gu === sample.region.gu
      const realDong = real.author?.region || real.region?.dong || ""
      const dongMatch = guMatch && realDong === sample.region.dong

      if (scopeFilter === "dong") {
        return dongMatch
      } else if (scopeFilter === "gu") {
        return guMatch
      } else if (scopeFilter === "city") {
        return cityMatch
      } else {
        // all (전국): 동일한 동에 실제 카드가 있는 경우에만 해당 샘플 소멸
        return dongMatch
      }
    })
  }

  // 샘플 카드 개수 제한 (동 1개, 구 2개, 시/전국 3개)
  const getSampleLimit = () => {
    if (scopeFilter === "dong") return 1
    if (scopeFilter === "gu") return 2
    return 3
  }

  const realPostsFiltered = filteredPostsRaw.filter(p => !p.isSample)
  const samplePostsFiltered = filteredPostsRaw
    .filter(p => p.isSample && !shouldHideSample(p, realPostsFiltered))
    .slice(0, getSampleLimit())
  const filteredPosts = [...realPostsFiltered, ...samplePostsFiltered]`;

const rawFilterReplacement = `  // targetRegion 파라미터 계산
  const targetCity = userAddressState.city || "인천"
  const targetGu = userAddressState.gu || "서구"
  const targetDong = searchRegion || userRegion || "청라동"

  // posts 상태를 기반으로, 샘플 주소들을 현재 필터 범위에 맞게 동적으로 로컬라이징한 normalizedPosts 생성
  const normalizedPosts = posts.map(post => {
    if (!post.isSample) return post
    const locRegion = getLocalizedSampleRegion(post.id, targetCity, targetGu, targetDong, scopeFilter)
    return {
      ...post,
      region: locRegion,
      author: {
        ...post.author,
        region: locRegion.dong
      }
    }
  })

  const filteredPostsRaw = normalizedPosts.filter(post => {
    if (categoryFilter !== "all" && post.type !== categoryFilter) return false
    if (showOnlyNew && !isTodayPost(post.createdAt)) return false
    if (showOnlyLiked && !post.isLiked) return false
    if (showOnlySubscribed && !post.isSubscribed) return false
    
    // 샘플 카데고리 카드는 필터를 타지 않고 항상 통과
    if (post.isSample) return true

    // 지역 필터: 검색 지역이 있으면 우선, 없으면 내 지역 + 범위
    const targetRegion = searchRegion || userRegion
    const postRegion = post.author?.region || post.region?.dong || ""
    
    if (scopeFilter === "dong") {
      if (searchRegion) {
        return postRegion === targetRegion
      } else {
        return isSameCity(post.region.city, userAddress.city) &&
               post.region.gu === userAddress.gu &&
               postRegion === targetRegion
      }
    } else if (scopeFilter === "gu") {
      return isSameCity(post.region.city, userAddress.city) && post.region.gu === userAddress.gu
    } else if (scopeFilter === "city") {
      return isSameCity(post.region.city, userAddress.city)
    }
    // all: 모든 지역
    return true
  })

  // 샘플 카드 개별 소멸 여부 판단 (지역 범위 및 실제 카드 등록 여부 매칭)
  const shouldHideSample = (sample: TalkPost, realPosts: TalkPost[]) => {
    const isSameCityA = (c1?: string, c2?: string) => {
      if (!c1 || !c2) return false
      return c1.substring(0, 2) === c2.substring(0, 2)
    }

    return realPosts.some(real => {
      const cityMatch = isSameCityA(real.region.city, sample.region.city)
      const guMatch = cityMatch && real.region.gu === sample.region.gu
      const realDong = real.author?.region || real.region?.dong || ""
      const dongMatch = guMatch && realDong === sample.region.dong

      if (scopeFilter === "dong") {
        return dongMatch
      } else if (scopeFilter === "gu") {
        return guMatch
      } else if (scopeFilter === "city") {
        return cityMatch
      } else {
        // all (전국): 동일한 동에 실제 카드가 있는 경우에만 해당 샘플 소멸
        return dongMatch
      }
    })
  }

  // 샘플 카드 개수 제한 (동 1개, 구 2개, 시/전국 3개)
  const getSampleLimit = () => {
    if (scopeFilter === "dong") return 1
    if (scopeFilter === "gu") return 2
    return 3
  }

  const realPostsFiltered = filteredPostsRaw.filter(p => !p.isSample)
  const sampleLimit = Math.max(0, getSampleLimit() - realPostsFiltered.length)
  const samplePostsFiltered = filteredPostsRaw
    .filter(p => p.isSample && !shouldHideSample(p, realPostsFiltered))
    .slice(0, sampleLimit)
  const filteredPosts = [...realPostsFiltered, ...samplePostsFiltered]`;

// Normalize CRLF to LF in target and replacement to guarantee matches
const codeLf = code.replace(/\r\n/g, '\n');
const rawFilterTargetLf = rawFilterTarget.replace(/\r\n/g, '\n');
const rawFilterReplacementLf = rawFilterReplacement.replace(/\r\n/g, '\n');

if (codeLf.includes(rawFilterTargetLf)) {
  code = codeLf.replace(rawFilterTargetLf, rawFilterReplacementLf);
} else {
  console.warn('Warning: rawFilterTarget not found in source!');
}

// 3. getCategoryCount 내부 교체
const categoryTarget = `  const getCategoryCount = (categoryId: string) => {
    const rawFiltered = posts.filter((post) => {
      if (categoryId !== "all" && post.type !== categoryId) return false
      if (showOnlyNew && !isTodayPost(post.createdAt)) return false
      if (showOnlyLiked && !post.isLiked) return false
      if (showOnlySubscribed && !post.isSubscribed) return false

      if (post.isSample) return true

      const targetRegion = searchRegion || userRegion
      const postRegion = post.author?.region || post.region?.dong || ""

      if (scopeFilter === "dong") {
        if (searchRegion) {
          return postRegion === targetRegion
        } else {
          return isSameCity(post.region.city, userAddress.city) &&
                 post.region.gu === userAddress.gu &&
                 postRegion === targetRegion
        }
      } else if (scopeFilter === "gu") {
        return isSameCity(post.region.city, userAddress.city) && post.region.gu === userAddress.gu
      } else if (scopeFilter === "city") {
        return isSameCity(post.region.city, userAddress.city)
      }

      return true
    })

    const realFiltered = rawFiltered.filter(p => !p.isSample)
    const sampleFiltered = rawFiltered
      .filter(p => p.isSample && !shouldHideSample(p, realFiltered))
      .slice(0, getSampleLimit())

    return realFiltered.length + sampleFiltered.length
  }`;

const categoryReplacement = `  const getCategoryCount = (categoryId: string) => {
    const rawFiltered = normalizedPosts.filter((post) => {
      if (categoryId !== "all" && post.type !== categoryId) return false
      if (showOnlyNew && !isTodayPost(post.createdAt)) return false
      if (showOnlyLiked && !post.isLiked) return false
      if (showOnlySubscribed && !post.isSubscribed) return false

      if (post.isSample) return true

      const targetRegion = searchRegion || userRegion
      const postRegion = post.author?.region || post.region?.dong || ""

      if (scopeFilter === "dong") {
        if (searchRegion) {
          return postRegion === targetRegion
        } else {
          return isSameCity(post.region.city, userAddress.city) &&
                 post.region.gu === userAddress.gu &&
                 postRegion === targetRegion
        }
      } else if (scopeFilter === "gu") {
        return isSameCity(post.region.city, userAddress.city) && post.region.gu === userAddress.gu
      } else if (scopeFilter === "city") {
        return isSameCity(post.region.city, userAddress.city)
      }

      return true
    })

    const realFiltered = rawFiltered.filter(p => !p.isSample)
    const sampleCountLimit = Math.max(0, getSampleLimit() - realFiltered.length)
    const sampleFiltered = rawFiltered
      .filter(p => p.isSample && !shouldHideSample(p, realFiltered))
      .slice(0, sampleCountLimit)

    return realFiltered.length + sampleFiltered.length
  }`;

const codeLf2 = code.replace(/\r\n/g, '\n');
const categoryTargetLf = categoryTarget.replace(/\r\n/g, '\n');
const categoryReplacementLf = categoryReplacement.replace(/\r\n/g, '\n');

if (codeLf2.includes(categoryTargetLf)) {
  code = codeLf2.replace(categoryTargetLf, categoryReplacementLf);
} else {
  console.warn('Warning: categoryTarget not found in source!');
}

// Convert back to CRLF before writing to keep original file style
const finalCode = code.replace(/\n/g, '\r\n');
fs.writeFileSync(targetFile, finalCode, 'utf8');
console.log('TalkPage patched successfully!');
