/**
 * add-inventory-flags.cjs
 * Agrega materialImportante: false y basicoPresupuesto: false a todos los
 * documentos del inventario (colecciones `inventory` e `inventory_lists`).
 *
 * Uso: node add-inventory-flags.cjs [--dry-run]
 */
const admin = require('firebase-admin');

const KEY   = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const DB_ID = 'carpinteria-huayapam-erp';
const DRY   = process.argv.includes('--dry-run');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: DB_ID });

async function run() {
  let totalInventory = 0;
  let totalLists     = 0;

  // ── 1. Colección `inventory` (un doc por artículo) ──────────────────────
  const invSnap = await db.collection('inventory').get();
  const invBatch = db.batch();

  for (const doc of invSnap.docs) {
    const data = doc.data();
    const needs = !('materialImportante' in data) || !('basicoPresupuesto' in data);
    if (!needs) continue;

    const update = {};
    if (!('materialImportante' in data)) update.materialImportante = false;
    if (!('basicoPresupuesto'  in data)) update.basicoPresupuesto  = false;

    if (!DRY) invBatch.update(doc.ref, update);
    totalInventory++;
  }

  if (!DRY && totalInventory > 0) await invBatch.commit();
  console.log(`inventory: ${totalInventory} docs actualizados${DRY ? ' (dry-run)' : ''}`);

  // ── 2. Colección `inventory_lists` (un doc por categoría, con lista) ────
  const listSnap = await db.collection('inventory_lists').get();

  for (const listDoc of listSnap.docs) {
    const data = listDoc.data();
    const items = data.list || [];
    let changed = false;

    const updated = items.map(item => {
      const upd = { ...item };
      if (!('materialImportante' in upd)) { upd.materialImportante = false; changed = true; }
      if (!('basicoPresupuesto'  in upd)) { upd.basicoPresupuesto  = false; changed = true; }
      return upd;
    });

    if (changed) {
      if (!DRY) await listDoc.ref.update({ list: updated });
      totalLists++;
      console.log(`  inventory_lists/${listDoc.id}: ${items.length} ítems actualizados`);
    }
  }

  console.log(`inventory_lists: ${totalLists} categorías actualizadas${DRY ? ' (dry-run)' : ''}`);
  console.log('Listo.');
}

run().catch(err => { console.error(err); process.exit(1); });
