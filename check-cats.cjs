// Quick check: which categories in inventory don't match concept_categories?
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

async function main() {
  const catSnap = await db.collection('concept_categories').doc('main').get();
  const categories = (catSnap.data().list || []);
  const catNames = categories.map(c => typeof c === 'object' ? c.name : c);
  const catSet = new Set(catNames.map(n => n.toLowerCase().trim()));
  console.log('catNames:', catNames);

  const invSnap = await db.collection('inventory').get();
  const unknownMap = {};
  invSnap.forEach(doc => {
    const data = doc.data();
    if (data._init) return;
    const cat = (data.category || '').trim();
    if (cat && !catSet.has(cat.toLowerCase().trim())) {
      unknownMap[cat] = (unknownMap[cat] || 0) + 1;
    }
  });

  const unknowns = Object.entries(unknownMap);
  if (unknowns.length === 0) {
    console.log('\n✅ All inventory categories are recognized!');
  } else {
    console.log('\n⚠ Unrecognized categories:');
    unknowns.forEach(([cat, count]) => console.log(`  "${cat}" — ${count} items`));
  }
  console.log(`\nTotal inventory docs: ${invSnap.size}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
