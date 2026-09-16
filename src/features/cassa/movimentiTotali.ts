import type { Movimento, MovimentoTipo } from '@/types/database';

// Segno di ciascun tipo di movimento (usato sia da CassaPage per i totali
// riga/periodo, sia dalla Home per "Spese officina"): tenerlo qui, in un
// modulo senza componenti, evita di dover importare tutta CassaPage nella
// Home solo per questo calcolo (altrimenti finisce nel bundle principale
// invece che nel chunk lazy della Cassa).
export const SEGNO: Record<MovimentoTipo, 1 | -1> = {
  incasso_extra: 1,
  spesa_officina: -1,
  spesa_titolare: -1,
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

export const incassoMovimento = (m: Movimento): number =>
  TIPI_CON_SPESE_LAVORAZIONE.includes(m.tipo)
    ? Number(m.importo)
    : SEGNO[m.tipo] === 1 ? Number(m.importo) : 0;

export const spesaMovimento = (m: Movimento): number =>
  TIPI_CON_SPESE_LAVORAZIONE.includes(m.tipo)
    ? Number(m.spese_lavorazione) || 0
    : SEGNO[m.tipo] === -1 ? Number(m.importo) : 0;
