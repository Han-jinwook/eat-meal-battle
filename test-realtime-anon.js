const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const envPath = path.join(__dirname, '.env.local');
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

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testRealtimeAnon() {
  console.log("Setting up Realtime listener with ANON key...");
  const channel = supabase.channel('test_realtime_anon')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_likes' }, payload => {
      console.log('ANON Received Realtime like:', payload);
    })
    .subscribe(async (status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        const adminSupabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
        console.log("Inserting a test like via admin...");
        const res = await adminSupabase.from('meal_likes').insert({
          id: '22222222-2222-2222-2222-222222222222',
          meal_id: 'aa8afbbc-7d0e-46a0-b772-f4797e283645',
          user_id: 'a4478ded-b522-4662-86ae-61f10c51cb98' // someone else
        });
        
        setTimeout(async () => {
          console.log("Cleaning up...");
          await adminSupabase.from('meal_likes').delete().eq('id', '22222222-2222-2222-2222-222222222222');
          process.exit(0);
        }, 3000);
      }
    });
}
testRealtimeAnon();
