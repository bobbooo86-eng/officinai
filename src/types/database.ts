// ============================================
// OfficinAI Database Types (matching Supabase schema)
// ============================================

export type AppuntamentoStato =
  | 'richiesta'
  | 'prenotato'
  | 'in_diagnosi'
  | 'in_lavorazione'
  | 'attesa_ricambi'
  | 'pronto';

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
