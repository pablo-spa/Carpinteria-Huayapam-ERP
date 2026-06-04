/**
 * fix-proyectos-estado.cjs
 * Marca todos los proyectos existentes en Firestore como estado: 'Terminado'.
 * Uso: node fix-proyectos-estado.cjs
 */
const admin = require('firebase-admin');

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const DB_ID = 'carpinteria-huayapam-erp';

admin.initializeApp({
  credential: admin.credential.cert(require(KEY)),
  databaseURL: `https://${require(KEY).project_id}.firebaseio.com`,
});

const db = admin.firestore();
db.settings({ databaseId: DB_ID });

async function main() {
  const snap = await db.collection('projects').get();
  if (snap.empty) { console.log('No hay proyectos en la colección.'); return; }

  const batch = db.batch();
  let count = 0;

  snap.forEach(doc => {
    const data = doc.data();
    const estadoActual = data.estado || data.status || '';
    const nombre = data.nombre || data.name || doc.id;
    console.log(`  [${doc.id}] "${nombre}" — estado actual: "${estadoActual || 'VACÍO'}" → Terminado`);
    batch.update(doc.ref, { estado: 'Terminado' });
    count++;
  });

  await batch.commit();
  console.log(`\n✓ ${count} proyecto(s) actualizados a estado: 'Terminado'.`);
}

main().catch(e => { console.error(e); process.exit(1); });
