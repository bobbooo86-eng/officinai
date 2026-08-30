import type { AppuntamentoStato, DifettoGravita } from '@/types/database';

// ---- Appointment States ----
export const STATO_CONFIG: Record<AppuntamentoStato, { label: string; color: string; bg: string; icon: string }> = {
  richiesta: { label: 'Richiesta', color: '#8b5cf6', bg: '#ede9fe', icon: '🔔' },
  prenotato: { label: 'Prenotato', color: '#6b7280', bg: '#f3f4f6', icon: '📅' },
  in_diagnosi: { label: 'In Diagnosi', color: '#f59e0b', bg: '#fef3c7', icon: '🔍' },
  in_lavorazione: { label: 'In Lavorazione', color: '#3b82f6', bg: '#dbeafe', icon: '🔧' },
  attesa_ricambi: { label: 'Attesa Ricambi', color: '#ef4444', bg: '#fee2e2', icon: '📦' },
  pronto: { label: 'Pronto', color: '#10b981', bg: '#d1fae5', icon: '✅' },
  consegnato: { label: 'Consegnato', color: '#64748b', bg: '#f1f5f9', icon: '🏁' },
  annullato: { label: 'Annullato', color: '#6b7280', bg: '#f3f4f6', icon: '🚫' },
  bozza_preventivo: { label: 'In attesa di conferma', color: '#a855f7', bg: '#f3e8ff', icon: '📝' },
};

export const STATI_ORDINE: AppuntamentoStato[] = [
  'richiesta',
  'prenotato',
  'in_diagnosi',
  'in_lavorazione',
  'attesa_ricambi',
  'pronto',
  'consegnato',
];

// ---- Severity Levels ----
export const GRAVITA_CONFIG: Record<DifettoGravita, { label: string; color: string; bg: string }> = {
  bassa: { label: 'Bassa', color: '#10b981', bg: '#d1fae5' },
  media: { label: 'Media', color: '#f59e0b', bg: '#fef3c7' },
  alta: { label: 'Alta', color: '#ef4444', bg: '#fee2e2' },
  critica: { label: 'Critica', color: '#991b1b', bg: '#fecaca' },
};

// ---- Photo Categories ----
export const FOTO_CATEGORIE = [
  { value: 'prima', label: 'Prima' },
  { value: 'durante', label: 'Durante' },
  { value: 'dopo', label: 'Dopo' },
  { value: 'difetto', label: 'Difetto' },
  { value: 'ricambio', label: 'Ricambio' },
] as const;

// ---- Work Type Detection ----
export const TIPO_LAVORAZIONE: Record<string, { label: string; icon: string }> = {
  meccanica: { label: 'Meccanica', icon: '🔧' },
  gomme: { label: 'Gomme', icon: '🛞' },
  carrozzeria: { label: 'Carrozzeria', icon: '🎨' },
  tagliando: { label: 'Tagliando', icon: '🛢️' },
  elettronica: { label: 'Elettronica', icon: '⚡' },
  revisione: { label: 'Revisione', icon: '📋' },
  diagnosi: { label: 'Diagnosi', icon: '🔍' },
  clima: { label: 'Climatizzazione', icon: '❄️' },
};

export function detectTipoLavorazione(problema?: string | null): string {
  if (!problema) return 'meccanica';
  const p = problema.toLowerCase();
  if (/gomm[ea]|pneumatic|ruot[ea]/i.test(p)) return 'gomme';
  if (/carrozz|verniciatura|ammaccat|graffio/i.test(p)) return 'carrozzeria';
  if (/taglian|olio|filtro|candel/i.test(p)) return 'tagliando';
  if (/elettr|batteria|centralina|sensor/i.test(p)) return 'elettronica';
  if (/revision|collaudo/i.test(p)) return 'revisione';
  if (/diagnos|scanner|obd/i.test(p)) return 'diagnosi';
  if (/clima|condizionat|aria cond|compressor/i.test(p)) return 'clima';
  return 'meccanica';
}

// ---- Demo IDs ----
export const DEMO_OFFICINA_ID = '00000000-0000-0000-0000-000000000001';
