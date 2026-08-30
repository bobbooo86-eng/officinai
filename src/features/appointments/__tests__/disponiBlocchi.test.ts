import { describe, it, expect } from 'vitest';
import { disponiBlocchi } from '../CalendarView';
import type { Appuntamento } from '@/types/database';

// La griglia parte dalle 07:00 e ogni ora vale 56px.
const ALTEZZA_ORA = 56;

// Le date sono costruite dai componenti locali, cosi' il test non dipende
// dal fuso orario in cui gira.
const app = (id: string, ora: number, minuti = 0): Appuntamento =>
  ({
    id,
    data_ora: new Date(2026, 7, 30, ora, minuti).toISOString(),
  }) as Appuntamento;

const topAttesoPerOra = (ora: number, minuti = 0) =>
  ((ora * 60 + minuti - 7 * 60) / 60) * ALTEZZA_ORA;

describe('disponiBlocchi', () => {
  it('posiziona un appuntamento in base al suo orario', () => {
    const [b] = disponiBlocchi([app('a', 9)]);
    expect(b.top).toBe(topAttesoPerOra(9));
    expect(b.altezza).toBe(ALTEZZA_ORA);
    expect(b.colonneTotali).toBe(1);
  });

  it('tiene conto dei minuti', () => {
    const [b] = disponiBlocchi([app('a', 10, 30)]);
    expect(b.top).toBe(topAttesoPerOra(10, 30));
  });

  it('affianca due appuntamenti alla stessa ora invece di sovrapporli', () => {
    const blocchi = disponiBlocchi([app('a', 10), app('b', 10)]);
    expect(blocchi).toHaveLength(2);
    expect(blocchi.every((b) => b.colonneTotali === 2)).toBe(true);
    expect(blocchi.map((b) => b.colonna).sort()).toEqual([0, 1]);
  });

  it('lascia larghezza piena a orari che non si sovrappongono', () => {
    const blocchi = disponiBlocchi([app('a', 9), app('b', 11)]);
    expect(blocchi.every((b) => b.colonneTotali === 1)).toBe(true);
  });

  it('considera sovrapposti due appuntamenti a mezz ora di distanza', () => {
    // Con durata di un'ora, 10:00 e 10:30 si accavallano.
    const blocchi = disponiBlocchi([app('a', 10), app('b', 10, 30)]);
    expect(blocchi.every((b) => b.colonneTotali === 2)).toBe(true);
  });

  it('non sovrappone appuntamenti consecutivi esatti', () => {
    const blocchi = disponiBlocchi([app('a', 10), app('b', 11)]);
    expect(blocchi.every((b) => b.colonneTotali === 1)).toBe(true);
  });

  it('riusa una corsia libera dentro lo stesso gruppo', () => {
    // a 10:00-11:00 e b 10:30-11:30 occupano due corsie; c alle 11:00 puo'
    // tornare nella corsia di a, che nel frattempo si e' liberata.
    const blocchi = disponiBlocchi([app('a', 10), app('b', 10, 30), app('c', 11)]);
    const perId = Object.fromEntries(blocchi.map((b) => [b.app.id, b]));
    expect(perId.c.colonna).toBe(perId.a.colonna);
    expect(perId.b.colonna).not.toBe(perId.a.colonna);
  });

  it('riporta dentro la griglia gli orari fuori fascia', () => {
    const presto = disponiBlocchi([app('a', 5)])[0];
    expect(presto.top).toBe(0);

    const tardi = disponiBlocchi([app('b', 23)])[0];
    // L'ultimo blocco inizia un'ora prima della fine della griglia (21:00).
    expect(tardi.top).toBe(topAttesoPerOra(20));
  });

  it('restituisce un elenco vuoto senza appuntamenti', () => {
    expect(disponiBlocchi([])).toEqual([]);
  });
});
