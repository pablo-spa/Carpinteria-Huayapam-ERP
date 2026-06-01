/**
 * Migración: renombrar campos de inglés a español en Firestore.
 *
 * Colecciones afectadas:
 *   projects  → codigo, nombre, estado, contactoId, fechaInicio, fechaFin,
 *               avance, valorTotal, pagos, piezas, hitos, horasEstimadas,
 *               horasPorCategoria, maderaPt, costoMateriales, enlaceDrive, archivado
 *   attendance → fecha (date), trabajadorId (workerId), estado (status), proyectos (projects)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

// ── projects ──────────────────────────────────────────────────
const PROJECT_MAP = {
  code:                     'codigo',
  name:                     'nombre',
  status:                   'estado',
  contactId:                'contactoId',
  startDate:                'fechaInicio',
  endDate:                  'fechaFin',
  progress:                 'avance',
  totalValue:               'valorTotal',
  payments:                 'pagos',
  pieces:                   'piezas',
  milestones:               'hitos',
  estimatedHours:           'horasEstimadas',
  estimatedHoursByCategory: 'horasPorCategoria',
  estimatedWoodPt:          'maderaPt',
  estimatedOtherMatCost:    'costoMateriales',
  driveLink:                'enlaceDrive',
  archived:                 'archivado',
  notes:                    'notas',
};

// ── attendance ────────────────────────────────────────────────
const ATTENDANCE_MAP = {
  date:     'fecha',
  workerId: 'trabajadorId',
  status:   'estado',
  projects: 'proyectos',
  notes:    'notas',
};

async function migrateCollection(colName, fieldMap) {
  const snap = await db.collection(colName).get();
  const docs = snap.docs.filter(d => !d.data()._init);
  console.log(`\n${colName}: ${docs.length} docs a revisar`);

  let updated = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of docs) {
    const data = doc.data();
    const updates = {};
    const deletes = {};

    for (const [oldKey, newKey] of Object.entries(fieldMap)) {
      if (oldKey in data && !(newKey in data)) {
        // old field exists and new field doesn't → rename
        updates[newKey] = data[oldKey];
        deletes[oldKey] = FieldValue.delete();
      } else if (oldKey in data && newKey in data) {
        // both exist → just delete the old one (new already has correct value)
        deletes[oldKey] = FieldValue.delete();
      }
      // if only newKey exists → already migrated, skip
    }

    if (Object.keys(updates).length > 0 || Object.keys(deletes).length > 0) {
      batch.update(doc.ref, { ...updates, ...deletes });
      updated++;
      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) await batch.commit();
  console.log(`  ✅ ${updated} docs actualizados`);
  return updated;
}

async function main() {
  console.log('=== Migración campos inglés → español ===\n');

  const p = await migrateCollection('projects',   PROJECT_MAP);
  const a = await migrateCollection('attendance', ATTENDANCE_MAP);

  console.log(`\n✅ Migración completa. projects: ${p}, attendance: ${a}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
