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
  console.log("Checking realtime publications...");
  // Query pg_publication_tables directly is usually restricted on Supabase REST API,
  // but we can try to query information_schema or just manually inspect.
  // A better way is to see if we can query realtime publications
  
  const { data, error } = await supabase.rpc('query_realtime_tables'); // Or maybe we can't query this directly from REST API.
  console.log(error ? error.message : data);
}
checkDb();
