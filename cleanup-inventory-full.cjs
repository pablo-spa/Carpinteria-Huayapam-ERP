/**
 * cleanup-inventory-full.cjs
 * Limpieza comprensiva del inventario:
 *   1. Reclasifica categorías incorrectas
 *   2. Extrae marcas al campo brand
 *   3. Estandariza nombres (Title Case, limpia redundancias)
 *   4. Crea colección wood_price_catalog
 *
 * Uso: node cleanup-inventory-full.cjs [--dry-run]
 */
const admin = require('firebase-admin');
const KEY   = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });
const DRY = process.argv.includes('--dry-run');

// ── Utilidades ──────────────────────────────────────────────────────────────

function toTitleCase(str) {
  // Excepción: acrónimos conocidos que deben quedar en mayúsculas
  const ACRONYMS = new Set(['MDF','FSC','PCP','SDS','LED','PVC','HSS','HM',
    'PTR','FSC','ISO','SAE','API','INOX','ABS','PH','PZ','NF','NC','G5',
    'SKF','FAG','URB','SKU','UH02']);
  return str.replace(/[A-ZÁÉÍÓÚÜÑ][^,\s]*/gi, word => {
    const up = word.toUpperCase();
    if (ACRONYMS.has(up)) return up;
    // Números con fracciones: 3/4, 1-1/2 → dejar como están
    if (/^\d/.test(word)) return word;
    // Artículos/preposiciones sueltos
    const lowers = new Set(['de','del','la','las','los','el','y','e','o','a','en','con','para','por','sin','al','un','una','sus','su']);
    const low = word.toLowerCase();
    if (lowers.has(low)) return low;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// Normalizar nombre ya en Title Case (no volver a titlecase, solo limpiar)
function cleanName(name) {
  return name
    .replace(/\s{2,}/g, ' ')         // espacios dobles
    .replace(/\(\s+/g, '(')          // espacio después de paréntesis
    .replace(/\s+\)/g, ')')          // espacio antes de cierre
    .replace(/\s*\.\s*$/, '')        // punto final
    .trim();
}

// ── Marcas conocidas ────────────────────────────────────────────────────────
// [ regex que detecta la marca en el nombre, nombre canónico de la marca ]
const BRAND_RULES = [
  [/\bsayer\b/i,          'Sayer'],
  [/\bfandeli\b/i,        'Fandeli'],
  [/\btruper\b/i,         'Truper'],
  [/\bmakita\b/i,         'Makita'],
  [/\bbosch\b/i,          'Bosch'],
  [/\bdewalt\b/i,         'DeWalt'],
  [/\bhafele\b|häfele/i,  'Häfele'],
  [/\barauco\b/i,         'Arauco'],
  [/\bproteak\b/i,        'Proteak'],
  [/\blobus\b/i,          'Lobus'],
  [/\bsoudal\b/i,         'Soudal'],
  [/\bpennsylvan[ia]+\b|\bpensylvan[ia]+\b/i, 'Pennsylvania'],
  [/\b3m\b/,              '3M'],
  [/\bdap\b/i,            'DAP'],
  [/\bcomex\b/i,          'Comex'],
  [/\bmilwaukee\b/i,      'Milwaukee'],
  [/\btrustex\b/i,        'Trustex'],
  [/\bhafele\b/i,         'Häfele'],
  [/\bvalresa\b/i,        'Valresa'],
  [/\bpolyform\b/i,       'Polyform'],
  [/\bmilesi\b/i,         'Milesi'],
  [/\bosmo\b/i,           'Osmo'],
  [/\brubio monocoat\b/i, 'Rubio Monocoat'],
  [/\bbona\b/i,           'Bona'],
  [/\bcwf-uv\b/i,         'CWF-UV'],
  [/\bspax\b/i,           'Spax'],
  [/\bstihl\b/i,          'Stihl'],
  [/\bnorman\b/i,         'Norman'],
  [/\bducasse?\b/i,       'Ducasse'],
  [/\bblumotion\b/i,      'Blum'],
  [/\bblum\b/i,           'Blum'],
  [/\bsalice\b/i,         'Salice'],
  [/\bjako\b/i,           'Jako'],
  [/\bphillips\b/i,       'Phillips'],
  [/\bdexte[lr]\b/i,      'Dexter'],
  [/\bherrasa\b/i,        'Herrasa'],
  [/\bherralum\b/i,       'Herralum'],
  [/\bveker\b/i,          'Veker'],
  [/\bhandy home\b/i,     'Handy Home'],
  [/\bfag\b/i,            'FAG'],
  [/\bskf\b/i,            'SKF'],
  [/\burrea\b/i,          'Urrea'],
  [/\bsurtek\b/i,         'Surtek'],
  [/\bcuprum\b/i,         'Cuprum'],
  [/\bshepher[d]?\b/i,    'Shepherd'],
  [/\bmirka\b/i,          'Mirka'],
  [/\bdynabrade\b/i,      'Dynabrade'],
  [/\bgoni\b/i,           'Goni'],
  [/\bautozone\b/i,       'Autozone'],
  [/\bbardahl\b/i,        'Bardahl'],
  [/\bmembers mark\b/i,   'Members Mark'],
  [/\bixtlan\b/i,         'Ixtlán FSC'],
  [/\bpasam\b/i,          'PASAM'],
  [/\bmancomunados\b/i,   'Mancomunados'],
  [/\barbol de la vida\b/i, 'Árbol de la Vida'],
  [/\bla asuncion\b/i,    'La Asunción'],
  [/\bwash\b/i,           ''],   // solo marca si viene después de product name
  [/\bsacsa\b/i,          'SACSA'],
  [/\bfremolmex\b/i,      'Fremolmex'],
  [/\blincoln\b/i,        'Lincoln'],
  [/\bstanley\b/i,        'Stanley'],
  [/\bcemix\b/i,          'Cemix'],
  [/\bdap\b/i,            'DAP'],
  [/\bsista\b/i,          'Sista'],
  [/\bbostik\b/i,         'Bostik'],
];

function extractBrand(name) {
  for (const [re, brand] of BRAND_RULES) {
    if (brand && re.test(name)) return brand;
  }
  return null;
}

// ── Reglas de reclasificación ───────────────────────────────────────────────
// [ condición (fn que recibe el item), nueva categoría ]
const CAT_RULES = [
  // Herramienta → Herramientas (solo renombre)
  [i => i.category === 'Herramienta', 'Herramientas'],

  // General → reclasificar por nombre
  [i => i.category === 'General' && /acr[iy]l/i.test(i.name), 'Siliconas y Adhesivos'],

  // Barniz/Aceite: aceites de motor y anticongelantes → Automóviles
  [i => i.category === 'Barniz, Aceite y Pintura' &&
    /(aceite.*motor|multigrado|anticongelante|valucraft|members mark.*gasolina|bardahl)/i.test(i.name),
    'Automóviles'],

  // Barniz/Aceite: brocas de taladro → Sierras, Cuchillas y Brocas
  [i => i.category === 'Barniz, Aceite y Pintura' && /^broca\b/i.test(i.name), 'Sierras, Cuchillas y Brocas'],

  // Barniz/Aceite: aceite 2 tiempos (motosierra/desbrozadora) → Mantenimiento
  [i => i.category === 'Barniz, Aceite y Pintura' && /2 tiempos|2t\b/i.test(i.name), 'Mantenimiento'],

  // Barniz/Aceite: probetas y vasos de vidrio → Herramientas
  [i => i.category === 'Barniz, Aceite y Pintura' && /probeta|vaso de precipitado/i.test(i.name), 'Herramientas'],

  // Barniz/Aceite: botella de plástico → Ferretería
  [i => i.category === 'Barniz, Aceite y Pintura' && /botella de pl[aá]stico/i.test(i.name), 'Ferretería'],

  // Ferretería: caja de herramientas → Herramientas
  [i => i.category === 'Ferretería' && /caja para herramienta|caja de herramienta/i.test(i.name), 'Herramientas'],

  // Ferretería: limsas, formones, escofinas → Herramientas
  [i => i.category === 'Ferretería' &&
    /^(formon|escofina|lima (plana|triangular)|cutter|llave (allen|inglesa|española)|desarmador|pinza de|machete)/i.test(i.name),
    'Herramientas'],

  // Ferretería: discos de corte y desbaste → Sierras, Cuchillas y Brocas
  [i => i.category === 'Ferretería' &&
    /^disco de (corte|desbaste)/i.test(i.name),
    'Sierras, Cuchillas y Brocas'],

  // Ferretería: base/respaldo para pulidora/lijadora → Repuestos de Herramientas
  [i => i.category === 'Ferretería' &&
    /^base[/ ](respaldo|soporte)|base para (pulidora|lijadora|hilo)/i.test(i.name),
    'Repuestos de Herramientas'],

  // Ferretería: Poli Resinas → Siliconas y Adhesivos
  [i => i.category === 'Ferretería' && /poli resinas?|resina prha/i.test(i.name), 'Siliconas y Adhesivos'],

  // Ferretería: Estopa → Limpieza
  [i => i.category === 'Ferretería' && /^estopa$/i.test(i.name.trim()), 'Limpieza'],

  // Ferretería: Escoba/cepillo de limpieza → Limpieza
  [i => i.category === 'Ferretería' && /^(escoba|cepillo (cerdas|plastico multiusos))/i.test(i.name), 'Limpieza'],

  // Ferretería: Emplaye → Papelería y Oficina
  [i => i.category === 'Ferretería' && /^emplaye$/i.test(i.name.trim()), 'Papelería y Oficina'],

  // Ferretería: Pantimedias → Barniz, Aceite y Pintura (se usan para filtrar pintura)
  [i => i.category === 'Ferretería' && /pantimedias/i.test(i.name), 'Barniz, Aceite y Pintura'],

  // Ferretería: Toallas de microfibra y papel → Limpieza
  [i => i.category === 'Ferretería' && /toallas (multiusos|de microfibra)/i.test(i.name), 'Limpieza'],

  // Ferretería: Harina de trigo (pasta para pegar) → Siliconas y Adhesivos
  [i => i.category === 'Ferretería' && /harina de trigo/i.test(i.name), 'Siliconas y Adhesivos'],

  // Ferretería: Soldadura → Metálicos
  [i => i.category === 'Ferretería' && /^soldadura/i.test(i.name), 'Metálicos'],

  // Ferretería: malla, cadena cortada como materiales → Metálicos
  [i => i.category === 'Ferretería' && /^(malla para gallinero|malla rombo|alambr[óo]n|alambre recocido|varilla roscada)/i.test(i.name), 'Metálicos'],

  // MDF: tubo ovalado → Metálicos
  [i => i.category === 'MDF, Triplay y Ecotab' && /^tubo ovalado/i.test(i.name), 'Metálicos'],

  // Mantenimiento: focos → Eléctrico e Iluminación
  [i => i.category === 'Mantenimiento' && /^foco\b/i.test(i.name), 'Eléctrico e Iluminación'],

  // Mantenimiento: clavijas y contactos eléctricos → Eléctrico e Iluminación
  [i => i.category === 'Mantenimiento' &&
    /^(clavija|contacto duplex falla|boton de paro|contactor|cinta de aislar)/i.test(i.name),
    'Eléctrico e Iluminación'],

  // Mantenimiento: baleros que son de repuesto de herramientas
  [i => i.category === 'Mantenimiento' && /balero (lhv|4307|6002 lhv|62208|6207|6208)/i.test(i.name), 'Repuestos de Herramientas'],
];

// ── Correcciones de nombre individuales ─────────────────────────────────────
const NAME_FIXES = {
  // Algunos nombres tienen errores tipográficos o inconsistencias notorias
  'Brocha 2 Ceradas Normales': 'Brocha 2" Cerdas Normales',
  'Brocha 2-1/2 Ceradas Normales': 'Brocha 2-1/2" Cerdas Normales',
  'Sayer Dluyente Americano P/nitro D-8000': 'Sayer Diluyente Americano P/Nitro D-8000',
  'Polyform Solvente P/poliuretano E.1l': 'Polyform Solvente P/Poliuretano E.1L',
  'Polyform Solvente P/poliuretano E.1l Comex': 'Polyform Solvente P/Poliuretano E.1L Comex',
  'Selladodr de Poliuretano': 'Sellador de Poliuretano',
  'GOTERO/PIPETA 3ml SKU 881365803792': 'Gotero/Pipeta 3ml',
  'ACRILASTIC PENNSYLVANIA NEGRO 300ml': 'Acrilastic Negro 300ml',
  'ACRILASTIC PENNSYLVANIA ALUMINIO 300ml': 'Acrilastic Aluminio 300ml',
  'ACRILASTIC PENNSYLVANIA BLANCO 300ml': 'Acrilastic Blanco 300ml',
  'ACRILASTIC PENNSYLVANIA BRONCE 300ml': 'Acrilastic Bronce 300ml',
  'ACRILASTIC PENNSYLVANIA CAFE 300ml': 'Acrilastic Café 300ml',
  'ACRILASTIC PENNSYLVANIA CHAMPANG 300ml': 'Acrilastic Champagne 300ml',
};

// ── Madera: agrupar en categorías simplificadas ──────────────────────────────
// Los items de madera con dimensiones exactas y proveedor quedan en inventario
// pero se simplifica el nombre para extraer especie, calidad y proveedor

function simplifyWoodName(item) {
  const n = item.name;
  const changes = {};

  // Extraer proveedor al campo brand si no tiene brand
  if (!item.brand) {
    const provMatch = n.match(/\b(PASAM|MANCOMUNADOS|LA ASUNCION|La Asuncion|IXTLAN|Ixtlan|WASH|Wash|Arbol de la Vida|Arbol De La Vida|ML|FSC 100%|FSC)\b/i);
    if (provMatch) {
      const provMap = {
        'pasam': 'PASAM', 'mancomunados': 'Mancomunados', 'la asuncion': 'La Asunción',
        'ixtlan': 'Ixtlán FSC', 'wash': 'WASH', 'arbol de la vida': 'Árbol de la Vida',
        'ml': 'ML', 'fsc 100%': 'FSC 100%', 'fsc': 'FSC 100%',
      };
      const prov = provMap[provMatch[1].toLowerCase()] || provMatch[1];
      changes.brand = prov;
    }
  }

  // Limpiar nombre: quitar proveedor del nombre si ya está en brand
  if (changes.brand || item.brand) {
    let clean = n
      .replace(/\b(FSC 100%|FSC|PASAM|MANCOMUNADOS|LA ASUNCION|La Asuncion|IXTLAN|Ixtlan|WASH|Wash|Arbol de la Vida|Arbol De La Vida|ML)\b/gi, '')
      .replace(/\s{2,}/g, ' ').trim();
    // Limpiar paréntesis vacíos o solo con espacios
    clean = clean.replace(/\(\s*\)/g, '').trim();
    if (clean !== n) changes.name = clean;
  }

  return changes;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY ? '🔍 DRY RUN\n' : '🚀 APLICANDO CAMBIOS\n');

  const snap  = await db.collection('inventory').get();
  const items = snap.docs.map(d => ({ _docId: d.id, ...d.data() })).filter(i => !i._init && i.name);

  let catChanges = 0, brandAdded = 0, nameFixed = 0;
  let BATCH_SIZE = 400;
  let batch = db.batch(), batchN = 0;

  async function flush() {
    if (batchN > 0 && !DRY) { await batch.commit(); batch = db.batch(); batchN = 0; }
  }

  for (const item of items) {
    const updates = {};

    // 1. Corrección de nombre individual
    if (NAME_FIXES[item.name]) {
      updates.name = NAME_FIXES[item.name];
    }

    // 2. Title Case si el nombre está en MAYÚSCULAS (vestigios del doble import)
    if (item.name === item.name.toUpperCase() && item.name.length > 3) {
      updates.name = toTitleCase(updates.name || item.name);
    }
    updates.name = cleanName(updates.name || item.name);

    // 3. Reclasificación
    for (const [cond, newCat] of CAT_RULES) {
      if (cond(item)) { updates.category = newCat; catChanges++; break; }
    }

    // 4. Extracción de marca
    if (!item.brand) {
      const brand = extractBrand(item.name);
      if (brand) { updates.brand = brand; brandAdded++; }
    }

    // 5. Simplificación de madera
    if ((updates.category || item.category) === 'Madera' ||
        (item.category === 'MDF, Triplay y Ecotab')) {
      const woodChg = simplifyWoodName({ ...item, ...updates });
      Object.assign(updates, woodChg);
    }

    // Aplicar solo si hay cambios
    const changed = Object.keys(updates).some(k => {
      if (k === 'name') return updates.name !== item.name;
      if (k === 'category') return updates.category !== item.category;
      if (k === 'brand') return !item.brand;
      return true;
    });

    if (changed) {
      if (updates.name && updates.name !== item.name) nameFixed++;
      if (DRY) {
        if (updates.category && updates.category !== item.category)
          console.log(`  CAT  [${(item.category||'').padEnd(30)}→${updates.category}] ${item.name}`);
        if (updates.brand && !item.brand)
          console.log(`  BRAND [${updates.brand.padEnd(20)}] ${item.name}`);
      } else {
        batch.update(db.collection('inventory').doc(item._docId), updates);
        batchN++;
        if (batchN >= BATCH_SIZE) await flush();
      }
    }
  }

  await flush();

  // ── Crear wood_price_catalog ─────────────────────────────────────────────
  const catalog = [
    // Maderas macizas (unidad: pt = pie tabla)
    { id: 'wc-pino-1a',     nombre: 'Pino Primera',         unidad: 'pt',     precioEst: 0, notas: 'Tabla/Tablón estufado' },
    { id: 'wc-pino-2a',     nombre: 'Pino Segunda',         unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-pino-3a',     nombre: 'Pino Tercera',         unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-pino-trat',   nombre: 'Pino Tratado/Impregnado', unidad: 'pt',  precioEst: 0, notas: 'Exterior/humedad' },
    { id: 'wc-tzalam-1a',   nombre: 'Tzalam Primera',       unidad: 'pt',     precioEst: 0, notas: 'Estufado, La Asunción/WASH' },
    { id: 'wc-macuil-1a',   nombre: 'Macuil Primera (Estufado)', unidad: 'pt', precioEst: 0, notas: '' },
    { id: 'wc-macuil-2a',   nombre: 'Macuil Segunda (Estufado)', unidad: 'pt', precioEst: 0, notas: '' },
    { id: 'wc-cedro-1a',    nombre: 'Cedro Primera',        unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-caoba',       nombre: 'Caoba',                unidad: 'pt',     precioEst: 0, notas: 'Estufada, Árbol de la Vida' },
    { id: 'wc-encino',      nombre: 'Encino Americano',     unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-huanacaxtle', nombre: 'Huanacaxtle',          unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-teca',        nombre: 'Teca',                 unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-ayacahuite',  nombre: 'Ayacahuite',           unidad: 'pt',     precioEst: 0, notas: '' },
    { id: 'wc-machiche',    nombre: 'Machiche',             unidad: 'pt',     precioEst: 0, notas: '' },
    // Tableros (unidad: lámina = 1.22×2.44m)
    { id: 'wc-mdf-nat-5mm', nombre: 'MDF Natural 5.5mm',   unidad: 'lámina', precioEst: 0, notas: '1.22×2.44m' },
    { id: 'wc-mdf-nat-9mm', nombre: 'MDF Natural 9mm',     unidad: 'lámina', precioEst: 0, notas: '1.22×2.44m' },
    { id: 'wc-mdf-nat-12',  nombre: 'MDF Natural 12mm',    unidad: 'lámina', precioEst: 0, notas: '1.22×2.44m' },
    { id: 'wc-mdf-nat-15',  nombre: 'MDF Natural 15mm',    unidad: 'lámina', precioEst: 0, notas: '1.22×2.44m' },
    { id: 'wc-mdf-nat-18',  nombre: 'MDF Natural 18mm',    unidad: 'lámina', precioEst: 0, notas: '1.22×2.44m' },
    { id: 'wc-mdf-mel-bco', nombre: 'MDF Melaminado Blanco 15mm', unidad: 'lámina', precioEst: 0, notas: '2 caras' },
    { id: 'wc-mdf-nog-15',  nombre: 'MDF Enchapado Nogal 15mm',   unidad: 'lámina', precioEst: 0, notas: 'Arauco/Proteak 2C' },
    { id: 'wc-mdf-tzal-15', nombre: 'MDF Enchapado Tzalam 15mm',  unidad: 'lámina', precioEst: 0, notas: '2 caras' },
    { id: 'wc-mdf-tzal-18', nombre: 'MDF Enchapado Tzalam 18mm',  unidad: 'lámina', precioEst: 0, notas: '2 caras' },
    { id: 'wc-mdf-enc-15',  nombre: 'MDF Enchapado Encino 15mm',  unidad: 'lámina', precioEst: 0, notas: '2 caras' },
    { id: 'wc-mdf-enc-18',  nombre: 'MDF Enchapado Encino 18mm',  unidad: 'lámina', precioEst: 0, notas: '2 caras' },
    { id: 'wc-mdf-pin-15',  nombre: 'MDF Enchapado Pino 15mm',    unidad: 'lámina', precioEst: 0, notas: '' },
    { id: 'wc-mdf-ced-15',  nombre: 'MDF Enchapado Cedro 15mm',   unidad: 'lámina', precioEst: 0, notas: '' },
    { id: 'wc-mdf-oku-15',  nombre: 'MDF Enchapado Okumé 15mm',   unidad: 'lámina', precioEst: 0, notas: '' },
    { id: 'wc-mdf-mac-15',  nombre: 'MDF Enchapado Macuil 15mm',  unidad: 'lámina', precioEst: 0, notas: '' },
    // Triplay
    { id: 'wc-tri-birch-15', nombre: 'Triplay Birch 15mm',        unidad: 'lámina', precioEst: 0, notas: 'Lobus Reforzado 1.22×2.44' },
    { id: 'wc-tri-birch-18', nombre: 'Triplay Birch 18mm',        unidad: 'lámina', precioEst: 0, notas: '' },
    { id: 'wc-tri-pino-15',  nombre: 'Triplay Pino Chileno 15mm', unidad: 'lámina', precioEst: 0, notas: '' },
    { id: 'wc-tri-enc-5mm',  nombre: 'Triplay Encino 5.2mm',      unidad: 'lámina', precioEst: 0, notas: '1C' },
    { id: 'wc-tri-nog-5mm',  nombre: 'Triplay Nogal 5mm',         unidad: 'lámina', precioEst: 0, notas: '' },
    // Ecotab
    { id: 'wc-eco-mac-16',   nombre: 'Ecotab Macuil 16mm',        unidad: 'lámina', precioEst: 0, notas: 'Listonado La Asunción' },
    { id: 'wc-eco-mac-18',   nombre: 'Ecotab Macuil 18mm',        unidad: 'lámina', precioEst: 0, notas: 'Listonado La Asunción' },
    // Deck
    { id: 'wc-deck-cumaru',  nombre: 'Deck Cumaru 1a 19mm',       unidad: 'm²',     precioEst: 0, notas: '8cm de ancho' },
    { id: 'wc-deck-teka',    nombre: 'Deck Teka/Ipé 22mm',        unidad: 'm²',     precioEst: 0, notas: 'Lobus 0.406m²' },
  ];

  console.log(`\n=== CATÁLOGO DE PRECIOS DE MADERA (${catalog.length} entradas) ===`);
  if (!DRY) {
    const catBatch = db.batch();
    for (const entry of catalog) {
      catBatch.set(db.collection('wood_price_catalog').doc(entry.id), entry);
    }
    await catBatch.commit();
    console.log('  ✓ Colección wood_price_catalog creada en Firestore');
  } else {
    catalog.forEach(e => console.log(`  ${e.id.padEnd(20)} ${e.nombre.padEnd(35)} ${e.unidad}`));
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Reclasificaciones de categoría: ${catChanges}`);
  console.log(`  Marcas extraídas: ${brandAdded}`);
  console.log(`  Nombres corregidos/estandarizados: ${nameFixed}`);
  if (DRY) console.log('\n  ⚠ Sin cambios aplicados. Ejecuta sin --dry-run para aplicar.');
}

main().catch(e => { console.error(e); process.exit(1); });
