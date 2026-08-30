import { supabase } from './supabase';

/**
 * Il database in produzione puo' avere uno schema piu' vecchio del codice
 * (colonne aggiunte da migrazioni non ancora applicate). PostgREST in quel
 * caso risponde PGRST204: "Could not find the 'X' column of 'Y' in the
 * schema cache" e l'intera operazione fallisce, anche se tutti gli altri
 * campi sarebbero salvabili.
 *
 * Queste helper riprovano l'operazione scartando la colonna segnalata,
 * cosi' il salvataggio va comunque a buon fine con i campi supportati
 * invece di fallire del tutto.
 */

const MISSING_COLUMN_RE = /Could not find the '([^']+)' column/i;

/** Estrae il nome della colonna mancante da un errore PostgREST, se e' quel tipo di errore. */
function missingColumn(error: { message?: string } | null): string | null {
  if (!error?.message) return null;
  const match = error.message.match(MISSING_COLUMN_RE);
  return match ? match[1] : null;
}

/** True se l'errore indica che l'intera tabella non esiste nello schema. */
export function isMissingTable(error: { message?: string } | null): boolean {
  return !!error?.message && /Could not find the table/i.test(error.message);
}

type Payload = Record<string, unknown>;
type DbError = { message: string } | null;

/**
 * Insert che riprova scartando le colonne non presenti nel database.
 * `required` elenca le colonne indispensabili: se una di queste manca,
 * l'errore viene restituito invece di proseguire con dati incompleti.
 * Con `opts.returning` restituisce anche la riga inserita.
 */
export async function insertTolerant<T = unknown>(
  table: string,
  payload: Payload,
  required: string[] = [],
  opts: { returning?: boolean } = {}
): Promise<{ error: DbError; skipped: string[]; data: T | null }> {
  const body: Payload = { ...payload };
  const skipped: string[] = [];

  // Al massimo un tentativo per colonna, piu' quello iniziale.
  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const query = supabase.from(table).insert(body);
    const { data, error } = opts.returning
      ? await query.select().single()
      : await query;
    if (!error) return { error: null, skipped, data: (data as T) ?? null };

    const col = missingColumn(error);
    if (!col || required.includes(col) || !(col in body)) {
      return { error, skipped, data: null };
    }
    delete body[col];
    skipped.push(col);
  }

  return { error: { message: 'Salvataggio non riuscito dopo piu tentativi.' }, skipped, data: null };
}

/** Update che riprova scartando le colonne non presenti nel database. */
export async function updateTolerant(
  table: string,
  payload: Payload,
  match: { column: string; value: string },
  required: string[] = []
): Promise<{ error: DbError; skipped: string[] }> {
  const body: Payload = { ...payload };
  const skipped: string[] = [];

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const { error } = await supabase.from(table).update(body).eq(match.column, match.value);
    if (!error) return { error: null, skipped };

    const col = missingColumn(error);
    if (!col || required.includes(col) || !(col in body)) {
      return { error, skipped };
    }
    delete body[col];
    skipped.push(col);
  }

  return { error: { message: 'Aggiornamento non riuscito dopo piu tentativi.' }, skipped };
}
