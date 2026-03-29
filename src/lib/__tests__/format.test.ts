import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fmtEuro, fmtDurata, fmtData, fmtOra, fmtDataOra } from '../format';

describe('fmtEuro', () => {
  it('formats a positive amount', () => {
    const result = fmtEuro(1234.56);
    // Italian locale uses comma for decimal, dot for thousands
    expect(result).toContain('€');
    // Locale may or may not include thousand separator depending on environment
    expect(result).toMatch(/1\.?234,56/);
  });

  it('formats zero', () => {
    const result = fmtEuro(0);
    expect(result).toContain('0,00');
    expect(result).toContain('€');
  });

  it('formats a negative amount', () => {
    const result = fmtEuro(-50);
    expect(result).toContain('50,00');
    expect(result).toContain('€');
    // Negative indicator (could be minus sign or parentheses depending on locale)
    expect(result).toMatch(/-|−/);
  });

  it('formats a small decimal amount', () => {
    const result = fmtEuro(0.99);
    expect(result).toContain('0,99');
  });
});

describe('fmtDurata', () => {
  it('formats zero milliseconds', () => {
    expect(fmtDurata(0)).toBe('00:00:00');
  });

  it('formats seconds only', () => {
    expect(fmtDurata(45000)).toBe('00:00:45');
  });

  it('formats minutes and seconds', () => {
    expect(fmtDurata(125000)).toBe('00:02:05');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(fmtDurata(3661000)).toBe('01:01:01');
  });

  it('formats large durations', () => {
    // 25 hours
    expect(fmtDurata(90000000)).toBe('25:00:00');
  });
});

describe('fmtData', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fix "today" to 2026-03-29
    dateSpy = vi.useFakeTimers();
    dateSpy.setSystemTime(new Date('2026-03-29T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Oggi" for today\'s date', () => {
    expect(fmtData('2026-03-29T10:00:00')).toBe('Oggi');
  });

  it('returns "Domani" for tomorrow\'s date', () => {
    expect(fmtData('2026-03-30T10:00:00')).toBe('Domani');
  });

  it('returns "Ieri" for yesterday\'s date', () => {
    expect(fmtData('2026-03-28T10:00:00')).toBe('Ieri');
  });

  it('returns formatted date for other dates', () => {
    const result = fmtData('2026-01-15T10:00:00');
    // Should include day and year, formatted in Italian
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('returns original string for invalid date', () => {
    expect(fmtData('not-a-date')).toBe('not-a-date');
  });
});

describe('fmtOra', () => {
  it('formats time in HH:mm', () => {
    expect(fmtOra('2026-03-29T14:30:00')).toBe('14:30');
  });

  it('formats midnight', () => {
    expect(fmtOra('2026-03-29T00:00:00')).toBe('00:00');
  });

  it('returns empty string for invalid input', () => {
    expect(fmtOra('not-a-date')).toBe('');
  });
});

describe('fmtDataOra', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('combines date and time', () => {
    const result = fmtDataOra('2026-03-29T14:30:00');
    expect(result).toBe('Oggi 14:30');
  });
});
