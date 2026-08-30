// Il fuso va impostato prima di importare il modulo sotto test, cosi' le
// operazioni su Date usano l'ora italiana come sull'app in produzione.
process.env.TZ = 'Europe/Rome';

import { describe, it, expect, vi, afterEach } from 'vitest';
import { dayKey, todayKey } from '../format';

afterEach(() => {
  vi.useRealTimers();
});

describe('dayKey', () => {
  it('usa la data locale, non quella UTC', () => {
    // 00:30 del 30 agosto in Italia sono le 22:30 del 29 in UTC: prendere i
    // primi 10 caratteri dell'ISO string classificava l'appuntamento nel
    // giorno sbagliato e lo faceva sparire dal calendario.
    const istante = '2026-08-29T22:30:00+00:00';
    expect(new Date(istante).toISOString().slice(0, 10)).toBe('2026-08-29');
    expect(dayKey(istante)).toBe('2026-08-30');
  });

  it('resta sullo stesso giorno per un orario diurno', () => {
    expect(dayKey('2026-08-29T19:40:00+00:00')).toBe('2026-08-29');
  });

  it('accetta anche un oggetto Date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('gestisce il cambio di anno', () => {
    expect(dayKey('2025-12-31T23:30:00+01:00')).toBe('2025-12-31');
    expect(dayKey('2026-01-01T00:30:00+01:00')).toBe('2026-01-01');
  });

  it('restituisce stringa vuota per una data non valida', () => {
    expect(dayKey('non-una-data')).toBe('');
  });
});

describe('todayKey', () => {
  it('resta sul giorno locale anche a notte fonda', () => {
    // In Italia le 00:30 sono ancora il giorno precedente in UTC: la Home
    // mostrava gli appuntamenti di ieri come quelli di oggi.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T22:30:00Z'));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-08-29');
    expect(todayKey()).toBe('2026-08-30');
  });

  it('coincide con dayKey della data corrente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00Z'));
    expect(todayKey()).toBe(dayKey(new Date()));
  });
});
