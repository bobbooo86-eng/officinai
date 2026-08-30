import { describe, it, expect, beforeEach } from 'vitest';
import {
  aggiornaLocale, aggiungiLocale, isLocale, leggiLocali, perSupabase, rimuoviLocale, svuotaLocali,
} from '../cassaLocale';
import type { Movimento } from '@/types/database';

const OFF = 'officina-1';
const ALTRA = 'officina-2';

const dati = (over: Partial<Movimento> = {}) =>
  ({
    officina_id: OFF,
    tipo: 'incasso_extra',
    importo: 50,
    descrizione: 'Lavaggio',
    metodo_pagamento: 'contanti',
    data: '2026-08-30',
    dipendente_id: null,
    created_by: null,
    note: null,
    ...over,
  }) as Omit<Movimento, 'id' | 'created_at'>;

beforeEach(() => {
  localStorage.clear();
});

describe('archivio locale della cassa', () => {
  it('parte vuoto', () => {
    expect(leggiLocali(OFF)).toEqual([]);
  });

  it('conserva un movimento aggiunto', () => {
    const creato = aggiungiLocale(OFF, dati());
    const letti = leggiLocali(OFF);
    expect(letti).toHaveLength(1);
    expect(letti[0].id).toBe(creato.id);
    expect(letti[0].descrizione).toBe('Lavaggio');
  });

  it('assegna un id e una data di creazione', () => {
    const creato = aggiungiLocale(OFF, dati());
    expect(creato.id).toBeTruthy();
    expect(Number.isNaN(Date.parse(creato.created_at as string))).toBe(false);
  });

  it('marca i movimenti come locali', () => {
    const creato = aggiungiLocale(OFF, dati());
    expect(isLocale(creato)).toBe(true);
    expect(isLocale({ id: 'x' } as Movimento)).toBe(false);
  });

  it('mette per primo il movimento piu recente', () => {
    aggiungiLocale(OFF, dati({ descrizione: 'primo' }));
    aggiungiLocale(OFF, dati({ descrizione: 'secondo' }));
    expect(leggiLocali(OFF).map((m) => m.descrizione)).toEqual(['secondo', 'primo']);
  });

  it('tiene separate le officine', () => {
    aggiungiLocale(OFF, dati());
    expect(leggiLocali(ALTRA)).toEqual([]);
    expect(leggiLocali(OFF)).toHaveLength(1);
  });

  it('aggiorna un movimento esistente mantenendo id e marcatore', () => {
    const creato = aggiungiLocale(OFF, dati({ descrizione: 'vecchia', importo: 50 }));
    aggiornaLocale(OFF, creato.id, { descrizione: 'nuova', importo: 80 });
    const [letto] = leggiLocali(OFF);
    expect(letto.id).toBe(creato.id);
    expect(letto.descrizione).toBe('nuova');
    expect(letto.importo).toBe(80);
    expect(isLocale(letto)).toBe(true);
  });

  it('aggiorna solo il movimento indicato', () => {
    const a = aggiungiLocale(OFF, dati({ descrizione: 'a' }));
    aggiungiLocale(OFF, dati({ descrizione: 'b' }));
    aggiornaLocale(OFF, a.id, { descrizione: 'modificato' });
    const descrizioni = leggiLocali(OFF).map((m) => m.descrizione).sort();
    expect(descrizioni).toEqual(['b', 'modificato']);
  });

  it('rimuove un singolo movimento lasciando gli altri', () => {
    const a = aggiungiLocale(OFF, dati({ descrizione: 'a' }));
    aggiungiLocale(OFF, dati({ descrizione: 'b' }));
    rimuoviLocale(OFF, a.id);
    expect(leggiLocali(OFF).map((m) => m.descrizione)).toEqual(['b']);
  });

  it('svuota solo l officina indicata', () => {
    aggiungiLocale(OFF, dati());
    aggiungiLocale(ALTRA, dati({ officina_id: ALTRA }));
    svuotaLocali(OFF);
    expect(leggiLocali(OFF)).toEqual([]);
    expect(leggiLocali(ALTRA)).toHaveLength(1);
  });

  it('non perde i dati se il contenuto salvato e corrotto', () => {
    localStorage.setItem(`officinai:movimenti-locali:${OFF}`, 'non-json');
    expect(leggiLocali(OFF)).toEqual([]);
  });

  it('toglie il marcatore locale prima di inviare a Supabase', () => {
    const creato = aggiungiLocale(OFF, dati());
    const payload = perSupabase(creato);
    expect(payload).not.toHaveProperty('locale');
    expect(payload).not.toHaveProperty('dipendente');
    // I campi che il database deve ricevere restano tutti.
    expect(payload.officina_id).toBe(OFF);
    expect(payload.importo).toBe(50);
    expect(payload.id).toBe(creato.id);
  });
});
