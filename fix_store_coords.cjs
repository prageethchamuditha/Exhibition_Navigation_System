const { createClient } = require('./node_modules/@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Correct campus building centroids computed from the 3D model pixel data
// anchor: KALAWANA_ANCHOR_LAT=6.535472, KALAWANA_ANCHOR_LNG=80.401000
const UPDATES = [
  // Mora → Building #21 (Auditorium & Library) — central main block
  { id: '7b8eeaa9-521d-4f26-a284-9b0299c7dafc', name: 'Mora',  latitude: 6.535438, longitude: 80.401044 },
  // Beta → Building #13 (Main Hall A) — northeast main block
  { id: '9f0a32e1-ce09-4012-a86c-f569e11b190b', name: 'Beta',  latitude: 6.535532, longitude: 80.401150 },
  // gamma → Building #24 (Primary Section) — west long block
  { id: '8b61d7eb-3adf-48a0-9c88-630d4706b170', name: 'gamma', latitude: 6.535388, longitude: 80.400886 },
  // Alpha → Building #31 (Senior Secondary) — southeast tall block
  { id: '9e93cf16-e54e-4187-bf72-6bdde9eb0704', name: 'Alpha', latitude: 6.535305, longitude: 80.401169 },
  // test → Building #30 (Sports Complex) — south-central
  { id: '9b6911da-a3e5-4e46-ad40-8559c10d7843', name: 'test',  latitude: 6.535313, longitude: 80.400905 },
];

async function main() {
  for (const u of UPDATES) {
    const { data, error } = await client
      .from('stores')
      .update({ latitude: u.latitude, longitude: u.longitude, updated_at: new Date().toISOString() })
      .eq('id', u.id)
      .select('id, name, latitude, longitude');
    if (error) console.error(`Error ${u.name}:`, error);
    else console.log(`✅ ${u.name}:`, data);
  }

  const { data: all } = await client.from('stores').select('id, name, latitude, longitude');
  console.log('\n--- All stores after update ---');
  all.forEach(s => console.log(`${s.name}: ${s.latitude}, ${s.longitude}`));
}
main();
