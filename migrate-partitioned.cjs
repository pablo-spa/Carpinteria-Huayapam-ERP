/**
 * migrate-partitioned.cjs
 *
 * Convierte contacts e inventory de colecciones de documentos individuales
 * a colecciones de listas particionadas:
 *
 *   contacts  (797 docs, 1 read cada una)
 *   → contacts_lists/clientes    (1 read, lista de clientes sin campos de trabajador)
 *   → contacts_lists/proveedores (1 read, lista de proveedores)
 *   → contacts_lists/trabajadores (1 read, lista de trabajadores sin campos de empresa)
 *
 *   inventory (1528 docs, 1 read cada uno)
 *   → inventory_lists/{Categoría} (1 read por categoría, ~20 categorías)
 *
 * Resultado: 797 + 1528 = 2325 reads → 3 + 20 = 23 reads por sesión.
 * Los docs originales NO se borran (quedan como backup).
 */

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

function byteSize(obj) { return Buffer.byteLength(JSON.stringify(obj), 'utf8'); }

// ── Campos permitidos por tipo de contacto ──────────────────────────────────
// Solo guardamos los campos que tienen sentido para cada tipo.
// Omitimos campos vacíos además.

const CAMPOS_BASE       = ['id', 'tipo', 'activo', 'name', 'telefono', 'email', 'address', 'rfc', 'notas', 'customFields'];
const CAMPOS_EMPRESA    = ['empresa', 'web', 'person'];
const CAMPOS_TRABAJADOR = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'puesto', 'salarioBase',
                           'curp', 'imss', 'fechaIngreso', 'diasVacaciones', 'personalId', 'birthDate',
                           'hoursWeek', 'vacAdded', 'endDate'];

const ALLOWED = {
  cliente:    new Set([...CAMPOS_BASE, ...CAMPOS_EMPRESA]),
  proveedor:  new Set([...CAMPOS_BASE, ...CAMPOS_EMPRESA]),
  trabajador: new Set([...CAMPOS_BASE, ...CAMPOS_TRABAJADOR]),
};

function blank(v) {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
}

function buildContact(raw) {
  const tipo   = raw.tipo || 'cliente';
  const allowed = ALLOWED[tipo] || ALLOWED.cliente;
  const out    = {};

  for (const k of allowed) {
    const v = raw[k];
    if (blank(v)) continue;
    out[k] = v;
  }

  // Garantizar campos mínimos
  out.id    = raw.id || raw._id;
  out.tipo  = tipo;
  out.activo = raw.activo !== false;
  out.name  = raw.name || '';

  // Para clientes/proveedores: empresa = name si está vacía
  if (tipo !== 'trabajador') {
    if (!out.empresa) out.empresa = raw.name || '';
  }

  return out;
}

function buildInventoryItem(raw) {
  // Quitar campos vacíos; guardar todo lo que tenga valor real
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (blank(v)) continue;
    out[k] = v;
  }
  // Garantizar id
  out.id = raw.id || raw._id;
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Migración a colecciones particionadas');
  console.log('══════════════════════════════════════════════\n');

  // ── 1. CONTACTS ──────────────────────────────────────────────────────────
  console.log('Leyendo contacts...');
  const contactSnap = await db.collection('contacts').get();
  const allContacts = contactSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  const clientes    = allContacts.filter(c => (c.tipo || 'cliente') === 'cliente').map(buildContact);
  const proveedores = allContacts.filter(c => c.tipo === 'proveedor').map(buildContact);
  const trabajadores= allContacts.filter(c => c.tipo === 'trabajador').map(buildContact);

  await db.collection('contacts_lists').doc('clientes').set({ list: clientes });
  await db.collection('contacts_lists').doc('proveedores').set({ list: proveedores });
  await db.collection('contacts_lists').doc('trabajadores').set({ list: trabajadores });

  const totalContactsBefore = allContacts.length;
  const totalContactsBytes  = byteSize(allContacts);
  const totalListBytes      = byteSize(clientes) + byteSize(proveedores) + byteSize(trabajadores);

  console.log(`\n✅ contacts_lists creado:`);
  console.log(`   clientes:     ${clientes.length.toString().padStart(4)} items | ${Math.round(byteSize(clientes)/1024)} KB`);
  console.log(`   proveedores:  ${proveedores.length.toString().padStart(4)} items | ${Math.round(byteSize(proveedores)/1024)} KB`);
  console.log(`   trabajadores: ${trabajadores.length.toString().padStart(4)} items | ${Math.round(byteSize(trabajadores)/1024)} KB`);
  console.log(`\n   Antes: ${totalContactsBefore} docs = ~${Math.round(totalContactsBytes/1024)} KB → ${totalContactsBefore} reads`);
  console.log(`   Ahora: 3 docs = ~${Math.round(totalListBytes/1024)} KB → 3 reads`);

  // ── 2. INVENTORY ─────────────────────────────────────────────────────────
  console.log('\nLeyendo inventory...');
  const invSnap = await db.collection('inventory').get();
  const allItems = invSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  // Agrupar por categoría
  const byCat = {};
  allItems.forEach(i => {
    const cat = i.category || 'General';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(buildInventoryItem(i));
  });

  // Escribir en batches (hasta 400 ops por batch)
  const categories = Object.entries(byCat);
  let batch = db.batch();
  let batchCount = 0;
  for (const [cat, list] of categories) {
    batch.set(db.collection('inventory_lists').doc(cat), { list });
    if (++batchCount >= 400) { await batch.commit(); batch = db.batch(); batchCount = 0; }
  }
  if (batchCount > 0) await batch.commit();

  const totalItemsBefore = allItems.length;
  const totalInvBytesBefore = byteSize(allItems);
  const totalInvBytesAfter  = byteSize(Object.values(byCat).flat());

  console.log(`\n✅ inventory_lists creado (${categories.length} categorías):`);
  categories.sort((a,b) => b[1].length - a[1].length).forEach(([cat, list]) => {
    const kb = Math.round(byteSize(list)/1024);
    console.log(`   ${cat.padEnd(35)} ${list.length.toString().padStart(4)} items | ${kb} KB`);
  });
  console.log(`\n   Antes: ${totalItemsBefore} docs = ~${Math.round(totalInvBytesBefore/1024)} KB → ${totalItemsBefore} reads`);
  console.log(`   Ahora: ${categories.length} docs = ~${Math.round(totalInvBytesAfter/1024)} KB → ${categories.length} reads`);

  // ── Resumen ───────────────────────────────────────────────────────────────
  const readsBefore = totalContactsBefore + totalItemsBefore;
  const readsAfter  = 3 + categories.length;
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  Reads por sesión: ${readsBefore} → ${readsAfter}  (reducción del ${Math.round((1 - readsAfter/readsBefore)*100)}%)`);
  console.log(`  Los documentos originales NO fueron borrados.`);
  console.log(`══════════════════════════════════════════════\n`);
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => process.exit(0));
