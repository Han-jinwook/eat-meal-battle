const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
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

async function checkStorage() {
  console.log('Connecting to Supabase:', supabaseUrl);
  
  // 1. List buckets
  const { data: buckets, error: bucketsErr } = await supabaseAdmin.storage.listBuckets();
  if (bucketsErr) {
    console.error('Error listing buckets:', bucketsErr);
    return;
  }
  
  console.log('Existing buckets:');
  buckets.forEach(b => {
    console.log(`- Name: ${b.name}, Public: ${b.public}`);
  });
  
  const mealImagesBucket = buckets.find(b => b.name === 'meal-images');
  if (!mealImagesBucket) {
    console.log('ERROR: "meal-images" bucket does not exist! Creating it...');
    
    const { data: createData, error: createErr } = await supabaseAdmin.storage.createBucket('meal-images', {
      public: true,
      allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg', 'image/gif'],
      fileSizeLimit: 5242880 // 5MB
    });
    
    if (createErr) {
      console.error('Failed to create bucket:', createErr);
      return;
    }
    console.log('Successfully created "meal-images" bucket:', createData);
  } else {
    console.log('"meal-images" bucket exists.');
  }

  // 2. Try to list files in 'meal-images'
  const { data: files, error: filesErr } = await supabaseAdmin.storage.from('meal-images').list('', { limit: 5 });
  if (filesErr) {
    console.error('Error listing files in "meal-images":', filesErr);
  } else {
    console.log('Successfully listed files in "meal-images":', files.map(f => f.name));
  }

  // 3. Try to upload a dummy file to 'meal-images'
  const buffer = Buffer.from('test storage content', 'utf-8');
  const testFileName = `test_from_script_${Date.now()}.txt`;
  
  console.log('Testing upload of', testFileName);
  const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
    .from('meal-images')
    .upload(testFileName, buffer, {
      contentType: 'text/plain',
      upsert: true
    });
    
  if (uploadErr) {
    console.error('Upload test failed:', uploadErr);
  } else {
    console.log('Upload test succeeded:', uploadData);
    
    // Clean up
    const { error: deleteErr } = await supabaseAdmin.storage.from('meal-images').remove([testFileName]);
    if (deleteErr) {
      console.error('Failed to delete test file:', deleteErr);
    } else {
      console.log('Cleanup of test file succeeded.');
    }
  }
}

checkStorage();
