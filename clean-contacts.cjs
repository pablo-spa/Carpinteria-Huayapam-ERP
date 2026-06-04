/**
 * Migración de contactos: normaliza campos de nombre y limpia documentos.
 *
 * Nuevo schema canónico:
 *   nombre          → primer nombre
 *   apellidoPaterno → apellido paterno
 *   apellidoMaterno → apellido materno
 *   empresa         → razón social (para clientes/proveedores empresa)
 *   name            → nombre completo para display (backward-compat)
 *
 * Elimina: givenName, paterno, materno, _id, name/phone/notes (alias legacy)
 */

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

// ── Parsear nombre en partes ──────────────────────────────────────────────────
function parseName(data) {
  // 1. Ya migrado
  if (data.nombre && data.apellidoPaterno) {
    return {
      nombre: data.nombre.trim(),
      apellidoPaterno: data.apellidoPaterno.trim(),
      apellidoMaterno: (data.apellidoMaterno || '').trim(),
    };
  }

  // 2. givenName + paterno explícitos
  if (data.givenName && data.paterno) {
    return {
      nombre: data.givenName.trim(),
      apellidoPaterno: data.paterno.trim(),
      apellidoMaterno: (data.materno || '').trim(),
    };
  }

  // 3. givenName = nombre de pila, name = nombre completo
  if (data.givenName && data.name && data.name !== data.givenName) {
    const fullParts = data.name.trim().split(/\s+/);
    const givenParts = data.givenName.trim().split(/\s+/);
    const apellidos = fullParts.slice(givenParts.length);
    return {
      nombre: data.givenName.trim(),
      apellidoPaterno: apellidos[0] || '',
      apellidoMaterno: apellidos.slice(1).join(' '),
    };
  }

  // 4. Parsear del nombre completo disponible
  const fullName = (data.name || data.givenName || data.nombre || '').trim();
  if (!fullName) return { nombre: '', apellidoPaterno: '', apellidoMaterno: '' };

  const parts = fullName.split(/\s+/);
  if (parts.length === 1) return { nombre: parts[0], apellidoPaterno: '', apellidoMaterno: '' };
  if (parts.length === 2) return { nombre: parts[0], apellidoPaterno: parts[1], apellidoMaterno: '' };
  return { nombre: parts[0], apellidoPaterno: parts[1], apellidoMaterno: parts.slice(2).join(' ') };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const snap = await db.collection('contacts').get();
  console.log(`\n📋 Contactos en Firestore: ${snap.size}\n`);

  let migrated = 0, skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = { ...doc.data() };

    if (data._init) {
      skipped++;
      continue;
    }

    const { nombre, apellidoPaterno, apellidoMaterno } = parseName(data);
    const empresa = (data.empresa || '').trim();
    const fullName = [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim();
    const displayName = empresa || fullName || '?';

    // Documento limpio con campos canónicos
    const clean = {
      id:             doc.id,
      tipo:           data.tipo || 'cliente',
      activo:         data.activo !== false,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      empresa,
      name:           displayName,        // backward-compat
      telefono:       data.telefono || data.phone || '',
      email:          data.email || '',
      address:        data.address || '',
      web:            data.web || '',
      person:         data.person || '',
      notas:          data.notas || data.notes || '',
      rfc:            data.rfc || '',
    };

    // Campos específicos de trabajadores
    if (data.tipo === 'trabajador') {
      clean.puesto       = data.puesto || data.role || '';
      clean.salarioBase  = parseFloat(data.salarioBase || data.baseSalary) || 0;
      clean.curp         = data.curp || '';
      clean.imss         = data.imss || '';
      clean.fechaIngreso = data.fechaIngreso || data.startDate || data.ingreso || '';
      clean.diasVacaciones = parseInt(data.diasVacaciones || data.vacationDays) || 0;
    }

    // Preservar campos extra no estructurados
    if (data.customFields?.length) clean.customFields = data.customFields;
    if (data.contactoId || data.contactId) clean.contactoId = data.contactoId || data.contactId;

    batch.set(doc.ref, clean);
    batchCount++;
    migrated++;

    const tipo = (data.tipo || '?').padEnd(11);
    console.log(`  ✓ ${doc.id.slice(0,8)}… | ${tipo} | "${displayName}"`);

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();
  console.log(`\n✅ Migración completa: ${migrated} contactos, ${skipped} docs de init omitidos.\n`);
}

main()
  .catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); })
  .finally(() => process.exit(0));
