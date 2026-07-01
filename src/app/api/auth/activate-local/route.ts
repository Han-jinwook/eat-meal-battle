import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('is_activated, accumulated_seconds')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found in WhatEat local DB
        return NextResponse.json({
          is_activated: false,
          accumulated_seconds: 0,
          exists: false,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      is_activated: user.is_activated || false,
      accumulated_seconds: user.accumulated_seconds || 0,
      exists: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, nickname, profileImage, accumulatedSeconds, isActivated } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, is_activated, accumulated_seconds')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    let resultData;

    if (!existingUser) {
      // 2. User does not exist, insert a new record linking to Hub
      const { data, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: email || `user_${userId.substring(0, 8)}@merlin.com`,
          nickname: nickname || '가족회원',
          profile_image: profileImage || '',
          provider: 'merlin_hub',
          provider_id: userId,
          is_student: false,
          is_activated: isActivated || false,
          accumulated_seconds: accumulatedSeconds || 0,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      resultData = data;
    } else {
      // 3. User exists, update accumulated_seconds and is_activated status
      // Once is_activated is true, we should keep it true and not overwrite with false
      const nextIsActivated = existingUser.is_activated || isActivated || false;
      const nextAccumulatedSeconds = Math.max(existingUser.accumulated_seconds || 0, accumulatedSeconds || 0);

      const { data, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          is_activated: nextIsActivated,
          accumulated_seconds: nextAccumulatedSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      resultData = data;
    }

    return NextResponse.json({
      success: true,
      is_activated: resultData.is_activated,
      accumulated_seconds: resultData.accumulated_seconds,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
