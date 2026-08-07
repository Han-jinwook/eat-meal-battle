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

async function testRealtimeComments() {
  console.log("Setting up Realtime listener for comments...");
  const channel = supabase.channel('test_comments_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, payload => {
      console.log('Received Realtime comment:', payload);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log("Inserting a test comment...");
        const res = await supabase.from('comments').insert({
          id: '11111111-1111-1111-1111-111111111111',
          meal_id: 'aa8afbbc-7d0e-46a0-b772-f4797e283645',
          user_id: '5ea629a5-574b-4529-b0c4-22535e391c94',
          content: 'Test Realtime',
          is_deleted: false
        });
        console.log("Insert result:", res.error ? res.error : "Success");
        
        setTimeout(async () => {
          console.log("Cleaning up test comment...");
          await supabase.from('comments').delete().eq('id', '11111111-1111-1111-1111-111111111111');
          process.exit(0);
        }, 3000);
      }
    });
}
testRealtimeComments();
