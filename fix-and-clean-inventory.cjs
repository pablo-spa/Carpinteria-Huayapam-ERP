/**
 * fix-and-clean-inventory.cjs
 * 1. Normalizes all inventory category names to match concept_categories
 * 2. Deletes items that belong to "Herramienta/Herramientas" (tracked elsewhere)
 * 3. Re-maps "Madera" items → "General" (madera is tracked in almacen de madera)
 * Does NOT touch concept_categories.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

// null = DELETE, string = map to this canonical name
const CAT_MAP = {
  'ferreteria':                  'Ferretería',
  'ferretería':                  'Ferretería',

  'tornillería y fijaciones':    'Tornillería y Fijaciones',
  'tornilleria y fijaciones':    'Tornillería y Fijaciones',
  'tornillería':                 'Tornillería y Fijaciones',
  'tornilleria':                 'Tornillería y Fijaciones',
  'herrajes':                    'Tornillería y Fijaciones',
  'herraje':                     'Tornillería y Fijaciones',

  'barniz, aceite y pintura':    'Barniz, Aceite y Pintura',
  'barniz aceite y pintura':     'Barniz, Aceite y Pintura',
  'barniz, aceite y pinturas':   'Barniz, Aceite y Pintura',
  'barniz aceite y pinturas':    'Barniz, Aceite y Pintura',
  'barnices y químicos':         'Barniz, Aceite y Pintura',
  'barnices y quimicos':         'Barniz, Aceite y Pintura',
  'quimicos y barnices':         'Barniz, Aceite y Pintura',
  'químicos y barnices':         'Barniz, Aceite y Pintura',
  'quimicos':                    'Barniz, Aceite y Pintura',
  'químicos':                    'Barniz, Aceite y Pintura',
  'pintura':                     'Barniz, Aceite y Pintura',
  'pinturas':                    'Barniz, Aceite y Pintura',
  'barniz':                      'Barniz, Aceite y Pintura',
  'barnices':                    'Barniz, Aceite y Pintura',

  'sierras, cuchillas y brocas': 'Sierras, Cuchillas y Brocas',
  'sierras cuchillas y brocas':  'Sierras, Cuchillas y Brocas',
  'sierras':                     'Sierras, Cuchillas y Brocas',

  'lijas y abrasivos':           'Lijas y Abrasivos',
  'lija y abrasivos':            'Lijas y Abrasivos',
  'lijas':                       'Lijas y Abrasivos',
  'abrasivos':                   'Lijas y Abrasivos',

  // Madera → General (madera tracked in almacen de madera)
  'madera':                      'General',
  'maderas':                     'General',
  'madera maciza':               'General',
  'tableros y maderas':          'General',

  'mdf, triplay, ecotab':        'MDF, Triplay y Ecotab',
  'mdf, triplay y ecotab':       'MDF, Triplay y Ecotab',
  'mdf triplay ecotab':          'MDF, Triplay y Ecotab',
  'mdf':                         'MDF, Triplay y Ecotab',
  'triplay':                     'MDF, Triplay y Ecotab',

  'metalicos':                   'Metálicos',
  'metálicos':                   'Metálicos',
  'metalico':                    'Metálicos',

  'electrico e iluminacion':     'Eléctrico e Iluminación',
  'eléctrico e iluminación':     'Eléctrico e Iluminación',
  'electrico e iluminación':     'Eléctrico e Iluminación',
  'electrico':                   'Eléctrico e Iluminación',
  'eléctrico':                   'Eléctrico e Iluminación',
  'iluminacion':                 'Eléctrico e Iluminación',
  'iluminación':                 'Eléctrico e Iluminación',
  'electrico e iluminacion':     'Eléctrico e Iluminación',

  'mantenimiento':               'Mantenimiento',

  'eq seguridad':                'Equipo de Seguridad',
  'equipo de seguridad':         'Equipo de Seguridad',
  'seguridad':                   'Equipo de Seguridad',
  'epp':                         'Equipo de Seguridad',

  'silicon y acrilastic':        'Siliconas y Adhesivos',
  'silicón y acrilastic':        'Siliconas y Adhesivos',
  'silicon':                     'Siliconas y Adhesivos',
  'silicones':                   'Siliconas y Adhesivos',
  'pegamentos y resinas':        'Siliconas y Adhesivos',
  'pegamento y resinas':         'Siliconas y Adhesivos',
  'pegamentos':                  'Siliconas y Adhesivos',
  'adhesivos':                   'Siliconas y Adhesivos',
  'siliconas y adhesivos':       'Siliconas y Adhesivos',

  // Herramienta → DELETE (tracked in herramientas.html)
  'herramienta':                 null,
  'herramientas':                null,

  'repuestos herramientas':      'Repuestos de Herramientas',
  'repuesto herramientas':       'Repuestos de Herramientas',
  'repuestos de herramientas':   'Repuestos de Herramientas',

  'cristal':                     'Cristal y Vidrio',
  'vidrio':                      'Cristal y Vidrio',
  'vidrio y cristal':            'Cristal y Vidrio',
  'cristal y vidrio':            'Cristal y Vidrio',

  'construccion':                'Construcción',
  'construcción':                'Construcción',

  'telas y lonas':               'Telas y Lonas',
  'telas':                       'Telas y Lonas',
  'lonas':                       'Telas y Lonas',

  'producto de limpieza':        'Limpieza',
  'productos de limpieza':       'Limpieza',
  'limpieza':                    'Limpieza',
  'aseo':                        'Limpieza',

  'papeleria':                   'Papelería y Oficina',
  'papelería':                   'Papelería y Oficina',
  'oficina':                     'Papelería y Oficina',
  'papelería y oficina':         'Papelería y Oficina',

  'automoviles':                 'Automóviles',
  'automóviles':                 'Automóviles',
  'automovil':                   'Automóviles',

  'servicios':                   'Servicios',
  'servicio':                    'Servicios',

  'general':                     'General',
  'otros':                       'General',
  'otro':                        'General',
  'sin categoria':               'General',
  'sin categoría':               'General',
};

function mapCategory(raw) {
  if (!raw) return 'General';
  return CAT_MAP[raw.trim().toLowerCase()];
}

async function main() {
  const invSnap = await db.collection('inventory').get();
  const items = invSnap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(i => !i._init);
  console.log(`Total items: ${items.length}`);

  const toDelete = [];
  const toUpdate = [];

  for (const item of items) {
    const mapped = mapCategory(item.category);
    if (mapped === undefined) {
      // No mapping found — log it
      console.log(`  NO MAP: "${item.category}" — ${item.name}`);
    } else if (mapped === null) {
      // Delete
      toDelete.push(item);
    } else if (mapped !== item.category) {
      // Update
      toUpdate.push({ ...item, newCat: mapped });
    }
  }

  console.log(`\nTo delete (Herramienta): ${toDelete.length}`);
  toDelete.forEach(i => console.log(`  - [${i.category}] ${i.name}`));

  console.log(`\nTo remap: ${toUpdate.length}`);

  // Delete herramienta items
  if (toDelete.length) {
    let batch = db.batch();
    let count = 0;
    for (const item of toDelete) {
      batch.delete(db.collection('inventory').doc(item._id));
      if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    console.log(`\n✓ Deleted ${toDelete.length} herramienta items.`);
  }

  // Update categories
  if (toUpdate.length) {
    let batch = db.batch();
    let count = 0;
    for (const item of toUpdate) {
      const { _id, newCat, ...data } = item;
      batch.set(db.collection('inventory').doc(_id), { ...data, category: newCat }, { merge: true });
      if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    console.log(`✓ Updated categories for ${toUpdate.length} items.`);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
