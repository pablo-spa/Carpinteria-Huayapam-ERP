/**
 * migrate.cjs — Carpintería Huayapam ERP
 * 1. Copies workers → contacts (tipo: trabajador)
 * 2. Seeds: settings, expense_categories, piece_types,
 *           concept_categories, concept_units, suppliers
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";

initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SETTINGS = {
  id: 'main',
  empresa: 'Carpintería Huayapam',
  horaEntrada: '09:00',
  minutosRetardo: 15,
  minutosFalta: 60,
  moneda: 'MXN',
  iva: 16,
  overheadPorHora: 37.3,
  jornadaHoras: 9,
  semanaHoras: 45,
  tasaSatRate: 1.5,
  tasaSunRate: 2.0,
};

const EXPENSE_CATEGORIES = [
  { id: 'cat-001', name: 'Materiales y Materia Prima',      type: 'gasto' },
  { id: 'cat-002', name: 'Nómina y Mano de Obra',           type: 'gasto' },
  { id: 'cat-003', name: 'Servicios Públicos',               type: 'gasto' },
  { id: 'cat-004', name: 'Herramienta y Equipo',             type: 'gasto' },
  { id: 'cat-005', name: 'Transporte y Flete',               type: 'gasto' },
  { id: 'cat-006', name: 'Mantenimiento Taller',             type: 'gasto' },
  { id: 'cat-007', name: 'Gastos Operativos Generales',      type: 'gasto' },
  { id: 'cat-008', name: 'Financieros',                      type: 'gasto' },
  { id: 'cat-009', name: 'Honorarios / Pago Socia',          type: 'gasto' },
  { id: 'cat-010', name: 'Viáticos y Gastos de Viaje',       type: 'gasto' },
  { id: 'cat-011', name: 'Anticipo de Cliente',              type: 'ingreso' },
  { id: 'cat-012', name: 'Pago Final de Cliente',            type: 'ingreso' },
  { id: 'cat-013', name: 'Venta Directa / Stock',            type: 'ingreso' },
  { id: 'cat-014', name: 'Otros Ingresos',                   type: 'ingreso' },
  { id: 'cat-015', name: 'Transferencia entre cuentas propias', type: 'transferencia' },
];

const PIECE_TYPES = [
  { id: 'pt-001', code: 'PTA', name: 'Puerta' },
  { id: 'pt-002', code: 'VEN', name: 'Ventana' },
  { id: 'pt-003', code: 'CLO', name: 'Closet' },
  { id: 'pt-004', code: 'COC', name: 'Cocina Integral' },
  { id: 'pt-005', code: 'LIB', name: 'Librero' },
  { id: 'pt-006', code: 'MES', name: 'Mesa / Comedor' },
  { id: 'pt-007', code: 'CAM', name: 'Cama / Cabecera' },
  { id: 'pt-008', code: 'ESC', name: 'Escritorio' },
  { id: 'pt-009', code: 'SAL', name: 'Sala / Sillón' },
  { id: 'pt-010', code: 'BAÑ', name: 'Mueble de Baño' },
  { id: 'pt-011', code: 'BAR', name: 'Barra / Bar' },
  { id: 'pt-012', code: 'ARR', name: 'Arrimadero / Panel' },
  { id: 'pt-013', code: 'ESC', name: 'Escalera' },
  { id: 'pt-014', code: 'OTR', name: 'Otro / Especial' },
];

const CONCEPT_CATEGORIES = [
  'Madera Maciza',
  'Tableros y Chapas',
  'Herrajes',
  'Químicos y Barnices',
  'Herramienta',
  'Consumibles',
  'Tornillería y Fijaciones',
  'Vidrio y Espejo',
  'Tapicería',
  'Electricidad',
  'Otros',
];

const CONCEPT_UNITS = [
  'pza',
  'pt',
  'lámina',
  'kg',
  'lt',
  'ml',
  'mt',
  'mt2',
  'gln',
  'rollo',
  'caja',
  'par',
  'juego',
  'bolsa',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function batchWrite(colName, docs, keyField = 'id') {
  const col = db.collection(colName);
  let batch = db.batch();
  let count = 0;
  let total = 0;
  for (const doc of docs) {
    batch.set(col.doc(String(doc[keyField])), doc);
    count++;
    total++;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  return total;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Carpintería Huayapam — Migration & Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Read existing workers
  console.log('📖  Reading workers collection...');
  const workersSnap = await db.collection('workers').get();
  const workers = workersSnap.docs.map(d => d.data());
  console.log(`    Found ${workers.length} workers.\n`);

  // 2. Migrate workers → contacts
  console.log('👷  Migrating workers → contacts (tipo: trabajador)...');
  const contactDocs = workers.map(w => ({
    ...w,
    tipo:   'trabajador',
    type:   'Trabajador',
    activo: true,
    // normalise name fields so all modules can find them
    name:      w.name      || `${w.givenName || ''} ${w.paterno || ''}`.trim(),
    givenName: w.givenName || (w.name ? w.name.split(' ')[0] : ''),
    paterno:   w.paterno   || (w.name ? w.name.split(' ').slice(1).join(' ') : ''),
  }));
  const nContacts = await batchWrite('contacts', contactDocs);
  console.log(`    ✅  ${nContacts} contacts written.\n`);

  // 3. Seed settings
  console.log('⚙️   Seeding settings...');
  await db.collection('settings').doc('main').set(SETTINGS);
  console.log('    ✅  settings/main written.\n');

  // 4. Seed expense_categories
  console.log('📂  Seeding expense_categories...');
  const nCats = await batchWrite('expense_categories', EXPENSE_CATEGORIES);
  console.log(`    ✅  ${nCats} expense categories written.\n`);

  // 5. Seed piece_types
  console.log('🪑  Seeding piece_types...');
  const nPieces = await batchWrite('piece_types', PIECE_TYPES);
  console.log(`    ✅  ${nPieces} piece types written.\n`);

  // 6. Seed concept_categories (stored as a single settings doc)
  console.log('🏷️   Seeding concept_categories...');
  await db.collection('concept_categories').doc('main').set({ list: CONCEPT_CATEGORIES });
  console.log('    ✅  concept_categories/main written.\n');

  // 7. Seed concept_units (stored as a single settings doc)
  console.log('📏  Seeding concept_units...');
  await db.collection('concept_units').doc('main').set({ list: CONCEPT_UNITS });
  console.log('    ✅  concept_units/main written.\n');

  // 8. Create empty placeholder docs for collections the app expects
  //    (so Firestore shows them and index.html loads them as [])
  const EMPTY_COLLECTIONS = [
    'projects', 'quotations', 'inventory', 'orders', 'purchase_orders',
    'attendance', 'attendance_logs', 'production_logs',
    'payroll_weeks', 'payroll_lines', 'worker_loans', 'worker_loan_payments',
    'accounting_movements', 'notifications', 'wood',
    'viajes', 'anticipos_viaticos', 'gastos_viaticos',
    'suppliers', 'material_requests', 'project_worker_hours',
    'lumber_batches', 'lumber_boards', 'pieces', 'project_phases',
    'purchase_order_lines', 'systemEvents', 'users',
  ];

  console.log('📦  Initialising empty collections...');
  for (const col of EMPTY_COLLECTIONS) {
    // Write a _init sentinel doc so the collection exists; app code ignores it
    await db.collection(col).doc('_init').set({ _init: true, _note: 'placeholder — safe to delete' });
    process.stdout.write(`    ✅  ${col}\n`);
  }

  // 9. Final count
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allCols = await db.listCollections();
  console.log(`  Done. Firestore now has ${allCols.length} collections.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
