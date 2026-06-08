/**
 * restore-inventory.cjs — Re-imports inventory from CSV without touching concept_categories
 */
const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

function parseCSVRow(line) {
  const res = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { res.push(cur); cur = ''; continue; }
    cur += c;
  }
  res.push(cur);
  return res;
}

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b[a-záéíóúüñ]/g, c => c.toUpperCase());
}

const CAT_MAP = {
  'Barniz, Aceite Y Pintura':       'Barniz, Aceite y Pintura',
  'Mdf, Triplay Y Ecotab':          'MDF, Triplay y Ecotab',
  'Sierras, Cuchillas Y Brocas':    'Sierras, Cuchillas y Brocas',
  'Eléctrico E Iluminación':        'Eléctrico e Iluminación',
  'Siliconas Y Adhesivos':          'Siliconas y Adhesivos',
  'Tornillería Y Fijaciones':       'Tornillería y Fijaciones',
  'Repuestos De Herramientas':      'Repuestos de Herramientas',
  'Papelería Y Oficina':            'Papelería y Oficina',
  'Equipo De Seguridad':            'Equipo de Seguridad',
};

function numericCode(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); hash |= 0; }
  return String(Math.abs(hash)).substring(0, 6).padStart(6, '0');
}

async function batchWrite(colName, docs, idFn) {
  const col = db.collection(colName);
  let batch = db.batch();
  let count = 0;
  for (const d of docs) {
    const id = typeof idFn === 'function' ? idFn(d) : String(d.id);
    batch.set(col.doc(id), d);
    if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
  }
  if (count > 0) await batch.commit();
  return docs.length;
}

async function main() {
  const csvPath = path.join(__dirname, 'conceptos_inventario.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter(l => l.trim());
  lines.shift(); // skip header

  const items = [];
  for (const line of lines) {
    const row = parseCSVRow(line);
    if (row.length < 5) continue;
    const rawCat = toTitleCase(row[1].trim());
    const cat    = CAT_MAP[rawCat] || rawCat;
    const unit   = row[2].trim().toLowerCase();
    const id     = 'inv-' + row[0].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 150);
    items.push({
      id, code: numericCode(id),
      name: toTitleCase(row[0].trim()),
      category: cat, unit,
      cost: parseFloat(row[3].trim()) || 0,
      lastPurchaseDate: row[4].trim(),
      stock: 0, min: 0, location: '',
    });
  }

  console.log(`Restoring ${items.length} inventory items...`);
  await batchWrite('inventory', items, d => d.id);
  console.log(`Done. Restored ${items.length} items.`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
