import type { Movimento, MovimentoTipo, PagamentoInfo } from '@/types/database';

// Segno di ciascun tipo di movimento (usato sia da CassaPage per i totali
// riga/periodo, sia dalla Home per "Spese officina"): tenerlo qui, in un
// modulo senza componenti, evita di dover importare tutta CassaPage nella
// Home solo per questo calcolo (altrimenti finisce nel bundle principale
// invece che nel chunk lazy della Cassa).
export const SEGNO: Record<MovimentoTipo, 1 | -1> = {
  incasso_extra: 1,
  spesa_officina: -1,
  spesa_titolare: -1,
  spesa_affitto: -1,
  spesa_autoricambi: -1,
  spesa_monti: -1,
  anticipo_dipendente: -1,
  spesa_dipendente: -1,
  spesa_revisione_gianni: -1,
  spesa_centraline_daniele: -1,
  costo_lavorazione: -1,
  spesa_lavorazione: -1,
};

// Revisione (Gianni) e Centraline (Daniele) registrano due movimenti di
// segno opposto in un solo inserimento: l'importo e' quanto ha pagato il
// cliente per il lavoro (un incasso), le "spese lavorazione" sono quanto si
// paga al collaboratore esterno (una spesa) — non e' un'unica spesa.
export const TIPI_CON_SPESE_LAVORAZIONE: MovimentoTipo[] = ['spesa_revisione_gianni', 'spesa_centraline_daniele'];

// Una Revisione (Gianni)/Centraline (Daniele) ancora "in lavorazione" non
// ha importi finali (si conoscono solo a fine lavoro): non conta ancora
// niente come incasso o spesa, solo i ricambi comprati nel frattempo
// contano (come movimenti "spesa_officina" a parte, gia' inclusi qui).
export const incassoMovimento = (m: Movimento): number => {
  if (m.stato === 'in_lavorazione') return 0;
  return TIPI_CON_SPESE_LAVORAZIONE.includes(m.tipo)
    ? Number(m.importo)
    : SEGNO[m.tipo] === 1 ? Number(m.importo) : 0;
};

export const spesaMovimento = (m: Movimento): number => {
  if (m.stato === 'in_lavorazione') return 0;
  if (TIPI_CON_SPESE_LAVORAZIONE.includes(m.tipo)) {
    // Default true: tutte le righe salvate prima di questo quadratino
    // contavano sempre come spesa, il comportamento resta lo stesso finche'
    // non lo si spunta via.
    return m.spese_lavorazione_conta !== false ? (Number(m.spese_lavorazione) || 0) : 0;
  }
  return SEGNO[m.tipo] === -1 ? Number(m.importo) : 0;
};

// Il costo ricambi su un appuntamento e' spesso solo informativo: i
// ricambisti vengono pagati a blocchi (es. 800€ tutti insieme), non pezzo
// per pezzo, e quella spesa si registra a parte come movimento
// "spesa_officina". Conta come spesa qui solo se segnato "pagati subito"
// (pagati sul momento dall'officina stessa, es. sfascio in contanti): se
// invece e' il cliente a pagare il fornitore direttamente, l'officina non
// ha speso nulla, quindi non e' una spesa (vedi incassato() per l'altro
// lato di quel caso: va sottratto dall'incassato, non dalle spese).
export const spesaRicambi = (p?: PagamentoInfo | null): number =>
  p?.ricambi_pagati_subito ? Number(p.costo_ricambi) || 0 : 0;

// Quando il cliente paga il fornitore dei ricambi direttamente (es. Monti),
// quell'importo finisce a lui, non in cassa: e' quello che va contato come
// "pagato" sul conto di quel fornitore, non il costo ricambi (che resta
// solo informativo per il margine). Quanto, esattamente, dipende da cosa
// aveva gia' incassato l'officina:
// - "Pagato completo": importo_pagato e' sempre uguale a importo_totale
//   (il modulo di consegna lo impone), quindi l'officina non ha incassato
//   nulla di suo — tutto l'importo e' finito al fornitore.
// - "Acconto": l'officina ha davvero incassato importo_pagato di suo
//   (es. un anticipo in contanti), solo il resto e' finito al fornitore.
// Vedi anche incassato()/restoDaIncassare() in IncassiOfficina, stessa logica.
export const creditoFornitoreDiretto = (p?: PagamentoInfo | null): number => {
  if (!p?.fornitore_pagato_da_cliente) return 0;
  if (p.stato === 'acconto') return Math.max(0, (p.importo_totale || 0) - (p.importo_pagato || 0));
  return p.importo_totale || 0;
};
