/**
 * seed-movimientos.cjs — Carpintería Huayapam ERP
 *
 * Lee movimientos_limpios.csv y sube todo a Firestore:
 *   - Vincula entidades a contactos existentes (fuzzy match)
 *   - Crea nuevos contactos para entidades desconocidas
 *   - Auto-categoriza movimientos por palabras clave en CONCEPTO
 *   - Actualiza listas de cuentas bancarias y formas de pago
 *
 * Uso:
 *   node seed-movimientos.cjs --combine          → solo genera movimientos_combinados.csv
 *   node seed-movimientos.cjs --import           → sube todo a Firestore
 *   node seed-movimientos.cjs --combine --import → ambos
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const MODE_COMBINE = process.argv.includes('--combine');
const MODE_IMPORT  = process.argv.includes('--import');

if (!MODE_COMBINE && !MODE_IMPORT) {
  console.error('Usa --combine, --import, o ambos.');
  process.exit(1);
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

const CSV_DIR = '/Users/pablospada/Downloads/MOVIMIENTOS CARPINTERIA';
const FILES = [
  { file: '00CH CC MOVIMIENTOS CONTABILIDAD - CAJA.csv',  monto: 'entrada_salida' },
  { file: '00CH CC MOVIMIENTOS CONTABILIDAD - CHU.csv',   monto: 'deposito_retiro' },
  { file: '00CH CC MOVIMIENTOS CONTABILIDAD - SATP.csv',  monto: 'deposito_retiro' },
  { file: '00CH CC MOVIMIENTOS CONTABILIDAD - OTROS.csv', monto: 'entrada_salida'  },
];

const CLEAN_CSV = path.join(__dirname, 'movimientos_limpios.csv');
const RAW_CSV   = path.join(__dirname, 'movimientos_combinados.csv');

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += c; }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

function csvEscape(val) {
  const s = String(val ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseAmount(str) {
  if (!str || str.trim() === '') return 0;
  return parseFloat(str.replace(/,/g, '').trim()) || 0;
}

function parseDate(str) {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return str.trim();
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function makeId(fecha, cuenta, tipo, monto, entidad, concepto) {
  const raw = `${fecha}|${cuenta}|${tipo}|${monto}|${entidad}|${concepto}`.toLowerCase();
  return 'mov-' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function slug(str, maxLen = 40) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, maxLen);
}

// ── Normalización de nombres ──────────────────────────────────────────────────

const CORP_SUFFIXES = [
  'S. A. DE C. V.', 'SA DE CV', 'S.A. DE C.V.', 'S.A.DE C.V.',
  'S. DE R. L. DE C. V.', 'S.DE R.L.DE C.V.', 'S DE RL DE CV',
  'A. C.', 'A.C.', 'S. A. B. DE C. V.', 'S.A.B. DE C.V.',
  'S. C.', 'S.C.', 'S. A.', 'S.A.', 'S.L.', 'S. L.',
  'S. DE R.L. DE C.V.', 'SAPI DE CV', 'S.A.P.I. DE C.V.',
];

function normName(name) {
  let s = name.toUpperCase();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const suf of CORP_SUFFIXES) {
    s = s.replace(new RegExp(suf.replace(/\./g, '\\.').replace(/\s+/g, '\\s*'), 'g'), '');
  }
  s = s.replace(/\(.*?\)/g, '');
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function tokenSimilar(a, b) {
  if (a === b) return true;
  const longer  = Math.max(a.length, b.length);
  const shorter = Math.min(a.length, b.length);
  if (shorter >= 5 && (a.includes(b) || b.includes(a))) return true;
  const tokA = new Set(a.split(' ').filter(t => t.length > 2));
  const tokB = new Set(b.split(' ').filter(t => t.length > 2));
  if (tokA.size >= 2 && tokB.size >= 2) {
    const shared = [...tokA].filter(t => tokB.has(t)).length;
    if (shared / Math.min(tokA.size, tokB.size) >= 0.7) return true;
  }
  return false;
}

// ── Auto-categorización ───────────────────────────────────────────────────────

const CAT_RULES = [
  // Gastos
  { cat: 'Materiales y Materia Prima', type: 'Gasto', kw: [
    'MADERA','TABLERO','TRIPLAY','MDF','TZALAM','BANAK','MACUIL','CEDRO','PINO','TECA',
    'PAROTA','CHAPAS','TORNILLO','HERRAJE','BISAGRA','JALADERA','QUIMICO','BARNIZ','LACA',
    'PINTURA','SOLVENTE','COMEX','SAYER','ASTRO','FERRETERIA','FERRETERA','MADER',
    'MADERAS','MATERIALES','TABLEROS','PLYWOOD','TRIPLAY','SILICON','COLA','PEGAMENTO',
    'LIJA','LIJAS','CLAVOS','PERNO','TELA','CUERO','VIDRIO','CRISTAL','ESPEJO',
    'ALUMINIO','ACERO','HERRERIA','CEMENTOS','PINTURA','IMPERMEABILIZANTE',
  ]},
  { cat: 'Nómina y Mano de Obra', type: 'Gasto', kw: [
    'NOMINA','NÓMINA','SUELDO','SEMANA','PERSONAS','TRABAJADOR','SALARIO',
    'PLANILLA','PAGO SEMANAL','TRABAJADORES','JORNADA',
  ]},
  { cat: 'Servicios Públicos', type: 'Gasto', kw: [
    'TELMEX','CFE','LUZ','AGUA','INTERNET','BASURA','PREDIAL','ELECTRICIDAD',
    'TELEFONO','TELÉFONO','TELECOMUNICACIONES','RENTA','BODEGA','ALQUILER',
    'MEMBRESIA','MEMBRESÍA','ENLACE GLOBAL','GAS','TOTALGAS',
  ]},
  { cat: 'Herramienta y Equipo', type: 'Gasto', kw: [
    'HERRAMIENTA','SIERRA','ROUTER','CEPILLO','TORNO','EQUIPO','MAQUINA','MAQUINARIA',
    'TOOLS','TRUPER','REFACCION','REFACCIÓN','HOJA','DISCO','FRESA','BROCA',
    'MANTENIMIENTO MAQUINA','MANTENIMIENTO EQUIPO','MOTOR','CORREA',
  ]},
  { cat: 'Transporte y Flete', type: 'Gasto', kw: [
    'FLETE','TRANSPORTE','GASOLINA','COMBUSTIBLE','GASOLINERA','DIESEL','ENVIO','ENVÍO',
    'MENSAJERIA','PAQUETERIA','CAMION','CAMIONETA','FLETERA','ESTACION DE SERVICIO',
  ]},
  { cat: 'Mantenimiento Taller', type: 'Gasto', kw: [
    'MANTENIMIENTO','REPARACION','REPARACIÓN','LIMPIEZA','ENGARGOLADO','FUMIGACION',
    'PLOMERO','ELECTRICISTA','PINTURA TALLER',
  ]},
  { cat: 'Viáticos y Gastos de Viaje', type: 'Gasto', kw: [
    'VIATICO','VIÁTICO','VIATICOS','VIÁTICOS','HOTEL','HOSPEDAJE','BOLETO','AVION',
    'TAXI','UBER','COMIDA VIAJE',
  ]},
  { cat: 'Financieros', type: 'Gasto', kw: [
    'COMISION','COMISIÓN','IVA COMISION','IVA COMISIÓN','OP EXCEDIDAS','CARGO BANCARIO',
    'INTERES','INTERÉS','PENALIZACION','PENALIZACIÓN','CHEQUE DEVUELTO','BANCOMER',
    'BANORTE','BANAMEX','BANCO MERCANTIL',
  ]},
  { cat: 'Honorarios / Pago Socia', type: 'Gasto', kw: [
    'HONORARIO','CONTADOR','CONTADORA','ASESOR','DESPACHO','HARO','MINERVA',
    'REEMBOLSO SOCIO','DIVIDENDO','RETIRO SOCIO',
  ]},
  // Ingresos
  { cat: 'Anticipo de Cliente', type: 'Ingreso', kw: [
    'ANTICIPO','ADELANTO','PAGO PARCIAL','PRIMERA PARCIALIDAD','ENGANCHE',
    '50%','30%','40%','COBRO F-','COBRO A-',
  ]},
  { cat: 'Pago Final de Cliente', type: 'Ingreso', kw: [
    'LIQUIDACION','LIQUIDACIÓN','PAGO FINAL','SALDO FINAL','FINIQUITO',
    'ULTIMO PAGO','ÚLTIMO PAGO','COMPLEMENTO',
  ]},
  { cat: 'Venta Directa / Stock', type: 'Ingreso', kw: [
    'VENTA LEÑA','VENTA ASERRÍN','VENTA ASERRIN','VENTA MADERA','VENTA STOCK',
    'VENTA CAMIONETA','LEÑA','ASERRIN','DESPERDICIO',
  ]},
];

function autoCategoria(tipo, concepto, entidad) {
  const txt = (concepto + ' ' + entidad).toUpperCase();
  for (const rule of CAT_RULES) {
    if (rule.type && rule.type !== tipo) continue;
    if (rule.kw.some(k => txt.includes(k))) return rule.cat;
  }
  // Fallback por tipo
  if (tipo === 'Ingreso') return 'Otros Ingresos';
  if (tipo === 'Gasto')   return 'Gastos Operativos Generales';
  return '';
}

// ── COMBINE ───────────────────────────────────────────────────────────────────

function combineCSVs() {
  let all = [];
  for (const f of FILES) {
    const fullPath = path.join(CSV_DIR, f.file);
    const text     = fs.readFileSync(fullPath, 'utf8');
    const rows     = parseCSV(text);
    const header   = rows[0].map(h => h.trim().toLowerCase());

    const fechaIdx   = header.indexOf('fecha');
    const cuentaIdx  = header.indexOf('cuenta');
    const formaIdx   = header.indexOf('forma');
    const entidadIdx = header.findIndex(h => h.includes('depositante') || h.includes('beneficiario'));
    const conceptIdx = header.indexOf('concepto');

    let entradaIdx, salidaIdx;
    if (f.monto === 'deposito_retiro') {
      entradaIdx = header.findIndex(h => h.includes('deposito') || h.includes('depósito'));
      salidaIdx  = header.findIndex(h => h.includes('retiro'));
    } else {
      entradaIdx = header.findIndex(h => h.includes('entrada'));
      salidaIdx  = header.findIndex(h => h.includes('salida'));
    }

    for (let i = 1; i < rows.length; i++) {
      const row     = rows[i];
      if (row.length < 4) continue;
      const entidad = (row[entidadIdx] || '').trim().toUpperCase();
      const concept = (row[conceptIdx] || '').trim().toUpperCase();
      if (entidad === 'CANCELADO') continue;
      const entrada = parseAmount(row[entradaIdx]);
      const salida  = parseAmount(row[salidaIdx]);
      if (entrada === 0 && salida === 0) continue;
      const fecha  = parseDate(row[fechaIdx]  || '');
      const cuenta = (row[cuentaIdx] || '').trim().toUpperCase();
      if (!fecha || !cuenta) continue;
      const forma = (row[formaIdx] || '').trim().toUpperCase();
      const tipo  = entrada > 0 ? 'Ingreso' : 'Gasto';
      const monto = entrada > 0 ? entrada : salida;
      const formaNum = /^\d+$/.test(forma);
      all.push({
        id:      makeId(fecha, cuenta, tipo, monto, entidad, concept),
        fecha, cuenta, tipo, monto,
        forma:   formaNum ? 'CHEQUE' : forma,
        voucher: formaNum ? forma : '',
        entidad, concepto: concept,
        fuente:  f.file.split(' - ')[1].replace('.csv', ''),
      });
    }
  }
  all.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const headers = ['id','fecha','cuenta','tipo','monto','forma','voucher','entidad','concepto','fuente'];
  const lines = [headers.join(',')];
  for (const m of all) {
    lines.push(headers.map(h => csvEscape(m[h] ?? '')).join(','));
  }
  fs.writeFileSync(RAW_CSV, lines.join('\n'), 'utf8');
  console.log(`CSV combinado: ${all.length} movimientos → ${RAW_CSV}`);
  return all;
}

// ── IMPORT ────────────────────────────────────────────────────────────────────

async function importToFirestore() {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore }        = require('firebase-admin/firestore');

  const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
  initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
  const db = getFirestore('carpinteria-huayapam-erp');

  // ── 1. Leer CSV ──────────────────────────────────────────────────────────────
  const csvPath = fs.existsSync(CLEAN_CSV) ? CLEAN_CSV : RAW_CSV;
  console.log(`Leyendo ${path.basename(csvPath)}...`);
  const rows   = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const header = rows[0];
  const idx    = Object.fromEntries(header.map((h, i) => [h, i]));

  const movs = rows.slice(1).map(r => ({
    id:       r[idx.id],
    fecha:    r[idx.fecha],
    cuenta:   r[idx.cuenta],
    tipo:     r[idx.tipo],
    monto:    parseFloat(r[idx.monto]) || 0,
    forma:    r[idx.forma] || '',
    voucher:  r[idx.voucher] || '',
    entidad:  r[idx.entidad] || '',
    concepto: r[idx.concepto] || '',
    fuente:   r[idx.fuente] || '',
  })).filter(m => m.id && m.monto > 0);

  console.log(`  ${movs.length} movimientos cargados`);

  // ── 2. Traer contactos existentes de Firestore ────────────────────────────────
  console.log('Cargando contactos desde Firestore...');
  const contactsSnap = await db.collection('contacts').get();
  const existingContacts = contactsSnap.docs.map(d => ({ ...d.data(), _fsId: d.id }));
  console.log(`  ${existingContacts.length} contactos existentes`);

  // Índice normalizado → contacto
  const contactIndex = new Map();
  for (const c of existingContacts) {
    const names = [c.name, c.givenName, `${c.givenName || ''} ${c.paterno || ''}`.trim()].filter(Boolean);
    for (const n of names) {
      const norm = normName(n);
      if (norm) contactIndex.set(norm, c);
    }
  }

  // ── 3. Matching entidad → contacto ───────────────────────────────────────────
  console.log('Vinculando entidades a contactos...');
  const entityToContact = new Map();    // rawName → { contact_id, contact_name }
  const newContacts     = new Map();    // rawName → nuevo doc

  // Entidades especiales que no son contactos
  const SKIP_ENTITIES = new Set([
    'SALDO INICIAL', 'IVA COMISION TRANSFERENCIA', 'COMISION TRANSFERENCIA',
    'IVA COMISION MEMBRESIA', 'COMISION MEMBRESIA', 'OP EXCEDIDAS A MEMBRESIA',
    'OP. EXCEDIDAS A MEMBRESIA', 'IVA OP. EXCEDIDAS A MEMBRESIA',
    'IVA OP EXCEDIDAS A MEMBRESIA', 'CANCELADO', '0', '',
  ]);

  const uniqueEntities = [...new Set(movs.map(m => m.entidad))];

  for (const rawName of uniqueEntities) {
    if (SKIP_ENTITIES.has(rawName)) continue;

    const norm = normName(rawName);
    if (!norm) continue;

    // Buscar match exacto normalizado
    let match = contactIndex.get(norm);

    // Si no, buscar por similitud de tokens
    if (!match) {
      for (const [cn, c] of contactIndex.entries()) {
        if (tokenSimilar(norm, cn)) { match = c; break; }
      }
    }

    if (match) {
      entityToContact.set(rawName, {
        contact_id:   match._fsId || match.id,
        contact_name: match.name || match.givenName,
      });
    } else if (!newContacts.has(rawName)) {
      // Crear nuevo contacto
      // Determinar tipo según los movimientos de esa entidad
      const tiposDeEstaEntidad = movs.filter(m => m.entidad === rawName).map(m => m.tipo);
      const nIngresos = tiposDeEstaEntidad.filter(t => t === 'Ingreso').length;
      const nGastos   = tiposDeEstaEntidad.filter(t => t === 'Gasto').length;
      const tipo = nIngresos >= nGastos ? 'cliente' : 'proveedor';
      const prefix = tipo === 'cliente' ? 'cli' : 'sup';
      const id = `${prefix}-hist-${slug(rawName, 40)}`;

      newContacts.set(rawName, {
        id,
        name:       rawName,
        givenName:  rawName,
        paterno:    '',
        tipo,
        activo:     true,
        phone:      '',
        email:      '',
        address:    '',
        _seeded_from_movimientos: true,
      });

      entityToContact.set(rawName, { contact_id: id, contact_name: rawName });
    }
  }

  console.log(`  Vinculados:      ${[...entityToContact.values()].filter(v => !newContacts.has([...entityToContact.entries()].find(([k, vv]) => vv === v)?.[0])).length}`);
  console.log(`  Nuevos contactos: ${newContacts.size}`);

  // ── 4. Cuentas bancarias y formas de pago ─────────────────────────────────────
  const cuentasEnCSV  = [...new Set(movs.map(m => m.cuenta).filter(Boolean))].sort();
  const formasEnCSV   = [...new Set(movs.map(m => m.forma).filter(Boolean))].sort();

  // Leer listas actuales
  const baSnap = await db.collection('bank_accounts').doc('main').get();
  const pmSnap = await db.collection('payment_methods').doc('main').get();

  const existingAccounts = baSnap.exists ? (baSnap.data().list || []) : [];
  const existingMethods  = pmSnap.exists ? (pmSnap.data().list || []) : [];

  const mergedAccounts = [...new Set([...existingAccounts, ...cuentasEnCSV])].sort();
  const mergedMethods  = [...new Set([...existingMethods,  ...formasEnCSV])].sort();

  // ── 5. Batch writes ───────────────────────────────────────────────────────────

  // Nuevos contactos
  if (newContacts.size > 0) {
    console.log(`\nCreando ${newContacts.size} contactos nuevos...`);
    const col = db.collection('contacts');
    let batch = db.batch(); let count = 0;
    for (const c of newContacts.values()) {
      batch.set(col.doc(c.id), c);
      if (++count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count > 0) await batch.commit();
    console.log('  ✅ Contactos creados');
  }

  // Actualizar cuentas y formas de pago
  await db.collection('bank_accounts').doc('main').set({ list: mergedAccounts });
  await db.collection('payment_methods').doc('main').set({ list: mergedMethods });
  console.log(`\n✅ Cuentas bancarias: ${mergedAccounts.join(', ')}`);
  console.log(`✅ Formas de pago:    ${mergedMethods.join(', ')}`);

  // Movimientos
  console.log(`\nSubiendo ${movs.length} movimientos...`);
  const col = db.collection('accounting_movements');
  let batch = db.batch(); let count = 0; let total = 0;

  for (const m of movs) {
    const linked   = entityToContact.get(m.entidad);
    const categoria = autoCategoria(m.tipo, m.concepto, m.entidad);

    const doc = {
      id:             m.id,
      date:           m.fecha,
      account:        m.cuenta,
      type:           m.tipo,
      amount:         m.monto,
      method:         m.forma,
      voucher:        m.voucher,
      entity:         m.entidad,
      contact_id:     linked?.contact_id  || '',
      concept:        m.concepto,
      category:       categoria,
      notes:          '',
      status:         'confirmado',
      projectId:      '',
      orderId:        '',
      registrado_por: 'seed-movimientos',
      confirmado_por: 'seed-movimientos',
      confirmado_en:  new Date().toISOString(),
      fuente:         m.fuente,
    };

    batch.set(col.doc(m.id), doc);
    count++; total++;
    if (count >= 400) {
      await batch.commit();
      process.stdout.write(`  ${total}/${movs.length}\r`);
      batch = db.batch(); count = 0;
    }
  }
  if (count > 0) await batch.commit();

  console.log(`\n\n✅ ${total} movimientos importados`);

  // Resumen de categorías
  const catCount = {};
  for (const m of movs) {
    const c = autoCategoria(m.tipo, m.concepto, m.entidad);
    catCount[c] = (catCount[c] || 0) + 1;
  }
  console.log('\nDistribución de categorías:');
  Object.entries(catCount).sort((a,b) => b[1]-a[1]).forEach(([c,n]) => {
    console.log(`  ${n.toString().padStart(6)}  ${c}`);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (MODE_COMBINE) combineCSVs();
  if (MODE_IMPORT)  await importToFirestore();
}

main().catch(err => { console.error(err); process.exit(1); });
