import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Appuntamento, Movimento, MovimentoTipo } from '@/types/database';

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

/**
 * Conto corrente con ciascun fornitore di ricambi: quanto e' stato segnato
 * come "ricambi da {fornitore}" sulle consegne (il debito che cresce) meno
 * quanto e' gia' stato pagato (i movimenti spesa_autoricambi/spesa_monti
 * registrati in Cassa > Movimenti). Non e' legato al periodo selezionato
 * altrove in Cassa: e' un saldo che resta finche' non viene saldato, come
 * il tab "Da incassare".
 */
export function FornitoriRicambi({ officinaId }: { officinaId?: string }) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [espanso, setEspanso] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!officinaId) return;
    setLoading(true);
    const [{ data: apps }, { data: movs }] = await Promise.all([
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
    ]);
    setAppuntamenti((apps as Appuntamento[]) || []);
    setMovimenti((movs as Movimento[]) || []);
    setLoading(false);
  }, [officinaId]);

  useEffect(() => {
    load();
    if (!officinaId) return;
    const ch = supabase
      .channel('fornitori-ricambi-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti', filter: `officina_id=eq.${officinaId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [officinaId, load]);

  if (!officinaId) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400 px-1">
        Il saldo cresce quando su una consegna segni "da chi" vengono i ricambi, e scende quando registri un pagamento a quel fornitore da Movimenti.
      </p>
      {loading ? (
        <div className="text-center py-6 text-xs text-gray-400">Caricamento...</div>
      ) : (
        FORNITORI_RICAMBI.map((f) => {
          const appsFornitore = appuntamenti
            .filter((a) => a.pagamento?.fornitore_ricambi === f.id && (a.pagamento?.costo_ricambi || 0) > 0)
            .sort((a, b) => new Date(b.pagamento?.data_consegna || b.data_ora).getTime() - new Date(a.pagamento?.data_consegna || a.data_ora).getTime());
          // "Pagati subito" (es. saldato sul momento, o il cliente paga il
          // fornitore direttamente): quel lavoro non resta da pagare, va
          // escluso dal saldo anche se e' segnato su questo fornitore.
          const daPagare = appsFornitore.filter((a) => !a.pagamento?.ricambi_pagati_subito);
          const totaleNonSaldato = daPagare.reduce((s, a) => s + (a.pagamento?.costo_ricambi || 0), 0);
          const totaleSegnato = appsFornitore.reduce((s, a) => s + (a.pagamento?.costo_ricambi || 0), 0);
          const totalePagato = movimenti
            .filter((m) => m.tipo === f.tipoMovimento)
            .reduce((s, m) => s + Number(m.importo), 0);
          const saldo = totaleNonSaldato - totalePagato;
          const aperto = espanso === f.id;

          return (
            <Card key={f.id} className="!p-3">
              <button
                onClick={() => setEspanso(aperto ? null : f.id)}
                className="w-full flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${saldo > 0.009 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmtEuro(Math.max(0, saldo))}
                  </div>
                  <div className="text-[10px] text-gray-400">da pagare</div>
                </div>
              </button>
              <div className="flex justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
                <span>Ricambi segnati: {fmtEuro(totaleSegnato)}</span>
                <span>Pagato: {fmtEuro(totalePagato)}</span>
              </div>
              {aperto && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  {appsFornitore.length === 0 ? (
                    <div className="text-[11px] text-gray-400 text-center py-2">Nessun ricambio segnato per questo fornitore</div>
                  ) : (
                    appsFornitore.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-gray-600 truncate">
                          {a.clienti?.nome || 'Cliente'}{a.veicoli?.targa ? ` — ${a.veicoli.targa}` : ''}
                          {a.pagamento?.ricambi_pagati_subito && <span className="text-emerald-600"> · saldato</span>}
                        </span>
                        <span className={`font-semibold shrink-0 ml-2 ${a.pagamento?.ricambi_pagati_subito ? 'text-gray-400' : 'text-gray-700'}`}>
                          {fmtEuro(a.pagamento?.costo_ricambi || 0)}
                        </span>
                      </div>
                    ))
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
