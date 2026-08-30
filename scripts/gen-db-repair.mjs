// Rigenera src/lib/dbRepairSql.ts dal file di migrazione, cosi' che lo script
// mostrato dall'app resti allineato a quello versionato nel repository.
import { readFileSync, writeFileSync } from 'node:fs';

// Migrazioni correttive incluse nello script mostrato dall'app, in ordine.
const SOURCES = [
  'supabase/migrations/013_fix_schema_drift.sql',
  'supabase/migrations/014_fix_rls_enum_trigger.sql',
  'supabase/migrations/015_stato_consegnato.sql',
  'supabase/migrations/016_movimenti_minimale.sql',
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
