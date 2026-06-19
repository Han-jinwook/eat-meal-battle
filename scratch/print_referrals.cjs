const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function printReferrals() {
  // We can query referral records from Supabase directly if there is a referral table!
  // Wait, does a referral/invite table exist in Supabase?
  // Let's search tables like 'referrals', 'invites', 'referral_history', 'rewards' etc.
  const tables = ['referrals', 'invites', 'referral_history', 'rewards', 'referral_codes', 'user_referrals'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error && data && data.length > 0) {
      console.log(`Table ${t} exists! Fields:`, Object.keys(data[0]));
      console.log(`Sample row:`, data[0]);
    }
  }

  // Also query users to see if we can find a user with referral_code
  const { data: users, error: usersErr } = await supabase.from('users').select('*').limit(5);
  if (!usersErr && users) {
    console.log('Users sample:');
    users.forEach(u => console.log({ id: u.id, nickname: u.nickname, referral_code: u.referral_code }));
  }
}

printReferrals();
