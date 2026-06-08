// Deep check — exact byte-level comparison of inventory categories vs concept_categories
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

async function main() {
  // Load concept_categories — try both doc 'main' and full collection scan
  const catMainSnap = await db.collection('concept_categories').doc('main').get();
  const catAllSnap  = await db.collection('concept_categories').get();

  console.log('--- concept_categories docs ---');
  catAllSnap.forEach(doc => {
    console.log(`  doc id="${doc.id}":`, JSON.stringify(doc.data()).substring(0, 200));
  });

  // Build catNames same way almacen_inventario.html does
  // It reads: rawCats = d.concept_categories || []
  // then STATE_CATS = rawCats[0]?.list || rawCats.filter(x => typeof x === 'object' && x.name)
  // catNames = STATE_CATS.map(c => c.name)
  const rawCats = catAllSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
  console.log('\nrawCats (as page sees it):', JSON.stringify(rawCats).substring(0, 400));

  const STATE_CATS = rawCats[0]?.list || rawCats.filter(x => typeof x === 'object' && x.name);
  const catNames = STATE_CATS.map(c => typeof c === 'object' ? c.name : c).filter(Boolean);
  const catSet = new Set(catNames.map(n => n.toLowerCase().trim()));

  console.log('\ncatNames extracted:', catNames);
  console.log('\ncatSet size:', catSet.size);

  // Load inventory
  const invSnap = await db.collection('inventory').get();
  const bad = {};
  let total = 0;

  invSnap.forEach(doc => {
    const data = doc.data();
    if (data._init) return;
    total++;
    const cat = (data.category || '').trim();
    if (cat && !catSet.has(cat.toLowerCase().trim())) {
      if (!bad[cat]) bad[cat] = { count: 0, samples: [] };
      bad[cat].count++;
      if (bad[cat].samples.length < 3) bad[cat].samples.push(data.name || doc.id);
      // Show hex for invisible chars
      if (bad[cat].count === 1) {
        bad[cat].hex = [...cat].map(c => c.codePointAt(0).toString(16)).join(' ');
      }
    }
  });

  console.log(`\nTotal inventory: ${total}`);
  if (Object.keys(bad).length === 0) {
    console.log('✅ All categories recognized.');
  } else {
    console.log('⚠ Unrecognized:');
    for (const [cat, info] of Object.entries(bad)) {
      console.log(`  "${cat}" (${info.count} items) hex: ${info.hex}`);
      info.samples.forEach(s => console.log(`    - ${s}`));
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
