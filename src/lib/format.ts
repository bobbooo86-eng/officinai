import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns';
import { it } from 'date-fns/locale';

/**
 * Chiave giorno "YYYY-MM-DD" nel fuso locale.
 *
 * I timestamp arrivano da Postgres in UTC: prenderne i primi 10 caratteri, o
 * usare toISOString(), sbaglia giorno per gli orari a cavallo della mezzanotte
 * (in Italia le ore 00:00-02:00 locali sono ancora il giorno prima in UTC).
 */
export function dayKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Chiave del giorno corrente, nel fuso locale. */
export function todayKey(): string {
  return dayKey(new Date());
}

export function fmtData(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Oggi';
    if (isTomorrow(d)) return 'Domani';
    if (isYesterday(d)) return 'Ieri';
    return format(d, 'dd MMM yyyy', { locale: it });
  } catch {
    return dateStr;
  }
}

export function fmtOra(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'HH:mm');
  } catch {
    return '';
  }
}

export function fmtDataOra(dateStr: string): string {
  return `${fmtData(dateStr)} ${fmtOra(dateStr)}`;
}

export function fmtEuro(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function fmtDurata(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Usato ovunque un testo (nome cliente, problema segnalato, descrizione
// riga...) finisce dentro una stringa HTML costruita a mano per
// stampa/PDF/condivisione (PDFExport, PreventiviPage, AppointmentDetail,
// InvoicePage): quei testi arrivano anche da clienti non autenticati come
// staff (es. il campo "problema" della prenotazione online), quindi vanno
// sempre passati da qui prima di essere interpolati, o un cliente potrebbe
// far girare script nel contesto dell'app quando lo staff apre/stampa quel
// documento.
export function escapeHtml(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
