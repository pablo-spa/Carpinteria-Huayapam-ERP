#!/usr/bin/env node
// Finds inventory items whose category is NOT in concept_categories, and deletes them.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';

initializeApp({ credential: cert(require(KEY)) });
const db = getFirestore('carpinteria-huayapam-erp');

async function main() {
  // Load recognized categories
  const catSnap = await db.collection('concept_categories').doc('main').get();
  let categories = [];
  if (catSnap.exists) {
    categories = catSnap.data().list || [];
  } else {
    const all = await db.collection('concept_categories').get();
    all.forEach(d => {
      const data = d.data();
      if (data.list) categories = [...categories, ...data.list];
    });
  }

  const catSet = new Set(categories.filter(c => typeof c === 'string').map(c => c.toLowerCase().trim()));
  console.log('Recognized categories:', categories);

  // Load inventory
  const invSnap = await db.collection('inventory').get();
  const toDelete = [];
  const unknownCats = new Set();

  invSnap.forEach(doc => {
    const data = doc.data();
    if (data._init) return;
    const cat = (data.category || '').toLowerCase().trim();
    if (cat && !catSet.has(cat)) {
      unknownCats.add(data.category);
      toDelete.push({ id: doc.id, name: data.name || data.code, category: data.category });
    }
  });

  console.log('\nUnrecognized categories found:', [...unknownCats]);
  console.log(`Items to delete: ${toDelete.length}`);
  toDelete.slice(0, 10).forEach(i => console.log(`  - [${i.category}] ${i.name} (${i.id})`));
  if (toDelete.length > 10) console.log(`  ... and ${toDelete.length - 10} more`);

  if (toDelete.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  // Delete in batches of 500
  let batched = 0;
  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = db.batch();
    toDelete.slice(i, i + 500).forEach(item => {
      batch.delete(db.collection('inventory').doc(item.id));
    });
    await batch.commit();
    batched += Math.min(500, toDelete.length - i);
    console.log(`Deleted ${batched}/${toDelete.length}...`);
  }

  console.log(`\nDone. Removed ${toDelete.length} inventory items with unrecognized categories.`);
}

main().catch(err => { console.error(err); process.exit(1); });
