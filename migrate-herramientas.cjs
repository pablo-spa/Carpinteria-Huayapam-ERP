/**
 * Migra ítems de categoría "Herramienta" del inventario
 * a la colección herramientas, y los elimina de inventory.
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

function categorizar(nombre) {
  const n = (nombre || '').toLowerCase();
  if (/rotomartillo|taladro|atornillador|broca|berbiq/.test(n))           return 'perforacion';
  if (/router|ruteadora|fresadora|ingletadora|tupi/.test(n))              return 'router';
  if (/lijadora|lija|abrasiv|orbital|banda/.test(n))                      return 'lijado';
  if (/cepillo|garlopa|rabot/.test(n))                                    return 'cepillado';
  if (/escuadra|nivel|metro|cinta|calibrador|vernier|regla/.test(n))      return 'medicion';
  if (/sierra|serrucho|cutter|form[oó]n|escofina|machete|navaja/.test(n)) return 'corte';
  if (/lima|archivo/.test(n))                                             return 'corte';
  if (/pistola.*grav|pistola.*pintura|aerogr|soplete/.test(n))            return 'acabado';
  if (/pistola.*calaf|pistola.*clav|engrapadora|prensa|grampa/.test(n))   return 'sujecion';
  if (/martillo|mazo|desarmador|destornillador|llave|allen|pinza|alicate/.test(n)) return 'ensamble';
  return 'otro';
}

// Nombres más limpios: quitar números de serie largos al final
function limpiarNombre(raw) {
  // Quitar tokens que parecen números de serie: ej. "Zm35-521250179", "429001395", "Z0f9bro"
  return raw
    .replace(/\b[A-Z]{1,3}\d{5,}\b/gi, '')  // Zm35-521250179 style
    .replace(/\b[A-Z0-9]{7,}\b(?=\s*$)/g, '') // trailing alphanumeric serial
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function main() {
  const snap = await db.collection('inventory')
    .where('category', '==', 'Herramienta').get();

  console.log(`Encontradas ${snap.size} herramientas en inventario.\n`);

  const batch     = db.batch();
  const herCol    = db.collection('herramientas');
  const invCol    = db.collection('inventory');
  let migradas = 0;

  for (const doc of snap.docs) {
    const inv = doc.data();
    const nombre = limpiarNombre(inv.name || '');
    const cat    = categorizar(nombre);

    const herData = {
      id:           doc.id,
      codigo:       inv.code || '',
      nombre,
      marca:        inv.brand || '',
      categoria:    cat,
      tipo:         'compartida',
      estado:       'buena',
      assignedTo:   null,
      costo:        inv.cost || 0,
      fecha_compra: inv.lastPurchaseDate || null,
      notas:        inv.details || '',
    };

    console.log(`  [${cat.padEnd(12)}] ${herData.codigo}  ${nombre}${inv.brand ? '  ('+inv.brand+')' : ''}`);

    batch.set(herCol.doc(doc.id), herData);
    batch.delete(invCol.doc(doc.id));
    migradas++;
  }

  await batch.commit();
  console.log(`\n✓ ${migradas} herramientas migradas a colección 'herramientas' y eliminadas de inventory.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
