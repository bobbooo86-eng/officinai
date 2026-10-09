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
  | 'annullato'
  // Segnaposto creato automaticamente al salvataggio di un nuovo preventivo
  // (la riga in appuntamenti e' obbligatoria per il vincolo di chiave
  // esterna di preventivi.appuntamento_id): non e' un appuntamento reale
  // finche' "Conferma appuntamento" non lo trasforma in 'prenotato' con
  // data, ora e lavorazione vere. Va escluso da agenda, calendario,
  // dashboard e ricerca.
  | 'bozza_preventivo';

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
  // Saldo di partenza per ciascun fornitore di ricambi, per far iniziare il
  // conto fornitori da un debito/credito gia' esistente invece che da zero.
  saldi_fornitori_ricambi?: { autoricambi?: number; monti?: number } | null;
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
  codice_fiscale?: string | null;
  indirizzo?: string | null;
  note?: string | null;
  // "Elimina" archivia (attivo: false) invece di cancellare davvero: quasi
  // ogni cliente ha appuntamenti/recensioni collegati senza CASCADE, e la
  // cancellazione vera perderebbe lo storico. Ripristinabile.
  attivo?: boolean;
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
  foto_libretto_url?: string | null;
  created_at?: string;
}

export type PagamentoStato = 'pagato' | 'acconto' | 'non_pagato';

export interface PagamentoInfo {
  stato: PagamentoStato;
  importo_pagato?: number;   // per acconto: quanto ha gia pagato
  importo_totale?: number;   // importo totale da pagare
  costo_ricambi?: number;    // costo dei ricambi usati, per calcolare il guadagno netto
  // Tre stati possibili per il costo ricambi (mutuamente esclusivi):
  // - nessuno dei due flag: si paga a blocchi dopo (resta a debito sul conto fornitore)
  // - ricambi_pagati_subito: li ha pagati subito l'officina stessa (es. sfascio in contanti) -> conta come spesa, non resta a debito, ma l'incassato dal cliente resta intero (il cliente paga comunque il prezzo pieno all'officina)
  // - fornitore_pagato_da_cliente: il cliente paga il fornitore direttamente (es. Monti) -> l'officina non incassa quella parte (va sottratta dall'incassato), non conta come spesa (l'officina non ha speso nulla), non resta a debito
  ricambi_pagati_subito?: boolean;
  fornitore_pagato_da_cliente?: boolean;
  fornitore_ricambi?: 'autoricambi' | 'monti' | null; // da chi vengono i ricambi di questa consegna, per tenere il conto di quanto si deve ancora a ciascun fornitore
  data_consegna?: string;    // quando e' stata confermata la consegna: appuntamenti non ha altrimenti una data di consegna, solo data_ora (la data prenotata)
  note?: string;
  operaio?: string;          // nome di chi ha eseguito il lavoro sull'auto
}

// Acconto preso mentre l'auto e' ancora in lavorazione, prima della
// consegna finale (quando viene scritto pagamento). Ogni acconto genera
// anche un movimento "incasso_extra" in Cassa datato data_acconto, cosi'
// conta nel resoconto del giorno in cui e' stato davvero incassato invece
// che accumularsi tutto sul giorno della consegna.
export interface Acconto {
  data_acconto: string;
  importo: number;
  movimento_id?: string;
  nota?: string;
}

// Ricambi comprati mentre l'auto e' ancora in lavorazione, prima della
// consegna finale. Ogni acquisto genera anche un movimento "spesa_officina"
// in Cassa datato data_acquisto, cosi' conta come spesa sul resoconto del
// giorno vero in cui e' stato comprato, e resta visibile sulla scheda
// dell'auto come promemoria di cosa e' stato preso per quel mezzo.
export interface RicambioAcquistato {
  data_acquisto: string;
  importo: number;
  descrizione?: string;
  movimento_id?: string;
  // Se non vale la pena di conti come spesa (es. il costo e' gia' incluso
  // altrove, o lo paga di tasca sua il collaboratore esterno): assente o
  // true per tutte le voci salvate prima di questo campo, che contavano
  // sempre come spesa.
  conta_come_spesa?: boolean;
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
  acconti?: Acconto[] | null;
  ricambi_acquistati?: RicambioAcquistato[] | null;
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
  lavorazioni_tipiche?: string[];
  lavorazioni_da_eseguire?: string;
  nome_operaio?: string;
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
  // Quanto il cliente deve lasciare l'auto in officina (testo libero,
  // es. "1 giorno"). Va anche nel documento inviato al cliente.
  fermo_macchina?: string;
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
  | 'spesa_affitto'
  | 'spesa_autoricambi'
  | 'spesa_monti'
  | 'anticipo_dipendente'
  | 'spesa_dipendente'
  | 'spesa_revisione_gianni'
  | 'spesa_centraline_daniele'
  | 'costo_lavorazione'
  | 'spesa_lavorazione';

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
  // Spese sostenute dall'officina per la lavorazione, distinte da "importo"
  // (quanto pagato al collaboratore esterno): solo per Revisione (Gianni)
  // e Centraline (Daniele).
  spese_lavorazione?: number | null;
  // Una Revisione (Gianni) / Centraline (Daniele) puo' iniziare "in
  // lavorazione" (solo la descrizione, es. "scatola sterzo", importo e
  // spese_lavorazione non ancora noti) e completarsi dopo, quando si
  // conoscono i numeri finali. Null/assente per tutti gli altri tipi di
  // movimento, che non hanno mai questo stato intermedio.
  stato?: 'in_lavorazione' | 'completato' | null;
  // Ricambi comprati mentre la lavorazione e' ancora in corso: ognuno
  // genera anche un movimento "spesa_officina" a parte, datato al giorno
  // vero dell'acquisto (stesso meccanismo di appuntamenti.ricambi_acquistati).
  ricambi_acquistati?: RicambioAcquistato[] | null;
  // Costo ricambi complessivo della lavorazione (solo Revisione Gianni/
  // Centraline Daniele), con lo stesso quadratino "conta come spesa" di
  // una consegna auto: resta solo informativo finche' non lo spunti.
  costo_ricambi?: number | null;
  ricambi_pagati_subito?: boolean;
  created_at?: string;
  // Relations (joined)
  dipendente?: Utente | null;
}

// Acquisto registrato a mano sul conto di un fornitore di ricambi, non
// legato a nessuna consegna specifica (es. un pezzo comprato per
// magazzino): alza il debito verso quel fornitore.
export interface AcquistoFornitoreRicambi {
  id: string;
  officina_id: string;
  fornitore: 'autoricambi' | 'monti';
  descrizione: string;
  importo: number;
  data: string;
  created_at?: string;
}
