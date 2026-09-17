import { useEffect, useState, useMemo } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro, dayKey } from '@/lib/format';
import { STATO_CONFIG } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { dataIncasso, inPeriodo, valoreLavoro, PERIODI, type Periodo } from '@/features/cassa/IncassiOfficina';
import { incassoMovimento, spesaMovimento, spesaRicambi } from '@/features/cassa/movimentiTotali';
import type { Appuntamento, Preventivo, Recensione, Movimento, Utente } from '@/types/database';

// Nomi da cercare ovunque compaiano — nel campo "operaio" della consegna,
// nella descrizione/nota di un movimento, o gia' attribuiti dal tipo
// stesso (Revisione Gianni, Centraline Daniele).
const COLLABORATORI = ['Daniele', 'Antonello', 'Gianni', 'Massimo'] as const;

function menziona(testo: string | null | undefined, nome: string): boolean {
  return !!testo && testo.toLowerCase().includes(nome.toLowerCase());
}

const dataMovimento = (m: Movimento) => new Date(m.data + 'T00:00:00');

export function AnalyticsPage({ onNavigateToCliente }: { onNavigateToCliente?: (clienteId: string) => void } = {}) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [preventivi, setPreventivi] = useState<Preventivo[]>([]);
  const [recensioni, setRecensioni] = useState<Recensione[]>([]);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [dipendenti, setDipendenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | 'anno'>('30d');
  // Periodo del report per collaboratore: giorno/settimana/mese/anno, come
  // in Cassa > Incassi officina, non i 7/30/90 giorni del resto della pagina.
  const [periodoCollab, setPeriodoCollab] = useState<Periodo>('settimana');
  const [periodoSpese, setPeriodoSpese] = useState<Periodo>('settimana');
  // Collaboratore i cui lavori/spese sono espansi (un solo elenco alla volta per finestra).
  const [collabEspanso, setCollabEspanso] = useState<string | null>(null);
  const [speseEspanse, setSpeseEspanse] = useState<string | null>(null);

  useEffect(() => {
    if (!officina) return;
    const fetch = async () => {
      const [{ data: apps }, { data: prev }, { data: rec }, { data: mov }, { data: dip }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select('*')
          .eq('officina_id', officina.id)
          .neq('stato', 'bozza_preventivo')
          .order('data_ora', { ascending: false }),
        supabase
          .from('preventivi')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('recensioni')
          .select('*')
          .eq('officina_id', officina.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('movimenti')
          .select('*')
          .eq('officina_id', officina.id),
        supabase
          .from('utenti')
          .select('*')
          .eq('officina_id', officina.id),
      ]);
      setAppuntamenti(apps || []);
      setPreventivi(prev || []);
      setRecensioni(rec || []);
      setMovimenti(mov || []);
      setDipendenti(dip || []);
      setLoading(false);
    };
    fetch();
  }, [officina]);

  const stats = useMemo(() => {
    const now = new Date();
    const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : periodo === '90d' ? 90 : 365;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const appsInPeriod = appuntamenti.filter((a) => a.data_ora >= cutoff);
    const prevInPeriod = preventivi.filter((p) => (p.created_at || '') >= cutoff);

    const totalePreventivi = prevInPeriod.reduce((s, p) => s + (p.totale || 0), 0);
    const prevAccettati = prevInPeriod.filter((p) => p.stato === 'accettato');
    const totaleAccettati = prevAccettati.reduce((s, p) => s + (p.totale || 0), 0);
    const tassoAccettazione = prevInPeriod.length > 0
      ? (prevAccettati.length / prevInPeriod.length) * 100
      : 0;

    // Status distribution
    const statusDist: Record<string, number> = {};
    appsInPeriod.forEach((a) => {
      statusDist[a.stato] = (statusDist[a.stato] || 0) + 1;
    });

    // Daily appointments for sparkline
    const dailyApps: Record<string, number> = {};
    for (let i = 0; i < Math.min(days, 30); i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyApps[key] = 0;
    }
    appsInPeriod.forEach((a) => {
      const key = a.data_ora ? dayKey(a.data_ora) : undefined;
      if (key && dailyApps[key] !== undefined) {
        dailyApps[key]++;
      }
    });

    const dailyValues = Object.values(dailyApps).reverse();
    const maxDaily = Math.max(...dailyValues, 1);

    return {
      totaleAppuntamenti: appsInPeriod.length,
      completati: appsInPeriod.filter((a) => a.stato === 'pronto').length,
      inCorso: appsInPeriod.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi').length,
      totalePreventivi,
      totaleAccettati,
      numPreventivi: prevInPeriod.length,
      numAccettati: prevAccettati.length,
      tassoAccettazione,
      statusDist,
      dailyValues,
      maxDaily,
      mediaGiornaliera: appsInPeriod.length / days,
    };
  }, [appuntamenti, preventivi, periodo]);

  // Guadagno per collaboratore: solo lavorazioni vere e proprie svolte da
  // quella persona (consegne auto dove e' "operaio", voci Revisione
  // Gianni/Centraline Daniele) — non spese titolare/dipendente/acconti,
  // che non sono un lavoro prodotto da lui/lei. Stesso criterio "valore
  // lavoro - ricambi" di Incassi officina, cosi' i numeri non si
  // contraddicono fra le pagine.
  const collaboratori = useMemo(() => {
    const riferimento = new Date();
    const consegnati = appuntamenti.filter(
      (a) => a.stato === 'consegnato' && a.pagamento && inPeriodo(dataIncasso(a), periodoCollab, riferimento)
    );
    const movimentiInPeriodo = movimenti.filter((m) => inPeriodo(dataMovimento(m), periodoCollab, riferimento));

    return COLLABORATORI.map((nome) => {
      let incassi = 0;
      let spese = 0;
      const dettagli: { id: string; data: Date; label: string; sub: string; targa?: string; clienteId?: string; incasso: number; spesa: number }[] = [];

      consegnati.forEach((a) => {
        if (!menziona(a.pagamento?.operaio, nome)) return;
        const incasso = valoreLavoro(a);
        const spesa = spesaRicambi(a.pagamento);
        incassi += incasso;
        spese += spesa;
        const veicolo = [a.veicoli?.marca, a.veicoli?.modello].filter(Boolean).join(' ');
        dettagli.push({
          id: `app-${a.id}`,
          data: dataIncasso(a),
          label: veicolo || 'Veicolo',
          sub: [a.problema, a.clienti?.nome].filter(Boolean).join(' · '),
          targa: a.veicoli?.targa || undefined,
          clienteId: a.cliente_id || undefined,
          incasso,
          spesa,
        });
      });

      movimentiInPeriodo.forEach((m) => {
        const perGianni = nome === 'Gianni' && m.tipo === 'spesa_revisione_gianni';
        const perDaniele = nome === 'Daniele' && m.tipo === 'spesa_centraline_daniele';
        if (!perGianni && !perDaniele) return;
        const incasso = incassoMovimento(m);
        const spesa = spesaMovimento(m);
        incassi += incasso;
        spese += spesa;
        dettagli.push({
          id: `mov-${m.id}`,
          data: dataMovimento(m),
          label: m.descrizione || (perGianni ? 'Revisione Gianni' : 'Centraline Daniele'),
          sub: perGianni ? 'Revisione Gianni' : 'Centraline Daniele',
          incasso,
          spesa,
        });
      });

      dettagli.sort((x, y) => y.data.getTime() - x.data.getTime());
      return { nome, incassi, spese, netto: incassi - spese, lavori: dettagli.length, dettagli };
    });
  }, [appuntamenti, movimenti, periodoCollab]);

  // Spese per collaboratore: qui invece il contrario — solo le spese
  // titolare/dipendente/acconti prese dalla cassa per lui, scelte dal
  // menu a tendina (dipendente_id) o scritte nella descrizione/nota.
  // Esclusi i movimenti Revisione Gianni/Centraline Daniele, che sono
  // gia' contati (come lavorazione) nella finestra "Guadagno".
  const spesePerCollaboratore = useMemo(() => {
    const riferimento = new Date();
    const movimentiInPeriodo = movimenti.filter(
      (m) =>
        m.tipo !== 'spesa_revisione_gianni' && m.tipo !== 'spesa_centraline_daniele' &&
        inPeriodo(dataMovimento(m), periodoSpese, riferimento)
    );

    return COLLABORATORI.map((nome) => {
      let spese = 0;
      const dettagli: { id: string; data: Date; label: string; sub: string; spesa: number }[] = [];

      movimentiInPeriodo.forEach((m) => {
        const dipendente = m.dipendente_id ? dipendenti.find((d) => d.id === m.dipendente_id) : null;
        const perDipendente = !!dipendente && menziona(dipendente.nome, nome);
        const perTestoLibero = menziona(m.descrizione, nome) || menziona(m.note, nome);
        if (!perDipendente && !perTestoLibero) return;
        const spesa = spesaMovimento(m);
        if (spesa <= 0) return;
        spese += spesa;
        dettagli.push({
          id: `spesa-${m.id}`,
          data: dataMovimento(m),
          label: m.descrizione || m.tipo.replace(/_/g, ' '),
          sub: m.tipo.replace(/_/g, ' '),
          spesa,
        });
      });

      dettagli.sort((x, y) => y.data.getTime() - x.data.getTime());
      return { nome, spese, voci: dettagli.length, dettagli };
    });
  }, [movimenti, dipendenti, periodoSpese]);

  const exportCSV = () => {
    const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : periodo === '90d' ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const appsInPeriod = appuntamenti.filter((a) => a.data_ora >= cutoff);

    const header = 'Data,Stato,Problema,Cliente ID,Veicolo ID\n';
    const rows = appsInPeriod.map((a) =>
      `${a.data_ora ? dayKey(a.data_ora) : ''},${a.stato},"${(a.problema || '').replace(/"/g, '""')}",${a.cliente_id},${a.veicolo_id}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `officinai-report-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader text="Caricamento analytics..." />;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
          <button
            onClick={exportCSV}
            className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[10px] font-medium text-gray-600 cursor-pointer"
            title="Esporta CSV"
          >
            📥 CSV
          </button>
        </div>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(['7d', '30d', '90d', 'anno'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer ${
                periodo === p ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {p === '7d' ? '7G' : p === '30d' ? '30G' : p === '90d' ? '90G' : 'Anno'}
            </button>
          ))}
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totaleAppuntamenti}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Appuntamenti</div>
        </Card>
        <Card className="!p-4 text-center">
          <div className="text-3xl font-bold text-emerald-600">{fmtEuro(stats.totaleAccettati)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Fatturato preventivi</div>
        </Card>
      </div>

      {/* Revenue card */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">FATTURATO PREVENTIVI</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">{stats.numPreventivi}</div>
            <div className="text-[10px] text-gray-400">Emessi</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-600">{stats.numAccettati}</div>
            <div className="text-[10px] text-gray-400">Accettati</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.tassoAccettazione.toFixed(0)}%</div>
            <div className="text-[10px] text-gray-400">Conversione</div>
          </div>
        </div>
        {/* Conversion bar */}
        <div className="mt-3 w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${stats.tassoAccettazione}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>Tot. emesso: {fmtEuro(stats.totalePreventivi)}</span>
          <span>Tot. accettato: {fmtEuro(stats.totaleAccettati)}</span>
        </div>
      </Card>

      {/* Mini sparkline chart */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">APPUNTAMENTI GIORNALIERI</h3>
        <div className="flex items-end gap-[2px] h-16">
          {stats.dailyValues.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500 rounded-t-sm min-h-[2px] transition-all hover:bg-blue-600"
              style={{ height: `${(v / stats.maxDaily) * 100}%` }}
              title={`${v} appuntamenti`}
            />
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">
          Media: {stats.mediaGiornaliera.toFixed(1)} appuntamenti/giorno
        </div>
      </Card>

      {/* Guadagno per collaboratore */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">GUADAGNO PER COLLABORATORE</h3>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {PERIODI.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodoCollab(p.id)}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                periodoCollab === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {collaboratori.map((c) => {
            const espanso = collabEspanso === c.nome;
            return (
              <div key={c.nome} className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
                <button
                  onClick={() => setCollabEspanso(espanso ? null : c.nome)}
                  className="w-full text-left p-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      {c.nome} <span className="text-gray-400 text-xs">{espanso ? '▲' : '▼'}</span>
                    </span>
                    <span className={`text-sm font-bold ${c.netto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtEuro(c.netto)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>{c.lavori} lavor{c.lavori === 1 ? 'o' : 'i'}</span>
                    <span>Incassi {fmtEuro(c.incassi)} · Spese {fmtEuro(c.spese)}</span>
                  </div>
                </button>
                {espanso && (
                  <div className="border-t border-gray-200 divide-y divide-gray-100 bg-white">
                    {c.dettagli.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">Nessun lavoro in questo periodo</div>
                    ) : (
                      c.dettagli.map((d) => {
                        const cliccabile = !!d.clienteId && !!onNavigateToCliente;
                        const contenuto = (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-800 truncate">
                                {d.label}{d.targa && <span className="ml-1.5 font-mono text-[10px] text-gray-500">{d.targa}</span>}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 shrink-0">+{fmtEuro(d.incasso)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-gray-400 mt-0.5">
                              <span className="truncate">{d.sub} · {d.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              {d.spesa > 0 && <span className="text-red-500 shrink-0">− {fmtEuro(d.spesa)}</span>}
                            </div>
                            {cliccabile && (
                              <div className="text-[9px] text-blue-500 mt-0.5">Tocca per vedere la scheda cliente →</div>
                            )}
                          </>
                        );
                        return cliccabile ? (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => onNavigateToCliente!(d.clienteId!)}
                            className="p-2.5 w-full text-left block cursor-pointer hover:bg-gray-50"
                          >
                            {contenuto}
                          </button>
                        ) : (
                          <div key={d.id} className="p-2.5">
                            {contenuto}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">
          Solo lavorazioni: campo "operaio" della consegna auto e movimenti Revisione Gianni/Centraline Daniele — non spese titolare/dipendente. Clicca su un nome per vedere i lavori.
        </div>
      </Card>

      {/* Spese per collaboratore */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">SPESE PER COLLABORATORE</h3>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {PERIODI.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodoSpese(p.id)}
              className={`py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                periodoSpese === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {spesePerCollaboratore.map((c) => {
            const espanso = speseEspanse === c.nome;
            return (
              <div key={c.nome} className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
                <button
                  onClick={() => setSpeseEspanse(espanso ? null : c.nome)}
                  className="w-full text-left p-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      {c.nome} <span className="text-gray-400 text-xs">{espanso ? '▲' : '▼'}</span>
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      {fmtEuro(c.spese)}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {c.voci} voc{c.voci === 1 ? 'e' : 'i'}
                  </div>
                </button>
                {espanso && (
                  <div className="border-t border-gray-200 divide-y divide-gray-100 bg-white">
                    {c.dettagli.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">Nessuna spesa in questo periodo</div>
                    ) : (
                      c.dettagli.map((d) => (
                        <div key={d.id} className="p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-800 truncate">{d.label}</span>
                            <span className="text-xs font-bold text-red-600 shrink-0">− {fmtEuro(d.spesa)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                            {d.sub} · {d.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">
          Spese titolare/dipendente/acconti prese dalla cassa per lui, scelte dal menu a tendina o scritte nella descrizione/nota. Clicca su un nome per vedere le voci.
        </div>
      </Card>

      {/* Status distribution */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">DISTRIBUZIONE STATI</h3>
        <div className="space-y-2">
          {Object.entries(stats.statusDist).map(([stato, count]) => {
            const cfg = STATO_CONFIG[stato as keyof typeof STATO_CONFIG];
            if (!cfg) return null;
            const pct = stats.totaleAppuntamenti > 0 ? (count / stats.totaleAppuntamenti) * 100 : 0;
            return (
              <div key={stato}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700">{cfg.icon} {cfg.label}</span>
                  <span className="text-xs font-semibold text-gray-900">{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="!p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{stats.completati}</div>
          <div className="text-[10px] text-gray-400">Completati</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-xl font-bold text-amber-500">{stats.inCorso}</div>
          <div className="text-[10px] text-gray-400">In corso</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-xl font-bold text-gray-600">
            {stats.totaleAppuntamenti > 0
              ? fmtEuro(stats.totaleAccettati / stats.totaleAppuntamenti)
              : '€0'
            }
          </div>
          <div className="text-[10px] text-gray-400">Media/app</div>
        </Card>
      </div>

      {/* Recensioni clienti */}
      {recensioni.length > 0 && (
        <Card className="!p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">RECENSIONI CLIENTI</h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-bold text-amber-500">
              {(recensioni.reduce((s, r) => s + r.voto, 0) / recensioni.length).toFixed(1)}
            </div>
            <div>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className={`text-sm ${
                    s <= Math.round(recensioni.reduce((sum, r) => sum + r.voto, 0) / recensioni.length)
                      ? 'opacity-100' : 'opacity-20'
                  }`}>⭐</span>
                ))}
              </div>
              <div className="text-[10px] text-gray-400">{recensioni.length} recensioni</div>
            </div>
          </div>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((s) => {
              const count = recensioni.filter((r) => r.voto === s).length;
              const pct = recensioni.length > 0 ? (count / recensioni.length) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-gray-500">{s}</span>
                  <span className="text-[10px]">⭐</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-gray-400">{count}</span>
                </div>
              );
            })}
          </div>
          {/* Latest comments */}
          {recensioni.filter((r) => r.commento).slice(0, 3).map((r) => (
            <div key={r.id} className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1 mb-0.5">
                {Array.from({ length: r.voto }).map((_, i) => (
                  <span key={i} className="text-[10px]">⭐</span>
                ))}
              </div>
              <p className="text-xs text-gray-600 italic">"{r.commento}"</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
