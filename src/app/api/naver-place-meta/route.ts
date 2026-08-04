import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // 30 seconds limit

async function fetchNaverPlacePhoto(storeName: string): Promise<string> {
  if (!storeName || storeName.includes('지도') || storeName.includes('Map')) return '';
  try {
    const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(storeName)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    
    // Find pstatic images that contain ldb-phinf or pup-review-phinf or naverbooking-phinf
    const regex = /https:\/\/search\.pstatic\.net\/common\/[^"'\s]*/gi;
    const matches = html.match(regex);
    if (matches) {
      for (const img of matches) {
        const decoded = decodeURIComponent(img).replace(/&amp;/g, '&').replace(/["'\s]/g, '');
        if (decoded.includes('ldb-phinf') || decoded.includes('pup-review-phinf') || decoded.includes('naverbooking-phinf')) {
          return decoded;
        }
      }
      return matches[0].replace(/&amp;/g, '&').replace(/["'\s]/g, '');
    }
  } catch (e) {
    console.error('Failed to fetch Naver Place Photo by keyword:', e);
  }
  return '';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl).trim();
    
    // 유튜브 URL 신속 인터셉트
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const youtubeMatch = decodedUrl.match(youtubeRegex);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      let title = '';
      let image = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      
      try {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const ytRes = await fetch(watchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        if (ytRes.ok) {
          const ytHtml = await ytRes.text();
          const titleMatch = ytHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                             ytHtml.match(/<meta[^>]*name="title"[^>]*content="([^"]*)"/i) ||
                             ytHtml.match(/<title>([^<]*)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace(/\s*-\s*YouTube.*/i, '').trim();
          }
        }
      } catch (e) {
        console.error('YouTube HTML fetch failed:', e);
      }

      if (!title) {
        title = '유튜브 영상';
      }
      
      return NextResponse.json({ title, image, brand: 'youtube' });
    }

    // 1. Resolve redirect to get final URL
    const res = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    const finalUrl = res.url;
    let title = '';
    let image = '';
    let address = '';
    let html = '';
    
    const isNaver = finalUrl.includes('naver.com') || decodedUrl.includes('naver.com') || decodedUrl.includes('naver.me');
    const isKakao = finalUrl.includes('kakao.com') || decodedUrl.includes('kakao.com') || decodedUrl.includes('kko.to');
    const isGoogle = finalUrl.includes('google.com') || finalUrl.includes('google.co.kr') || decodedUrl.includes('maps.app.goo.gl') || decodedUrl.includes('goo.gl/maps');
    const isYoutube = finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be') || decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be');
    const isInstagram = finalUrl.includes('instagram.com') || decodedUrl.includes('instagram.com');
    const isTiktok = finalUrl.includes('tiktok.com') || decodedUrl.includes('tiktok.com');


    const getHtml = async () => {
      if (!html) {
        html = await res.text();
      }
      return html;
    };

    // 2. Case A: Naver Place
    if (isNaver) {
      const placeIdMatch = finalUrl.match(/\/place\/(\d+)/) || finalUrl.match(/restaurant\/(\d+)/) || decodedUrl.match(/\/place\/(\d+)/) || decodedUrl.match(/restaurant\/(\d+)/);
      if (placeIdMatch) {
        const placeId = placeIdMatch[1];
        const pcmapUrl = `https://pcmap.place.naver.com/restaurant/${placeId}/home`;
        const pcmapRes = await fetch(pcmapUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (pcmapRes.ok) {
          const pcHtml = await pcmapRes.text();
          const titleMatch = pcHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                             pcHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i);
          title = titleMatch ? titleMatch[1].replace(/\s*:\s*네이버.*/, '').trim() : '';
          const imgMatch = pcHtml.match(/https:\/\/search\.pstatic\.net\/common\/[^"'\s]*/i);
          image = imgMatch ? imgMatch[0].replace(/&amp;/g, '&').replace(/["'\s]/g, '') : '';
          
          const roadAddrMatch = pcHtml.match(/"roadAddress"\s*:\s*"([^"]+)"/i) || pcHtml.match(/roadAddress\\?"\s*:\s*\\?"([^"]+)\\?"/i);
          const addrMatch = pcHtml.match(/"address"\s*:\s*"([^"]+)"/i) || pcHtml.match(/address\\?"\s*:\s*\\?"([^"]+)\\?"/i);
          
          let roadAddr = '';
          let jibunAddr = '';
          if (roadAddrMatch && roadAddrMatch[1]) {
            roadAddr = roadAddrMatch[1].replace(/\\u[0-9a-fA-F]{4}/g, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
          }
          if (addrMatch && addrMatch[1]) {
            jibunAddr = addrMatch[1].replace(/\\u[0-9a-fA-F]{4}/g, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));
          }

          if (roadAddr && jibunAddr) {
            const dongMatch = jibunAddr.match(/\s([가-힣]+(?:동|읍|면))(?:\s|\d|$)/);
            if (dongMatch) {
              address = `${roadAddr} (${dongMatch[1]})`;
            } else {
              address = roadAddr;
            }
          } else {
            address = roadAddr || jibunAddr || '';
          }
        }
      }
    }

    // 3. Case B: Kakao Map
    if (isKakao && !title) {
      const pageHtml = await getHtml();
      
      const titleMatch = pageHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                         pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i);
      title = titleMatch ? titleMatch[1].trim() : '';
      
      const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        title = decodeURIComponent(qMatch[1]).replace(/\+/g, ' ');
      }

      if (title) {
        image = await fetchNaverPlacePhoto(title);
      }

      if (!image) {
        const imgMatch = pageHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                         pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
        image = imgMatch ? imgMatch[1].trim() : '';
        if (image && image.startsWith('//')) {
          image = 'https:' + image;
        }
      }
    }

    // 4. Case C: Google Maps
    if (isGoogle && !title) {
      const placeMatch = finalUrl.match(/\/place\/([^/]+)/) || decodedUrl.match(/\/place\/([^/]+)/);
      if (placeMatch) {
        try {
          title = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim();
        } catch (e) {
          title = placeMatch[1].replace(/\+/g, ' ').trim();
        }
      }

      const pageHtml = await getHtml();

      if (!title || title.includes('Google Maps') || title.includes('Google 지도') || title.includes('Google지도')) {
        const titleMatch = pageHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                           pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i) ||
                           pageHtml.match(/<title>([^<]*)<\/title>/i);
        const parsedTitle = titleMatch ? titleMatch[1].trim() : '';
        if (parsedTitle && !parsedTitle.includes('Google Maps') && !parsedTitle.includes('Google 지도') && !parsedTitle.includes('Google지도')) {
          title = parsedTitle;
        }
      }

      if (title) {
        title = title.replace(/\s*-\s*Google Maps.*/i, '').replace(/\s*-\s*구글 지도.*/i, '').replace(/\s*-\s*Google지도.*/i, '').trim();
      }

      if (!title) {
        title = '구글 지도';
      }

      if (title) {
        image = await fetchNaverPlacePhoto(title);
      }

      if (!image) {
        const imgMatch = pageHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                         pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
        image = imgMatch ? imgMatch[1].replace(/&amp;/g, '&').trim() : '';

        if (image && image.includes('staticmap')) {
          const centerMatch = image.match(/[?&]center=([0-9.-]+)(?:%2C|,)([0-9.-]+)/i);
          if (centerMatch) {
            const lat = parseFloat(centerMatch[1]);
            const lng = parseFloat(centerMatch[2]);
            
            // 지리적으로 대한민국 영역을 벗어나거나 미국 등 엉뚱한 위치(예: default US center)인 경우 제거
            const isUSLocation = (lng >= -130 && lng <= -60) || (Math.abs(lat - 37.0625) < 0.1 && Math.abs(lng - -95.677) < 0.1);
            
            if (isUSLocation) {
              image = ''; // Fallback to premium G icon card
            } else {
              // 강제로 한국어 레이블 설정 및 빨간색 핀(Marker) 추가하여 가독성 강화
              image = image.replace(/language=[a-z-]+/gi, 'language=ko');
              if (!image.includes('markers=')) {
                image += `&markers=color:red%7C${lat},${lng}`;
              }
            }
          }
        }
      }
    }

    // 5. Case D: Generic Site (using standard OG tags)
    if (!title) {
      const pageHtml = await getHtml();
      const titleMatch = pageHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                         pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i) ||
                         pageHtml.match(/<title>([^<]*)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : '';

      const imgMatch = pageHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                       pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
      image = imgMatch ? imgMatch[1].trim() : '';
    }

    let brand = 'naver';
    if (isKakao) brand = 'kakao';
    else if (isGoogle) brand = 'google';
    else if (isYoutube) brand = 'youtube';
    else if (isInstagram) brand = 'instagram';
    else if (isTiktok) brand = 'tiktok';
    else brand = 'generic';

    if (!address && title && brand !== 'youtube' && brand !== 'generic') {
      try {
        const localSearchUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(title)}&display=1`;
        const localRes = await fetch(localSearchUrl, {
          headers: {
            "X-Naver-Client-Id": process.env.NAVER_SEARCH_CLIENT_ID || "",
            "X-Naver-Client-Secret": process.env.NAVER_SEARCH_CLIENT_SECRET || ""
          }
        });
        if (localRes.ok) {
          const localData = await localRes.json();
          if (localData.items && localData.items.length > 0) {
            address = localData.items[0].roadAddress || localData.items[0].address || '';
          }
        }
      } catch (e) {
        console.error('Failed to fetch address from Naver Local Search:', e);
      }
    }

    return NextResponse.json({ title, image, brand, address });
  } catch (error: any) {
    console.error('Map Link Meta Parsing Error:', error);
    return NextResponse.json({ error: 'Failed to parse metadata', details: error.message }, { status: 500 });
  }
}
