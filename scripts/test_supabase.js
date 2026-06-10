const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ekyqxkmwtvwtiszopery.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreXF4a213dHZ3dGlzem9wZXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMzNzUzMiwiZXhwIjoyMDk1OTEzNTMyfQ.K2Uzz1BrYKkh3CRcG-MkrkriciX5I7HVnuM8RKx3Q-Y';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    // raw SQL 실행을 지원하지 않을 수 있으므로, information_schema나 일반 쿼리를 던져봅니다.
    // users 테이블에서 1건 조회
    const { data: users, error: err1 } = await supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (err1) {
      console.log('Error fetching from users table:', err1.message);
    } else {
      console.log('Success fetching from users table. Found:', users.length);
    }

    // family_users 테이블에서 1건 조회
    const { data: familyUsers, error: err2 } = await supabase
      .from('family_users')
      .select('*')
      .limit(1);
      
    if (err2) {
      console.log('Error fetching from family_users table:', err2.message);
    } else {
      console.log('Success fetching from family_users table. Found:', familyUsers.length);
    }

  } catch (error) {
    console.error('Fatal test error:', error.message);
  }
}

testConnection();
