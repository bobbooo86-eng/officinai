import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del client Supabase: registra i payload ricevuti e restituisce
// gli errori programmati, per simulare uno schema piu' vecchio del codice.
const calls: Record<string, unknown>[] = [];
let errorQueue: ({ message: string } | null)[] = [];

let returnRow: unknown = { id: 'row-1' };

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        calls.push(payload);
        const error = errorQueue.shift() ?? null;
        const result = { data: error ? null : returnRow, error };
        return Object.assign(Promise.resolve({ error }), {
          select: () => ({ single: () => Promise.resolve(result) }),
        });
      },
      update: (payload: Record<string, unknown>) => ({
        eq: () => {
          calls.push(payload);
          return Promise.resolve({ error: errorQueue.shift() ?? null });
        },
      }),
    }),
  },
}));

const { insertTolerant, updateTolerant, isMissingTable } = await import('../resilientDb');

const missingCol = (c: string, t: string) => ({
  message: `Could not find the '${c}' column of '${t}' in the schema cache`,
});

beforeEach(() => {
  calls.length = 0;
  errorQueue = [];
});

describe('insertTolerant', () => {
  it('salva normalmente quando lo schema e completo', async () => {
    const { error, skipped } = await insertTolerant('magazzino', { nome: 'Filtro', prezzo_acq: 10 });
    expect(error).toBeNull();
    expect(skipped).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('riprova senza la colonna mancante e riesce', async () => {
    errorQueue = [missingCol('prezzo_acq', 'magazzino'), null];
    const { error, skipped } = await insertTolerant('magazzino', {
      nome: 'Filtro',
      prezzo_acq: 10,
      quantita: 3,
    });
    expect(error).toBeNull();
    expect(skipped).toEqual(['prezzo_acq']);
    expect(calls[1]).toEqual({ nome: 'Filtro', quantita: 3 });
  });

  it('scarta piu colonne mancanti in sequenza', async () => {
    errorQueue = [missingCol('prezzo_acq', 'magazzino'), missingCol('prezzo_vend', 'magazzino'), null];
    const { error, skipped } = await insertTolerant('magazzino', {
      nome: 'Filtro',
      prezzo_acq: 10,
      prezzo_vend: 20,
    });
    expect(error).toBeNull();
    expect(skipped).toEqual(['prezzo_acq', 'prezzo_vend']);
    expect(calls[2]).toEqual({ nome: 'Filtro' });
  });

  it('non scarta le colonne obbligatorie', async () => {
    errorQueue = [missingCol('officina_id', 'magazzino')];
    const { error } = await insertTolerant('magazzino', { officina_id: 'x', nome: 'Filtro' }, [
      'officina_id',
    ]);
    expect(error).not.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('restituisce l errore se la tabella non esiste', async () => {
    errorQueue = [{ message: "Could not find the table 'public.movimenti' in the schema cache" }];
    const { error } = await insertTolerant('movimenti', { importo: 5 });
    expect(error).not.toBeNull();
    expect(isMissingTable(error)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('con returning restituisce la riga inserita', async () => {
    returnRow = { id: 'cliente-9', nome: 'Mario' };
    const { error, data } = await insertTolerant<{ id: string; nome: string }>(
      'clienti',
      { nome: 'Mario' },
      ['nome'],
      { returning: true }
    );
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'cliente-9', nome: 'Mario' });
  });

  it('con returning riprova senza la colonna mancante e restituisce la riga', async () => {
    returnRow = { id: 'cliente-10', nome: 'Mario' };
    errorQueue = [missingCol('codice_fiscale', 'clienti'), null];
    const { error, data, skipped } = await insertTolerant<{ id: string }>(
      'clienti',
      { nome: 'Mario', codice_fiscale: 'ABC' },
      ['nome'],
      { returning: true }
    );
    expect(error).toBeNull();
    expect(skipped).toEqual(['codice_fiscale']);
    expect(data).toEqual({ id: 'cliente-10', nome: 'Mario' });
    expect(calls[1]).toEqual({ nome: 'Mario' });
  });

  it('propaga errori non legati allo schema senza riprovare', async () => {
    errorQueue = [{ message: 'new row violates row-level security policy' }];
    const { error } = await insertTolerant('magazzino', { nome: 'Filtro' });
    expect(error?.message).toContain('row-level security');
    expect(calls).toHaveLength(1);
  });
});

describe('updateTolerant', () => {
  it('riprova senza la colonna mancante', async () => {
    errorQueue = [missingCol('prezzo_vend', 'magazzino'), null];
    const { error, skipped } = await updateTolerant(
      'magazzino',
      { nome: 'Filtro', prezzo_vend: 20 },
      { column: 'id', value: 'abc' }
    );
    expect(error).toBeNull();
    expect(skipped).toEqual(['prezzo_vend']);
    expect(calls[1]).toEqual({ nome: 'Filtro' });
  });
});

describe('isMissingTable', () => {
  it('distingue tabella mancante da colonna mancante', () => {
    expect(isMissingTable({ message: "Could not find the table 'public.movimenti' in the schema cache" })).toBe(true);
    expect(isMissingTable(missingCol('prezzo_acq', 'magazzino'))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });

  it('riconosce anche il messaggio di Postgres', () => {
    expect(isMissingTable({ message: 'relation "public.movimenti" does not exist' })).toBe(true);
  });

  it('riconosce i codici di errore, qualunque sia il messaggio', () => {
    expect(isMissingTable({ message: 'errore generico', code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ message: 'errore generico', code: '42P01' })).toBe(true);
    expect(isMissingTable({ message: 'errore generico', code: '23505' })).toBe(false);
  });
});
