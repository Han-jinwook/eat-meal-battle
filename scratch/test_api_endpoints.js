const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// .env.local 파싱
const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf-8')
  .split('\n')
  .reduce((acc, line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      acc[key] = value.trim();
    }
    return acc;
  }, {});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

let testUserId = '00000000-0000-4000-8000-000000000001';

async function setupTestUser() {
  console.log('--- Fetching real user ID from DB for test context ---');
  const { data: firstUser, error: realUserErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (realUserErr || !firstUser) {
    console.error('Error fetching real user, using default:', realUserErr);
  } else {
    testUserId = firstUser.id;
    console.log('Using real user ID for test:', testUserId);
  }
}

async function runTests() {
  await setupTestUser();

  console.log('\n--- 1. Testing /api/db/upload-image ---');
  
  // 1x1 투명 GIF base64
  const sampleBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const fileName = `test_upload_${Date.now()}.gif`;

  const uploadPayload = {
    image: sampleBase64,
    fileName: fileName
  };

  try {
    const uploadRes = await fetch('http://localhost:3000/api/db/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-session-token'
      },
      body: JSON.stringify(uploadPayload)
    });

    console.log('Upload Response Status:', uploadRes.status);
    const uploadData = await uploadRes.json();
    console.log('Upload Response Body:', uploadData);

    if (!uploadRes.ok) {
      console.error('Upload failed!');
      return;
    }

    const publicUrl = uploadData.publicUrl;

    console.log('\n--- 2. Testing /api/db/write (insert) ---');
    const testMealId = `d8bc6534-f3c5-4d7a-8d19-${Math.random().toString(16).slice(2, 14)}`;
    const writePayload = {
      table: 'meal_images',
      action: 'insert',
      data: {
        id: testMealId,
        image_url: publicUrl,
        uploaded_by: testUserId,
        source: 'solo',
        status: 'pending',
        title: 'Test API Meal',
        rating: 5,
        meal_type: '집밥',
        description: 'Test API Description'
      }
    };

    const writeRes = await fetch('http://localhost:3000/api/db/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-session-token'
      },
      body: JSON.stringify(writePayload)
    });

    console.log('Write Response Status:', writeRes.status);
    const writeData = await writeRes.json();
    console.log('Write Response Body:', writeData);

    if (writeRes.ok) {
      console.log('Write check passed! Cleaning up...');
      // Clean up in DB
      await supabaseAdmin.from('meal_images').delete().eq('id', testMealId);
      console.log('Cleanup DB done.');
    } else {
      console.error('Write failed!');
    }

    // Clean up file in Storage
    console.log('Cleaning up uploaded storage file...');
    const { error: deleteErr } = await supabaseAdmin.storage
      .from('meal-images')
      .remove([fileName]);
    if (deleteErr) {
      console.error('Failed to delete test file from storage:', deleteErr);
    } else {
      console.log('Storage cleanup done.');
    }

  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

runTests();
