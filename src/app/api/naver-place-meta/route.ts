import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // 30 seconds limit

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl).trim();
    
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
    
    const isNaver = finalUrl.includes('naver.com') || decodedUrl.includes('naver.com') || decodedUrl.includes('naver.me');
    const isKakao = finalUrl.includes('kakao.com') || decodedUrl.includes('kakao.com') || decodedUrl.includes('kko.to');
    const isGoogle = finalUrl.includes('google.com') || finalUrl.includes('google.co.kr') || decodedUrl.includes('maps.app.goo.gl') || decodedUrl.includes('goo.gl/maps');

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
          const html = await pcmapRes.text();
          const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                             html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i);
          title = titleMatch ? titleMatch[1].replace(/\s*:\s*네이버.*/, '').trim() : '';
          const imgMatch = html.match(/https:\/\/search\.pstatic\.net\/common\/[^"'\s]*/i);
          image = imgMatch ? imgMatch[0].replace(/&amp;/g, '&').replace(/["'\s]/g, '') : '';
        }
      }
    }

    // 3. Case B: Kakao Map
    if (isKakao && !title) {
      const html = await res.text();
      
      const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                         html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i);
      title = titleMatch ? titleMatch[1].trim() : '';
      
      // Kakao Map provides specific store name in q query param
      const qMatch = finalUrl.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        title = decodeURIComponent(qMatch[1]).replace(/\+/g, ' ');
      }

      const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                       html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
      image = imgMatch ? imgMatch[1].trim() : '';
      if (image && image.startsWith('//')) {
        image = 'https:' + image;
      }
    }

    // 4. Case C: Google Maps or Generic Site (using standard OG tags)
    if (!title) {
      const html = await res.text();
      const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                         html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i) ||
                         html.match(/<title>([^<]*)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : '';
      if (title.includes('Google Maps') || title.includes('구글 지도')) {
        title = title.replace(/\s*-\s*Google Maps.*/i, '').replace(/\s*-\s*구글 지도.*/i, '').trim();
      }

      const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                       html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
      image = imgMatch ? imgMatch[1].trim() : '';
    }

    let brand = 'naver';
    if (isKakao) brand = 'kakao';
    else if (isGoogle) brand = 'google';

    return NextResponse.json({ title, image, brand });
  } catch (error: any) {
    console.error('Map Link Meta Parsing Error:', error);
    return NextResponse.json({ error: 'Failed to parse metadata', details: error.message }, { status: 500 });
  }
}
