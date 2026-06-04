/**
 * fix-categories.cjs
 * Lee todos los artículos del inventario y las categorías reales,
 * limpia/unifica las categorías y guarda los cambios en Firestore.
 *
 * Uso: node fix-categories.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

// ── Categorías canónicas (nombre final → código de 2 dígitos) ────────────────
const CANONICAL_CATS = [
  { name: 'Ferretería',                  catCode: '01' },
  { name: 'Tornillería y Fijaciones',    catCode: '02' },
  { name: 'Barniz, Aceite y Pintura',    catCode: '03' },
  { name: 'Sierras, Cuchillas y Brocas', catCode: '04' },
  { name: 'Lijas y Abrasivos',           catCode: '05' },
  { name: 'Madera',                      catCode: '06' },
  { name: 'MDF, Triplay y Ecotab',       catCode: '07' },
  { name: 'Metálicos',                   catCode: '08' },
  { name: 'Eléctrico e Iluminación',     catCode: '09' },
  { name: 'Mantenimiento',               catCode: '10' },
  { name: 'Equipo de Seguridad',         catCode: '11' },
  { name: 'Siliconas y Adhesivos',       catCode: '12' },
  { name: 'Herramienta',                 catCode: '13' },
  { name: 'Repuestos de Herramientas',   catCode: '14' },
  { name: 'Cristal y Vidrio',            catCode: '15' },
  { name: 'Construcción',               catCode: '16' },
  { name: 'Telas y Lonas',              catCode: '17' },
  { name: 'Limpieza',                   catCode: '18' },
  { name: 'Papelería y Oficina',         catCode: '19' },
  { name: 'Automóviles',                catCode: '20' },
  { name: 'Servicios',                  catCode: '21' },
  { name: 'General',                    catCode: '99' },
];

// ── Mapeo de categorías existentes → categoría canónica ──────────────────────
const CAT_MAP = {
  // Ferretería (general)
  'ferreteria':                         'Ferretería',
  'ferretería':                         'Ferretería',

  // Tornillería
  'tornillería y fijaciones':           'Tornillería y Fijaciones',
  'tornilleria y fijaciones':           'Tornillería y Fijaciones',
  'tornillería':                        'Tornillería y Fijaciones',
  'tornilleria':                        'Tornillería y Fijaciones',
  'herrajes':                           'Tornillería y Fijaciones',
  'herraje':                            'Tornillería y Fijaciones',

  // Barniz, Aceite y Pintura
  'barniz, aceite y pintura':           'Barniz, Aceite y Pintura',
  'barniz aceite y pintura':            'Barniz, Aceite y Pintura',
  'barniz, aceite y pinturas':          'Barniz, Aceite y Pintura',
  'barniz aceite y pinturas':           'Barniz, Aceite y Pintura',
  'barnices y químicos':                'Barniz, Aceite y Pintura',
  'barnices y quimicos':                'Barniz, Aceite y Pintura',
  'quimicos y barnices':                'Barniz, Aceite y Pintura',
  'químicos y barnices':                'Barniz, Aceite y Pintura',
  'quimicos':                           'Barniz, Aceite y Pintura',
  'químicos':                           'Barniz, Aceite y Pintura',
  'pintura':                            'Barniz, Aceite y Pintura',
  'pinturas':                           'Barniz, Aceite y Pintura',
  'barniz':                             'Barniz, Aceite y Pintura',
  'barnices':                           'Barniz, Aceite y Pintura',

  // Sierras, Cuchillas y Brocas
  'sierras, cuchillas y brocas':        'Sierras, Cuchillas y Brocas',
  'sierras cuchillas y brocas':         'Sierras, Cuchillas y Brocas',
  'sierras':                            'Sierras, Cuchillas y Brocas',

  // Lijas y Abrasivos
  'lijas y abrasivos':                  'Lijas y Abrasivos',
  'lija y abrasivos':                   'Lijas y Abrasivos',
  'lijas':                              'Lijas y Abrasivos',
  'abrasivos':                          'Lijas y Abrasivos',

  // Madera
  'madera':                             'Madera',
  'maderas':                            'Madera',
  'madera maciza':                      'Madera',
  'tableros y maderas':                 'Madera',

  // MDF, Triplay y Ecotab
  'mdf, triplay, ecotab':               'MDF, Triplay y Ecotab',
  'mdf, triplay y ecotab':              'MDF, Triplay y Ecotab',
  'mdf triplay ecotab':                 'MDF, Triplay y Ecotab',
  'mdf':                                'MDF, Triplay y Ecotab',
  'triplay':                            'MDF, Triplay y Ecotab',

  // Metálicos
  'metalicos':                          'Metálicos',
  'metálicos':                          'Metálicos',
  'metalico':                           'Metálicos',

  // Eléctrico e Iluminación
  'electrico e iluminacion':            'Eléctrico e Iluminación',
  'eléctrico e iluminación':            'Eléctrico e Iluminación',
  'electrico e iluminación':            'Eléctrico e Iluminación',
  'electrico':                          'Eléctrico e Iluminación',
  'eléctrico':                          'Eléctrico e Iluminación',
  'iluminacion':                        'Eléctrico e Iluminación',
  'iluminación':                        'Eléctrico e Iluminación',

  // Mantenimiento
  'mantenimiento':                      'Mantenimiento',

  // Equipo de Seguridad
  'eq seguridad':                       'Equipo de Seguridad',
  'equipo de seguridad':                'Equipo de Seguridad',
  'seguridad':                          'Equipo de Seguridad',
  'epp':                                'Equipo de Seguridad',

  // Siliconas y Adhesivos
  'silicon y acrilastic':               'Siliconas y Adhesivos',
  'silicón y acrilastic':               'Siliconas y Adhesivos',
  'silicon':                            'Siliconas y Adhesivos',
  'silicones':                          'Siliconas y Adhesivos',
  'pegamentos y resinas':               'Siliconas y Adhesivos',
  'pegamento y resinas':                'Siliconas y Adhesivos',
  'pegamentos':                         'Siliconas y Adhesivos',
  'adhesivos':                          'Siliconas y Adhesivos',

  // Herramienta
  'herramienta':                        'Herramienta',
  'herramientas':                       'Herramienta',

  // Repuestos de Herramientas
  'repuestos herramientas':             'Repuestos de Herramientas',
  'repuesto herramientas':              'Repuestos de Herramientas',
  'repuestos de herramientas':          'Repuestos de Herramientas',

  // Cristal y Vidrio
  'cristal':                            'Cristal y Vidrio',
  'vidrio':                             'Cristal y Vidrio',
  'vidrio y cristal':                   'Cristal y Vidrio',
  'cristal y vidrio':                   'Cristal y Vidrio',

  // Construcción
  'construccion':                       'Construcción',
  'construcción':                       'Construcción',

  // Telas y Lonas
  'telas y lonas':                      'Telas y Lonas',
  'telas':                              'Telas y Lonas',
  'lonas':                              'Telas y Lonas',

  // Limpieza
  'producto de limpieza':               'Limpieza',
  'productos de limpieza':              'Limpieza',
  'limpieza':                           'Limpieza',
  'aseo':                               'Limpieza',

  // Papelería y Oficina
  'papeleria':                          'Papelería y Oficina',
  'papelería':                          'Papelería y Oficina',
  'oficina':                            'Papelería y Oficina',
  'papelería y oficina':                'Papelería y Oficina',

  // Automóviles
  'automoviles':                        'Automóviles',
  'automóviles':                        'Automóviles',
  'automovil':                          'Automóviles',

  // Servicios
  'servicios':                          'Servicios',
  'servicio':                           'Servicios',

  // General / sin categoría
  'general':                            'General',
  'otros':                              'General',
  'otro':                               'General',
  'sin categoria':                      'General',
  'sin categoría':                      'General',
  '':                                   'General',
};

function mapCategory(raw) {
  if (!raw) return 'General';
  const key = raw.trim().toLowerCase();
  return CAT_MAP[key] || null; // null = sin mapeo conocido
}

async function main() {
  console.log('📦 Leyendo inventario de Firestore...\n');

  // ── Leer datos ───────────────────────────────────────────────────────────────
  const [invSnap] = await Promise.all([
    db.collection('inventory').get(),
  ]);

  const items = invSnap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(i => !i._init);
  console.log(`   ${items.length} artículos encontrados.\n`);

  // ── Analizar categorías actuales ──────────────────────────────────────────────
  const catGroups = {};
  items.forEach(i => {
    const cat = i.category || '';
    if (!catGroups[cat]) catGroups[cat] = [];
    catGroups[cat].push(i.name || i._id);
  });

  console.log('📊 Categorías encontradas en Firestore:');
  console.log('─'.repeat(60));
  Object.entries(catGroups).sort((a,b) => b[1].length - a[1].length).forEach(([cat, names]) => {
    const mapped = mapCategory(cat);
    const arrow  = mapped ? `→ ${mapped}` : '⚠ SIN MAPEO';
    console.log(`  "${cat}"  (${names.length} items)   ${arrow}`);
  });
  console.log('─'.repeat(60));

  // ── Detectar sin mapeo ────────────────────────────────────────────────────────
  const unmapped = Object.keys(catGroups).filter(c => mapCategory(c) === null);
  if (unmapped.length) {
    console.log(`\n⚠  Categorías SIN mapeo (no se modificarán):`);
    unmapped.forEach(c => console.log(`     "${c}" — ${catGroups[c].length} items`));
    console.log('\n   Agrega estas entradas a CAT_MAP en este script para mapearlas.\n');
  }

  // ── Aplicar cambios ───────────────────────────────────────────────────────────
  const toUpdate = items.filter(i => {
    const mapped = mapCategory(i.category);
    return mapped !== null && mapped !== i.category;
  });

  console.log(`\n✏️  Artículos a actualizar: ${toUpdate.length} de ${items.length}`);
  if (!toUpdate.length) {
    console.log('   Nada que actualizar. ✓');
    return;
  }

  // Preview primeros 10
  console.log('\n   Preview (primeros 10):');
  toUpdate.slice(0, 10).forEach(i => {
    console.log(`   • ${(i.name||'?').padEnd(40)} "${i.category}" → "${mapCategory(i.category)}"`);
  });
  if (toUpdate.length > 10) console.log(`   ... y ${toUpdate.length - 10} más.`);

  // Batch write
  console.log('\n💾 Guardando en Firestore...');
  const col = db.collection('inventory');
  let batch = db.batch();
  let count = 0;
  for (const item of toUpdate) {
    const newCat = mapCategory(item.category);
    const { _id, ...data } = item;
    batch.set(col.doc(_id), { ...data, category: newCat }, { merge: true });
    if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`   ✓ ${toUpdate.length} artículos actualizados.\n`);

  // ── Guardar categorías canónicas en concept_categories ────────────────────────
  console.log('📋 Actualizando concept_categories con las categorías canónicas...');
  const catColRef = db.collection('concept_categories').doc('main');
  await catColRef.set({ list: CANONICAL_CATS });
  console.log(`   ✓ ${CANONICAL_CATS.length} categorías canónicas guardadas.\n`);

  // ── Resumen final ─────────────────────────────────────────────────────────────
  console.log('📈 Resumen por categoría canónica:');
  const finalCounts = {};
  CANONICAL_CATS.forEach(c => finalCounts[c.name] = 0);
  items.forEach(i => {
    const cat = mapCategory(i.category) || i.category;
    if (finalCounts[cat] !== undefined) finalCounts[cat]++;
    else finalCounts[cat] = (finalCounts[cat]||0) + 1;
  });
  Object.entries(finalCounts).sort((a,b) => b[1]-a[1]).forEach(([cat, n]) => {
    if (n > 0) console.log(`   ${cat.padEnd(25)} ${n} artículos`);
  });

  console.log('\n✅ Listo.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
