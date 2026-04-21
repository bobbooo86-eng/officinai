#!/usr/bin/env node
/**
 * Applica supabase/APPLY_ALL.sql al progetto Supabase usando la Management API.
 *
 * Uso (sulla TUA macchina, dove la rete verso supabase.com non e' bloccata):
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node supabase/apply-migrations.mjs
 *
 * Opzionali:
 *   PROJECT_REF=sncwrzrzlorzfnfnaxin   # default: hard-coded sotto
 *   SQL_FILE=supabase/APPLY_ALL.sql    # default
 *
 * Lo script:
 *  1) legge il file SQL
 *  2) lo esegue in due batch perche' "ALTER TYPE ... ADD VALUE" non puo'
 *     girare in transazione: lo isoliamo in una query separata
 *  3) mostra eventuali errori per riga
 */
import { readFileSync } from 'node:fs';

const TOKEN      = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT    = process.env.PROJECT_REF || 'sncwrzrzlorzfnfnaxin';
const SQL_FILE   = process.env.SQL_FILE   || new URL('./APPLY_ALL.sql', import.meta.url).pathname;
const ENDPOINT   = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`;

if (!TOKEN) {
  console.error('Manca SUPABASE_ACCESS_TOKEN (token sbp_...)');
  process.exit(1);
}

const sql = readFileSync(SQL_FILE, 'utf8');

// "ALTER TYPE ... ADD VALUE" non puo' girare in un blocco transazione,
// va eseguito da solo.
const enumLine = sql
  .split('\n')
  .find((l) => /ALTER\s+TYPE\s+stato_appuntamento\s+ADD\s+VALUE/i.test(l));

const sqlSenzaEnum = sql
  .split('\n')
  .filter((l) => !/ALTER\s+TYPE\s+stato_appuntamento\s+ADD\s+VALUE/i.test(l))
  .join('\n');

async function runQuery(label, query) {
  process.stdout.write(`▶ ${label} ... `);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.log('FAIL');
    console.error(`  HTTP ${res.status}: ${text}`);
    return false;
  }
  console.log('OK');
  return true;
}

const ok1 = await runQuery('Migration 010 + 011 + 012 (senza ALTER TYPE)', sqlSenzaEnum);
const ok2 = enumLine
  ? await runQuery('Aggiungo enum value consegnato', enumLine)
  : true;

if (ok1 && ok2) {
  console.log('\n✅ Tutte le migration applicate con successo.');
  process.exit(0);
} else {
  console.log('\n❌ Una o piu` query sono fallite. Vedi sopra.');
  process.exit(1);
}
