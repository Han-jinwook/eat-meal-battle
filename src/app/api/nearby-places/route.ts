import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // 30 seconds

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const keyword = searchParams.get('keyword');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const debug: Record<string, any> = { lat, lng, keyword };

  try {
    let dong = '';

    // 1. Nominatim Reverse Geocoding to get Dong Name
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`;
      const geoRes = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'WhatEatApp/1.0 (contact@whateat.app)'
        }
      });

      debug.nominatimStatus = geoRes.status;
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const addr = geoData.address || {};
        const rawDong = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || '';
        dong = rawDong.replace(/\d+동$/, '동').trim();
        debug.nominatimDong = dong || '(empty)';
        debug.nominatimAddr = addr;
      }
    } catch (e) {
      debug.nominatimError = String(e);
      console.warn("Nominatim reverse geocoding failed:", e);
    }

    // 1.5 Try BigDataCloud if Nominatim failed
    if (!dong) {
      try {
        const bigDataCloudUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ko`;
        const bdcRes = await fetch(bigDataCloudUrl);
        debug.bdcStatus = bdcRes.status;
        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          const rawLocality = bdcData.locality || bdcData.city || '';
          dong = rawLocality.replace(/\d+동$/, '동').trim();
          debug.bdcDong = dong || '(empty)';
        }
      } catch (e) {
        debug.bdcError = String(e);
        console.warn("BigDataCloud reverse geocoding failed:", e);
      }
    }

    debug.finalDong = dong;

    // 2. Fetch Naver Search results
    const searchQuery = keyword 
      ? (dong ? `${dong} ${keyword}` : keyword) 
      : (dong ? `${dong} 식당` : "식당");
    debug.searchQuery = searchQuery;

    const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}&lat=${lat}&lng=${lng}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://m.search.naver.com/'
      }
    });

    debug.naverStatus = searchRes.status;

    if (!searchRes.ok) {
      debug.naverError = `HTTP ${searchRes.status}`;
      return NextResponse.json({ places: [], debug });
    }

    const html = await searchRes.text();
    debug.htmlLength = html.length;

    const placesMap = new Map<string, any>();
    let totalAddressHits = 0;
    let totalParsed = 0;
    let filteredByBusinessCat = 0;
    let filteredByNoNameAddr = 0;
    let filteredByNoCoords = 0;
    let filteredByDistance = 0;
    const sampleNames: string[] = [];  // 발견된 식당명 샘플

    // Scan for "address" to find JSON blocks containing place info
    let pos = 0;
    while (true) {
      const index = html.indexOf('"address"', pos);
      if (index === -1) break;
      totalAddressHits++;

      // Extract surrounding brace matching chunk
      let start = index;
      let braceCount = 0;
      while (start >= 0) {
        if (html[start] === '{') {
          braceCount--;
          if (braceCount < 0) break;
        } else if (html[start] === '}') {
          braceCount++;
        }
        start--;
      }

      let end = index;
      braceCount = 0;
      while (end < html.length) {
        if (html[end] === '}') {
          braceCount--;
          if (braceCount < 0) break;
        } else if (html[end] === '{') {
          braceCount++;
        }
        end++;
      }

      if (start >= 0 && end < html.length) {
        const chunk = html.substring(start, end + 1);
        try {
          const decoded = chunk.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
            return String.fromCharCode(parseInt(grp, 16));
          });

          const idMatch = decoded.match(/"id"\s*:\s*"([^"]+)"/);
          const nameMatch = decoded.match(/"name"\s*:\s*"([^"]+)"/);
          const titleMatch = decoded.match(/"title"\s*:\s*"([^"]+)"/);
          const addressMatch = decoded.match(/"address"\s*:\s*"([^"]+)"/);
          const categoryMatch = decoded.match(/"category"\s*:\s*"([^"]+)"/);
          const imgMatch = decoded.match(/"(?:smartplaceImages|imageUrl)"\s*:\s*(?:\[\s*")?"([^"]+)"/);
          const bCatMatch = decoded.match(/"businessCategory"\s*:\s*"([^"]+)"/);
          const xMatch = decoded.match(/"x"\s*:\s*"([^"]+)"/);
          const yMatch = decoded.match(/"y"\s*:\s*"([^"]+)"/);

          const id = idMatch ? idMatch[1] : null;
          const name = nameMatch ? nameMatch[1] : (titleMatch ? titleMatch[1] : null);
          const address = addressMatch ? addressMatch[1] : null;
          const category = categoryMatch ? categoryMatch[1] : '음식점';
          let image = imgMatch ? imgMatch[1] : '';
          const bCat = bCatMatch ? bCatMatch[1] : null;

          // 비식당 업종 제외 (모텔, 숙박, 병원 등)
          if (bCat && !['restaurant', 'cafe', 'bakery', 'pub', 'bar'].includes(bCat)) {
            filteredByBusinessCat++;
            pos = index + 9;
            continue;
          }

          // Filter out UI noise and ensure valid address
          if (name && address && name.length > 1 && address.includes(' ')) {
            totalParsed++;
            if (sampleNames.length < 10) sampleNames.push(name);

            if (image) {
              image = decodeURIComponent(image).replace(/\\/g, '');
              if (!image.startsWith('http')) {
                image = 'https:' + image;
              }
            }

            const px = xMatch ? parseFloat(xMatch[1]) : null;
            const py = yMatch ? parseFloat(yMatch[1]) : null;
            
            if (!placesMap.has(name)) {
              let distStr = undefined;
              let rawDist = 999999;
              
              if (px && py && !isNaN(px) && !isNaN(py) && lat && lng) {
                const numLat = parseFloat(lat);
                const numLng = parseFloat(lng);
                if (!isNaN(numLat) && !isNaN(numLng)) {
                  rawDist = getDistance(numLat, numLng, py, px);
                  // 스마트폰 GPS 오차 보정 반경(~250m) 내 초근접 식당만 필터링
                  if (rawDist > 250) {
                    filteredByDistance++;
                    pos = index + 9;
                    continue;
                  }
                  
                  distStr = `${Math.round(rawDist)}m`;
                }
              } else {
                // 정확한 좌표가 없는 항목은 제외
                filteredByNoCoords++;
                pos = index + 9;
                continue;
              }

              placesMap.set(name, {
                name,
                address: address.includes(' ') ? address : (dong ? `${dong} ${address}` : address),
                category,
                image,
                link: id ? `https://m.place.naver.com/restaurant/${id}` : undefined,
                distance: distStr,
                rawDist
              });
            }
          } else {
            filteredByNoNameAddr++;
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      pos = index + 9; // move past "address"
    }

    debug.totalAddressHits = totalAddressHits;
    debug.totalParsed = totalParsed;
    debug.filteredByBusinessCat = filteredByBusinessCat;
    debug.filteredByNoNameAddr = filteredByNoNameAddr;
    debug.filteredByNoCoords = filteredByNoCoords;
    debug.filteredByDistance = filteredByDistance;
    debug.finalPlacesCount = placesMap.size;
    debug.sampleNames = sampleNames;

    // Convert map to array and sort by raw distance
    const sortedPlaces = Array.from(placesMap.values()).sort((a, b) => a.rawDist - b.rawDist);

    return NextResponse.json({ places: sortedPlaces.slice(0, 8), debug });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    debug.fatalError = String(error);
    return NextResponse.json({ error: 'Internal Server Error', debug }, { status: 500 });
  }
}
