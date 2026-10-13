import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { TIPI_CON_SPESE_LAVORAZIONE, incassoMovimento } from './movimentiTotali';
import { DateField } from '@/components/DateField';
import { dayKey } from '@/lib/format';
import type { Appuntamento, Movimento } from '@/types/database';

// Formato "YYYY-MM-DD" in ora locale per l'input date: con toISOString()
// diretto la data mostrata potrebbe slittare di un giorno vicino alla
// mezzanotte per il fuso orario.
function dataInputValue(iso: string): string {
  const d = new Date(iso);
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Stato e azioni per modificare acconto/totale/costo ricambi/operaio di un
 * appuntamento consegnato. Estratto qui (invece che dentro IncassiOfficina)
 * cosi' anche Movimenti (CassaPage), che mostra le stesse consegne nella
 * lista "Tutti", puo' modificarle senza dover passare dalla sezione
 * separata "Incassi officina". */
export function usePagamentoEditor(onSalvato?: (id: string) => void) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPagato, setEditPagato] = useState('');
  const [editTotale, setEditTotale] = useState('');
  const [editRicambi, setEditRicambi] = useState('');
  const [editRicambiSubito, setEditRicambiSubito] = useState(false);
  const [editFornitorePagatoDaCliente, setEditFornitorePagatoDaCliente] = useState(false);
  const [editFornitoreRicambi, setEditFornitoreRicambi] = useState<'' | 'autoricambi' | 'monti'>('');
  const [editOperaio, setEditOperaio] = useState('');
  const [editData, setEditData] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);

  const apri = (a: Appuntamento) => {
    setEditingId(a.id);
    // "Pagato completo" aveva salvato solo il totale, senza mai valorizzare
    // l'incassato: qui lo ricostruisce (incassato = totale) per i pagamenti
    // vecchi, cosi' non va reinserito a mano ogni volta che si apre la matita.
    const pagatoDefault = a.pagamento?.stato === 'pagato'
      ? (a.pagamento?.importo_pagato ?? a.pagamento?.importo_totale ?? 0)
      : (a.pagamento?.importo_pagato ?? 0);
    setEditPagato(String(pagatoDefault));
    setEditTotale(String(a.pagamento?.importo_totale ?? 0));
    setEditRicambi(String(a.pagamento?.costo_ricambi ?? 0));
    setEditRicambiSubito(!!a.pagamento?.ricambi_pagati_subito);
    setEditFornitorePagatoDaCliente(!!a.pagamento?.fornitore_pagato_da_cliente);
    setEditFornitoreRicambi(a.pagamento?.fornitore_ricambi || '');
    setEditOperaio(a.pagamento?.operaio || '');
    setEditData(dataInputValue(a.pagamento?.data_consegna || a.data_ora));
  };

  const annulla = () => setEditingId(null);

  // Un acconto puo' crescere nel tempo (il cliente paga altro dopo la
  // consegna): incassato finora, totale da pagare, costo ricambi e nome
  // dell'operaio si modificano tutti insieme da qui. Se l'incassato
  // raggiunge il totale, il pagamento passa da solo a "pagato".
  const salva = async (a: Appuntamento) => {
    if (!a.pagamento) return;
    const nuovoPagato = parseFloat(editPagato) || 0;
    const nuovoTotale = parseFloat(editTotale) || 0;
    const nuovoRicambi = parseFloat(editRicambi) || 0;
    const saldato = nuovoTotale > 0 && nuovoPagato >= nuovoTotale;
    // Mezzogiorno locale (non mezzanotte) per evitare che il fuso orario
    // faccia slittare la data al giorno prima quando viene riletta.
    const nuovaDataConsegna = editData ? new Date(editData + 'T12:00:00').toISOString() : a.pagamento.data_consegna;
    const nuovoPagamento = {
      ...a.pagamento,
      importo_pagato: nuovoPagato,
      importo_totale: nuovoTotale,
      costo_ricambi: nuovoRicambi,
      ricambi_pagati_subito: editRicambiSubito,
      fornitore_pagato_da_cliente: editFornitorePagatoDaCliente,
      fornitore_ricambi: editFornitoreRicambi || null,
      operaio: editOperaio.trim() || undefined,
      data_consegna: nuovaDataConsegna,
      stato: saldato ? ('pagato' as const) : nuovoPagato > 0 ? ('acconto' as const) : ('non_pagato' as const),
    };
    setSalvando(a.id);
    const { error } = await supabase.from('appuntamenti').update({ pagamento: nuovoPagamento }).eq('id', a.id);
    setSalvando(null);
    if (error) { alert('Modifica non salvata: ' + error.message); return; }
    setEditingId(null);
    onSalvato?.(a.id);
  };

  return {
    editingId, editPagato, setEditPagato, editTotale, setEditTotale,
    editRicambi, setEditRicambi, editRicambiSubito, setEditRicambiSubito,
    editFornitorePagatoDaCliente, setEditFornitorePagatoDaCliente,
    editFornitoreRicambi, setEditFornitoreRicambi,
    editOperaio, setEditOperaio,
    editData, setEditData, salvando,
    apri, annulla, salva,
  };
}
export type PagamentoEditor = ReturnType<typeof usePagamentoEditor>;

/** Campi del pannello di modifica (acconto/totale/ricambi/operaio), sempre
 * gli stessi ovunque venga aperto: Incassi officina e Movimenti. */
export function PagamentoEditFields({ editor, appuntamento }: { editor: PagamentoEditor; appuntamento: Appuntamento }) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Incassato finora €</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={editor.editPagato}
            onChange={(e) => editor.setEditPagato(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Totale da pagare €</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={editor.editTotale}
            onChange={(e) => editor.setEditTotale(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Costo ricambi €</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={editor.editRicambi}
            onChange={(e) => editor.setEditRicambi(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-400 block">Fornitore ricambi</label>
        <select
          value={editor.editFornitoreRicambi}
          onChange={(e) => editor.setEditFornitoreRicambi(e.target.value as '' | 'autoricambi' | 'monti')}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Non segnato</option>
          <option value="autoricambi">Autoricambi</option>
          <option value="monti">Autodemolizioni Monti</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Operaio che ha fatto il lavoro</label>
          <input
            type="text"
            value={editor.editOperaio}
            onChange={(e) => editor.setEditOperaio(e.target.value)}
            placeholder="Nome operaio"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Data consegna</label>
          <input
            type="date"
            value={editor.editData}
            onChange={(e) => editor.setEditData(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => editor.salva(appuntamento)}
          disabled={editor.salvando === appuntamento.id}
          className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {editor.salvando === appuntamento.id ? 'Salvataggio...' : 'Salva'}
        </button>
        <button
          onClick={editor.annulla}
          disabled={editor.salvando === appuntamento.id}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

/** Stato e azioni per modificare una Revisione (Gianni)/Centraline (Daniele)
 * direttamente da qui, senza dover passare da Movimenti (CassaPage): solo i
 * campi utili per una correzione veloce (descrizione, cliente, importo,
 * spese lavorazione, data), non lo stato in_lavorazione/completato — quello
 * resta un passaggio da fare in Movimenti. */
export function useMovimentoLavorazioneEditor(onSalvato?: (id: string) => void) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescrizione, setEditDescrizione] = useState('');
  const [editClienteNome, setEditClienteNome] = useState('');
  const [editImporto, setEditImporto] = useState('');
  const [editSpeseLavorazione, setEditSpeseLavorazione] = useState('');
  const [editData, setEditData] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);

  const apri = (m: Movimento) => {
    setEditingId(m.id);
    setEditDescrizione(m.descrizione || '');
    setEditClienteNome(m.cliente_nome || '');
    setEditImporto(String(m.importo ?? 0));
    setEditSpeseLavorazione(m.spese_lavorazione != null ? String(m.spese_lavorazione) : '');
    setEditData(m.data);
  };

  const annulla = () => setEditingId(null);

  const salva = async (m: Movimento) => {
    const dati = {
      descrizione: editDescrizione.trim() || m.descrizione,
      cliente_nome: editClienteNome.trim() || null,
      importo: parseFloat(editImporto) || 0,
      spese_lavorazione: editSpeseLavorazione ? (parseFloat(editSpeseLavorazione) || 0) : null,
      data: editData || m.data,
    };
    setSalvando(m.id);
    const { error } = await supabase.from('movimenti').update(dati).eq('id', m.id);
    setSalvando(null);
    if (error) { alert('Modifica non salvata: ' + error.message); return; }
    setEditingId(null);
    onSalvato?.(m.id);
  };

  return {
    editingId, editDescrizione, setEditDescrizione, editClienteNome, setEditClienteNome,
    editImporto, setEditImporto, editSpeseLavorazione, setEditSpeseLavorazione,
    editData, setEditData, salvando, apri, annulla, salva,
  };
}
export type MovimentoLavorazioneEditor = ReturnType<typeof useMovimentoLavorazioneEditor>;

/** Campi del pannello di modifica di una Revisione (Gianni)/Centraline
 * (Daniele), riusabile ovunque serva (Incassi officina e, in futuro, altrove). */
export function MovimentoLavorazioneEditFields({ editor, movimento }: { editor: MovimentoLavorazioneEditor; movimento: Movimento }) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
      <div>
        <label className="text-[10px] text-gray-400 block">Descrizione</label>
        <input
          type="text"
          value={editor.editDescrizione}
          onChange={(e) => editor.setEditDescrizione(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-400 block">Cliente (opzionale)</label>
        <input
          type="text"
          value={editor.editClienteNome}
          onChange={(e) => editor.setEditClienteNome(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Incassato €</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={editor.editImporto}
            onChange={(e) => editor.setEditImporto(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Spese lavorazione €</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={editor.editSpeseLavorazione}
            onChange={(e) => editor.setEditSpeseLavorazione(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400 block">Data</label>
          <input
            type="date"
            value={editor.editData}
            onChange={(e) => editor.setEditData(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => editor.salva(movimento)}
          disabled={editor.salvando === movimento.id}
          className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {editor.salvando === movimento.id ? 'Salvataggio...' : 'Salva'}
        </button>
        <button
          onClick={editor.annulla}
          disabled={editor.salvando === movimento.id}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export type Periodo = 'giorno' | 'settimana' | 'mese' | 'anno';

/** Data di riferimento per il resoconto: quando e' stata confermata la
 * consegna, non la data prenotata dell'appuntamento (data_ora), che puo'
 * essere molto precedente. I record salvati prima di questo campo non
 * hanno data_consegna: si ripiega su data_ora per non perderli dai totali.
 * Esportata perche' Movimenti (CassaPage) riusa gli stessi incassi qui. */
export function dataIncasso(a: Appuntamento): Date {
  const iso = a.pagamento?.data_consegna || a.data_ora;
  return new Date(iso);
}

function inizioSettimana(d: Date): Date {
  const r = new Date(d);
  const giorno = (r.getDay() + 6) % 7; // 0 = lunedi
  r.setDate(r.getDate() - giorno);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function inPeriodo(d: Date, periodo: Periodo, riferimento: Date): boolean {
  if (periodo === 'giorno') {
    return d.toDateString() === riferimento.toDateString();
  }
  if (periodo === 'settimana') {
    const inizio = inizioSettimana(riferimento);
    const fine = new Date(inizio);
    fine.setDate(fine.getDate() + 7);
    return d >= inizio && d < fine;
  }
  if (periodo === 'mese') {
    return d.getFullYear() === riferimento.getFullYear() && d.getMonth() === riferimento.getMonth();
  }
  return d.getFullYear() === riferimento.getFullYear();
}

/** Quanto e' stato davvero incassato per questo veicolo: pagato completo
 * conta il totale, un acconto conta solo la parte gia' versata, il resto
 * (se c'e') non e' cassa finche' non arriva. Se il cliente ha pagato il
 * fornitore dei ricambi direttamente (es. Monti): su "pagato completo"
 * l'officina non ha incassato nulla di suo (importo_pagato e' sempre
 * uguale a importo_totale per costruzione, non e' un vero incasso); su
 * "acconto" invece importo_pagato e' un vero anticipo preso dall'officina,
 * solo il resto e' finito al fornitore — stessa logica di
 * creditoFornitoreDiretto() in movimentiTotali.ts.
 * Gli acconti presi prima della consegna (mentre l'auto era ancora in
 * lavorazione) sono gia' stati contati come movimenti a parte, datati al
 * giorno vero in cui sono arrivati: vanno tolti da qui, altrimenti alla
 * consegna finale verrebbero ricontati una seconda volta. */
export function incassato(a: Appuntamento): number {
  const p = a.pagamento;
  if (!p) return 0;
  const accontiPrecedenti = (a.acconti || []).reduce((s, acc) => s + Number(acc.importo), 0);
  const base = p.fornitore_pagato_da_cliente ? (p.stato === 'acconto' ? (p.importo_pagato || 0) : 0)
    : p.stato === 'pagato' ? (p.importo_totale || 0)
    : p.stato === 'acconto' ? (p.importo_pagato || 0)
    : 0;
  return Math.max(0, base - accontiPrecedenti);
}

/** Valore del lavoro fatturato al cliente, incassato o no: il guadagno
 * netto (valore - costo ricambi) e' il margine del lavoro svolto, non
 * cambia se il cliente ha gia' pagato o no — quello lo dice "Ancora da
 * incassare", che resta calcolato separatamente. */
export function valoreLavoro(a: Appuntamento): number {
  return a.pagamento?.importo_totale || 0;
}

/** Quanto resta ancora da farsi pagare per questo veicolo (acconto non
 * saldato o consegna non pagata): 0 se e' gia' tutto incassato. Stessa
 * rettifica di incassato(): se il cliente paga il fornitore dei ricambi
 * direttamente, tutto il resto non e' (e non sara' mai) da farsi pagare
 * dall'officina, lo riceve lui.
 * Esportata perche' Movimenti (CassaPage) la mostra sulla stessa riga. */
export function restoDaIncassare(a: Appuntamento): number {
  const p = a.pagamento;
  if (!p || p.fornitore_pagato_da_cliente) return 0;
  if (p.stato === 'acconto') return Math.max(0, (p.importo_totale || 0) - (p.importo_pagato || 0));
  if (p.stato === 'non_pagato') return p.importo_totale || 0;
  return 0;
}

export const PERIODI: { id: Periodo; label: string }[] = [
  { id: 'giorno', label: 'Oggi' },
  { id: 'settimana', label: 'Settimana' },
  { id: 'mese', label: 'Mese' },
  { id: 'anno', label: 'Anno' },
];

// movimenti.data e' una stringa "YYYY-MM-DD": va riletta come data locale
// (non UTC) o un giorno vicino alla mezzanotte finirebbe nel giorno sbagliato.
const dateFromDataStr = (s: string) => new Date(s + 'T00:00:00');

export interface PeriodoNavigabile {
  periodo: Periodo;
  riferimento: Date;
  rangeCustom: { inizio: string; fine: string } | null;
  mostraRangeForm: boolean;
  setMostraRangeForm: (value: boolean | ((prev: boolean) => boolean)) => void;
  rangeInizio: string;
  setRangeInizio: (s: string) => void;
  rangeFine: string;
  setRangeFine: (s: string) => void;
  inRangeSelezionato: (d: Date) => boolean;
  navigaPeriodo: (offset: number) => void;
  applicaRangeCustom: () => void;
  annullaRangeCustom: () => void;
  selezionaPeriodo: (p: Periodo) => void;
  tornaOggi: () => void;
  periodoLabel: string;
}

/** Periodo giorno/settimana/mese/anno navigabile avanti/indietro, o
 * sostituito da un intervallo di date scelto a mano — stesso meccanismo
 * gia' in uso su Movimenti e Incassi officina (CassaPage), estratto qui
 * cosi' un terzo/quarto punto (es. Analytics) non debba riscrivere la
 * stessa logica di sana pianta un'altra volta. */
export function usePeriodoNavigabile(periodoIniziale: Periodo = 'settimana'): PeriodoNavigabile {
  const [periodo, setPeriodo] = useState<Periodo>(periodoIniziale);
  const [riferimento, setRiferimento] = useState(() => new Date());
  const [rangeCustom, setRangeCustom] = useState<{ inizio: string; fine: string } | null>(null);
  const [mostraRangeForm, setMostraRangeForm] = useState(false);
  const [rangeInizio, setRangeInizio] = useState('');
  const [rangeFine, setRangeFine] = useState('');

  const inRangeSelezionato = useCallback(
    (d: Date) => {
      if (rangeCustom) {
        const k = dayKey(d);
        return k >= rangeCustom.inizio && k <= rangeCustom.fine;
      }
      return inPeriodo(d, periodo, riferimento);
    },
    [rangeCustom, periodo, riferimento]
  );

  const navigaPeriodo = (offset: number) => {
    setRangeCustom(null);
    setRiferimento((prev) => {
      const d = new Date(prev);
      if (periodo === 'giorno') d.setDate(d.getDate() + offset);
      else if (periodo === 'settimana') d.setDate(d.getDate() + offset * 7);
      else if (periodo === 'mese') d.setMonth(d.getMonth() + offset);
      else d.setFullYear(d.getFullYear() + offset);
      return d;
    });
  };

  const applicaRangeCustom = () => {
    if (!rangeInizio || !rangeFine) return;
    setRangeCustom(rangeInizio <= rangeFine ? { inizio: rangeInizio, fine: rangeFine } : { inizio: rangeFine, fine: rangeInizio });
    setMostraRangeForm(false);
  };

  const selezionaPeriodo = (p: Periodo) => {
    setPeriodo(p);
    setRangeCustom(null);
    setMostraRangeForm(false);
  };

  const periodoLabel = useMemo(() => {
    const fmtG = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    if (rangeCustom) return `${fmtG(rangeCustom.inizio)} – ${fmtG(rangeCustom.fine)}`;
    if (periodo === 'giorno') return riferimento.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (periodo === 'settimana') {
      const inizio = new Date(riferimento);
      const g = (inizio.getDay() + 6) % 7;
      inizio.setDate(inizio.getDate() - g);
      const fine = new Date(inizio);
      fine.setDate(fine.getDate() + 6);
      return `${inizio.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${fine.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (periodo === 'mese') return riferimento.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return riferimento.getFullYear().toString();
  }, [periodo, riferimento, rangeCustom]);

  return {
    periodo, riferimento, rangeCustom, mostraRangeForm, setMostraRangeForm,
    rangeInizio, setRangeInizio, rangeFine, setRangeFine,
    inRangeSelezionato, navigaPeriodo, applicaRangeCustom,
    annullaRangeCustom: () => setRangeCustom(null),
    selezionaPeriodo,
    tornaOggi: () => setRiferimento(new Date()),
    periodoLabel,
  };
}

/** Selettore periodo (giorno/settimana/mese/anno) con frecce avanti/indietro
 * e intervallo di date personalizzato, pronto per essere agganciato a un
 * usePeriodoNavigabile(): stesso aspetto ovunque venga usato. */
export function SelettorePeriodoNavigabile({ nav }: { nav: PeriodoNavigabile }) {
  return (
    <div className="space-y-2 mb-3">
      <div className="grid grid-cols-4 gap-1.5">
        {PERIODI.map((p) => (
          <button
            key={p.id}
            onClick={() => nav.selezionaPeriodo(p.id)}
            className={`py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              nav.periodo === p.id && !nav.rangeCustom ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!nav.rangeCustom && (
        <div className="flex items-center justify-between">
          <button onClick={() => nav.navigaPeriodo(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500" aria-label="Periodo precedente">
            ‹
          </button>
          <div className="text-center">
            <div className="text-[11px] font-semibold text-gray-700 capitalize">{nav.periodoLabel}</div>
            <button onClick={nav.tornaOggi} className="text-[10px] text-blue-600 hover:underline cursor-pointer">
              Torna a oggi
            </button>
          </div>
          <button onClick={() => nav.navigaPeriodo(1)} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500" aria-label="Periodo successivo">
            ›
          </button>
        </div>
      )}

      {nav.rangeCustom ? (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-blue-800">📅 {nav.periodoLabel}</span>
          <button onClick={nav.annullaRangeCustom} className="text-[11px] text-blue-600 hover:underline cursor-pointer shrink-0">
            Annulla intervallo
          </button>
        </div>
      ) : (
        <button
          onClick={() => nav.setMostraRangeForm((v) => !v)}
          className="w-full text-center text-[11px] text-blue-600 hover:underline cursor-pointer"
        >
          {nav.mostraRangeForm ? 'Chiudi' : '📅 Scegli un intervallo di date personalizzato'}
        </button>
      )}
      {nav.mostraRangeForm && !nav.rangeCustom && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 block mb-0.5">Da</label>
            <DateField value={nav.rangeInizio} onChange={nav.setRangeInizio} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 block mb-0.5">A</label>
            <DateField value={nav.rangeFine} onChange={nav.setRangeFine} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button
            onClick={nav.applicaRangeCustom}
            disabled={!nav.rangeInizio || !nav.rangeFine}
            className="py-1.5 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors shrink-0"
          >
            Applica
          </button>
        </div>
      )}
    </div>
  );
}

const LABEL_LAVORAZIONE: Record<string, { label: string; icon: string }> = {
  spesa_revisione_gianni: { label: 'Revisione (Gianni)', icon: '🔧' },
  spesa_centraline_daniele: { label: 'Centraline (Daniele)', icon: '💻' },
};

type VoceLista =
  | { kind: 'auto'; data: Date; appuntamento: Appuntamento }
  | { kind: 'lavorazione'; data: Date; movimento: Movimento };

export function IncassiOfficina({ officinaId }: { officinaId?: string }) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  // Revisione (Gianni) e Centraline (Daniele): statistiche d'incasso delle
  // lavorazioni di officina, non solo delle consegne auto.
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('settimana');
  const [search, setSearch] = useState('');
  // Filtro per stato pagamento: una Revisione Gianni/Centraline Daniele
  // completata conta come "Pagato" (non ha un concetto di acconto, l'intero
  // importo si considera incassato appena finita), "In lavorazione" non
  // compare mai sotto Acconto/Non pagato (non ha ancora numeri definitivi).
  const [filtroStato, setFiltroStato] = useState<'tutti' | 'pagato' | 'acconto' | 'non_pagato'>('tutti');

  const load = useCallback(async () => {
    if (!officinaId) return;
    setLoading(true);
    const [{ data }, { data: dataMov }] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select('*, clienti(nome), veicoli(marca,modello,targa)')
        .eq('officina_id', officinaId)
        .eq('stato', 'consegnato')
        .not('pagamento', 'is', null)
        .order('data_ora', { ascending: false })
        .limit(500),
      supabase
        .from('movimenti')
        .select('*')
        .eq('officina_id', officinaId)
        .in('tipo', TIPI_CON_SPESE_LAVORAZIONE)
        .order('data', { ascending: false })
        .limit(500),
    ]);
    setAppuntamenti((data as Appuntamento[]) || []);
    setMovimenti((dataMov as Movimento[]) || []);
    setLoading(false);
  }, [officinaId]);

  // Spunta rapida sulla riga stessa, senza apire la matita: il costo
  // ricambi e' spesso solo informativo (pagato a blocchi al ricambista),
  // conta come spesa solo quando spuntato.
  const toggleRicambiSubito = async (a: Appuntamento) => {
    if (!a.pagamento) return;
    const nuovoPagamento = {
      ...a.pagamento,
      ricambi_pagati_subito: !a.pagamento.ricambi_pagati_subito,
      fornitore_pagato_da_cliente: false,
    };
    setAppuntamenti((prev) => prev.map((x) => (x.id === a.id ? { ...x, pagamento: nuovoPagamento } : x)));
    await supabase.from('appuntamenti').update({ pagamento: nuovoPagamento }).eq('id', a.id);
  };

  // Idem, per il caso in cui e' il cliente a pagare il fornitore dei
  // ricambi direttamente: mutuamente esclusiva con "pagati subito".
  const toggleFornitorePagatoDaCliente = async (a: Appuntamento) => {
    if (!a.pagamento) return;
    const nuovoPagamento = {
      ...a.pagamento,
      fornitore_pagato_da_cliente: !a.pagamento.fornitore_pagato_da_cliente,
      ricambi_pagati_subito: false,
    };
    setAppuntamenti((prev) => prev.map((x) => (x.id === a.id ? { ...x, pagamento: nuovoPagamento } : x)));
    await supabase.from('appuntamenti').update({ pagamento: nuovoPagamento }).eq('id', a.id);
  };

  useEffect(() => {
    load();
    if (!officinaId) return;
    const ch = supabase
      .channel('incassi-officina-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [officinaId, load]);

  // Data di riferimento per il periodo selezionato: di base "adesso", ma
  // navigabile avanti/indietro (es. la settimana di due mesi fa), o
  // sostituita del tutto da un intervallo di date scelto a mano — stesso
  // meccanismo di Movimenti (CassaPage), cosi' si puo' rivedere lo storico
  // delle statistiche d'incasso officina per qualsiasi periodo passato.
  const [riferimento, setRiferimento] = useState(() => new Date());
  const [rangeCustom, setRangeCustom] = useState<{ inizio: string; fine: string } | null>(null);
  const [mostraRangeForm, setMostraRangeForm] = useState(false);
  const [rangeInizio, setRangeInizio] = useState('');
  const [rangeFine, setRangeFine] = useState('');

  const inRangeSelezionato = useCallback(
    (d: Date) => {
      if (rangeCustom) {
        const k = dayKey(d);
        return k >= rangeCustom.inizio && k <= rangeCustom.fine;
      }
      return inPeriodo(d, periodo, riferimento);
    },
    [rangeCustom, periodo, riferimento]
  );

  const navigaPeriodo = (offset: number) => {
    setRangeCustom(null);
    setRiferimento((prev) => {
      const d = new Date(prev);
      if (periodo === 'giorno') d.setDate(d.getDate() + offset);
      else if (periodo === 'settimana') d.setDate(d.getDate() + offset * 7);
      else if (periodo === 'mese') d.setMonth(d.getMonth() + offset);
      else d.setFullYear(d.getFullYear() + offset);
      return d;
    });
  };

  const applicaRangeCustom = () => {
    if (!rangeInizio || !rangeFine) return;
    setRangeCustom(rangeInizio <= rangeFine ? { inizio: rangeInizio, fine: rangeFine } : { inizio: rangeFine, fine: rangeInizio });
    setMostraRangeForm(false);
  };

  const periodoLabel = useMemo(() => {
    const fmtG = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    if (rangeCustom) return `${fmtG(rangeCustom.inizio)} – ${fmtG(rangeCustom.fine)}`;
    if (periodo === 'giorno') return riferimento.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (periodo === 'settimana') {
      const inizio = new Date(riferimento);
      const g = (inizio.getDay() + 6) % 7;
      inizio.setDate(inizio.getDate() - g);
      const fine = new Date(inizio);
      fine.setDate(fine.getDate() + 6);
      return `${inizio.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${fine.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (periodo === 'mese') return riferimento.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return riferimento.getFullYear().toString();
  }, [periodo, riferimento, rangeCustom]);

  const inRange = useMemo(
    () => appuntamenti.filter((a) => inRangeSelezionato(dataIncasso(a))),
    [appuntamenti, inRangeSelezionato]
  );
  const movimentiInRange = useMemo(
    () => movimenti.filter((m) => inRangeSelezionato(dateFromDataStr(m.data))),
    [movimenti, inRangeSelezionato]
  );

  // Con una ricerca attiva si cerca su tutto lo storico, non solo nel
  // periodo selezionato: altrimenti una targa fuori dal periodo mostrato
  // sembrerebbe non trovata, anche se esiste.
  const risultati = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? appuntamenti : inRange;
    if (!q) return base;
    return base.filter((a) =>
      a.clienti?.nome?.toLowerCase().includes(q) ||
      a.veicoli?.targa?.toLowerCase().includes(q) ||
      a.veicoli?.marca?.toLowerCase().includes(q) ||
      a.veicoli?.modello?.toLowerCase().includes(q)
    );
  }, [appuntamenti, inRange, search]);

  const risultatiMovimenti = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? movimenti : movimentiInRange;
    if (!q) return base;
    return base.filter((m) =>
      m.descrizione?.toLowerCase().includes(q) ||
      m.cliente_nome?.toLowerCase().includes(q)
    );
  }, [movimenti, movimentiInRange, search]);

  // Elenco unico, consegne auto e lavorazioni di officina insieme, ordinato
  // per data: cosi' si vede tutta l'attivita' del periodo in un colpo solo.
  const voci: VoceLista[] = useMemo(() => {
    const a: VoceLista[] = risultati
      .filter((appuntamento) => filtroStato === 'tutti' || appuntamento.pagamento?.stato === filtroStato)
      .map((appuntamento) => ({ kind: 'auto', data: dataIncasso(appuntamento), appuntamento }));
    const m: VoceLista[] = risultatiMovimenti
      // Una lavorazione completata non ha acconti: conta come "Pagato".
      // "In lavorazione" non ha ancora numeri definitivi, non compare mai
      // sotto Acconto/Non pagato.
      .filter((movimento) => filtroStato === 'tutti' || (filtroStato === 'pagato' && movimento.stato !== 'in_lavorazione'))
      .map((movimento) => ({ kind: 'lavorazione', data: dateFromDataStr(movimento.data), movimento }));
    return [...a, ...m].sort((x, y) => y.data.getTime() - x.data.getTime());
  }, [risultati, risultatiMovimenti, filtroStato]);

  // "Guadagno netto" qui e' il margine vero del lavoro svolto (fatturato
  // meno costo ricambi/spese lavorazione), a prescindere da quando viene
  // incassato o dalla spunta "pagati subito" (che serve solo al flusso di
  // cassa, non alla statistica del margine) — stesso principio di "Guadagno
  // per collaboratore" in Analytics.
  const movimentiCompletati = movimentiInRange.filter((m) => m.stato !== 'in_lavorazione');
  const totaleLordo = inRange.reduce((s, a) => s + valoreLavoro(a), 0) + movimentiCompletati.reduce((s, m) => s + incassoMovimento(m), 0);
  // Costo per intero, a prescindere dal quadratino "conta come spesa" (che
  // serve solo ai conti reali di Cassa/Movimenti): qui e' una statistica, il
  // margine vero del lavoro svolto non cambia a seconda di chi paga chi.
  const totaleCosto = inRange.reduce((s, a) => s + (Number(a.pagamento?.costo_ricambi) || 0), 0) + movimentiCompletati.reduce((s, m) => s + (Number(m.spese_lavorazione) || 0), 0);
  const margineNetto = totaleLordo - totaleCosto;
  const totaleResto = inRange.reduce((s, a) => s + restoDaIncassare(a), 0);
  const numVoci = inRange.length + movimentiCompletati.length;

  // La modifica salva su appuntamenti.pagamento: la sottoscrizione realtime
  // sopra ricarica da sola la lista, non serve aggiornare lo stato a mano.
  const editor = usePagamentoEditor();
  const editorLavorazione = useMovimentoLavorazioneEditor();

  if (!officinaId) return null;

  return (
    <div className="space-y-3">
      {/* Selettore periodo */}
      <div className="grid grid-cols-4 gap-1.5">
        {PERIODI.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPeriodo(p.id); setRangeCustom(null); setMostraRangeForm(false); }}
            className={`py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              periodo === p.id && !rangeCustom ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Naviga avanti/indietro nel periodo scelto (es. la settimana di due mesi fa) */}
      {!rangeCustom && (
        <div className="flex items-center justify-between">
          <button onClick={() => navigaPeriodo(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500" aria-label="Periodo precedente">
            ‹
          </button>
          <div className="text-center">
            <div className="text-[11px] font-semibold text-gray-700 capitalize">{periodoLabel}</div>
            <button onClick={() => setRiferimento(new Date())} className="text-[10px] text-emerald-600 hover:underline cursor-pointer">
              Torna a oggi
            </button>
          </div>
          <button onClick={() => navigaPeriodo(1)} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500" aria-label="Periodo successivo">
            ›
          </button>
        </div>
      )}

      {/* Intervallo di date scelto a mano, al posto di giorno/settimana/mese/anno */}
      {rangeCustom ? (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-emerald-800">📅 {periodoLabel}</span>
          <button onClick={() => setRangeCustom(null)} className="text-[11px] text-emerald-600 hover:underline cursor-pointer shrink-0">
            Annulla intervallo
          </button>
        </div>
      ) : (
        <button
          onClick={() => setMostraRangeForm((v) => !v)}
          className="w-full text-center text-[11px] text-emerald-600 hover:underline cursor-pointer"
        >
          {mostraRangeForm ? 'Chiudi' : '📅 Scegli un intervallo di date personalizzato'}
        </button>
      )}
      {mostraRangeForm && !rangeCustom && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 block mb-0.5">Da</label>
            <DateField value={rangeInizio} onChange={setRangeInizio} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 block mb-0.5">A</label>
            <DateField value={rangeFine} onChange={setRangeFine} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button
            onClick={applicaRangeCustom}
            disabled={!rangeInizio || !rangeFine}
            className="py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shrink-0"
          >
            Applica
          </button>
        </div>
      )}

      {/* Ricerca per targa o nome cliente */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per targa o nome cliente..."
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />

      {/* Filtro per stato pagamento: solo l'elenco sotto, il riepilogo resta
          sempre sul periodo intero (come i tab di Movimenti). */}
      <div className="grid grid-cols-4 gap-1.5">
        {([
          { id: 'tutti', label: 'Tutti' },
          { id: 'pagato', label: 'Pagato' },
          { id: 'acconto', label: 'Acconto' },
          { id: 'non_pagato', label: 'Non pagato' },
        ] as const).map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltroStato(f.id)}
            className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              filtroStato === f.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Riepilogo: statistica pura, sempre come se tutto fosse stato pagato
          per intero (vedi commento su totaleLordo) — per i soldi davvero
          incassati/da incassare vedi Movimenti. */}
      <Card className="!p-4 space-y-2 !bg-emerald-50/50 !border-emerald-200">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600">Lordo lavorazioni</span>
          <span className="text-xl font-black text-emerald-700">{fmtEuro(totaleLordo)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600">Costo ricambi/lavorazione</span>
          <span className="text-sm font-semibold text-red-600">− {fmtEuro(totaleCosto)}</span>
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-emerald-200">
          <span className="text-xs font-bold text-gray-700">Guadagno netto</span>
          <span className="text-lg font-black text-gray-900">{fmtEuro(margineNetto)}</span>
        </div>
        {totaleResto > 0 && (
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-[11px] text-amber-700">Di cui ancora da incassare (acconti/non pagati)</span>
            <span className="text-xs font-bold text-amber-700">{fmtEuro(totaleResto)}</span>
          </div>
        )}
        <div className="text-[11px] text-gray-400 pt-1">{numVoci} lavorazion{numVoci === 1 ? 'e' : 'i'} nel periodo</div>
      </Card>

      {/* Elenco consegne auto e lavorazioni di officina nel periodo (o risultati della ricerca) */}
      {loading ? (
        <div className="text-center py-6 text-sm text-gray-400">Caricamento...</div>
      ) : voci.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400">
          {search.trim()
            ? 'Nessun risultato per la ricerca'
            : filtroStato !== 'tutti'
            ? 'Nessuna lavorazione con questo stato nel periodo'
            : 'Nessuna lavorazione in questo periodo'}
        </div>
      ) : (
        <div className="space-y-2">
          {voci.map((voce) => {
            if (voce.kind === 'lavorazione') {
              const m = voce.movimento;
              const lbl = LABEL_LAVORAZIONE[m.tipo] || { label: m.tipo, icon: '🔧' };
              const inLavorazione = m.stato === 'in_lavorazione';
              const inEditLavorazione = editorLavorazione.editingId === m.id;
              return (
                <Card key={`mov-${m.id}`} className="!p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {m.descrizione}{m.cliente_nome ? ` — ${m.cliente_nome}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{lbl.icon} {lbl.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {dateFromDataStr(m.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {inLavorazione ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                          🔧 In lavorazione
                        </span>
                      ) : (
                        <div className="text-sm font-bold text-gray-900">{fmtEuro(incassoMovimento(m))}</div>
                      )}
                    </div>
                    {!inEditLavorazione && (
                      <button
                        onClick={() => editorLavorazione.apri(m)}
                        className="text-gray-400 hover:text-emerald-600 cursor-pointer shrink-0 px-1"
                        title="Modifica"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                  {!inLavorazione && !inEditLavorazione && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                      Costo lavorazione: <span className="font-semibold text-gray-700">{fmtEuro(Number(m.spese_lavorazione) || 0)}</span>
                      {' · '}netto <span className="font-semibold text-emerald-700">{fmtEuro(incassoMovimento(m) - (Number(m.spese_lavorazione) || 0))}</span>
                    </div>
                  )}
                  {inEditLavorazione && <MovimentoLavorazioneEditFields editor={editorLavorazione} movimento={m} />}
                </Card>
              );
            }
            const a = voce.appuntamento;
            const p = a.pagamento!;
            const cfg = p.stato === 'pagato'
              ? { label: 'Pagato', color: '#065f46', bg: '#d1fae5' }
              : p.stato === 'acconto'
              ? { label: 'Acconto', color: '#92400e', bg: '#fef3c7' }
              : { label: 'Non pagato', color: '#991b1b', bg: '#fee2e2' };
            const inEdit = editor.editingId === a.id;
            return (
              <Card key={a.id} className="!p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{a.clienti?.nome || 'Cliente'}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {a.veicoli?.marca} {a.veicoli?.modello}{a.veicoli?.targa ? ` — ${a.veicoli.targa}` : ''}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {dataIncasso(a).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}
                      {dataIncasso(a).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <div className="text-sm font-bold text-gray-900">{fmtEuro(valoreLavoro(a))}</div>
                    {restoDaIncassare(a) > 0 && (
                      <div className="text-[10px] text-amber-600">
                        Da incassare: {fmtEuro(restoDaIncassare(a))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <div className="text-[11px] text-gray-500">
                    <div>
                      Costo ricambi: <span className="font-semibold text-gray-700">{fmtEuro(p.costo_ricambi || 0)}</span>
                      {' · '}netto <span className="font-semibold text-emerald-700">{fmtEuro(valoreLavoro(a) - (Number(p.costo_ricambi) || 0))}</span>
                      {p.operaio && <span className="text-gray-400"> · 🔧 {p.operaio}</span>}
                    </div>
                    {(p.costo_ricambi || 0) > 0 && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1.5 mt-0.5 cursor-pointer ${p.ricambi_pagati_subito ? 'text-red-500' : 'text-gray-400'}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!p.ricambi_pagati_subito}
                          onChange={() => toggleRicambiSubito(a)}
                          className="rounded shrink-0"
                        />
                        {p.ricambi_pagati_subito ? 'conta come spesa' : 'non conta come spesa'}
                      </label>
                    )}
                    {/* Ha senso solo se c'e' un fornitore selezionato per questo lavoro. */}
                    {(p.costo_ricambi || 0) > 0 && p.fornitore_ricambi && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1.5 mt-0.5 cursor-pointer ${p.fornitore_pagato_da_cliente ? 'text-red-500' : 'text-gray-400'}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!p.fornitore_pagato_da_cliente}
                          onChange={() => toggleFornitorePagatoDaCliente(a)}
                          className="rounded shrink-0"
                        />
                        {p.fornitore_pagato_da_cliente ? `pagati dal cliente a ${p.fornitore_ricambi === 'monti' ? 'Monti' : 'Autoricambi'} (non incassato)` : `non pagati dal cliente a ${p.fornitore_ricambi === 'monti' ? 'Monti' : 'Autoricambi'}`}
                      </label>
                    )}
                  </div>
                  {!inEdit && (
                    <button
                      onClick={() => editor.apri(a)}
                      className="text-gray-400 hover:text-emerald-600 cursor-pointer shrink-0 px-1"
                      title="Modifica acconto e costo ricambi"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {inEdit && <PagamentoEditFields editor={editor} appuntamento={a} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
