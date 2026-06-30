import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client
// Note: Ensure that OPENAI_API_KEY is set in your environment variables (.env.local)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 30; // 30 seconds limit for Vercel/Netlify serverless

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key is missing' }, { status: 500 });
    }

    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Call OpenAI API for vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '주어진 음식 사진을 분석하여, 사진 속에 나타난 가장 구체적인 한국 음식 혹은 요리 이름 1개만 단답형으로 대답해줘. 국물 색상(예: 빨간 국물의 육개장 vs 맑은 국물의 갈비탕), 건더기 재료(예: 찢은 소고기 양지 vs 뼈가 붙은 갈비)를 자세히 관찰하고 식당에서 부르는 정확한 한식 메뉴명을 알려줘. (예: 육개장, 갈비탕, 김치찌개, 부대찌개 등). 다른 설명 없이 단어 1개만 말해야 해.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'high', // Use 'high' to ensure exact details (e.g. shredded beef vs bones) are visible
              },
            },
          ],
        },
      ],
      max_tokens: 20,
      temperature: 0.2, // Low temperature for more deterministic output
    });

    const menuName = response.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ menuName });
  } catch (error: any) {
    console.error('AI Image Analysis Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error.message },
      { status: 500 }
    );
  }
}
