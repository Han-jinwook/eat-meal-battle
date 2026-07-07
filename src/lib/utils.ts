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
  
  // Find Dong, Eup, or Myeon, or Gu, Gun
  let region = parts.find(p => p.match(/\d*(동|읍|면)\)?$/));
  if (region) {
    region = region.replace(/[()]/g, '');
  }
  
  if (!region && parts.length >= 2) {
    // If no dong/eup/myeon, try to use gu/gun or the second part
    region = parts.find(p => p.match(/\d*(구|군)$/)) || parts[1];
    if (region) {
      region = region.replace(/[()]/g, '');
    }
  }
  
  if (city && region) {
    if (city === region) {
      return `${name} (${region})`;
    }
    return `${name} (${city}/${region})`;
  }
  
  return name;
}
