const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'auth' }
});

const testUserId = '00000000-0000-4000-8000-000000000001';

async function test() {
  console.log('Fetching from auth.users...');
  const { data, error } = await supabaseAuth
    .from('users')
    .select('id, email')
    .limit(5);

  if (error) {
    console.error('Error fetching auth.users:', error);
  } else {
    console.log('Auth users:', data);
  }

  console.log('Inserting test user into auth.users...');
  const testUserRow = {
    id: testUserId,
    instance_id: '00000000-0000-0000-0000-000000000000',
    email: 'test@aggrofilter.com',
    aud: 'authenticated',
    role: 'authenticated',
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: insertData, error: insertError } = await supabaseAuth
    .from('users')
    .insert(testUserRow)
    .select();

  if (insertError) {
    console.error('Error inserting auth.users:', insertError);
  } else {
    console.log('Insert success:', insertData);
  }
}

test();
