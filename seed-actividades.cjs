const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

const ACTIVIDADES = [
  'Cepillado y Escuadrado',
  'Corte y Despiece',
  'Montaje en Seco',
  'Encolado',
  'Detallado',
  'Pulido',
  'Barniz',
  'Emplaye',
  'Instalación',
];

async function main() {
  await db.collection('actividades_trabajo').doc('main').set({ list: ACTIVIDADES });
  console.log('✅ actividades_trabajo seeded:', ACTIVIDADES);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
