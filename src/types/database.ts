// ============================================
// OfficinAI Database Types (matching Supabase schema)
// ============================================

export type AppuntamentoStato =
  | 'richiesta'
  | 'prenotato'
  | 'in_diagnosi'
  | 'in_lavorazione'
  | 'attesa_ricambi'
  | 'pronto'
  | 'consegnato'
  | 'annullato';

export type PreventivoStato = 'bozza' | 'inviato' | 'accettato' | 'rifiutato';

export type UserRole = 'titolare' | 'operaio' | 'reception';

export type FotoCategoria =
  | 'prima'
  | 'durante'
  | 'dopo'
  | 'difetto'
  | 'ricambio';

export type DifettoGravita = 'bassa' | 'media' | 'alta' | 'critica';

// ---- Core Tables ----

export interface Officina {
  id: string;
  nome: string;
  indirizzo: string;
  tel: string;
  email: string;
  p_iva: string;
  logo_url?: string | null;
  servizi?: { id: string; label: string }[];
  orari_apertura?: { giorno: string; attivo: boolean; apertura: string; chiusura: string }[];
  piano: string;
  created_at?: string;
}

export interface Utente {
  id: string;
  officina_id: string;
  nome: string;
  email: string;
  tel: string;
  ruolo: UserRole;
  attivo: boolean;
  created_at?: string;
}

export interface Cliente {
  id: string;
  officina_id: string;
  nome: string;
  email: string;
  tel: string;
  note?: string;
  created_at?: string;
}

export interface Veicolo {
  id: string;
  cliente_id: string;
  marca: string;
  modello: string;
  targa: string;
  anno: number;
  km: number;
  carburante: string;
  scadenze?: {
    revisione?: string;
    assicurazione?: string;
    tagliando?: string;
    bollo?: string;
  };
  created_at?: string;
}

export type PagamentoStato = 'pagato' | 'acconto' | 'non_pagato';

export interface PagamentoInfo {
  stato: PagamentoStato;
  importo_pagato?: number;   // per acconto: quanto ha gia pagato
  importo_totale?: number;   // importo totale da pagare
  note?: string;
}

export interface Appuntamento {
  id: string;
  officina_id: string;
  cliente_id: string;
  veicolo_id: string;
  tecnico_id?: string;
  data_ora: string;
  stato: AppuntamentoStato;
  priorita: string;
  problema: string;
  operazioni?: string;
  codici_obd?: string;
  data_proposta?: string;
  nota_officina?: string;
  pagamento?: PagamentoInfo | null;
  created_at?: string;
  // Relations (joined)
  clienti?: Cliente;
  veicoli?: Veicolo;
}

export interface FoglioLavoro {
  id: string;
  appuntamento_id: string;
  tecnico_id: string;
  inizio?: string;
  fine?: string;
  tempo_lavoro_ms: number;
  pause: number;
  km_uscita?: number;
  note_finali?: string;
  chiuso: boolean;
  firma_operaio?: string;
  costo_manodopera?: number;
  tariffa_oraria?: number;
  created_at?: string;
}

export interface RicambioUsato {
  id: string;
  foglio_lavoro_id: string;
  nome: string;
  codice?: string;
  quantita: number;
  stato_rimosso?: string;
  prezzo: number;
  tipo: 'nuovo' | 'usato' | 'consumabile';
  created_at?: string;
}

export interface Difetto {
  id: string;
  foglio_lavoro_id: string;
  descrizione: string;
  gravita: DifettoGravita;
  consigliato?: string;
  risolto: boolean;
  created_at?: string;
}

export interface Foto {
  id: string;
  appuntamento_id: string;
  categoria: FotoCategoria;
  url: string;
  descrizione?: string;
  visibile_cliente: boolean;
  tecnico_id?: string;
  created_at?: string;
}

// ---- Business Tables ----

export interface PreventivoRiga {
  tipo: 'manodopera' | 'ricambio';
  desc: string;
  qta: number;
  prezzo: number;
}

export interface Preventivo {
  id: string;
  appuntamento_id: string;
  righe: PreventivoRiga[];
  subtotale: number;
  sconto: number;
  iva: number;
  totale: number;
  stato: PreventivoStato;
  created_at?: string;
}

export interface Messaggio {
  id: string;
  appuntamento_id: string;
  da: string;
  testo: string;
  letto: boolean;
  created_at: string;
}

export interface Magazzino {
  id: string;
  officina_id: string;
  nome: string;
  codice: string;
  categoria: string;
  quantita: number;
  quantita_minima: number;
  prezzo_acq: number;
  prezzo_vend: number;
  created_at?: string;
}

export interface NotificaWA {
  id: string;
  officina_id: string;
  cliente_id: string;
  tipo: string;
  testo: string;
  stato: string;
  tel_destinatario: string;
  created_at?: string;
}

export interface CasoAI {
  id: string;
  officina_id: string;
  codici_obd: string;
  problema: string;
  soluzione: string;
  costo: number;
  condiviso: boolean;
  created_at?: string;
}

export interface Accettazione {
  id: string;
  appuntamento_id: string;
  km_ingresso: number;
  livello_carburante: number;
  danni: { x: number; y: number; tipo: string; nota: string }[];
  checklist: Record<string, boolean>;
  oggetti_personali: string;
  note_accettazione: string;
  firma_cliente: string | null;
  created_at: string;
}

export interface ScansioneOBD {
  id: string;
  officina_id: string;
  cliente_id: string;
  veicolo_id: string;
  codici: string[];
  km_scansione?: number;
  nota_cliente?: string;
  letto: boolean;
  gestito: boolean;
  created_at: string;
  // Relations (joined)
  clienti?: Cliente;
  veicoli?: Veicolo;
}

export interface Recensione {
  id: string;
  appuntamento_id: string;
  officina_id: string;
  cliente_id: string;
  voto: number;
  commento?: string;
  created_at?: string;
}

export type MovimentoTipo =
  | 'incasso_extra'
  | 'spesa_officina'
  | 'spesa_titolare'
  | 'anticipo_dipendente'
  | 'spesa_dipendente';

export type MetodoPagamento =
  | 'contanti'
  | 'carta'
  | 'bonifico'
  | 'paypal'
  | 'assegno'
  | 'altro';

export interface Movimento {
  id: string;
  officina_id: string;
  tipo: MovimentoTipo;
  importo: number;
  descrizione: string;
  metodo_pagamento?: MetodoPagamento | null;
  data: string;
  dipendente_id?: string | null;
  created_by?: string | null;
  note?: string | null;
  created_at?: string;
  // Relations (joined)
  dipendente?: Utente | null;
}
