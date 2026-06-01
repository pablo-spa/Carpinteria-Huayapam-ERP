// Script de migración: copia todos los datos del DB de AI Studio al DB (default)
// Uso: node migrar_db.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const KEY_PATH = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';

const app = initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });

const db_viejo  = getFirestore(app, 'ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');
const db_nuevo  = getFirestore(app, 'carpinteria-huayapam-erp');

const colecciones = [
  'workers', 'contacts', 'inventory', 'projects', 'project_phases',
  'quotations', 'pieces', 'orders', 'production_logs', 'payroll_weeks',
  'payroll_lines', 'worker_loans', 'worker_loan_payments', 'attendance',
  'attendance_logs', 'piece_types', 'expense_categories', 'purchase_orders',
  'purchase_order_lines', 'lumber_batches', 'lumber_boards', 'material_requests',
  'suppliers', 'project_worker_hours', 'viajes', 'anticipos_viaticos',
  'gastos_viaticos', 'notifications', 'accounting_movements', 'settings',
  'systemEvents', 'wood', 'users', 'worker_roles', 'concept_categories',
  'concept_units', 'bank_accounts', 'payment_methods', 'viatico_categories',
  'actividades_trabajo', 'inventory_salidas', 'config_params'
];

const BATCH_SIZE = 400; // Firestore permite máx 500 ops por batch

async function migrar_coleccion(col) {
  const snap = await db_viejo.collection(col).get();
  if (snap.empty) { console.log(`  ${col}: vacía, omitida`); return 0; }

  let total = 0;
  let batch = db_nuevo.batch();
  let ops   = 0;

  for (const doc of snap.docs) {
    batch.set(db_nuevo.collection(col).doc(doc.id), doc.data());
    ops++;
    total++;
    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batch = db_nuevo.batch();
      ops   = 0;
    }
  }
  if (ops > 0) await batch.commit();

  console.log(`  ✓ ${col}: ${total} documentos copiados`);
  return total;
}

console.log('Iniciando migración...\n');
let total_docs = 0;
for (const col of colecciones) {
  try {
    total_docs += await migrar_coleccion(col);
  } catch (e) {
    console.error(`  ❌ ${col}: ${e.message}`);
  }
}
console.log(`\n✅ Migración completa — ${total_docs} documentos copiados.`);
console.log('Siguiente paso: cambia el DB en index.html y vuelve a probar.');
process.exit(0);
