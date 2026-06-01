/**
 * limpiar-entidades.cjs
 *
 * Lee movimientos_combinados.csv, agrupa entidades similares y genera
 * entidades_revision.csv para que puedas revisar y corregir los grupos.
 *
 * Luego, con el CSV revisado, aplica el mapeo al CSV de movimientos.
 *
 * Uso:
 *   node limpiar-entidades.cjs --analizar   → genera entidades_revision.csv
 *   node limpiar-entidades.cjs --aplicar    → aplica entidades_revision.csv a movimientos_combinados.csv
 *                                             y genera movimientos_limpios.csv
 */

const fs   = require('fs');
const path = require('path');

const MODE_ANALIZAR = process.argv.includes('--analizar');
const MODE_APLICAR  = process.argv.includes('--aplicar');

if (!MODE_ANALIZAR && !MODE_APLICAR) {
  console.error('Usa --analizar o --aplicar');
  process.exit(1);
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  for (const line of text.replace(/\r/g,'').split('\n')) {
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

// ── Normalización ─────────────────────────────────────────────────────────────

const SUFFIXES = [
  'S. A. DE C. V.', 'SA DE CV', 'S.A. DE C.V.', 'S.A.DE C.V.',
  'S. DE R. L. DE C. V.', 'S.DE R.L.DE C.V.', 'S DE RL DE CV',
  'A. C.', 'A.C.', 'S. A. B. DE C. V.', 'S.A.B. DE C.V.',
  'S. C.', 'S.C.', 'S. A.', 'S.A.', 'S.L.', 'S. L.',
];

function normalize(name) {
  let s = name.toUpperCase();
  // Quitar acentos
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Quitar sufijos corporativos
  for (const suf of SUFFIXES) {
    s = s.replace(new RegExp(suf.replace(/\./g, '\\.').replace(/\s+/g, '\\s*'), 'g'), '');
  }
  // Quitar paréntesis y su contenido (e.g. "(ACCIONES)", "(JL GRANILLO)")
  s = s.replace(/\(.*?\)/g, '');
  // Quitar puntuación excepto espacios
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  // Colapsar espacios
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ── Levenshtein ───────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

// Similitud: true si los strings son "suficientemente parecidos"
function esSimilar(a, b) {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  const longer  = Math.max(a.length, b.length);
  if (shorter === 0) return false;

  // Uno contiene al otro (para casos como "MINERVA" vs "TELLO RUIZ MINERVA")
  // Solo si el corto tiene al menos 5 chars para evitar falsos positivos
  if (shorter >= 5 && (a.includes(b) || b.includes(a))) return true;

  // Levenshtein relativo: distancia máxima según longitud
  const maxDist = longer <= 8 ? 1 : longer <= 15 ? 2 : longer <= 25 ? 3 : 4;
  if (levenshtein(a, b) <= maxDist) return true;

  // Token overlap: si comparten ≥ 70% de las palabras y ninguno es muy corto
  const tokA = new Set(a.split(' ').filter(t => t.length > 2));
  const tokB = new Set(b.split(' ').filter(t => t.length > 2));
  if (tokA.size >= 2 && tokB.size >= 2) {
    const shared = [...tokA].filter(t => tokB.has(t)).length;
    const minToks = Math.min(tokA.size, tokB.size);
    if (shared / minToks >= 0.7) return true;
  }

  return false;
}

// ── Clustering ────────────────────────────────────────────────────────────────

function clusterEntidades(entidadesMap) {
  // entidadesMap: Map<rawName, count>
  const entries = [...entidadesMap.entries()];

  // Normalizar cada uno
  const normed = entries.map(([raw, count]) => ({
    raw,
    norm: normalize(raw),
    count,
  }));

  // Union-Find
  const parent = normed.map((_, i) => i);
  function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
  function union(i, j) { parent[find(i)] = find(j); }

  // Agrupar por norm exacto primero
  const normIndex = new Map();
  for (let i = 0; i < normed.length; i++) {
    const n = normed[i].norm;
    if (normIndex.has(n)) union(i, normIndex.get(n));
    else normIndex.set(n, i);
  }

  // Luego fuzzy entre normas distintas (solo para normas con pocos tokens → nombres de personas)
  for (let i = 0; i < normed.length; i++) {
    for (let j = i + 1; j < normed.length; j++) {
      if (find(i) === find(j)) continue;
      if (esSimilar(normed[i].norm, normed[j].norm)) union(i, j);
    }
  }

  // Construir grupos
  const groups = new Map();
  for (let i = 0; i < normed.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(normed[i]);
  }

  // Para cada grupo, elegir el nombre canónico = el más frecuente
  const clusters = [];
  for (const members of groups.values()) {
    members.sort((a, b) => b.count - a.count);
    const total = members.reduce((s, m) => s + m.count, 0);
    clusters.push({
      canonico: members[0].raw,
      variantes: members.map(m => m.raw),
      total,
    });
  }

  // Ordenar por total desc
  clusters.sort((a, b) => b.total - a.total);
  return clusters;
}

// ── ANALIZAR ──────────────────────────────────────────────────────────────────

function analizar() {
  const text  = fs.readFileSync(path.join(__dirname, 'movimientos_combinados.csv'), 'utf8');
  const rows  = parseCSV(text);
  const header = rows[0];
  const eIdx  = header.indexOf('entidad');

  const counts = new Map();
  for (let i = 1; i < rows.length; i++) {
    const e = (rows[i][eIdx] || '').trim();
    if (e) counts.set(e, (counts.get(e) || 0) + 1);
  }

  console.log(`Entidades únicas en bruto: ${counts.size}`);
  console.log('Agrupando...');

  const clusters = clusterEntidades(counts);
  const soloUna  = clusters.filter(c => c.variantes.length === 1);
  const varias   = clusters.filter(c => c.variantes.length > 1);

  console.log(`Grupos con variantes: ${varias.length}`);
  console.log(`Sin variantes:        ${soloUna.length}`);
  console.log(`Total grupos:         ${clusters.length}`);

  // Generar CSV de revisión
  // Columnas: canonico_sugerido | REVISAR | variantes (una por columna) | total
  // El usuario puede cambiar "canonico_sugerido" y poner REVISAR=SI si quiere ajustar el grupo
  const outLines = ['canonico_sugerido,revisar,total,variante_1,variante_2,variante_3,variante_4,variante_5,variante_6,variante_7,variante_8,variante_9,variante_10'];

  for (const c of clusters) {
    const vars = c.variantes.slice(0, 10);
    while (vars.length < 10) vars.push('');
    const revisar = c.variantes.length > 1 ? 'REVISAR' : '';
    const row = [c.canonico, revisar, c.total, ...vars].map(csvEscape);
    outLines.push(row.join(','));
  }

  const outPath = path.join(__dirname, 'entidades_revision.csv');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`\nArchivo generado: ${outPath}`);
  console.log('\nAbre entidades_revision.csv en Excel/Numbers.');
  console.log('Revisa las filas marcadas "REVISAR" y ajusta "canonico_sugerido" si hace falta.');
  console.log('Cuando termines, corre:  node limpiar-entidades.cjs --aplicar');
}

// ── APLICAR ───────────────────────────────────────────────────────────────────

function aplicar() {
  const revPath = fs.existsSync(path.join(process.env.HOME, 'Downloads', 'entidades_revision - entidades_revision.csv'))
    ? path.join(process.env.HOME, 'Downloads', 'entidades_revision - entidades_revision.csv')
    : path.join(__dirname, 'entidades_revision.csv');
  if (!fs.existsSync(revPath)) {
    console.error('No se encontró entidades_revision.csv. Corre primero --analizar.');
    process.exit(1);
  }

  // Leer mapeo: variante → canonico
  const revRows = parseCSV(fs.readFileSync(revPath, 'utf8'));
  const mapeo = new Map(); // rawVariante → canonico
  for (let i = 1; i < revRows.length; i++) {
    const row = revRows[i];
    const canonico = (row[0] || '').trim();
    if (!canonico) continue;
    // variantes están en columnas 3..12
    for (let j = 3; j <= 12; j++) {
      const v = (row[j] || '').trim();
      if (v) mapeo.set(v, canonico);
    }
  }

  console.log(`Mapeo cargado: ${mapeo.size} entradas`);

  // Aplicar al CSV combinado
  const text   = fs.readFileSync(path.join(__dirname, 'movimientos_combinados.csv'), 'utf8');
  const rows   = parseCSV(text);
  const header = rows[0];
  const eIdx   = header.indexOf('entidad');

  let changed = 0;
  const outRows = [header];
  for (let i = 1; i < rows.length; i++) {
    const row = [...rows[i]];
    const orig = (row[eIdx] || '').trim();
    const canon = mapeo.get(orig);
    if (canon && canon !== orig) { row[eIdx] = canon; changed++; }
    outRows.push(row);
  }

  const outPath = path.join(__dirname, 'movimientos_limpios.csv');
  const lines = outRows.map(r => r.map(csvEscape).join(','));
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log(`${changed} entidades normalizadas`);
  console.log(`Archivo generado: ${outPath}`);
  console.log('\nRevisa movimientos_limpios.csv y cuando estés listo corre:');
  console.log('  node seed-movimientos.cjs --import   (ajusta el script para leer movimientos_limpios.csv)');
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (MODE_ANALIZAR) analizar();
if (MODE_APLICAR)  aplicar();
