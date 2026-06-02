/**
 * seed-vacaciones.cjs
 *
 * Lee vacaciones_grupo1.csv y actualiza cada trabajador en Firestore con:
 *   - fechaIngreso
 *   - fechaNacimiento
 *   - vacacionesReset: { fecha: hoy, diasRestantes: dias_pendientes_totales }
 *
 * Uso: node seed-vacaciones.cjs
 */

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

const HOY = new Date().toISOString().slice(0, 10);

// ── Normalización para matching ───────────────────────────────────────────────

function norm(str) {
  return (str || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ── Leer CSV ──────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const header = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h.trim(), (cols[i] || '').trim()]));
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = path.join(__dirname, 'vacaciones_grupo1.csv');
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  console.log(`CSV: ${rows.length} trabajadores`);

  // Traer todos los contactos tipo trabajador de Firestore
  const snap = await db.collection('contacts').where('tipo', '==', 'trabajador').get();
  const trabajadores = snap.docs.map(d => ({ ...d.data(), _ref: d.ref }));
  console.log(`Firestore: ${trabajadores.length} trabajadores`);

  let actualizados = 0;
  let noEncontrados = [];

  for (const row of rows) {
    const paterno  = norm(row.apellido_paterno);
    const materno  = norm(row.apellido_materno);
    const nombre   = norm(row.nombre).split(' ')[0]; // primer nombre

    // Buscar por paterno + primer nombre
    let match = trabajadores.find(w => {
      const wPaterno = norm(w.paterno || w.name?.split(' ')[0] || '');
      const wNombre  = norm(w.givenName || w.name?.split(' ').slice(-1)[0] || '');
      return wPaterno === paterno && wNombre.startsWith(nombre);
    });

    // Fallback: solo paterno
    if (!match) {
      match = trabajadores.find(w => {
        const wPaterno = norm(w.paterno || w.name?.split(' ')[0] || '');
        return wPaterno === paterno;
      });
    }

    // Fallback: por nombre completo en el campo name
    if (!match) {
      match = trabajadores.find(w => {
        const wName = norm(w.name || '');
        return wName.includes(paterno) && wName.includes(nombre);
      });
    }

    if (!match) {
      noEncontrados.push(`${row.apellido_paterno} ${row.nombre}`);
      continue;
    }

    const diasPendientes = parseFloat(row.dias_pendientes_totales) || 0;

    const update = {
      fechaIngreso:    row.fecha_ingreso,
      startDate:       row.fecha_ingreso,
      fechaNacimiento: row.fecha_nacimiento,
      vacacionesReset: {
        fecha:         HOY,
        diasRestantes: diasPendientes,
        notas:         `Importado de vacaciones_grupo1.csv — ${row.notas || ''}`.trim(),
      },
    };

    await match._ref.update(update);
    console.log(`  ✅ ${match.name || match.nombre} ← ingreso: ${row.fecha_ingreso}, pendientes: ${diasPendientes}d`);
    actualizados++;
  }

  console.log(`\nActualizados: ${actualizados}/${rows.length}`);

  if (noEncontrados.length) {
    console.log('\n⚠️  No encontrados en Firestore:');
    noEncontrados.forEach(n => console.log('  -', n));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
