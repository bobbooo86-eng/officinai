// ---- Appointment States ----
export type AppuntamentoStato =
  | 'prenotato'
  | 'in_diagnosi'
  | 'in_lavorazione'
  | 'attesa_ricambi'
  | 'pronto';

export const STATO_CONFIG: Record<
  AppuntamentoStato,
  { label: string; color: string; bg: string; icon: string }
> = {
  prenotato: { label: 'Prenotato', color: '#6b7280', bg: '#f3f4f6', icon: '📅' },
  in_diagnosi: { label: 'In Diagnosi', color: '#f59e0b', bg: '#fef3c7', icon: '🔍' },
  in_lavorazione: { label: 'In Lavorazione', color: '#3b82f6', bg: '#dbeafe', icon: '🔧' },
  attesa_ricambi: { label: 'Attesa Ricambi', color: '#ef4444', bg: '#fee2e2', icon: '📦' },
  pronto: { label: 'Pronto', color: '#10b981', bg: '#d1fae5', icon: '✅' },
};

export const STATI_ORDINE: AppuntamentoStato[] = [
  'prenotato',
  'in_diagnosi',
  'in_lavorazione',
  'attesa_ricambi',
  'pronto',
];

// ---- Filter tabs for agenda ----
export const FILTER_TABS = [
  { key: 'tutti', label: 'Tutti' },
  { key: 'in_attesa', label: 'In Attesa' },
  { key: 'in_corso', label: 'In Corso' },
  { key: 'completato', label: 'Completato' },
] as const;

// ---- Branding ----
export const BRAND_BLUE = '#1e40af';
export const BRAND_BLUE_DARK = '#1e3a5f';

// ---- App ----
export const APP_VERSION = '1.0.0';
