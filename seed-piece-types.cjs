/**
 * seed-piece-types.cjs — update piece_types collection with complete furniture list
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

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
  { id: 'pt-013', code: 'ESL', name: 'Escalera' },
  { id: 'pt-014', code: 'VIT', name: 'Vitrina / Aparador' },
  { id: 'pt-015', code: 'REC', name: 'Recibidor / Console' },
  { id: 'pt-016', code: 'TEV', name: 'Mueble de TV' },
  { id: 'pt-017', code: 'EST', name: 'Estante / Repisa' },
  { id: 'pt-018', code: 'BAC', name: 'Banca / Banco' },
  { id: 'pt-019', code: 'GAB', name: 'Gabinete / Alacena' },
  { id: 'pt-020', code: 'TOC', name: 'Tocador / Dresser' },
  { id: 'pt-021', code: 'PER', name: 'Pérgola / Deck' },
  { id: 'pt-022', code: 'CUB', name: 'Cubierta / Countertop' },
  { id: 'pt-023', code: 'OTR', name: 'Otro / Especial' },
];

async function main() {
  const col = db.collection('piece_types');
  const batch = db.batch();
  for (const pt of PIECE_TYPES) {
    batch.set(col.doc(pt.id), pt);
  }
  await batch.commit();
  console.log(`✅  ${PIECE_TYPES.length} tipos de pieza actualizados.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
