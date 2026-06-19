const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  // Try querying table names in the public schema
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  });

  if (error) {
    console.log('Error querying tables via RPC exec_sql. Trying basic query...');
  } else {
    console.log('Tables in Supabase:');
    console.log(data);
    return;
  }

  // Fallback: let's try querying some tables directly to see if they exist
  const tables = ['users', 'meals', 'meal_menus', 'meal_images', 'comments', 'comment_replies', 'family_shared_meals', 'whateat_meals'];
  for (const table of tables) {
    const { data: testData, error: testError } = await supabase.from(table).select('*').limit(1);
    if (testError) {
      console.log(`Table '${table}': NOT FOUND or ERROR (${testError.message})`);
    } else {
      console.log(`Table '${table}': EXISTS`);
    }
  }
}

checkTables();
