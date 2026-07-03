import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // 30 seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const keyword = searchParams.get('keyword');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    // 1. Nominatim Reverse Geocoding to get Dong Name
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`;
    const geoRes = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'WhatEatApp/1.0 (contact@whateat.app)'
      }
    });

    let dong = '';
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const addr = geoData.address || {};
      const rawDong = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || '';
      dong = rawDong.replace(/\d+동$/, '동').trim();
    }

    if (!dong) {
      dong = '역삼동'; // fallback
    }

    // 2. Fetch Naver Search results for "${dong} 식당"
    const searchQuery = keyword ? `${dong} ${keyword}` : `${dong} 식당`;
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

            if (!placesMap.has(name)) {
              placesMap.set(name, {
                name,
                address: address.includes(' ') ? address : `${dong} ${address}`,
                category,
                image,
                link: id ? `https://m.place.naver.com/restaurant/${id}` : undefined
              });
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      pos = index + 9; // move past "address"
    }

    const places = Array.from(placesMap.values());
    return NextResponse.json({ places });
  } catch (error) {
    console.error('Failed to fetch nearby places:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
