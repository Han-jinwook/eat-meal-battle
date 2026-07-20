import pako from 'pako';

export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ');
}

// JSON 객체를 압축하고 Base64로 인코딩하는 함수
export const compressAndEncode = (data: object): string => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = pako.deflate(jsonString);
    // Buffer.from을 사용하여 바이너리 데이터를 Base64 문자열로 변환
    const base64String = Buffer.from(compressed).toString('base64');
    return base64String;
  } catch (error) {
    console.error('State 압축 및 인코딩 실패:', error);
    // 실패 시 원본 데이터를 JSON 문자열로 인코딩하여 반환
    return btoa(JSON.stringify(data));
  }
};

// Base64로 인코딩된 압축 데이터를 디코딩하고 압축 해제하는 함수
export const decodeAndDecompress = (base64String: string): object | null => {
  try {
    // Buffer.from을 사용하여 Base64 문자열을 바이너리 데이터로 변환
    const compressed = Buffer.from(base64String, 'base64');
    const decompressed = pako.inflate(new Uint8Array(compressed), { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('State 디코딩 및 압축 해제 실패:', error);
    // 실패 시 일반 Base64 디코딩 시도
    try {
      return JSON.parse(atob(base64String));
    } catch (e) {
      console.error('일반 Base64 디코딩도 실패:', e);
      return null;
    }
  }
};

export function formatPlaceNameWithRegion(name?: string, address?: string) {
  if (!name) return "";
  if (!address) return name;
  
  const parts = address.split(" ");
  let city = parts[0];
  
  if (["N플레이스", "카카오맵", "구글", "레시피", "유튜브", "인스타그램", "틱톡"].includes(city)) {
    return name;
  }
  
  // Simplify city names (e.g., 서울특별시 -> 서울, 인천광역시 -> 인천)
  if (city.length > 2 && (city.endsWith("시") || city.endsWith("도") || city.endsWith("특별시") || city.endsWith("광역시"))) {
    city = city.substring(0, 2);
  } else if (city.length === 4 && city.endsWith("특도")) { // 제주특별자치도
    city = "제주";
  }
  
  let gu = parts.find(p => p.match(/\d*(구|군)$/));
  if (gu) {
    gu = gu.replace(/[()]/g, '');
  }

  // Find Dong, Eup, or Myeon
  let dong = parts.find(p => p.match(/\d*(동|읍|면)\)?$/));
  if (dong) {
    dong = dong.replace(/[()]/g, '');
  }
  
  const regionParts = [city];
  if (gu && gu !== city) regionParts.push(gu);
  if (dong && dong !== gu && dong !== city) regionParts.push(dong);

  if (regionParts.length > 1) {
    return `${name} (${regionParts.join("/")})`;
  } else if (regionParts.length === 1 && parts.length >= 2) {
    // If no gu or dong found, try to use the second part as fallback
    let fallback = parts[1].replace(/[()]/g, '');
    return `${name} (${city}/${fallback})`;
  }
  
  return name;
}

export function formatRegionStr(city: string, gu: string, dong: string) {
  const parts = []
  if (city) {
    let c = city
    if (c.length >= 3 && (c.endsWith("광역시") || c.endsWith("특별시") || c.endsWith("자치시") || c.endsWith("자치도"))) {
      c = c.substring(0, 2)
    } else if (c.endsWith("도") || c.endsWith("시")) {
      c = c.substring(0, c.length - 1)
    }
    if (c === "서울특별") c = "서울"
    parts.push(c)
  }
  if (gu && gu !== city) {
    parts.push(gu)
  }
  if (dong) {
    let d = dong
    if (d.endsWith("동") || d.endsWith("읍") || d.endsWith("면")) {
      d = d.substring(0, d.length - 1)
    }
    parts.push(d)
  }
  return parts.join("/")
}

export function parseRegionFromAddress(address: string, defaultCity = "인천", defaultGu = "서구", defaultDong = "청라동") {
  if (!address) return { city: defaultCity, gu: defaultGu, dong: defaultDong }
  const parts = address.split(/\s+/)
  let city = defaultCity
  let gu = ""
  let dong = ""

  if (parts.length > 0) {
    const p0 = parts[0]
    if (p0.endsWith("시") || p0.endsWith("도") || p0.endsWith("특별자치시") || p0.endsWith("광역시")) {
      city = p0.substring(0, 2)
    } else {
      city = p0
    }
  }
  for (const part of parts.slice(1)) {
    if (part.endsWith("구") || part.endsWith("군") || part.endsWith("시")) {
      if (!gu) gu = part
    }
    if (part.endsWith("동") || part.endsWith("읍") || part.endsWith("면")) {
      dong = part
      break
    }
  }

  if (!gu) gu = defaultGu
  if (!dong) dong = defaultDong

  return { city, gu, dong }
}
