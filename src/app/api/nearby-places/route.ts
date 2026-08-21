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

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const addr = geoData.address || {};
        const rawDong = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || '';
        dong = rawDong.replace(/\d+동$/, '동').trim();
      }
    } catch (e) {
      console.warn("Nominatim reverse geocoding failed:", e);
    }

    // 1.5 Try BigDataCloud if Nominatim failed (since Nominatim frequently returns 403/429 on local env)
    if (!dong) {
      try {
        const bigDataCloudUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ko`;
        const bdcRes = await fetch(bigDataCloudUrl);
        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          const rawLocality = bdcData.locality || bdcData.city || '';
          dong = rawLocality.replace(/\d+동$/, '동').trim();
        }
      } catch (e) {
        console.warn("BigDataCloud reverse geocoding failed:", e);
      }
    }

    // 2. Fetch Naver Search results for "${dong} 식당" (or just "식당" if Nominatim failed)
    const searchQuery = keyword 
      ? (dong ? `${dong} ${keyword}` : keyword) 
      : (dong ? `${dong} 식당` : "식당");
    const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}&lat=${lat}&lng=${lng}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://m.search.naver.com/'
      }
    });

    if (!searchRes.ok) {
      return NextResponse.json({ places: [] });
    }

    const html = await searchRes.text();
    const placesMap = new Map<string, any>();

    // Scan for "address" to find JSON blocks containing place info
    let pos = 0;
    while (true) {
      const index = html.indexOf('"address"', pos);
      if (index === -1) break;

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
          const imgMatch = decoded.match(/"smartplaceImages"\s*:\s*\[\s*"([^"]+)"/);
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
            continue;
          }

          // Filter out UI noise and ensure valid address
          if (name && address && name.length > 1 && address.includes(' ')) {
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
                  // Filter out places completely out of bounds (e.g. > 15km)
                  if (rawDist > 15000) continue;
                  
                  if (rawDist < 1000) {
                    distStr = `${Math.round(rawDist)}m`;
                  } else {
                    distStr = `${(rawDist / 1000).toFixed(1)}km`;
                  }
                }
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
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      pos = index + 9; // move past "address"
    }

    // Convert map to array and sort by raw distance
    const sortedPlaces = Array.from(placesMap.values()).sort((a, b) => a.rawDist - b.rawDist);

    return NextResponse.json({ places: sortedPlaces.slice(0, 25) });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
