/**
 * clean-inventory.cjs
 * Deduplica el inventario: agrupa por nombre normalizado, conserva el ítem
 * con más datos y elimina los duplicados de Firestore.
 *
 * Uso: node clean-inventory.cjs [--dry-run]
 */
const admin = require('firebase-admin');

const KEY    = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const DB_ID  = 'carpinteria-huayapam-erp';
const DRY    = process.argv.includes('--dry-run');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: DB_ID });

// ── Utilidades ──────────────────────────────────────────────────────────────

function normalize(name) {
  return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Puntuación de un ítem: cuantos más datos tenga, mayor puntuación */
function score(item) {
  let s = 0;
  if (parseFloat(item.stock)  > 0) s += 10;
  if (parseFloat(item.cost)   > 0) s += 5;
  if (item.code && item.code.trim()) s += 3;
  if (item.brand && item.brand.trim()) s += 2;
  if (item.location && item.location.trim()) s += 1;
  // Preferir Title Case sobre MAYÚSCULAS como desempate
  if ((item.name || '') !== (item.name || '').toUpperCase()) s += 1;
  return s;
}

/** Fusiona los campos no vacíos de 'src' en 'dst' (sin sobreescribir datos existentes) */
function merge(dst, src) {
  const fields = ['code','category','brand','brandId','unit','cost','stock','min','location','details','lastPurchaseDate','priceHistory'];
  for (const f of fields) {
    if ((dst[f] === undefined || dst[f] === null || dst[f] === '' || dst[f] === 0) && src[f]) {
      dst[f] = src[f];
    }
  }
  return dst;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY ? '🔍 DRY RUN — no se hará ningún cambio en Firestore\n' : '🚀 Limpieza REAL — se eliminarán duplicados de Firestore\n');

  const snap  = await db.collection('inventory').get();
  const items = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  const real  = items.filter(i => !i._init && i.name);

  console.log(`Total documentos: ${items.length}`);
  console.log(`Documentos con nombre: ${real.length}`);

  // Agrupar por nombre normalizado
  const groups = {};
  real.forEach(i => {
    const k = normalize(i.name);
    if (!groups[k]) groups[k] = [];
    groups[k].push(i);
  });

  const dupGroups = Object.values(groups).filter(g => g.length > 1);
  console.log(`Grupos con duplicados: ${dupGroups.length}`);
  console.log(`Ítems duplicados a eliminar: ${dupGroups.reduce((s, g) => s + g.length - 1, 0)}\n`);

  let deleted = 0, updated = 0;

  // Procesar en lotes de 500 (límite de Firestore batch)
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  async function commitBatch() {
    if (batchCount > 0 && !DRY) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  for (const group of dupGroups) {
    // Ordenar: mayor puntuación primero
    group.sort((a, b) => score(b) - score(a));
    const keeper = group[0];
    const dupes  = group.slice(1);

    // Fusionar datos de los duplicados en el keeper
    let needsUpdate = false;
    for (const d of dupes) {
      const before = JSON.stringify(keeper);
      merge(keeper, d);
      if (JSON.stringify(keeper) !== before) needsUpdate = true;
    }

    if (needsUpdate) {
      const { _docId, ...data } = keeper;
      if (!DRY) {
        batch.update(db.collection('inventory').doc(_docId), data);
        batchCount++;
      }
      updated++;
    }

    // Eliminar duplicados
    for (const d of dupes) {
      console.log(`  DEL  [${(d.category||'').padEnd(20)}] ${d.name}`);
      if (!DRY) {
        batch.delete(db.collection('inventory').doc(d._docId));
        batchCount++;
      }
      deleted++;

      if (batchCount >= BATCH_SIZE) await commitBatch();
    }
  }

  await commitBatch();

  console.log(`\n=== RESULTADO ===`);
  console.log(`  Duplicados eliminados: ${deleted}`);
  console.log(`  Ítems actualizados (datos fusionados): ${updated}`);
  console.log(`  Ítems únicos que quedan: ${Object.keys(groups).length}`);
  if (DRY) console.log('\n  ⚠ Ejecuta sin --dry-run para aplicar los cambios.');
}

main().catch(e => { console.error(e); process.exit(1); });
