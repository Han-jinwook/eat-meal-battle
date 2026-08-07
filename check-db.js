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

async function checkDb() {
  console.log("Checking latest comments...");
  const { data: comments, error: cErr } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(cErr ? cErr : comments);

  console.log("Checking latest likes...");
  const { data: likes, error: lErr } = await supabase.from('meal_likes').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(lErr ? lErr : likes);
}
checkDb();
