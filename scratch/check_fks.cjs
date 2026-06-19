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

async function checkFKs() {
  const query = `
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('comments', 'comment_replies', 'meal_images');
  `;
  
  let data, error;
  try {
    const res = await supabase.rpc('exec_sql', { sql_query: query });
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    console.log("exec_sql RPC failed or not available. Testing with raw insert...");
    const testId = '00000000-0000-0000-0000-000000000000';
    const { error: insertErr } = await supabase.from('comments').insert({
      meal_id: testId,
      user_id: 'b51485f4-0bd1-4055-9702-8ebe5d13129a', // valid user ID from our users list
      content: 'test content'
    });
    if (insertErr) {
      console.log("Comment insert failed:", insertErr.message);
    } else {
      console.log("Comment insert succeeded with dummy UUID! No strict FK constraint on comments.meal_id.");
      await supabase.from('comments').delete().eq('content', 'test content');
    }
  } else {
    console.log("Foreign Key constraints in DB:");
    console.log(data);
  }
}

checkFKs();
