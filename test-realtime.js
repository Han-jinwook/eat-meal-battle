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

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function testRealtime() {
  console.log("Setting up Realtime listener...");
  const channel = supabase.channel('test_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, payload => {
      console.log('Received Realtime comment:', payload);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_likes' }, payload => {
      console.log('Received Realtime like:', payload);
    })
    .subscribe(async (status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log("Inserting a test like...");
        const res = await supabase.from('meal_likes').insert({
          id: '00000000-0000-0000-0000-000000000000',
          meal_id: '00000000-0000-0000-0000-000000000000',
          user_id: '5ea629a5-574b-4529-b0c4-22535e391c94'
        });
        console.log("Insert result:", res.error ? res.error : "Success");
        
        // Wait 3 seconds for realtime event
        setTimeout(async () => {
          console.log("Cleaning up test like...");
          await supabase.from('meal_likes').delete().eq('id', '00000000-0000-0000-0000-000000000000');
          process.exit(0);
        }, 3000);
      }
    });
}
testRealtime();
