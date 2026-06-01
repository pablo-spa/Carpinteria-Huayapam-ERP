/**
 * seed-conceptos.cjs
 * Adds inventory concepts to the inventory collection.
 * Also updates concept_categories and concept_units.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('ai-studio-a12c0386-3408-4b58-a08e-36e79f61305b');

function parseCSVRow(str) {
  const result = [];
  let inQuotes = false;
  let currentWord = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(currentWord);
      currentWord = '';
    } else {
      currentWord += char;
    }
  }
  result.push(currentWord);
  return result;
}

function toTitleCase(str) {
  if (!str) return '';
  const lower = str.toLowerCase();
  const words = lower.split(' ');
  return words.map((word, index) => {
    if (index > 0 && ['y', 'de', 'el', 'la', 'los', 'las', 'en', 'para', 'con', 'a'].includes(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// Generates a deterministic 10-digit number from a string
function generateNumericCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  // Convert to positive and pad/slice to exactly 10 digits
  let numStr = Math.abs(hash).toString();
  // If hash is too short, we pad it. If it's too long, we slice it.
  // Actually, to make it look like a nice product code, let's pad it with some fixed digits
  numStr = numStr.padStart(10, '1000000000');
  return numStr.substring(0, 10);
}

// Category unification map
const categoryMap = {
  'Herramientas': 'Herramienta',
  'Tornilleria': 'Tornillería y Fijaciones',
  'Orros': 'Orros'
};

async function main() {
  const csvPath = path.join(__dirname, 'conceptos_inventario.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  
  const lines = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
  lines.shift();
  
  const categoriesSet = new Set();
  const unitsSet = new Set();
  const itemsToInsert = [];

  for (const line of lines) {
    const row = parseCSVRow(line);
    if (row.length < 5) continue;
    
    let concepto = toTitleCase(row[0].trim());
    let rawCat = toTitleCase(row[1].trim());
    
    // Unify categories
    let categoria = categoryMap[rawCat] || rawCat;
    
    let unidad = row[2].trim().toLowerCase();
    const ultimoPrecio = parseFloat(row[3].trim()) || 0;
    const fecha = row[4].trim();
    
    if (categoria) categoriesSet.add(categoria);
    if (unidad) unitsSet.add(unidad);
    
    const id = 'inv-' + row[0].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 150);
    const shortCode = generateNumericCode(id);
    
    const data = {
      id: id,
      code: shortCode, 
      name: concepto,
      category: categoria,
      unit: unidad,
      cost: ultimoPrecio,
      lastPurchaseDate: fecha,
      stock: 0,
      min: 0,
      location: '',
      details: 'Importado de conceptos_inventario.csv'
    };
    
    itemsToInsert.push(data);
  }
  
  // 1. Base default categories and units
  const baseCategories = [
    'Madera Maciza', 'Tableros y Chapas', 'Herrajes', 'Químicos y Barnices',
    'Herramienta', 'Consumibles', 'Tornillería y Fijaciones', 'Vidrio y Espejo',
    'Tapicería', 'Electricidad', 'Otros'
  ];
  
  const baseUnits = [
    'pza', 'pt', 'lámina', 'kg', 'lt', 'ml', 'mt', 'mt2', 'gln', 'rollo', 'caja', 'par', 'juego', 'bolsa'
  ];

  const mergedCats = Array.from(new Set([...baseCategories, ...categoriesSet])).sort();
  await db.collection('concept_categories').doc('main').set({ list: mergedCats }, { merge: false });
  console.log(`\r\u2705 Categoqías actualizadas. Total ahora: ${mergedCats.length}`);

  const mergedUnits = Array.from(new Set([...baseUnits, ...unitsSet])).sort();
  await db.collection('concept_units').doc('main').set({ list: mergedUnits }, { merge: false });
  console.log(`\r\u2705 Unidades actualizadas. Total ahora: ${mergedUnits.length}`);

  // 3. Insert Inventory Items
  const col = db.collection('inventory');
  let batch = db.batch();
  let count = 0;
  let added = 0;
  
  for (const data of itemsToInsert) {
    batch.set(col.doc(data.id), data, { merge: true });
    count++;
    added++;
    
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }

  console.log(`\r\u2705  ${added} conceptos de inventario escritos en la colección 'inventory'.\n`);
}

main().catch(e => { console.error('❎', e.message); process.exit(1); });