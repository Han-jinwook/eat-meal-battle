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

    // 2. Fetch Naver PC Search (where=nexearch) with full Desktop Browser headers (bypasses 403 Cloud blocks)
    const queries = keyword 
      ? [dong ? `${dong} ${keyword}` : keyword]
      : [
          dong ? `${dong} 식당` : "식당",
          dong ? `${dong} 맛집` : "맛집"
        ];
    
    debug.queries = queries;

    const desktopHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.naver.com/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Upgrade-Insecure-Requests': '1'
    };

    const placesMap = new Map<string, any>();
    let totalAddressHits = 0;
    let totalParsed = 0;
    let filteredByBusinessCat = 0;
    let filteredByNoNameAddr = 0;
    let filteredByNoCoords = 0;
    let filteredByDistance = 0;
    const sampleNames: string[] = [];

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);

    for (const q of queries) {
      try {
        const searchUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(q)}`;
        const searchRes = await fetch(searchUrl, { headers: desktopHeaders });
        
        debug[`status_${q}`] = searchRes.status;
        if (!searchRes.ok) continue;

        const html = await searchRes.text();
        debug[`htmlLen_${q}`] = html.length;

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
              let rawName = nameMatch ? nameMatch[1] : (titleMatch ? titleMatch[1] : null);
              const address = addressMatch ? addressMatch[1] : null;
              const category = categoryMatch ? categoryMatch[1] : '음식점';
              let image = imgMatch ? imgMatch[1] : '';
              const bCat = bCatMatch ? bCatMatch[1] : null;

              if (rawName) {
                rawName = rawName.replace(/<[^>]*>/g, '').trim();
              }

              // 비식당 업종 제외
              if (bCat && !['restaurant', 'cafe', 'bakery', 'pub', 'bar'].includes(bCat)) {
                filteredByBusinessCat++;
                pos = index + 9;
                continue;
              }

              if (rawName && address && rawName.length > 1 && address.includes(' ')) {
                totalParsed++;
                if (sampleNames.length < 10 && !sampleNames.includes(rawName)) sampleNames.push(rawName);

                if (image) {
                  image = decodeURIComponent(image).replace(/\\/g, '');
                  if (!image.startsWith('http')) {
                    image = 'https:' + image;
                  }
                }

                const px = xMatch ? parseFloat(xMatch[1]) : null;
                const py = yMatch ? parseFloat(yMatch[1]) : null;
                
                if (!placesMap.has(rawName)) {
                  let distStr = undefined;
                  let rawDist = 999999;
                  
                  if (px && py && !isNaN(px) && !isNaN(py) && !isNaN(numLat) && !isNaN(numLng)) {
                    rawDist = getDistance(numLat, numLng, py, px);
                    distStr = `${Math.round(rawDist)}m`;
                  } else {
                    filteredByNoCoords++;
                    pos = index + 9;
                    continue;
                  }

                  placesMap.set(rawName, {
                    name: rawName,
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

          pos = index + 9;
        }
      } catch (err) {
        debug[`error_${q}`] = String(err);
      }
    }

    // Convert map to array and sort by distance
    let sortedPlaces = Array.from(placesMap.values()).sort((a, b) => a.rawDist - b.rawDist);

    // 거리 필터: 기본 250m, 만약 250m 이내 식당이 2개 이하이면 최대 400m까지 허용 (실내 GPS 오차 보정)
    const within250 = sortedPlaces.filter(p => p.rawDist <= 250);
    if (within250.length >= 2) {
      sortedPlaces = within250;
    } else {
      sortedPlaces = sortedPlaces.filter(p => p.rawDist <= 400);
    }

    debug.totalAddressHits = totalAddressHits;
    debug.totalParsed = totalParsed;
    debug.filteredByBusinessCat = filteredByBusinessCat;
    debug.filteredByNoNameAddr = filteredByNoNameAddr;
    debug.filteredByNoCoords = filteredByNoCoords;
    debug.filteredByDistance = filteredByDistance;
    debug.finalPlacesCount = sortedPlaces.length;
    debug.sampleNames = sampleNames;

    return NextResponse.json({ places: sortedPlaces.slice(0, 8), debug });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    debug.fatalError = String(error);
    return NextResponse.json({ error: 'Internal Server Error', debug }, { status: 500 });
  }
}
