/**
 * clean-contacts.cjs
 * Removes redundant `type` and `tags` fields from all contact docs.
 * Ensures every contact has a valid `tipo` value.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

async function main() {
  console.log('\nReading contacts...');
  const snap = await db.collection('contacts').get();
  console.log(`Found ${snap.docs.length} contacts.\n`);

  let batch = db.batch();
  let count = 0;
  let fixed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Derive canonical tipo
    let tipo = data.tipo;
    if (!tipo && data.type) {
      const t = data.type.toLowerCase();
      if (t === 'proveedor') tipo = 'proveedor';
      else if (t === 'trabajador' || t === 'empleado') tipo = 'trabajador';
      else tipo = 'cliente';
    }
    if (!tipo) tipo = 'cliente';

    const update = { tipo };
    // Delete the redundant fields
    if (data.type !== undefined) update.type = FieldValue.delete();
    if (data.tags !== undefined) update.tags = FieldValue.delete();

    batch.update(doc.ref, update);
    count++;
    fixed++;

    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();

  console.log(`✅  ${fixed} contacts cleaned (type/tags removed, tipo normalised).\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
