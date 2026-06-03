/**
 * fix-names-brands-prices.cjs
 * 1. Corrige nombres de MDF/Triplay con dimensiones erróneas
 * 2. Agrega 57 marcas faltantes a inventory_brands con codes únicos
 * 3. Actualiza precios estimados en wood_price_catalog desde costos reales del inventario
 */
const admin = require('firebase-admin');
const KEY   = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });
const DRY = process.argv.includes('--dry-run');

// ── 1. Correcciones de nombre ────────────────────────────────────────────────
const NAME_CORRECTIONS = {
  // MDF Tzalam: dimensiones erróneas
  'Mdf Chapa Tzalam 18mmx1220x2440x':                     'MDF Chapa Tzalam 18mm 2/c 1.22×2.44m',
  'Mdf Chapa Tzalam 18mmx1220x2440x(azul Fino) Arauco':   'MDF Chapa Tzalam 18mm Azul Fino 1.22×2.44m Arauco',
  'Mdf Chapa Tzalam 15mmx1220x244 2/c':                   'MDF Chapa Tzalam 15mm 2/c 1.22×2.44m',
  'Mdf Chapa Tzalam 15mmx122x244 Arauco':                 'MDF Chapa Tzalam 15mm 2/c 1.22×2.44m Arauco',
  'Mdf Chapa Tzalam 12mmx4x8 1/c':                        'MDF Chapa Tzalam 12mm 1/c 1.22×2.44m',
  // MDF - estandarizar "mm×mm×mm" → "mm 1.22×2.44m"
  'Mdf Chapa Nogal 15mmx1220x2440 Arauco':                'MDF Chapa Nogal 15mm 1.22×2.44m Arauco',
  'Mdf Gris Claro Mate Arauco 15mmx1220x2440':            'MDF Gris Claro Mate 15mm 1.22×2.44m Arauco',
  'Mdf Malta 15mmx1220x2440 Arauco':                      'MDF Malta 15mm 1.22×2.44m Arauco',
  'Mdf Oxford Mate Arauco 15mmx1220x2440':                'MDF Oxford Mate 15mm 1.22×2.44m Arauco',
  'Mdf Negro Mate Arauco 15mm X 1220 X 2440':             'MDF Negro Mate 15mm 1.22×2.44m Arauco',
  'Mdf Chapa Okume 15mmx1.22x2.44':                       'MDF Chapa Okumé 15mm 1/c 1.22×2.44m',
  'Mdf Chapa Okume 18mmx1.22x2.44':                       'MDF Chapa Okumé 18mm 1/c 1.22×2.44m',
  'Mdf Chapa Okume 5mmx1.22x2.44 1/c':                    'MDF Chapa Okumé 5mm 1/c 1.22×2.44m',
  // MDF melaminado Rehau
  'Mdf Rehau Rauvsio Super Mate After Dark 2800x1300x19mm': 'MDF Rehau Super Mate After Dark 19mm 1.30×2.80m',
  // Ecotab dimensiones mezcladas (16x122x2.44 → 16mm 1.22×2.44m)
  'Ecotab Listonado de Macuil 16x122x2.44 La Asuncion':  'Ecotab Listonado Macuil 16mm 1.22×2.44m',
  'Ecotab Listonado de Macuil 16x122x2.44':              'Ecotab Listonado Macuil 16mm 1.22×2.44m',
  'Ecotab Listonado de Macuil 18x122x2.44 La Asuncion':  'Ecotab Listonado Macuil 18mm 1.22×2.44m',
  'Ecotab Listonado de Macuil 18x122x2.44':              'Ecotab Listonado Macuil 18mm 1.22×2.44m',
  // Triplay: estandarizar 1.22x2.44mt → 1.22×2.44m
  'Triplay de Pino Asiatico 15mm 2c 1.22x2.44mt':        'Triplay Pino Asiático 15mm 2/c 1.22×2.44m',
  'Triplay de Pino Asiatico 18mm 2c 1.22x2.44mt':        'Triplay Pino Asiático 18mm 2/c 1.22×2.44m',
  'Triplay Nogal 5mmx1220x2440':                         'Triplay Nogal 5mm 1.22×2.44m',
  // Otros
  'Madera de Teca Tectona Grandis':                       'Madera Teca',
};

// ── 2. Marcas faltantes ──────────────────────────────────────────────────────
// Las que ya existen en inventory_brands con sus códigos actuales (a corregir):
const EXISTING_BRANDS = {
  'Hafele': '001', 'Lobus': '002', 'Spax': '003',
  'Dewalt': '004', 'Makita': '005', 'Bosch': '006', 'Trupper': '007',
};
// Nota: "Trupper" en el catálogo es "Truper" en inventario — también corregir

// Marcas nuevas a agregar (las 57 detectadas):
const NEW_BRANDS = [
  '3M', 'Arauco', 'Árbol de la Vida', 'Autozone', 'Bardahl', 'Blum',
  'Bona', 'Bostik', 'CWF-UV', 'Cemix', 'Comex', 'Cuprum', 'DAP',
  'DeWalt', 'Dexter', 'Ducasse', 'Dynabrade', 'FAG', 'Fandeli',
  'Fremolmex', 'Goni', 'Handy Home', 'Herralum', 'Herrasa', 'Häfele',
  'Ixtlán FSC', 'Jako', 'La Asunción', 'Lincoln', 'ML', 'Mancomunados',
  'Members Mark', 'Milesi', 'Milwaukee', 'Mirka', 'Osmo', 'PASAM',
  'Pennsylvania', 'Phillips', 'Polyform', 'Proteak', 'Rubio Monocoat',
  'SACSA', 'SKF', 'Salice', 'Sayer', 'Shepherd', 'Sista', 'Soudal',
  'Stanley', 'Stihl', 'Surtek', 'Truper', 'Urrea', 'Valresa', 'Veker', 'WASH',
];

// ── 3. Precios estimados de madera ───────────────────────────────────────────
// Calculados desde el campo `cost` del inventario (precios por pieza → convertidos a pt)
// Fórmulas: pies tabla = (grueso_plg × ancho_plg × largo_pies) / 12
const WOOD_PRICES = {
  // Maderas macizas por pt — promediadas de múltiples ítems con costo registrado
  'wc-pino-1a':     40,   // $173 / 4.125pt (3/4×8×8.25) ≈ $42; $109 / 3.09pt ≈ $35 → ~$40
  'wc-pino-2a':     37,   // $76.72 / 2.06pt (3/4×4×8.25) ≈ $37
  'wc-pino-3a':     30,   // sin datos exactos, estimado
  'wc-pino-trat':   45,   // Pino impregnado $452.40 / pieza → ~$45/pt estimado
  'wc-tzalam-1a':   78,   // $65.76, $85, $88 → promedio ~$78/pt
  'wc-macuil-1a':   68,   // $67.05/pt y $74.95/pt → ~$68
  'wc-macuil-2a':   51,   // $51.16/pt
  'wc-cedro-1a':    47,   // $47/pt
  'wc-caoba':       76,   // $76/pt
  'wc-encino':      72,   // $72/pt (similar al Ayacahuite)
  'wc-huanacaxtle': 85,   // $85/pt
  'wc-teca':        0,    // sin datos
  'wc-ayacahuite':  72,   // $72/pt
  'wc-machiche':    0,    // sin datos
  // Tableros (lámina = hoja 1.22×2.44m)
  'wc-mdf-nat-5mm': 200,  // sin dato exacto, estimado
  'wc-mdf-nat-9mm': 280,  // estimado
  'wc-mdf-nat-12':  340,  // estimado
  'wc-mdf-nat-15':  380,  // $378.44 Proteak 15mm
  'wc-mdf-nat-18':  450,  // estimado
  'wc-mdf-mel-bco': 510,  // $508.62 Blanco Absoluto Lobus 15mm
  'wc-mdf-nog-15':  626,  // $625.86 Nogal 15mm Arauco
  'wc-mdf-tzal-15': 590,  // $589.65-$912 → 590 es el más común
  'wc-mdf-tzal-18': 0,    // sin dato exacto
  'wc-mdf-enc-15':  500,  // $501.72
  'wc-mdf-enc-18':  636,  // $636.21
  'wc-mdf-pin-15':  496,  // $495.69
  'wc-mdf-pin-18':  566,  // $565.52
  'wc-mdf-ced-15':  750,  // $750
  'wc-mdf-oku-15':  0,    // Okumé 15mm sin dato
  'wc-mdf-mac-15':  599,  // $599.14 Macuil Mel Lobus 15mm
  'wc-tri-birch-15': 0,   // sin dato
  'wc-tri-birch-18': 0,   // sin dato
  'wc-tri-pino-15':  603, // $602.58 Pino Chileno 15mm
  'wc-tri-enc-5mm':  253, // $252.60 Encino 5.2mm
  'wc-tri-nog-5mm':  317, // $317.24 Nogal 5mm
  'wc-eco-mac-16':  2931, // $2931.04 Ecotab Macuil 16mm
  'wc-eco-mac-18':  2759, // $2758.56 Ecotab Macuil 18mm
  'wc-deck-cumaru':  0,   // sin dato directo de precio/m²
  'wc-deck-teka':    551, // $550.85 / 0.406m² = $1358/m²... pero precio es por pieza
};

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY ? '🔍 DRY RUN\n' : '🚀 APLICANDO CAMBIOS\n');

  const [invSnap, brandSnap, woodSnap] = await Promise.all([
    db.collection('inventory').get(),
    db.collection('inventory_brands').get(),
    db.collection('wood_price_catalog').get(),
  ]);

  const inv    = invSnap.docs.map(d => ({ _docId: d.id, ...d.data() })).filter(i => !i._init && i.name);
  const brands = brandSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  const wood   = woodSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));

  let batch = db.batch(), batchN = 0;
  async function flush() {
    if (batchN > 0 && !DRY) { await batch.commit(); batch = db.batch(); batchN = 0; }
  }

  // ── 1. Correcciones de nombre ─────────────────────────────────────────────
  let nameFixed = 0;
  for (const item of inv) {
    const fix = NAME_CORRECTIONS[item.name];
    if (fix) {
      console.log(`  NAME  "${item.name}"\n      → "${fix}"`);
      if (!DRY) { batch.update(db.collection('inventory').doc(item._docId), { name: fix }); batchN++; }
      nameFixed++;
      if (batchN >= 400) await flush();
    }
  }
  await flush();
  console.log(`\n  ✓ ${nameFixed} nombres corregidos`);

  // ── 2. Marcas ─────────────────────────────────────────────────────────────
  // Obtener max código actual
  const existingCodes = new Set(brands.map(b => parseInt(b.brandCode)||0));
  let nextCode = Math.max(1, ...existingCodes) + 1;

  // Corregir código "001" duplicado en existentes
  const existingByName = {};
  let assignedCodes = new Map(); // nombre→código
  let codeCounter   = 1;

  // Re-asignar códigos únicos a los ya existentes
  for (const b of brands) {
    const code = String(codeCounter++).padStart(3,'0');
    assignedCodes.set(b.name, code);
    if (!DRY) {
      batch.update(db.collection('inventory_brands').doc(b._docId), { brandCode: code });
      batchN++;
    }
    console.log(`  BRAND-FIX [${code}] ${b.name} (era: ${b.brandCode})`);
  }
  // Corregir "Trupper" → "Truper"
  const trupperId = brands.find(b => b.name === 'Trupper')?._docId;
  if (trupperId && !DRY) {
    batch.update(db.collection('inventory_brands').doc(trupperId), { name: 'Truper' });
    batchN++;
  }

  // Agregar marcas nuevas
  const existingNamesNorm = new Set(brands.map(b => b.name.toLowerCase().trim()));
  let added = 0;
  for (const brandName of NEW_BRANDS) {
    // Evitar duplicados (ej. "Truper" si ya existe "Trupper" corregido, o "Dewalt"/"DeWalt")
    const norm = brandName.toLowerCase().trim();
    const alreadyThere = [...existingNamesNorm].some(n => n.replace(/ä/g,'a') === norm.replace(/ä/g,'a') || n === norm);
    if (alreadyThere) continue;
    const code = String(codeCounter++).padStart(3,'0');
    const id   = 'brand-' + Date.now().toString(36) + '-' + added;
    const entry = { id, name: brandName, brandCode: code };
    console.log(`  BRAND-ADD [${code}] ${brandName}`);
    if (!DRY) {
      batch.set(db.collection('inventory_brands').doc(id), entry);
      batchN++;
    }
    existingNamesNorm.add(norm);
    added++;
    if (batchN >= 400) await flush();
  }
  await flush();
  console.log(`\n  ✓ ${added} marcas agregadas, códigos únicos asignados`);

  // ── 3. Precios en wood_price_catalog ──────────────────────────────────────
  let priceSet = 0;
  for (const entry of wood) {
    const precio = WOOD_PRICES[entry.id];
    if (precio !== undefined && precio > 0 && (entry.precioEst || 0) === 0) {
      console.log(`  PRICE [${entry.id}] ${entry.nombre}: $${precio}/${entry.unidad}`);
      if (!DRY) {
        batch.update(db.collection('wood_price_catalog').doc(entry._docId), { precioEst: precio });
        batchN++;
      }
      priceSet++;
    }
  }
  await flush();
  console.log(`\n  ✓ ${priceSet} precios actualizados en wood_price_catalog`);

  console.log(`\n=== FIN ${DRY ? '(DRY RUN - sin cambios)' : '✓'} ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
