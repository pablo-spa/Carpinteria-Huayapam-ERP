/**
 * accounting-to-monthly-lists.cjs
 *
 * Dos operaciones en una:
 *  1. LIMPIEZA — Quita campos vacíos de los 19k docs individuales en accounting_movements
 *  2. LISTAS MENSUALES — Agrupa todos los movimientos por mes y los escribe como
 *     accounting_by_month/{YYYY-MM}  →  { list: [...] }  (1 lectura por mes)
 *
 * Resultado:
 *   Antes:  19,241 reads para cargar historial completo
 *   Ahora:  1 read por mes — cargar 3 meses = 3 reads (vs 114 del preview anterior)
 *
 * Los docs individuales NO se borran (siguen siendo el backup/fuente de verdad).
 */

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

const BATCH_SIZE = 400;

function blank(v) {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
}

function strip(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!blank(v)) out[k] = v;
  }
  // Garantizar campo id
  if (raw.id || raw._id) out.id = raw.id || raw._id;
  return out;
}

function byteSize(obj) { return Buffer.byteLength(JSON.stringify(obj), 'utf8'); }

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  accounting_movements → limpieza + listas mensuales');
  console.log('══════════════════════════════════════════════════════════\n');

  // 1. Leer todos los movimientos
  console.log('Leyendo accounting_movements (puede tardar ~30s para 19k docs)...');
  const snap = await db.collection('accounting_movements').get();
  const raw  = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  console.log(`  → ${raw.length} documentos leídos`);

  // 2. Limpiar campos vacíos
  const cleaned = raw.map(strip);
  const bytesBefore = raw.reduce((s, d) => s + byteSize(d), 0);
  const bytesAfter  = cleaned.reduce((s, d) => s + byteSize(d), 0);
  console.log(`\nCampos vacíos eliminados:`);
  console.log(`  Antes:  ~${Math.round(bytesBefore / 1024)} KB total`);
  console.log(`  Después:~${Math.round(bytesAfter  / 1024)} KB total  (${Math.round((1 - bytesAfter/bytesBefore)*100)}% menos)`);

  // 3. Agrupar por mes (YYYY-MM)
  const byMonth = {};
  let sinFecha = 0;
  cleaned.forEach(m => {
    const ym = (m.date || '').slice(0, 7);
    if (!ym || ym.length < 7) { sinFecha++; return; }
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(m);
  });

  const months = Object.keys(byMonth).sort();
  console.log(`\nMeses con movimientos: ${months.length}  (${months[0]} → ${months[months.length-1]})`);
  if (sinFecha > 0) console.log(`  ⚠  ${sinFecha} movimientos sin fecha — omitidos de las listas`);

  // Verificar tamaño máximo por mes
  let maxKb = 0;
  months.forEach(ym => {
    const kb = Math.round(byteSize(byMonth[ym]) / 1024);
    if (kb > maxKb) maxKb = kb;
    if (kb > 900) console.warn(`  ⚠  ${ym}: ${kb} KB — acercándose al límite 1MB`);
  });
  console.log(`  Mes más grande: ~${maxKb} KB`);

  // 4. Escribir listas mensuales (accounting_by_month/{YYYY-MM})
  console.log('\nEscribiendo accounting_by_month...');
  let batch = db.batch();
  let count = 0;
  for (const ym of months) {
    const ref = db.collection('accounting_by_month').doc(ym);
    batch.set(ref, { list: byMonth[ym], month: ym, count: byMonth[ym].length });
    if (++count >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      count = 0;
      process.stdout.write('.');
    }
  }
  if (count > 0) await batch.commit();
  console.log(`\n  ✅ ${months.length} documentos escritos en accounting_by_month`);

  // Mostrar resumen por año
  console.log('\nResumen por año:');
  const byYear = {};
  months.forEach(ym => {
    const y = ym.slice(0, 4);
    if (!byYear[y]) byYear[y] = { months: 0, docs: 0 };
    byYear[y].months++;
    byYear[y].docs += byMonth[ym].length;
  });
  Object.entries(byYear).sort().forEach(([y, s]) => {
    console.log(`  ${y}: ${s.months} meses, ${s.docs.toString().padStart(5)} movimientos`);
  });

  // 5. Limpiar docs individuales en Firestore (quitar campos vacíos)
  console.log('\nActualizando docs individuales (limpieza de campos vacíos)...');
  const toUpdate = [];
  raw.forEach((original, i) => {
    const orig = JSON.stringify(original);
    const clean = JSON.stringify(cleaned[i]);
    if (orig !== clean) toUpdate.push({ id: original.id, data: cleaned[i] });
  });
  console.log(`  ${toUpdate.length} de ${raw.length} docs tienen campos que limpiar`);

  if (toUpdate.length > 0) {
    let batch2 = db.batch();
    let cnt2 = 0;
    for (const { id, data } of toUpdate) {
      const { id: _id, ...fields } = data;
      batch2.set(db.collection('accounting_movements').doc(id), fields);
      if (++cnt2 >= BATCH_SIZE) {
        await batch2.commit();
        batch2 = db.batch();
        cnt2 = 0;
        process.stdout.write('.');
      }
    }
    if (cnt2 > 0) await batch2.commit();
    console.log(`\n  ✅ ${toUpdate.length} docs actualizados`);
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  Lecturas por sesión:`);
  console.log(`    Antes (preview):  114 reads (solo últimos 20 por cuenta)`);
  console.log(`    Ahora (3 meses):  3 reads   (todos los movimientos del trimestre)`);
  console.log(`    Historial anual:  12 reads  (todos los meses de un año)`);
  console.log(`    Historial total:  ${months.length} reads   (todo el historial, 1 read por mes)`);
  console.log('══════════════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => process.exit(0));
