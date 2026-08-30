// Rigenera src/lib/dbRepairSql.ts dal file di migrazione, cosi' che lo script
// mostrato dall'app resti allineato a quello versionato nel repository.
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'supabase/migrations/013_fix_schema_drift.sql';
const TARGET = 'src/lib/dbRepairSql.ts';

const sql = readFileSync(SOURCE, 'utf8');

const header = `// FILE GENERATO AUTOMATICAMENTE - non modificare a mano.
// Sorgente: ${SOURCE}
// Rigenera con: npm run gen:db-repair
//
// Contiene lo script SQL di riparazione dello schema, cosi' che l'app possa
// proporlo con un tasto "copia" quando rileva che il database e' disallineato.

export const DB_REPAIR_SQL = `;

writeFileSync(TARGET, header + JSON.stringify(sql) + ';\n');
console.log(`${TARGET} rigenerato (${sql.length} caratteri).`);
