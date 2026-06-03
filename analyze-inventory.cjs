/**
 * analyze-inventory.cjs
 * Lee el inventario desde Firestore y muestra un análisis de limpieza.
 */
const admin = require('firebase-admin');
const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const DB_ID = 'carpinteria-huayapam-erp';

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: DB_ID });

async function main() {
  const snap = await db.collection('inventory').get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\nTotal de conceptos: ${items.length}\n`);

  // Imprimir todos con nombre, categoría, stock, costo
  items
    .filter(i => !i._init && i.name)
    .sort((a, b) => (a.category||'').localeCompare(b.category||'') || (a.name||'').localeCompare(b.name||''))
    .forEach(i => {
      console.log(`[${(i.category||'SIN_CAT').padEnd(20)}] ${(i.name||'').padEnd(50)} stock:${String(i.stock??'?').padStart(6)} costo:$${(i.cost||0).toFixed(2)}`);
    });
}

main().catch(e => { console.error(e); process.exit(1); });
