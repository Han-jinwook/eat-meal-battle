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
    const isYoutube = finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be') || decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be');
    const isInstagram = finalUrl.includes('instagram.com') || decodedUrl.includes('instagram.com');
    const isTiktok = finalUrl.includes('tiktok.com') || decodedUrl.includes('tiktok.com');

    let html = '';
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

      const imgMatch = pageHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                       pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
      image = imgMatch ? imgMatch[1].trim() : '';
      if (image && image.startsWith('//')) {
        image = 'https:' + image;
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

      const imgMatch = pageHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i) ||
                       pageHtml.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/i);
      image = imgMatch ? imgMatch[1].replace(/&amp;/g, '&').trim() : '';
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

    return NextResponse.json({ title, image, brand });
  } catch (error: any) {
    console.error('Map Link Meta Parsing Error:', error);
    return NextResponse.json({ error: 'Failed to parse metadata', details: error.message }, { status: 500 });
  }
}
