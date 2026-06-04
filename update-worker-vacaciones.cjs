/**
 * update-worker-vacaciones.cjs
 * Agrega birthDate y vacacionesReset (snapshot al 01/06/2026) a todos los trabajadores.
 * Cálculo de días LFT coincide con rh_trabajadores.html.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=".../key.json" node update-worker-vacaciones.cjs
 */

const admin = require('firebase-admin');

const KEY_PATH = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const serviceAccount = require(KEY_PATH);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

// Fecha de referencia: 01/06/2026
const REF_DATE = new Date('2026-06-01');

// Tabla LFT (idéntica a rh_trabajadores.html)
function lft(years) {
  if (years < 1) return 0;
  if (years === 1) return 12;
  if (years === 2) return 14;
  if (years === 3) return 16;
  if (years === 4) return 18;
  if (years === 5) return 20;
  if (years <= 10) return 22;
  if (years <= 15) return 24;
  if (years <= 20) return 26;
  if (years <= 25) return 28;
  return 30;
}

function yearsWorked(fechaIngreso) {
  if (!fechaIngreso) return 0;
  const ms = REF_DATE - new Date(fechaIngreso);
  return Math.max(0, Math.floor(ms / (1000 * 3600 * 24 * 365.25)));
}

// Datos de trabajadores: { id, birthDate, diasPendientes }
// birthDate: año del ID (día/mes = 01/01 como placeholder — verificar con nómina)
// diasPendientes: calculado con LFT según fechaIngreso existente en Firebase
// Nota: GUI90 y ALF80 no tienen fechaIngreso → diasPendientes = null (sin vacacionesReset)
const WORKER_DATA = [
  // id        birthDate       fechaIngreso (referencia)           diasPendientes
  { id: 'GLA77', birthYear: 1977, fechaIngreso: '2004-07-01' },  // 21 años → 28 días ✓
  { id: 'ANG70', birthYear: 1970, fechaIngreso: '2022-04-04' },  // 4 años → 18 días
  { id: 'GRE75', birthYear: 1975, fechaIngreso: '2005-01-24' },  // 21 años → 28 días
  { id: 'VIC75', birthYear: 1975, fechaIngreso: '2024-03-11' },  // 2 años → 14 días
  { id: 'GUI90', birthYear: 1990, fechaIngreso: null            },  // sin ingreso → pendiente
  { id: 'ALF80', birthYear: 1980, fechaIngreso: null            },  // sin ingreso → pendiente
  { id: 'SAN04', birthYear: 2004, fechaIngreso: '2022-08-17' },  // 3 años → 16 días
  { id: 'NEP80', birthYear: 1980, fechaIngreso: '2021-05-26' },  // 5 años → 20 días
  { id: 'NAP81', birthYear: 1981, fechaIngreso: '2019-02-18' },  // 7 años → 22 días
  { id: 'CHR91', birthYear: 1991, fechaIngreso: '2022-03-28' },  // 4 años → 18 días
  { id: 'DIE04', birthYear: 2004, fechaIngreso: '2022-02-23' },  // 4 años → 18 días
  { id: 'ELO03', birthYear: 2003, fechaIngreso: '2024-01-08' },  // 2 años → 14 días
  { id: 'LEX01', birthYear: 2001, fechaIngreso: '2025-03-11' },  // 1 año → 12 días
  { id: 'NAR69', birthYear: 1969, fechaIngreso: '2004-06-07' },  // 21 años → 28 días
  { id: 'MIG81', birthYear: 1981, fechaIngreso: '2006-02-21' },  // 20 años → 26 días
  { id: 'MAR73', birthYear: 1973, fechaIngreso: '2021-07-05' },  // 4 años → 18 días
  { id: 'HER71', birthYear: 1971, fechaIngreso: '2005-04-25' },  // 21 años → 28 días
  { id: 'PAO95', birthYear: 1995, fechaIngreso: '2025-04-14' },  // 1 año → 12 días
  { id: 'CAR74', birthYear: 1974, fechaIngreso: '2003-05-01' },  // 23 años → 28 días
  { id: 'COS70', birthYear: 1970, fechaIngreso: '2005-05-09' },  // 21 años → 28 días
  { id: 'ANG65', birthYear: 1965, fechaIngreso: '2012-01-06' },  // 14 años → 24 días
  { id: 'DIE85', birthYear: 1985, fechaIngreso: '2022-10-16' },  // 3 años → 16 días
  { id: 'CAR02', birthYear: 2002, fechaIngreso: '2025-04-07' },  // 1 año → 12 días
  { id: 'EDD92', birthYear: 1992, fechaIngreso: '2011-06-14' },  // 14 años → 24 días
  { id: 'GAB82', birthYear: 1982, fechaIngreso: '2006-05-17' },  // 20 años → 26 días
  { id: 'MIL97', birthYear: 1997, fechaIngreso: '2022-10-16' },  // 3 años → 16 días
  { id: 'GAB72', birthYear: 1972, fechaIngreso: '2021-08-02' },  // 4 años → 18 días
  { id: 'JEN79', birthYear: 1979, fechaIngreso: '2022-03-14' },  // 4 años → 18 días
  { id: 'YES80', birthYear: 1980, fechaIngreso: '2025-04-14' },  // 1 año → 12 días
];

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Actualizar birthDate + vacacionesReset (01/06/2026)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const snap = await db.collection('contacts').where('tipo', '==', 'trabajador').get();
  const contactsById = {};
  snap.docs.forEach(d => { contactsById[d.data().id] = { ref: d.ref, data: d.data() }; });

  let updated = 0;
  let sinIngreso = [];

  for (const w of WORKER_DATA) {
    const contact = contactsById[w.id];
    if (!contact) {
      console.warn(`  ⚠️  No encontrado: ${w.id}`);
      continue;
    }

    const birthDate = `${w.birthYear}-01-01`; // día/mes placeholder — verificar en pantalla
    const dias = w.fechaIngreso ? lft(yearsWorked(w.fechaIngreso)) : null;

    const update = {
      birthDate,
    };

    if (dias !== null) {
      update.vacacionesReset = {
        diasRestantes: dias,
        fecha: '2026-06-01',
      };
    } else {
      sinIngreso.push(w.id);
    }

    await contact.ref.update(update);

    const nombre = contact.data.name || w.id;
    const diasStr = dias !== null ? `${dias} días` : '⚠️  sin fechaIngreso';
    console.log(`  ✅  ${nombre.padEnd(35)} birthDate: ${birthDate}   vacaciones: ${diasStr}`);
    updated++;
  }

  console.log(`\n✅  ${updated} trabajadores actualizados`);

  if (sinIngreso.length) {
    console.log(`\n⚠️  Sin fechaIngreso (agregar manualmente en RH → Trabajadores):`);
    sinIngreso.forEach(id => console.log(`   - ${id}`));
  }

  console.log('\n⚠️  NOTA: birthDate usa año del ID con 01/01 como placeholder.');
  console.log('   Actualiza día/mes exacto de nacimiento en RH → Trabajadores → Editar.\n');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
