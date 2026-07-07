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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testCreateUser() {
  const testId = 'a0a0a0a0-b0b0-c0c0-d0d0-e0e0e0e0e0e0';
  const testEmail = 'test_supabase_sync@example.com';
  const testPassword = 'merlin_hub_' + testId;

  console.log('--- 1. Check if test user exists in auth.users ---');
  const { data: existingUser, error: getError } = await supabaseAdmin.auth.admin.getUserById(testId);
  
  if (getError) {
    console.log('User does not exist (expected):', getError.message);
  } else {
    console.log('User already exists:', existingUser.user.id);
    // Delete existing
    await supabaseAdmin.auth.admin.deleteUser(testId);
    console.log('Deleted existing test user.');
  }

  console.log('\n--- 2. Create test user with custom ID ---');
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    id: testId,
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      nickname: '테스트유저'
    }
  });

  if (createError) {
    console.error('Create User Error:', createError);
  } else {
    console.log('Create User Success:', newUser.user.id, newUser.user.email);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(testId);
    console.log('Cleaned up test user.');
  }
}

testCreateUser();
