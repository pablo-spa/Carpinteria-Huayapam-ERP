/**
 * seed-movimientos-preview.cjs
 *
 * Crea la colección `accounting_movements_preview` con los últimos 20
 * movimientos de cada cuenta. La app usa esta colección por default
 * para evitar cargar los 19k+ movimientos históricos.
 *
 * Uso:
 *   node seed-movimientos-preview.cjs
 *
 * Para regenerar el preview (ej. después de agregar movimientos nuevos):
 *   node seed-movimientos-preview.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

const POR_CUENTA = 20;

async function main() {
  console.log('Leyendo accounting_movements...');
  const snap = await db.collection('accounting_movements').get();
  const all  = snap.docs.map(d => ({ ...d.data() }));
  console.log(`  ${all.length} movimientos totales`);

  // Agrupar por cuenta y tomar los últimos N por fecha
  const porCuenta = {};
  for (const m of all) {
    const acc = m.account || 'SIN_CUENTA';
    if (!porCuenta[acc]) porCuenta[acc] = [];
    porCuenta[acc].push(m);
  }

  const preview = [];
  for (const [acc, movs] of Object.entries(porCuenta)) {
    movs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const ultimos = movs.slice(0, POR_CUENTA);
    preview.push(...ultimos);
    console.log(`  ${acc}: ${ultimos.length} movimientos`);
  }

  console.log(`\nSubiendo ${preview.length} movimientos a accounting_movements_preview...`);

  // Borrar colección preview anterior
  const prevSnap = await db.collection('accounting_movements_preview').get();
  if (prevSnap.size > 0) {
    let batch = db.batch();
    let count = 0;
    for (const d of prevSnap.docs) {
      batch.delete(d.ref);
      if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count > 0) await batch.commit();
    console.log(`  Borrados ${prevSnap.size} docs anteriores`);
  }

  // Escribir nuevos
  const col = db.collection('accounting_movements_preview');
  let batch = db.batch(); let count = 0;
  for (const m of preview) {
    batch.set(col.doc(m.id), m);
    if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();

  console.log(`\n✅ accounting_movements_preview listo con ${preview.length} docs`);
  console.log(`   (${POR_CUENTA} últimos movimientos × ${Object.keys(porCuenta).length} cuentas)`);
}

main().catch(e => { console.error(e); process.exit(1); });
