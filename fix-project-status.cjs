const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

async function main() {
  const snap = await db.collection('projects').get();
  const real = snap.docs.filter(d => !d.data()._init && d.data().name);
  console.log(`Updating ${real.length} projects to status "Terminado"...`);

  let batch = db.batch();
  let count = 0;
  for (const doc of real) {
    batch.update(doc.ref, { status: 'Terminado' });
    if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();
  console.log(`✅ Done.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
