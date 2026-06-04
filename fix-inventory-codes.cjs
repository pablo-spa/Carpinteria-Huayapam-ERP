/**
 * fix-inventory-codes.cjs
 * Corrige los códigos CC-MMM-SS del inventario.
 *
 * Problema: los items tienen `brand: "Spax"` (texto) pero sin `brandId`,
 * por lo que el segmento MMM queda en "000" al re-codificar.
 *
 * Este script:
 *  1. Carga todas las marcas de inventory_brands
 *  2. Carga las categorías con sus códigos (concept_categories)
 *  3. Para cada item, busca la marca por nombre (case-insensitive)
 *  4. Regenera el código CC-MMM-SS correcto
 *  5. Actualiza brandId en el item para que el sistema lo use en adelante
 */

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

const BATCH_SIZE = 400;

function normalize(str) {
  return (str || '').trim().toLowerCase();
}

async function main() {
  // 1. Cargar marcas
  const brandsSnap = await db.collection('inventory_brands').get();
  const brands = brandsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Marcas cargadas: ${brands.length}`);

  // 2. Cargar categorías con catCode
  const catsDoc = await db.collection('concept_categories').doc('main').get();
  const catList = (catsDoc.data()?.list || []).map(c =>
    typeof c === 'string' ? { name: c, catCode: '' } : c
  );
  const catMap = {};
  catList.forEach(c => { catMap[normalize(c.name)] = c.catCode || '00'; });
  console.log(`Categorías con código: ${catList.filter(c => c.catCode).length}`);

  // 3. Cargar todos los items de inventario
  const invSnap = await db.collection('inventory').get();
  const items = invSnap.docs
    .map(d => ({ _docId: d.id, ...d.data() }))
    .filter(i => !i._init && i.name);
  console.log(`Items de inventario: ${items.length}`);

  // 4. Generar códigos
  const counters = {}; // { "CC-MMM": nextSeq }

  // Contadores: recorrer items en orden para asignar secuencial consistente
  const updated = [];
  let noChange = 0;

  for (const item of items) {
    // Buscar marca por brandId o por nombre (case-insensitive)
    let brand = brands.find(b => b.id === item.brandId);
    if (!brand && item.brand) {
      brand = brands.find(b => normalize(b.name) === normalize(item.brand));
    }

    const cc  = String(catMap[normalize(item.category)] || '00').padStart(2, '0').slice(0, 2);
    const mmm = brand?.brandCode ? String(brand.brandCode).padStart(3, '0').slice(0, 3) : '000';
    const pfx = cc + mmm;

    if (!(pfx in counters)) counters[pfx] = 0;
    const seq  = counters[pfx]++;
    const code = `${cc}-${mmm}-${String(seq).padStart(2, '0')}`;

    const brandId = brand?.id || item.brandId || '';
    const changed = item.code !== code || item.brandId !== brandId;

    if (changed) {
      updated.push({ _docId: item._docId, code, brandId, oldCode: item.code });
    } else {
      noChange++;
    }
  }

  console.log(`\nItems que cambian: ${updated.length} | Sin cambios: ${noChange}`);
  if (updated.length === 0) { console.log('Nada que actualizar.'); process.exit(0); }

  // Mostrar muestra
  console.log('\nMuestra de cambios:');
  updated.slice(0, 15).forEach(u => {
    console.log(`  ${(u.oldCode||'(sin código)').padEnd(12)} → ${u.code}`);
  });

  // 5. Escribir a Firestore en batches
  let batch = db.batch();
  let count = 0;

  for (const u of updated) {
    const ref = db.collection('inventory').doc(u._docId);
    batch.update(ref, { code: u.code, brandId: u.brandId });
    if (++count >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      count = 0;
      process.stdout.write('.');
    }
  }
  if (count > 0) await batch.commit();

  console.log(`\n\n✅ ${updated.length} items actualizados.\n`);
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => process.exit(0));
