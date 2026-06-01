/**
 * seed-projects.cjs
 * Seeds historical project names into the projects collection.
 * Status: 'completado'. No contactId — can be linked manually later.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

const PROJECTS = [
  "ALEJANDRA SPRIELLA",
  "ALFONSINA",
  "ALMACEN",
  "ANNIK KEOSEYAN",
  "BACANORA (CAJITAS)",
  "BANCOS GIRATORIOS MARTINA",
  "BANQUITOS TELESECUNDARIA",
  "BENJAMIN LOPEZ VITRINAS",
  "BERNA ANTONA",
  "BRUNO AERNE",
  "CAFÉ LOCAL",
  "CAJAS ARTESANIAS",
  "CAJAS ARTESANIAS ENERO",
  "CAJONES BACANORA",
  "CAMA JOSE LOPEZ",
  "CARLOS CORDOVA",
  "CASA CUNDA",
  "CASA CUNDA HOSTESS",
  "CASA MARGARITA",
  "CASA PRIETO VALLE DE BRAVO",
  "CASA S",
  "CASA VPE CUBIERTAS (HUBER)",
  "CASASNOVAS",
  "CAVA OCULTO",
  "CHAGOL",
  "CHAGOYA",
  "CLOSET LUIS ESPINOZA",
  "COMEDOR NELLY",
  "CRIOLLO",
  "CRIOLLO MAR26",
  "CUBIERTAS DANZANTES CDMX",
  "DAVID NOBLE",
  "EDIFICIO ALCALA",
  "EL TORON",
  "ETLA",
  "GUAYACAN BUNGALOWS",
  "HOTEL ZICATELA",
  "HOTELAZUL",
  "HUBER",
  "HUBER CBH",
  "INGRID CONTRERAS",
  "JAVIER ALVAREZ",
  "JAVIER RUIZ",
  "JAVIER Y PATRICIA",
  "KUYARIH ARQUITECTOS",
  "LIZBETH MARTINEZ",
  "LOS VITRALES ZORRILLA",
  "MALETERO LOS CABOS",
  "MANTENIMIENTO",
  "MANTENIMIENTO CASA CATARINA",
  "MANTENIMIENTO CUNA - JOSE LOPEZ",
  "MANTENIMIENTO GLORIA AMTMAN",
  "MANTENIMIENTO GUAYACAN",
  "MANTENIMIENTO NARANJOS",
  "MARCOS MISAYO",
  "MARIANA RAFUL",
  "MARTINA DACOSTA",
  "MAURICIO ROCHA",
  "MESAS DANZANTES",
  "MOBILIARIO OROSEI",
  "OTTY STUDIO",
  "PERGOLA CASASNOVA",
  "POLTRONA STUDIO",
  "PONTE",
  "PROYECTO BARCELONA",
  "PUERTA HOTEL AZUL",
  "PUERTA MONICA",
  "SAN LORENZO",
  "SILVIA CABRERA",
  "SOCORRO ZORRILLA",
  "TILCAJETE CAJA ANILLOS",
  "TILCAJETE CAJA TIGRE",
  "VALERIA SPRIELLA",
  "XAOK",
  "YA OAXACA",
];

function makeCode(name, idx) {
  const prefix = name.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase().padEnd(4, 'X');
  return `HIST-${prefix}-${String(idx + 1).padStart(3, '0')}`;
}

async function main() {
  console.log(`\nSeeding ${PROJECTS.length} historical projects...\n`);

  const col = db.collection('projects');
  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < PROJECTS.length; i++) {
    const name = PROJECTS[i];
    const id = 'proj-hist-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 36);
    const code = makeCode(name, i);

    batch.set(col.doc(id), {
      id,
      code,
      name,
      status: 'completado',
      contactId: '',
      startDate: '',
      endDate: '',
      description: '',
      pieces: [],
      milestones: [],
      _seeded: true,
    });
    count++;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();

  console.log(`✅  ${PROJECTS.length} proyectos históricos escritos.\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
