import type { Movimento } from '@/types/database';

/**
 * Archivio locale dei movimenti di cassa.
 *
 * Finche' la tabella `movimenti` non esiste sul database, la Cassa
 * salverebbe nulla e ogni inserimento andrebbe perso. Con questo archivio i
 * movimenti vengono conservati sul dispositivo e caricati automaticamente su
 * Supabase appena la tabella diventa disponibile.
 *
 * E' una soluzione di ripiego: i dati restano su questo dispositivo e su
 * questo browser finche' non vengono sincronizzati, quindi l'interfaccia deve
 * dirlo chiaramente all'utente.
 */

const chiave = (officinaId: string) => `officinai:movimenti-locali:${officinaId}`;

/** Movimento non ancora presente sul database. */
export type MovimentoLocale = Movimento & { locale: true };

export function isLocale(m: Movimento): boolean {
  return (m as Partial<MovimentoLocale>).locale === true;
}

function nuovoId(): string {
  // randomUUID non c'e' su browser datati o fuori da contesti sicuri.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function leggiLocali(officinaId: string): MovimentoLocale[] {
  try {
    const grezzo = localStorage.getItem(chiave(officinaId));
    if (!grezzo) return [];
    const dati = JSON.parse(grezzo);
    return Array.isArray(dati) ? (dati as MovimentoLocale[]) : [];
  } catch {
    // Storage non disponibile o contenuto corrotto: si riparte da vuoto
    // invece di far fallire il caricamento della pagina.
    return [];
  }
}

function scrivi(officinaId: string, movimenti: MovimentoLocale[]): void {
  try {
    localStorage.setItem(chiave(officinaId), JSON.stringify(movimenti));
  } catch {
    // Spazio esaurito o storage bloccato: non c'e' altro da fare qui,
    // il chiamante se ne accorge perche' l'elenco non cambia.
  }
}

/** Aggiunge un movimento all'archivio locale e restituisce la riga creata. */
export function aggiungiLocale(
  officinaId: string,
  dati: Omit<Movimento, 'id' | 'created_at'>
): MovimentoLocale {
  const movimento: MovimentoLocale = {
    ...dati,
    id: nuovoId(),
    created_at: new Date().toISOString(),
    locale: true,
  } as MovimentoLocale;
  scrivi(officinaId, [movimento, ...leggiLocali(officinaId)]);
  return movimento;
}

/** Aggiorna un movimento gia' presente nell'archivio locale. */
export function aggiornaLocale(
  officinaId: string,
  id: string,
  patch: Partial<Movimento>
): void {
  scrivi(
    officinaId,
    leggiLocali(officinaId).map((m) => (m.id === id ? { ...m, ...patch } : m))
  );
}

export function rimuoviLocale(officinaId: string, id: string): void {
  scrivi(
    officinaId,
    leggiLocali(officinaId).filter((m) => m.id !== id)
  );
}

export function svuotaLocali(officinaId: string): void {
  try {
    localStorage.removeItem(chiave(officinaId));
  } catch {
    // Ignorato: senza storage non c'e' nulla da svuotare.
  }
}

/** Prepara un movimento locale per l'inserimento su Supabase. */
export function perSupabase(m: MovimentoLocale): Record<string, unknown> {
  const { locale: _locale, dipendente, ...resto } = m as MovimentoLocale & {
    dipendente?: unknown;
  };
  void _locale;
  void dipendente;
  return resto;
}
