// Rigenera src/lib/dbRepairSql.ts dal file di migrazione, cosi' che lo script
// mostrato dall'app resti allineato a quello versionato nel repository.
import { readFileSync, writeFileSync } from 'node:fs';

// Migrazioni correttive incluse nello script mostrato dall'app, in ordine.
// 014 e 015 sono escluse: scritte contro uno schema (001_rls_policies.sql)
// che non corrisponde al database reale di produzione, verificato tramite
// la Management API — RLS disattivata ovunque, nessuna delle funzioni o
// dei trigger che presumevano.
const SOURCES = [
  'supabase/migrations/013_fix_schema_drift.sql',
  'supabase/migrations/016_movimenti_minimale.sql',
  'supabase/migrations/017_impostazioni_email.sql',
  'supabase/migrations/018_veicoli_scadenze.sql',
  'supabase/migrations/019_foglio_lavoro_semplice.sql',
  'supabase/migrations/020_fatture_delete_policy.sql',
];
const TARGET = 'src/lib/dbRepairSql.ts';

const sql = SOURCES.map((f) => readFileSync(f, 'utf8')).join('\n\n');

const header = `// FILE GENERATO AUTOMATICAMENTE - non modificare a mano.
// Sorgenti: ${SOURCES.join(', ')}
// Rigenera con: npm run gen:db-repair
//
// Contiene lo script SQL di riparazione dello schema, cosi' che l'app possa
// proporlo con un tasto "copia" quando rileva che il database e' disallineato.

export const DB_REPAIR_SQL = `;

writeFileSync(TARGET, header + JSON.stringify(sql) + ';\n');
console.log(`${TARGET} rigenerato (${sql.length} caratteri).`);
