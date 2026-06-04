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
              text: '주어진 음식 사진을 보고, 가장 잘 어울리는 음식 이름 1개만 단답형으로 대답해줘. (예: 제육볶음, 김치찌개, 떡볶이, 페퍼로니 피자, 아메리카노 등). 부가 설명 없이 딱 메뉴 이름만 말해야해.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'low', // Use 'low' to save tokens and speed up since we only need basic recognition
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
