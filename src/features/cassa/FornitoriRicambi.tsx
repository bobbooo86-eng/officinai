import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Appuntamento, Movimento, MovimentoTipo, AcquistoFornitoreRicambi } from '@/types/database';

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export const FORNITORI_RICAMBI: {
  id: 'autoricambi' | 'monti';
  label: string;
  icon: string;
  tipoMovimento: MovimentoTipo;
}[] = [
  { id: 'autoricambi', label: 'Autoricambi', icon: '🏭', tipoMovimento: 'spesa_autoricambi' },
  { id: 'monti', label: 'Autodemolizioni Monti', icon: '🚙', tipoMovimento: 'spesa_monti' },
];

type SaldiFornitori = { autoricambi?: number; monti?: number };

/**
 * Conto corrente con ciascun fornitore di ricambi: un saldo di partenza
 * (impostabile a mano, per chi aveva gia' un debito prima di usare questa
 * funzione) piu' quanto e' stato segnato come "ricambi da {fornitore}"
 * sulle consegne piu' gli acquisti aggiunti a mano (es. un pezzo per
 * magazzino, non legato a nessuna consegna) meno quanto e' gia' stato
 * pagato (i movimenti spesa_autoricambi/spesa_monti registrati in Cassa >
 * Movimenti). Non e' legato al periodo selezionato altrove in Cassa: e'
 * un saldo che resta finche' non viene saldato, come il tab "Da incassare".
 */
export function FornitoriRicambi({ officinaId }: { officinaId?: string }) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [acquisti, setAcquisti] = useState<AcquistoFornitoreRicambi[]>([]);
  const [saldiIniziali, setSaldiIniziali] = useState<SaldiFornitori>({});
  const [loading, setLoading] = useState(true);
  const [espanso, setEspanso] = useState<string | null>(null);
  const [editandoSaldo, setEditandoSaldo] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [salvandoSaldo, setSalvandoSaldo] = useState(false);
  const [aggiungendoAcquisto, setAggiungendoAcquisto] = useState<string | null>(null);
  const [nuovaDesc, setNuovaDesc] = useState('');
  const [nuovoImporto, setNuovoImporto] = useState('');
  const [salvandoAcquisto, setSalvandoAcquisto] = useState(false);

  const load = useCallback(async () => {
    if (!officinaId) return;
    setLoading(true);
    const [{ data: apps }, { data: movs }, { data: officina }, { data: acq }] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select('*, clienti(nome), veicoli(marca,modello,targa)')
        .eq('officina_id', officinaId)
        .eq('stato', 'consegnato')
        .not('pagamento', 'is', null)
        .limit(1000),
      supabase
        .from('movimenti')
        .select('*')
        .eq('officina_id', officinaId)
        .in('tipo', FORNITORI_RICAMBI.map((f) => f.tipoMovimento)),
      supabase
        .from('officine')
        .select('saldi_fornitori_ricambi')
        .eq('id', officinaId)
        .maybeSingle(),
      supabase
        .from('acquisti_fornitori_ricambi')
        .select('*')
        .eq('officina_id', officinaId)
        .order('data', { ascending: false }),
    ]);
    setAppuntamenti((apps as Appuntamento[]) || []);
    setMovimenti((movs as Movimento[]) || []);
    setSaldiIniziali((officina?.saldi_fornitori_ricambi as SaldiFornitori) || {});
    setAcquisti((acq as AcquistoFornitoreRicambi[]) || []);
    setLoading(false);
  }, [officinaId]);

  useEffect(() => {
    load();
    if (!officinaId) return;
    const ch = supabase
      .channel('fornitori-ricambi-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'officine', filter: `id=eq.${officinaId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acquisti_fornitori_ricambi', filter: `officina_id=eq.${officinaId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [officinaId, load]);

  const apriEditSaldo = (fornitoreId: string) => {
    setEditandoSaldo(fornitoreId);
    setEditValue(String(saldiIniziali[fornitoreId as keyof SaldiFornitori] ?? 0));
  };

  const salvaSaldoIniziale = async (fornitoreId: 'autoricambi' | 'monti') => {
    if (!officinaId) return;
    setSalvandoSaldo(true);
    const nuovo = { ...saldiIniziali, [fornitoreId]: parseFloat(editValue) || 0 };
    const { error } = await supabase.from('officine').update({ saldi_fornitori_ricambi: nuovo }).eq('id', officinaId);
    setSalvandoSaldo(false);
    if (error) { alert('Saldo non salvato: ' + error.message); return; }
    setSaldiIniziali(nuovo);
    setEditandoSaldo(null);
  };

  const apriAggiungiAcquisto = (fornitoreId: string) => {
    setAggiungendoAcquisto(fornitoreId);
    setNuovaDesc('');
    setNuovoImporto('');
  };

  const salvaAcquisto = async (fornitoreId: 'autoricambi' | 'monti') => {
    if (!officinaId || !nuovoImporto) return;
    setSalvandoAcquisto(true);
    const { error } = await supabase.from('acquisti_fornitori_ricambi').insert({
      officina_id: officinaId,
      fornitore: fornitoreId,
      descrizione: nuovaDesc.trim(),
      importo: parseFloat(nuovoImporto) || 0,
    });
    setSalvandoAcquisto(false);
    if (error) { alert('Acquisto non salvato: ' + error.message); return; }
    setAggiungendoAcquisto(null);
  };

  const eliminaAcquisto = async (id: string) => {
    if (!confirm('Eliminare questo acquisto?')) return;
    await supabase.from('acquisti_fornitori_ricambi').delete().eq('id', id);
  };

  if (!officinaId) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400 px-1">
        Il saldo cresce quando su una consegna segni "da chi" vengono i ricambi o aggiungi un acquisto con "+", e scende quando registri un pagamento a quel fornitore da Movimenti. La matita ✏️ imposta un saldo di partenza, se avevi già un debito prima di usare questa pagina.
      </p>
      {loading ? (
        <div className="text-center py-6 text-xs text-gray-400">Caricamento...</div>
      ) : (
        FORNITORI_RICAMBI.map((f) => {
          const appsFornitore = appuntamenti
            .filter((a) => a.pagamento?.fornitore_ricambi === f.id && (a.pagamento?.costo_ricambi || 0) > 0)
            .sort((a, b) => new Date(b.pagamento?.data_consegna || b.data_ora).getTime() - new Date(a.pagamento?.data_consegna || a.data_ora).getTime());
          const acquistiFornitore = acquisti.filter((a) => a.fornitore === f.id);
          // "Pagati subito" (saldato sul momento dall'officina) o
          // "fornitore pagato dal cliente" (il cliente salda il fornitore
          // direttamente): in entrambi i casi quel lavoro non resta da
          // pagare, va escluso dal saldo anche se e' segnato su questo
          // fornitore.
          const giaSaldato = (a: Appuntamento) => !!(a.pagamento?.ricambi_pagati_subito || a.pagamento?.fornitore_pagato_da_cliente);
          const daPagare = appsFornitore.filter((a) => !giaSaldato(a));
          const totaleNonSaldato = daPagare.reduce((s, a) => s + (a.pagamento?.costo_ricambi || 0), 0);
          const totaleSegnato = appsFornitore.reduce((s, a) => s + (a.pagamento?.costo_ricambi || 0), 0);
          const totaleAcquisti = acquistiFornitore.reduce((s, a) => s + Number(a.importo), 0);
          const movimentiFornitore = movimenti.filter((m) => m.tipo === f.tipoMovimento);
          const totalePagato = movimentiFornitore.reduce((s, m) => s + Number(m.importo), 0);
          const saldoIniziale = saldiIniziali[f.id] || 0;
          const saldo = saldoIniziale + totaleNonSaldato + totaleAcquisti - totalePagato;
          const aperto = espanso === f.id;
          const inEditSaldo = editandoSaldo === f.id;
          const inAggiungi = aggiungendoAcquisto === f.id;

          return (
            <Card key={f.id} className="!p-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setEspanso(aperto ? null : f.id)}
                  className="flex items-center gap-2 cursor-pointer flex-1 text-left"
                >
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                  <span className="text-[10px] text-gray-400">({acquistiFornitore.length + appsFornitore.length} voci)</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${aperto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => apriAggiungiAcquisto(f.id)}
                  className="text-gray-400 hover:text-emerald-600 cursor-pointer px-1.5 shrink-0 text-base font-bold"
                  title="Aggiungi un acquisto"
                >
                  +
                </button>
                {!inEditSaldo && (
                  <button
                    onClick={() => apriEditSaldo(f.id)}
                    className="text-gray-400 hover:text-emerald-600 cursor-pointer px-1.5 shrink-0"
                    title="Imposta saldo di partenza"
                  >
                    ✏️
                  </button>
                )}
                <button onClick={() => setEspanso(aperto ? null : f.id)} className="text-right cursor-pointer shrink-0">
                  <div className={`text-sm font-bold ${saldo > 0.009 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmtEuro(Math.max(0, saldo))}
                  </div>
                  <div className="text-[10px] text-gray-400">da pagare</div>
                </button>
              </div>
              {inAggiungi && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-[2]">
                      <label className="text-[10px] text-gray-400 block">Cosa hai comprato</label>
                      <input
                        type="text"
                        value={nuovaDesc}
                        onChange={(e) => setNuovaDesc(e.target.value)}
                        placeholder="es. ABS"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 block">Importo €</label>
                      <input
                        type="number"
                        step="0.01"
                        value={nuovoImporto}
                        onChange={(e) => setNuovoImporto(e.target.value)}
                        placeholder="es. 100"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => salvaAcquisto(f.id)}
                      disabled={salvandoAcquisto || !nuovoImporto}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {salvandoAcquisto ? 'Salvataggio...' : 'Aggiungi al conto'}
                    </button>
                    <button
                      onClick={() => setAggiungendoAcquisto(null)}
                      disabled={salvandoAcquisto}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
              {inEditSaldo && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 block">Saldo di partenza €</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => salvaSaldoIniziale(f.id)}
                    disabled={salvandoSaldo}
                    className="py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors mt-4"
                  >
                    {salvandoSaldo ? '...' : 'Salva'}
                  </button>
                  <button
                    onClick={() => setEditandoSaldo(null)}
                    disabled={salvandoSaldo}
                    className="py-1.5 px-3 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors mt-4"
                  >
                    Annulla
                  </button>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <span>Saldo iniziale: {fmtEuro(saldoIniziale)}</span>
                <span>Ricambi: {fmtEuro(totaleSegnato + totaleAcquisti)}</span>
                <span>Pagato: {fmtEuro(totalePagato)}</span>
              </div>
              {aperto && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                  {appsFornitore.length === 0 && acquistiFornitore.length === 0 && movimentiFornitore.length === 0 ? (
                    <div className="text-[11px] text-gray-400 text-center py-2">Nessun movimento per questo fornitore</div>
                  ) : (
                    <>
                      {(acquistiFornitore.length > 0 || appsFornitore.length > 0) && (
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Acquisti e lavori (debito)</div>
                          <div className="space-y-1">
                            {acquistiFornitore.map((a) => (
                              <div key={a.id} className="flex items-center justify-between text-[11px] py-0.5">
                                <span className="text-gray-600 truncate">
                                  🧾 {a.descrizione || 'Acquisto'} · {new Date(a.data + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className="font-semibold text-gray-700">{fmtEuro(a.importo)}</span>
                                  <button onClick={() => eliminaAcquisto(a.id)} className="text-red-400 hover:text-red-600 cursor-pointer">✕</button>
                                </span>
                              </div>
                            ))}
                            {appsFornitore.map((a) => (
                              <div key={a.id} className="flex items-center justify-between text-[11px] py-0.5">
                                <span className="text-gray-600 truncate">
                                  🔧 {a.clienti?.nome || 'Cliente'}{a.veicoli?.targa ? ` — ${a.veicoli.targa}` : ''}
                                  {a.pagamento?.fornitore_pagato_da_cliente && <span className="text-emerald-600"> · pagato dal cliente</span>}
                                  {a.pagamento?.ricambi_pagati_subito && <span className="text-emerald-600"> · saldato</span>}
                                </span>
                                <span className={`font-semibold shrink-0 ml-2 ${giaSaldato(a) ? 'text-gray-400' : 'text-gray-700'}`}>
                                  {fmtEuro(a.pagamento?.costo_ricambi || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {movimentiFornitore.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Pagamenti fatti</div>
                          <div className="space-y-1">
                            {movimentiFornitore
                              .slice()
                              .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                              .map((m) => (
                                <div key={m.id} className="flex items-center justify-between text-[11px] py-0.5">
                                  <span className="text-gray-600 truncate">
                                    💶 {m.descrizione || 'Pagamento'} · {new Date(m.data + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                  </span>
                                  <span className="font-semibold text-emerald-700 shrink-0 ml-2">− {fmtEuro(Number(m.importo))}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
