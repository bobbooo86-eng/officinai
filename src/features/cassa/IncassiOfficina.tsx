import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Appuntamento } from '@/types/database';

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
 * (se c'e') non e' cassa finche' non arriva. */
export function incassato(a: Appuntamento): number {
  const p = a.pagamento;
  if (!p) return 0;
  if (p.stato === 'pagato') return p.importo_totale || 0;
  if (p.stato === 'acconto') return p.importo_pagato || 0;
  return 0;
}

export const PERIODI: { id: Periodo; label: string }[] = [
  { id: 'giorno', label: 'Oggi' },
  { id: 'settimana', label: 'Settimana' },
  { id: 'mese', label: 'Mese' },
  { id: 'anno', label: 'Anno' },
];

export function IncassiOfficina({ officinaId }: { officinaId?: string }) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('mese');
  const [search, setSearch] = useState('');
  // Un solo pannello di modifica alla volta (acconto + costo ricambi
  // insieme), dietro una matita: prima si poteva scrivere direttamente
  // negli input, sempre visibili, che invitava a toccarli per sbaglio.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPagato, setEditPagato] = useState('');
  const [editTotale, setEditTotale] = useState('');
  const [editRicambi, setEditRicambi] = useState('');
  const [editOperaio, setEditOperaio] = useState('');
  const [salvandoPagamento, setSalvandoPagamento] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!officinaId) return;
    setLoading(true);
    const { data } = await supabase
      .from('appuntamenti')
      .select('*, clienti(nome), veicoli(marca,modello,targa)')
      .eq('officina_id', officinaId)
      .eq('stato', 'consegnato')
      .not('pagamento', 'is', null)
      .order('data_ora', { ascending: false })
      .limit(500);
    setAppuntamenti((data as Appuntamento[]) || []);
    setLoading(false);
  }, [officinaId]);

  useEffect(() => {
    load();
    if (!officinaId) return;
    const ch = supabase
      .channel('incassi-officina-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [officinaId, load]);

  const oggi = useMemo(() => new Date(), []);

  const inRange = useMemo(
    () => appuntamenti.filter((a) => inPeriodo(dataIncasso(a), periodo, oggi)),
    [appuntamenti, periodo, oggi]
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

  const totaleIncassato = inRange.reduce((s, a) => s + incassato(a), 0);
  const totaleRicambi = inRange.reduce((s, a) => s + (a.pagamento?.costo_ricambi || 0), 0);
  const margineNetto = totaleIncassato - totaleRicambi;
  const totaleResto = inRange.reduce((s, a) => {
    const p = a.pagamento;
    if (!p) return s;
    if (p.stato === 'acconto') return s + Math.max(0, (p.importo_totale || 0) - (p.importo_pagato || 0));
    if (p.stato === 'non_pagato') return s + (p.importo_totale || 0);
    return s;
  }, 0);

  const apriModifica = (a: Appuntamento) => {
    setEditingId(a.id);
    setEditPagato(String(a.pagamento?.importo_pagato ?? 0));
    setEditTotale(String(a.pagamento?.importo_totale ?? 0));
    setEditRicambi(String(a.pagamento?.costo_ricambi ?? 0));
    setEditOperaio(a.pagamento?.operaio || '');
  };

  // Un acconto puo' crescere nel tempo (il cliente paga altro dopo la
  // consegna): incassato finora, totale da pagare, costo ricambi e nome
  // dell'operaio si modificano tutti insieme da qui. Se l'incassato
  // raggiunge il totale, il pagamento passa da solo a "pagato".
  const salvaModifica = async (a: Appuntamento) => {
    if (!a.pagamento) return;
    const nuovoPagato = parseFloat(editPagato) || 0;
    const nuovoTotale = parseFloat(editTotale) || 0;
    const nuovoRicambi = parseFloat(editRicambi) || 0;
    const saldato = nuovoTotale > 0 && nuovoPagato >= nuovoTotale;
    const nuovoPagamento = {
      ...a.pagamento,
      importo_pagato: nuovoPagato,
      importo_totale: nuovoTotale,
      costo_ricambi: nuovoRicambi,
      operaio: editOperaio.trim() || undefined,
      stato: saldato ? ('pagato' as const) : nuovoPagato > 0 ? ('acconto' as const) : ('non_pagato' as const),
    };
    setSalvandoPagamento(a.id);
    const { error } = await supabase.from('appuntamenti').update({ pagamento: nuovoPagamento }).eq('id', a.id);
    setSalvandoPagamento(null);
    if (error) { alert('Modifica non salvata: ' + error.message); return; }
    setAppuntamenti((prev) => prev.map((x) => (x.id === a.id ? { ...x, pagamento: nuovoPagamento } : x)));
    setEditingId(null);
  };

  if (!officinaId) return null;

  return (
    <div className="space-y-3">
      {/* Selettore periodo */}
      <div className="grid grid-cols-4 gap-1.5">
        {PERIODI.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodo(p.id)}
            className={`py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              periodo === p.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Ricerca per targa o nome cliente */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per targa o nome cliente..."
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />

      {/* Riepilogo */}
      <Card className="!p-4 space-y-2 !bg-emerald-50/50 !border-emerald-200">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600">Incassato</span>
          <span className="text-xl font-black text-emerald-700">{fmtEuro(totaleIncassato)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600">Costo ricambi</span>
          <span className="text-sm font-semibold text-red-600">− {fmtEuro(totaleRicambi)}</span>
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-emerald-200">
          <span className="text-xs font-bold text-gray-700">Guadagno netto</span>
          <span className="text-lg font-black text-gray-900">{fmtEuro(margineNetto)}</span>
        </div>
        {totaleResto > 0 && (
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-[11px] text-amber-700">Ancora da incassare (acconti/non pagati)</span>
            <span className="text-xs font-bold text-amber-700">{fmtEuro(totaleResto)}</span>
          </div>
        )}
        <div className="text-[11px] text-gray-400 pt-1">{inRange.length} veicol{inRange.length === 1 ? 'o' : 'i'} consegnat{inRange.length === 1 ? 'o' : 'i'}</div>
      </Card>

      {/* Elenco veicoli consegnati nel periodo (o risultati della ricerca) */}
      {loading ? (
        <div className="text-center py-6 text-sm text-gray-400">Caricamento...</div>
      ) : risultati.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400">
          {search.trim() ? 'Nessun risultato per la ricerca' : 'Nessuna consegna in questo periodo'}
        </div>
      ) : (
        <div className="space-y-2">
          {risultati.map((a) => {
            const p = a.pagamento!;
            const cfg = p.stato === 'pagato'
              ? { label: 'Pagato', color: '#065f46', bg: '#d1fae5' }
              : p.stato === 'acconto'
              ? { label: 'Acconto', color: '#92400e', bg: '#fef3c7' }
              : { label: 'Non pagato', color: '#991b1b', bg: '#fee2e2' };
            const inEdit = editingId === a.id;
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
                    <div className="text-sm font-bold text-gray-900">{fmtEuro(incassato(a))}</div>
                    {p.stato === 'acconto' && p.importo_totale != null && (
                      <div className="text-[10px] text-amber-600">
                        Resto: {fmtEuro(Math.max(0, (p.importo_totale || 0) - (p.importo_pagato || 0)))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <span className="text-[11px] text-gray-500">
                    Costo ricambi: <span className="font-semibold text-gray-700">{fmtEuro(p.costo_ricambi || 0)}</span>
                    {(p.costo_ricambi || 0) > 0 && (
                      <span className="text-gray-400"> · netto {fmtEuro(incassato(a) - (p.costo_ricambi || 0))}</span>
                    )}
                    {p.operaio && <span className="text-gray-400"> · 🔧 {p.operaio}</span>}
                  </span>
                  {!inEdit && (
                    <button
                      onClick={() => apriModifica(a)}
                      className="text-gray-400 hover:text-emerald-600 cursor-pointer shrink-0 px-1"
                      title="Modifica acconto e costo ricambi"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {inEdit && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block">Incassato finora €</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={editPagato}
                          onChange={(e) => setEditPagato(e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block">Totale da pagare €</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={editTotale}
                          onChange={(e) => setEditTotale(e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block">Costo ricambi €</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={editRicambi}
                          onChange={(e) => setEditRicambi(e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block">Operaio che ha fatto il lavoro</label>
                      <input
                        type="text"
                        value={editOperaio}
                        onChange={(e) => setEditOperaio(e.target.value)}
                        placeholder="Nome operaio"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => salvaModifica(a)}
                        disabled={salvandoPagamento === a.id}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        {salvandoPagamento === a.id ? 'Salvataggio...' : 'Salva'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={salvandoPagamento === a.id}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
