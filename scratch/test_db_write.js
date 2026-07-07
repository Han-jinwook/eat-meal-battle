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
const supabaseAnonKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function testWrite() {
  console.log('\n--- 1. Get a test user ID ---');
  const { data: users, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, nickname')
    .limit(1);

  if (userError) {
    console.error('Fetch user error:', userError);
    return;
  }
  
  if (!users || users.length === 0) {
    console.error('No users found in database!');
    return;
  }

  const testUser = users[0];
  console.log('Test User:', testUser);

  console.log('\n--- 2. Try inserting a row into meal_images using Admin client ---');
  const testMealId = 'd8bc6534-f3c5-4d7a-8d19-58a4fe000000'; // test UUID
  const testRow = {
    id: testMealId,
    image_url: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=500&fit=crop',
    uploaded_by: testUser.id,
    explanation: JSON.stringify({ title: 'Test Meal', mealType: '집밥', rating: 5 }),
    source: 'solo',
    status: 'pending',
    title: 'Test Meal',
    rating: 5,
    meal_type: '집밥',
    link_url: '',
    place_name: '',
    place_address: '',
    description: 'Test Description'
  };

  const { data: adminInsert, error: adminError } = await supabaseAdmin
    .from('meal_images')
    .insert(testRow)
    .select();

  if (adminError) {
    console.error('Admin Insert Error:', adminError);
  } else {
    console.log('Admin Insert Success:', adminInsert);
    // Cleanup
    await supabaseAdmin.from('meal_images').delete().eq('id', testMealId);
  }

  console.log('\n--- 3. Try inserting a row using Anon client (representing authenticated/anonymous user) ---');
  // First, set the session if possible or just try sending it
  // Since we cannot log in easily here, let's see if we can do it anonymously
  const { data: anonInsert, error: anonError } = await supabaseAnon
    .from('meal_images')
    .insert(testRow)
    .select();

  if (anonError) {
    console.error('Anon Insert Error (This might fail if RLS is on and not authenticated):', anonError);
  } else {
    console.log('Anon Insert Success:', anonInsert);
    await supabaseAdmin.from('meal_images').delete().eq('id', testMealId);
  }
}

testWrite();
