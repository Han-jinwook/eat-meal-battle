import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // 30 seconds limit

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    
    // Follow redirect to resolve short URLs (e.g. naver.me)
    const res = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    const finalUrl = res.url;
    
    // Extract place ID
    const placeIdMatch = finalUrl.match(/\/place\/(\d+)/) || finalUrl.match(/restaurant\/(\d+)/);
    if (!placeIdMatch) {
      return NextResponse.json({ error: 'Failed to extract Naver Place ID' }, { status: 400 });
    }

    const placeId = placeIdMatch[1];
    const pcmapUrl = `https://pcmap.place.naver.com/restaurant/${placeId}/home`;

    const pcmapRes = await fetch(pcmapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!pcmapRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch Naver Place details page' }, { status: 500 });
    }

    const html = await pcmapRes.text();

    // Parse og:title
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i) || 
                       html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/i);
    let title = titleMatch ? titleMatch[1] : '';
    title = title.replace(/\s*:\s*네이버.*/, '').trim();

    // Parse first image
    const imgMatch = html.match(/https:\/\/search\.pstatic\.net\/common\/[^"'\s]*/i);
    let image = imgMatch ? imgMatch[0].replace(/&amp;/g, '&').replace(/["'\s]/g, '') : '';

    return NextResponse.json({ title, image, placeId });
  } catch (error: any) {
    console.error('Naver Place Meta Parsing Error:', error);
    return NextResponse.json({ error: 'Failed to parse metadata', details: error.message }, { status: 500 });
  }
}
