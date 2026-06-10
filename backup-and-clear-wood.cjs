/**
 * backup-and-clear-wood.cjs
 *
 * Busca todo el inventario de madera en Firebase (de las colecciones 'wood', 'inventory' y
 * de la partición 'inventory_lists/madera'), lo consolida y lo guarda en un archivo CSV.
 * Opcionalmente borra dichos registros de Firebase si se ejecuta con el argumento --delete.
 *
 * Uso:
 *   Solo backup (Dry run):
 *     node backup-and-clear-wood.cjs
 *
 *   Backup + Borrar de Firebase:
 *     node backup-and-clear-wood.cjs --delete
 */

const fs = require('fs');
const path = require('path');

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const admin = require('firebase-admin');

// Inicializar Firebase Admin SDK
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

function escapeCSV(val) {
  if (val === undefined || val === null) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const isDelete = process.argv.includes('--delete');

  console.log('\n══════════════════════════════════════════════');
  console.log('  Copia de Seguridad y Limpieza de Madera');
  console.log(`  Modo: ${isDelete ? '⚠️ ELIMINACIÓN ACTIVA ⚠️' : '🔍 SOLO RESPALDO (DRY RUN)'}`);
  console.log('══════════════════════════════════════════════\n');

  // 1. Obtener datos de la partición inventory_lists/madera
  console.log('1. Leyendo partición de inventario [inventory_lists/madera]...');
  const listDocRef = db.collection('inventory_lists').doc('madera');
  const listDoc = await listDocRef.get();
  const listItems = listDoc.exists ? (listDoc.data().list || []) : [];
  console.log(`   -> Encontrados ${listItems.length} artículos en la lista particionada.`);

  // 2. Obtener datos de la colección de documentos individuales 'wood'
  console.log('2. Leyendo colección de documentos individuales [wood]...');
  const woodSnap = await db.collection('wood').get();
  const woodDocs = woodSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  console.log(`   -> Encontrados ${woodDocs.length} documentos en la colección 'wood'.`);

  // 3. Obtener datos de la colección de documentos individuales 'inventory' que pertenezcan a madera
  console.log('3. Leyendo colección de documentos individuales [inventory] con categoría "madera"...');
  const invSnap = await db.collection('inventory').get();
  const invDocs = invSnap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .filter(item => (item.category || '').toLowerCase() === 'madera');
  console.log(`   -> Encontrados ${invDocs.length} documentos individuales en 'inventory'.`);

  // 4. Consolidar todos los ítems únicos por ID
  console.log('\n4. Consolidando registros únicos...');
  const consolidated = new Map();

  // Función para agregar o enriquecer un ítem en el mapa consolidado
  const mergeItem = (item) => {
    const id = item.id || item._id;
    if (!id) return;
    const existing = consolidated.get(id) || {};
    consolidated.set(id, { ...existing, ...item, id });
  };

  listItems.forEach(mergeItem);
  woodDocs.forEach(mergeItem);
  invDocs.forEach(mergeItem);

  const finalItems = Array.from(consolidated.values());
  console.log(`   -> Total de artículos únicos consolidados: ${finalItems.length}`);

  if (finalItems.length === 0) {
    console.log('\nℹ️ No hay registros de madera en el sistema. Saliendo.');
    process.exit(0);
  }

  // 5. Generar archivo CSV
  console.log('\n5. Generando archivo CSV de respaldo...');
  const headers = [
    'id', 'code', 'name', 'category', 'stock', 'min', 'unit', 'cost', 
    'location', 'details', 'entryDate', 'species', 'lote', 'format', 
    't', 'w', 'l', 'pt', 'quality'
  ];

  let csvContent = headers.join(',') + '\n';
  finalItems.forEach(item => {
    const row = headers.map(h => escapeCSV(item[h]));
    csvContent += row.join(',') + '\n';
  });

  const backupPath = path.join(__dirname, 'wood_inventory_backup.csv');
  fs.writeFileSync(backupPath, csvContent, 'utf8');
  console.log(`   -> CSV escrito con éxito en: ${backupPath}`);

  // 6. Si se solicitó la eliminación, proceder
  if (isDelete) {
    console.log('\n6. Iniciando eliminación de registros en Firebase...');

    // A. Eliminar el documento de la lista particionada
    console.log('   -> Eliminando documento [inventory_lists/madera]...');
    await listDocRef.delete();

    // B. Eliminar documentos individuales de 'wood' en batches
    console.log(`   -> Eliminando ${woodDocs.length} documentos de la colección 'wood'...`);
    let batch = db.batch();
    let batchCount = 0;
    for (const d of woodDocs) {
      batch.delete(db.collection('wood').doc(d.id));
      if (++batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    // C. Eliminar documentos individuales de 'inventory' en batches
    console.log(`   -> Eliminando ${invDocs.length} documentos de la colección 'inventory' con categoría "madera"...`);
    batch = db.batch();
    batchCount = 0;
    for (const d of invDocs) {
      batch.delete(db.collection('inventory').doc(d.id));
      if (++batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    console.log('\n✅ ELIMINACIÓN COMPLETADA SATISFACTORIAMENTE.');
  } else {
    console.log('\nℹ️ DRY RUN completado. Los registros no han sido eliminados de Firebase.');
    console.log('   Para proceder con la eliminación, ejecuta:');
    console.log('   node backup-and-clear-wood.cjs --delete');
  }

  console.log('\n══════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); })
  .finally(() => process.exit(0));
