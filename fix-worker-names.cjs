/**
 * Corrige apellidoPaterno y apellidoMaterno de los trabajadores.
 * Los datos del seed tienen el formato: name = "Paterno Materno Nombre"
 * Ej: {givenName:'Eddie', paterno:'Santiago', name:'Santiago Sanchez Eddie'}
 *     → nombre=Eddie, apellidoPaterno=Santiago, apellidoMaterno=Sanchez
 */

const KEY = '/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json';
const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
db.settings({ databaseId: 'carpinteria-huayapam-erp' });

// Datos originales del seed — fuente de verdad
const WORKERS = [
  {id:'EDD92', givenName:'Eddie',       paterno:'Santiago',  name:'Santiago Sanchez Eddie'},
  {id:'DIE85', givenName:'Diego',       paterno:'Romero',    name:'Romero Frias Diego'},
  {id:'NAR69', givenName:'Narciso',     paterno:'Martinez',  name:'Martinez Chavez Narciso R.'},
  {id:'HER71', givenName:'Herón',       paterno:'Pacheco',   name:'Pacheco Garcia Heron C.'},
  {id:'GAB82', givenName:'Gabriel',     paterno:'Santiago',  name:'Santiago Moreno Gabriel'},
  {id:'VIC75', givenName:'Vicente',     paterno:'Cruz',      name:'Cruz Morales Vicente A.'},
  {id:'ANG70', givenName:'Angel',       paterno:'Chincoya',  name:'Chincoya Rodriguez Angel L.'},
  {id:'NEP80', givenName:'Neptali',     paterno:'Hernandez', name:'Hernandez Gaytan Neptali'},
  {id:'GAB72', givenName:'Gabriel',     paterno:'Torija',    name:'Torija Hernandez Gabriel'},
  {id:'MIL97', givenName:'Milena',      paterno:'Spada',     name:'Spada Tello Milena'},
  {id:'GRE75', givenName:'Gregorio',    paterno:'Cruz',      name:'Cruz Cruz Gregorio'},
  {id:'CAR74', givenName:'Carlos',      paterno:'Padilla',   name:'Padilla Cruz Carlos A.'},
  {id:'MAR73', givenName:'Martha',      paterno:'Mendoza',   name:'Mendoza Arellano Martha'},
  {id:'MIG81', givenName:'Miguel',      paterno:'Mendez',    name:'Mendez Santiago Miguel A.'},
  {id:'PAO95', givenName:'Paola',       paterno:'Padilla',   name:'Padilla Contreras Paola'},
  {id:'GUI90', givenName:'Guillermo',   paterno:'Flores',    name:'Flores Garcia Guillermo'},
  {id:'SAN04', givenName:'Sandra',      paterno:'Garcia',    name:'Garcia Hernandez Sandra'},
  {id:'ALF80', givenName:'Alfredo',     paterno:'Garcia',    name:'Garcia Garcia Alfredo'},
  {id:'NAP81', givenName:'Napoleon',    paterno:'Hernandez', name:'Hernandez Ignacio Napoleon'},
  {id:'CHR91', givenName:'Christopher', paterno:'Hernandez', name:'Hernandez Ramirez Christopher'},
  {id:'ANG65', givenName:'Angeles',     paterno:'Rojas',     name:'Rojas Aragon Angeles'},
  {id:'LEX01', givenName:'Lexee',       paterno:'Jimenez',   name:'Jimenez Carranza Lexee'},
  {id:'JEN79', givenName:'Jenny',       paterno:'Velasco',   name:'Velasco Vazquez Jenny'},
  {id:'DIE04', givenName:'Diego',       paterno:'Hernandez', name:'Hernandez Ramirez Diego'},
  {id:'COS70', givenName:'Cosme',       paterno:'Perez',     name:'Perez Ramirez Cosme'},
  {id:'YES80', givenName:'Yesenia',     paterno:'Velasco',   name:'Velasco Vazquez Yesenia'},
  {id:'ELO03', givenName:'Eloy',        paterno:'Hernandez', name:'Hernandez Ramirez Eloy'},
  {id:'GLA77', givenName:'Gladis',      paterno:'Bautista',  name:'Bautista Santiago Gladis'},
  {id:'CAR02', givenName:'Carolina',    paterno:'Santiago',  name:'Santiago Reyes Carolina'},
];

/**
 * Del formato "Paterno Materno Nombre [sufijos]" extrae el apellido materno.
 * Estrategia: los primeros N palabras = paterno, luego busca donde empieza givenName,
 * todo lo que queda en medio = materno.
 */
function extractMaterno(nameFull, paterno, givenName) {
  const parts = nameFull.trim().split(/\s+/);
  const pWords = paterno.trim().split(/\s+/).length;

  // Buscar la primera palabra del givenName en los parts restantes
  const gFirst = givenName.trim().split(/\s+/)[0].toLowerCase();
  let gIdx = -1;
  for (let i = pWords; i < parts.length; i++) {
    if (parts[i].toLowerCase() === gFirst ||
        // Manejar variantes de acentos: Heron ≈ Herón
        parts[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') ===
        gFirst.normalize('NFD').replace(/[̀-ͯ]/g,'')) {
      gIdx = i;
      break;
    }
  }

  if (gIdx < 0) return ''; // No encontrado, no tocar
  const maternoWords = parts.slice(pWords, gIdx);
  return maternoWords.join(' ');
}

async function main() {
  const batch = db.batch();

  console.log('\n🔧 Corrigiendo apellidos de trabajadores...\n');

  for (const w of WORKERS) {
    const materno = extractMaterno(w.name, w.paterno, w.givenName);
    const nombre  = w.givenName;
    const paterno = w.paterno;
    const fullName = [nombre, paterno, materno].filter(Boolean).join(' ');

    const ref = db.collection('contacts').doc(w.id);
    batch.update(ref, {
      nombre,
      apellidoPaterno: paterno,
      apellidoMaterno: materno,
      name: fullName,
    });

    const maternoStr = materno ? `"${materno}"` : '(sin materno)';
    console.log(`  ${w.id.padEnd(8)} | ${nombre.padEnd(12)} | ${paterno.padEnd(12)} | ${maternoStr}`);
  }

  await batch.commit();
  console.log(`\n✅ ${WORKERS.length} trabajadores actualizados.\n`);
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => process.exit(0));
