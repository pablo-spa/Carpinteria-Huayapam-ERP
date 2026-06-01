/**
 * seed-balances.cjs
 *
 * Lee todos los movimientos de accounting_movements y calcula el saldo
 * real de cada cuenta, incluyendo saldos históricos para mostrar variación.
 * Guarda el resultado en `account_balances` (~11 docs).
 *
 * Correr cada vez que se importen movimientos históricos masivos.
 * Los movimientos nuevos desde la UI actualizan account_balances en tiempo real.
 *
 * Uso: node seed-balances.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const KEY = "/Users/pablospada/Programming Projects/carpinteria-huayapam/firebase key/gen-lang-client-0827035586-firebase-adminsdk-fbsvc-68a6f8c7ab.json";
initializeApp({ credential: cert(require(KEY)), projectId: 'gen-lang-client-0827035586' });
const db = getFirestore('carpinteria-huayapam-erp');

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('Leyendo accounting_movements...');
  const snap = await db.collection('accounting_movements').get();
  const all  = snap.docs.map(d => d.data());
  console.log(`  ${all.length} movimientos`);

  const cutoffs = {
    d7:   dateNDaysAgo(7),
    d30:  dateNDaysAgo(30),
    d180: dateNDaysAgo(180),
    d365: dateNDaysAgo(365),
  };

  // Acumular saldos por cuenta
  const accounts = {};

  function ensure(acc) {
    if (!accounts[acc]) accounts[acc] = { balance: 0, before_d7: 0, before_d30: 0, before_d180: 0, before_d365: 0 };
  }

  for (const m of all) {
    if (m.status !== 'confirmado' && m.status !== 'confirmed') continue;
    const date = m.date || '';

    const applyDelta = (acc, delta) => {
      ensure(acc);
      accounts[acc].balance += delta;
      if (date < cutoffs.d7)   accounts[acc].before_d7   += delta;
      if (date < cutoffs.d30)  accounts[acc].before_d30  += delta;
      if (date < cutoffs.d180) accounts[acc].before_d180 += delta;
      if (date < cutoffs.d365) accounts[acc].before_d365 += delta;
    };

    if (m.type === 'Transferencia') {
      if (m.account)     applyDelta(m.account,     -m.amount);
      if (m.destAccount) applyDelta(m.destAccount,  m.amount);
    } else {
      const delta = m.type === 'Ingreso' ? m.amount : -m.amount;
      if (m.account) applyDelta(m.account, delta);
    }
  }

  console.log('\nSaldos calculados:');
  const batch = db.batch();
  const col   = db.collection('account_balances');

  for (const [acc, data] of Object.entries(accounts)) {
    const round = v => Math.round(v * 100) / 100;
    const doc = {
      id:           acc,
      account:      acc,
      balance:      round(data.balance),
      before_d7:    round(data.before_d7),
      before_d30:   round(data.before_d30),
      before_d180:  round(data.before_d180),
      before_d365:  round(data.before_d365),
      updated_at:   new Date().toISOString(),
    };
    console.log(`  ${acc.padEnd(10)} $${doc.balance.toLocaleString('es-MX')}`);
    batch.set(col.doc(acc), doc);
  }

  await batch.commit();
  console.log(`\n✅ account_balances actualizado (${Object.keys(accounts).length} cuentas)`);
}

main().catch(e => { console.error(e); process.exit(1); });
