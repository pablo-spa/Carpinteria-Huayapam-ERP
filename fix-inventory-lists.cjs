/**
 * fix-inventory-lists.cjs
 * The app reads inventory from 'inventory_lists' (partitioned by category), not 'inventory'.
 * This script:
 * 1. Reads inventory_lists and concept_categories
 * 2. Reports any items with unrecognized categories
 * 3. Removes those items from inventory_lists
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

async function main() {
  // Load concept_categories
  const catSnap = await db.collection('concept_categories').doc('main').get();
  const catList = catSnap.data().list || [];
  const catNames = catList.map(c => typeof c === 'object' ? c.name : c).filter(Boolean);
  const catSet = new Set(catNames.map(n => n.toLowerCase().trim()));
  console.log('Recognized categories:', catNames.length);

  // Load inventory_lists (what the app actually uses)
  const invListSnap = await db.collection('inventory_lists').get();
  console.log(`\ninventory_lists docs: ${invListSnap.docs.length}`);

  let totalItems = 0;
  const badDocs = {}; // docId → { docData, badItems, goodItems }

  for (const doc of invListSnap.docs) {
    const data = doc.data();
    const list = data.list || [];
    totalItems += list.length;

    const bad = list.filter(i => {
      const cat = (i.category || '').trim();
      return cat && !catSet.has(cat.toLowerCase().trim());
    });

    if (bad.length) {
      badDocs[doc.id] = {
        docData: data,
        badItems: bad,
        goodItems: list.filter(i => {
          const cat = (i.category || '').trim();
          return !cat || catSet.has(cat.toLowerCase().trim());
        }),
      };
    }
  }

  console.log(`Total items in inventory_lists: ${totalItems}`);

  if (Object.keys(badDocs).length === 0) {
    console.log('\n✅ All items in inventory_lists have recognized categories!');
    return;
  }

  // Report
  let totalBad = 0;
  const unknownCats = new Set();
  for (const [docId, info] of Object.entries(badDocs)) {
    const cats = [...new Set(info.badItems.map(i => i.category))];
    console.log(`\nDoc "${docId}": ${info.badItems.length} bad items, categories: ${cats.join(', ')}`);
    info.badItems.slice(0, 5).forEach(i => console.log(`  - [${i.category}] ${i.name}`));
    if (info.badItems.length > 5) console.log(`  ... and ${info.badItems.length - 5} more`);
    totalBad += info.badItems.length;
    cats.forEach(c => unknownCats.add(c));
  }
  console.log(`\nTotal bad items: ${totalBad} in ${Object.keys(badDocs).length} docs`);
  console.log('Unknown categories:', [...unknownCats]);

  // Remove bad items from each doc
  console.log('\nRemoving bad items...');
  const batch = db.batch();
  for (const [docId, info] of Object.entries(badDocs)) {
    batch.update(db.collection('inventory_lists').doc(docId), { list: info.goodItems });
  }
  await batch.commit();
  console.log(`✓ Removed ${totalBad} items from inventory_lists.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
