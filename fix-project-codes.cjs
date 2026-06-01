/**
 * Migración: normalizar códigos de proyecto a 4 dígitos con ceros.
 *
 * Extrae la parte numérica del código actual y lo reformatea a 4 dígitos.
 * Ejemplos:
 *   "PRY-42"  →  "0042"
 *   "001"     →  "0001"
 *   "7"       →  "0007"
 *   "1234"    →  "1234"  (sin cambio)
 *
 * También actualiza referencias en:
 *   - attendance (workers[].projects[].p)
 *   - inventory_salidas (proyecto)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

function toFourDigit(code) {
  if (!code) return null;
  const digits = code.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (isNaN(n)) return null;
  return String(n).padStart(4, '0');
}

async function commitBatch(batch) {
  await batch.commit();
}

async function main() {
  // ── 1. Leer todos los proyectos ──────────────────────────────
  const projSnap = await db.collection('projects').get();
  const real     = projSnap.docs.filter(d => !d.data()._init && d.data().name && d.data().code);

  // Construir mapa oldCode → newCode
  const codeMap = {};  // { oldCode: newCode }
  const toUpdate = [];

  for (const doc of real) {
    const oldCode = doc.data().code;
    const newCode = toFourDigit(oldCode);
    if (!newCode) { console.log(`  ⚠️  Saltando "${doc.id}" — código no tiene dígitos: "${oldCode}"`); continue; }
    if (newCode === oldCode) { console.log(`  ✓  "${oldCode}" ya tiene formato correcto.`); continue; }
    codeMap[oldCode] = newCode;
    toUpdate.push({ ref: doc.ref, oldCode, newCode });
  }

  if (toUpdate.length === 0) { console.log('✅ Todos los códigos ya están en formato 4 dígitos. Nada que hacer.'); return; }

  console.log(`\nCambios de código (${toUpdate.length} proyectos):`);
  toUpdate.forEach(p => console.log(`  "${p.oldCode}"  →  "${p.newCode}"`));
  console.log('');

  // ── 2. Actualizar proyectos ──────────────────────────────────
  console.log('Actualizando proyectos...');
  let batch = db.batch();
  let count = 0;
  for (const { ref, newCode } of toUpdate) {
    batch.update(ref, { code: newCode });
    if (++count >= 400) { await commitBatch(batch); batch = db.batch(); count = 0; }
  }
  if (count > 0) await commitBatch(batch);
  console.log(`  ✅ ${toUpdate.length} proyectos actualizados.`);

  // ── 3. Actualizar references en attendance ───────────────────
  console.log('Revisando attendance...');
  const attSnap  = await db.collection('attendance').get();
  const attDocs  = attSnap.docs.filter(d => !d.data()._init);
  let attUpdated = 0;

  batch = db.batch(); count = 0;
  for (const doc of attDocs) {
    const data = doc.data();
    let changed = false;

    // Format 1: top-level data.projects array
    if (Array.isArray(data.projects)) {
      data.projects.forEach(entry => {
        if (entry.p && codeMap[entry.p]) { entry.p = codeMap[entry.p]; changed = true; }
      });
    }

    // Format 2: data.workers[].projects
    if (Array.isArray(data.workers)) {
      data.workers.forEach(w => {
        if (Array.isArray(w.projects)) {
          w.projects.forEach(entry => {
            if (entry.p && codeMap[entry.p]) { entry.p = codeMap[entry.p]; changed = true; }
          });
        }
      });
    }

    if (changed) {
      batch.update(doc.ref, data);
      attUpdated++;
      if (++count >= 400) { await commitBatch(batch); batch = db.batch(); count = 0; }
    }
  }
  if (count > 0) await commitBatch(batch);
  console.log(`  ✅ ${attUpdated} registros de attendance actualizados.`);

  // ── 4. Actualizar references en inventory_salidas ────────────
  console.log('Revisando inventory_salidas...');
  const salSnap = await db.collection('inventory_salidas').get();
  const salDocs = salSnap.docs.filter(d => d.data().proyecto && codeMap[d.data().proyecto]);
  let salUpdated = 0;

  batch = db.batch(); count = 0;
  for (const doc of salDocs) {
    const oldProj = doc.data().proyecto;
    batch.update(doc.ref, { proyecto: codeMap[oldProj] });
    salUpdated++;
    if (++count >= 400) { await commitBatch(batch); batch = db.batch(); count = 0; }
  }
  if (count > 0) await commitBatch(batch);
  console.log(`  ✅ ${salUpdated} salidas de almacén actualizadas.`);

  console.log('\n✅ Migración completada exitosamente.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
