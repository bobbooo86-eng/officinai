import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Appuntamento, Movimento, MovimentoTipo, AcquistoFornitoreRicambi } from '@/types/database';
import { creditoFornitoreDiretto } from './movimentiTotali';
import { useHistoryState } from '@/lib/useHistoryState';
import { todayKey, dayKey } from '@/lib/format';

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

/** Un saldo scritto a mano porta con se' la data in cui e' stato scritto:
 * serve a non ricontare quello che era gia' successo prima di allora (vedi
 * sotto). Il valore grezzo puo' anche essere un numero semplice (saldi
 * salvati prima di questa modifica): si legge come se fosse di sempre
 * (1970), cosi' per chi non ha ancora ritoccato la matita il conto resta
 * uguale a prima.
 */
type SaldoFornitore = { valore: number; data: string };
type SaldiFornitori = { autoricambi?: SaldoFornitore | number; monti?: SaldoFornitore | number };

function leggiSaldo(raw: SaldoFornitore | number | undefined): SaldoFornitore {
  if (raw == null) return { valore: 0, data: '1970-01-01' };
  if (typeof raw === 'number') return { valore: raw, data: '1970-01-01' };
  return raw;
}

/**
 * Conto corrente con ciascun fornitore di ricambi: un saldo scritto a mano
 * (con la matita ✏️, in qualsiasi momento) piu' gli acquisti ("+") e meno i
 * pagamenti registrati DA QUEL MOMENTO IN AVANTI. Riscrivere il saldo non
 * ricalcola nulla all'indietro: diventa il nuovo punto di partenza, e solo
 * quello che succede dopo lo fa muovere — altrimenti ogni acquisto/pagamento
 * gia' fatto verrebbe ricontato una seconda volta ogni volta che si
 * corregge il saldo. "Pagato" (sotto, e nella tendina) resta invece la
 * somma di SEMPRE, solo per riferimento: mostra tutta la storia anche se
 * non muove piu' il saldo.
 */
export function FornitoriRicambi({ officinaId }: { officinaId?: string }) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [acquisti, setAcquisti] = useState<AcquistoFornitoreRicambi[]>([]);
  const [saldiIniziali, setSaldiIniziali] = useState<SaldiFornitori>({});
  const [loading, setLoading] = useState(true);
  // Persistita: altrimenti un refresh richiudeva sempre la scheda del
  // fornitore che si stava guardando (es. Autoricambi).
  const [espanso, setEspanso] = useHistoryState<string | null>(
    'fornitori-espanso', null, (v) => v === null || FORNITORI_RICAMBI.some((f) => f.id === v)
  );
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
    setEditValue(String(leggiSaldo(saldiIniziali[fornitoreId as keyof SaldiFornitori]).valore));
  };

  const salvaSaldoIniziale = async (fornitoreId: 'autoricambi' | 'monti') => {
    if (!officinaId) return;
    setSalvandoSaldo(true);
    // Da oggi in avanti: quello che e' successo fino a ieri resta dentro
    // questo numero, non va piu' sottratto/aggiunto una seconda volta.
    const nuovoSaldo: SaldoFornitore = { valore: parseFloat(editValue) || 0, data: todayKey() };
    const nuovo = { ...saldiIniziali, [fornitoreId]: nuovoSaldo };
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
    const { data, error } = await supabase.from('acquisti_fornitori_ricambi').insert({
      officina_id: officinaId,
      fornitore: fornitoreId,
      descrizione: nuovaDesc.trim(),
      importo: parseFloat(nuovoImporto) || 0,
    }).select().single();
    setSalvandoAcquisto(false);
    if (error || !data) { alert('Acquisto non salvato: ' + (error?.message || 'errore sconosciuto')); return; }
    // Aggiorna subito la lista: non aspetta il giro del realtime, che non
    // sempre arriva in tempo (o per niente, se non e' attivo sul progetto).
    setAcquisti((prev) => [data as AcquistoFornitoreRicambi, ...prev]);
    setAggiungendoAcquisto(null);
    setEspanso(fornitoreId);
  };

  const eliminaAcquisto = async (id: string) => {
    if (!confirm('Eliminare questo acquisto?')) return;
    setAcquisti((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from('acquisti_fornitori_ricambi').delete().eq('id', id);
    if (error) { alert('Eliminazione non riuscita: ' + error.message); load(); }
  };

  if (!officinaId) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400 px-1">
Il saldo cresce quando aggiungi un acquisto col "+" (es. ogni settimana quanto hai speso di ricambi), e scende quando registri un pagamento a quel fornitore da Movimenti. La matita ✏️ corregge il saldo a mano in qualsiasi momento: da quel momento in poi riparte da quel numero, senza ricontare quello che era successo prima.
      </p>
      {loading ? (
        <div className="text-center py-6 text-xs text-gray-400">Caricamento...</div>
      ) : (
        FORNITORI_RICAMBI.map((f) => {
          // Il costo ricambi segnato su una consegna non conta piu' niente su
          // questa pagina (nemmeno come debito): il debito cresce solo con
          // gli acquisti aggiunti a mano col "+". Le uniche consegne che
          // contano qui sono quelle dove il cliente ha pagato il fornitore
          // direttamente (credita "Pagato" per intero, vedi sotto).
          const appsFornitore = appuntamenti
            .filter((a) => a.pagamento?.fornitore_ricambi === f.id && a.pagamento?.fornitore_pagato_da_cliente)
            .sort((a, b) => new Date(b.pagamento?.data_consegna || b.data_ora).getTime() - new Date(a.pagamento?.data_consegna || a.data_ora).getTime());
          const acquistiFornitore = acquisti.filter((a) => a.fornitore === f.id);
          const totaleAcquisti = acquistiFornitore.reduce((s, a) => s + Number(a.importo), 0);
          const movimentiFornitore = movimenti.filter((m) => m.tipo === f.tipoMovimento);
          // Quando il cliente paga il fornitore direttamente, l'intero resto
          // del lavoro (non il costo ricambi) va scalato dal conto: e' un
          // pagamento vero e proprio al fornitore, solo fatto da un'altra
          // tasca invece che dalla cassa dell'officina.
          const totaleCreditoDiretto = appsFornitore.reduce((s, a) => s + creditoFornitoreDiretto(a.pagamento), 0);
          // "Pagato" mostrato sotto e nella tendina: SEMPRE la storia
          // completa, solo per riferimento (vedi commento sopra la funzione).
          const totalePagato = movimentiFornitore.reduce((s, m) => s + Number(m.importo), 0) + totaleCreditoDiretto;
          const saldoSalvato = leggiSaldo(saldiIniziali[f.id]);
          // Per il conto "da pagare" invece contano solo acquisti e
          // pagamenti da quando il saldo e' stato scritto in poi: quelli
          // precedenti sono gia' dentro al numero scritto a mano.
          const acquistiDopoSaldo = acquistiFornitore.filter((a) => a.data >= saldoSalvato.data).reduce((s, a) => s + Number(a.importo), 0);
          const creditoDopoSaldo = appsFornitore
            .filter((a) => dayKey(a.pagamento?.data_consegna || a.data_ora) >= saldoSalvato.data)
            .reduce((s, a) => s + creditoFornitoreDiretto(a.pagamento), 0);
          const pagatoDopoSaldo = movimentiFornitore.filter((m) => m.data >= saldoSalvato.data).reduce((s, m) => s + Number(m.importo), 0) + creditoDopoSaldo;
          const saldo = saldoSalvato.valore + acquistiDopoSaldo - pagatoDopoSaldo;
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
                    title="Modifica il saldo"
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
                    <label className="text-[10px] text-gray-400 block">Saldo €</label>
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
              {/* Solo gli acquisti aggiunti a mano col "+": i ricambi
                  segnati sulle consegne non contano piu' niente qui. */}
              <div className="flex justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <span>Ricambi: {fmtEuro(totaleAcquisti)}</span>
                <span>Pagato: {fmtEuro(totalePagato)}</span>
              </div>
              {aperto && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                  {appsFornitore.length === 0 && acquistiFornitore.length === 0 && movimentiFornitore.length === 0 ? (
                    <div className="text-[11px] text-gray-400 text-center py-2">Nessun movimento per questo fornitore</div>
                  ) : (
                    <>
                      {acquistiFornitore.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Acquisti (debito)</div>
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
                          </div>
                        </div>
                      )}
                      {(movimentiFornitore.length > 0 || appsFornitore.length > 0) && (
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Pagamenti fatti</div>
                          <div className="space-y-1">
                            {[
                              ...movimentiFornitore.map((m) => ({
                                id: m.id,
                                data: m.data.length <= 10 ? `${m.data}T00:00:00` : m.data,
                                label: `💶 ${m.descrizione || 'Pagamento'}`,
                                importo: Number(m.importo),
                              })),
                              ...appsFornitore.map((a) => ({
                                id: a.id,
                                data: a.pagamento?.data_consegna || a.data_ora,
                                label: `🔧 ${a.clienti?.nome || 'Cliente'}${a.veicoli?.targa ? ` — ${a.veicoli.targa}` : ''} · pagato dal cliente`,
                                importo: creditoFornitoreDiretto(a.pagamento),
                              })),
                            ]
                              .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                              .map((riga) => (
                                <div key={riga.id} className="flex items-center justify-between text-[11px] py-0.5">
                                  <span className="text-gray-600 truncate">
                                    {riga.label} · {new Date(riga.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                  </span>
                                  <span className="font-semibold text-emerald-700 shrink-0 ml-2">− {fmtEuro(riga.importo)}</span>
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
