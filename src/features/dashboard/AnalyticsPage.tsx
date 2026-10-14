import { useEffect, useState, useMemo } from 'react';
import { Card, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro, dayKey } from '@/lib/format';
import { STATO_CONFIG } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { dataIncasso, valoreLavoro, usePeriodoNavigabile, SelettorePeriodoNavigabile } from '@/features/cassa/IncassiOfficina';
import { incassoMovimento, spesaMovimento, TIPI_CON_SPESE_LAVORAZIONE } from '@/features/cassa/movimentiTotali';
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
  // Periodo del report per collaboratore: giorno/settimana/mese/anno,
  // navigabile avanti/indietro o con un intervallo di date a scelta — come
  // in Cassa > Movimenti/Incassi officina, non i 7/30/90 giorni del resto
  // della pagina. Due selettori indipendenti: si puo' guardare il guadagno
  // di una settimana e le spese di un'altra senza che si influenzino.
  const navCollab = usePeriodoNavigabile('settimana');
  const navSpese = usePeriodoNavigabile('settimana');
  // Granularita' del grafico "Andamento guadagno netto": settimana per
  // settimana o mese per mese, per monitorare il trend dell'officina.
  const [granularitaAndamento, setGranularitaAndamento] = useState<'settimana' | 'mese'>('settimana');
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
  // che non sono un lavoro prodotto da lui/lei. Il costo ricambi si
  // toglie sempre dal guadagno (margine vero), a prescindere da chi e
  // quando paga il fornitore — a differenza di "spesa" in Cassa, che
  // conta solo i ricambi pagati subito dall'officina.
  const collaboratori = useMemo(() => {
    const consegnati = appuntamenti.filter(
      (a) => a.stato === 'consegnato' && a.pagamento && navCollab.inRangeSelezionato(dataIncasso(a))
    );
    const movimentiInPeriodo = movimenti.filter((m) => navCollab.inRangeSelezionato(dataMovimento(m)));

    return COLLABORATORI.map((nome) => {
      let incassi = 0;
      let spese = 0;
      const dettagli: { id: string; data: Date; label: string; sub: string; targa?: string; clienteId?: string; incasso: number; spesa: number; totaleLavoro?: number; costoRicambiTotale?: number }[] = [];

      consegnati.forEach((a) => {
        const operaioText = a.pagamento?.operaio;
        if (!menziona(operaioText, nome)) return;
        // Se il campo "operaio" cita piu' di un collaboratore (es. "Gianni
        // e Daniele": uno ha smontato, l'altro rimontato), il valore del
        // lavoro si divide in parti uguali fra chi e' citato, invece di
        // contare l'intero importo per ciascuno (altrimenti un lavoro da
        // 300€ risulterebbe 300€ per Gianni E 300€ per Daniele).
        const citati = COLLABORATORI.filter((n) => menziona(operaioText, n));
        const quota = citati.length > 1 ? 1 / citati.length : 1;
        const incasso = valoreLavoro(a) * quota;
        const spesa = (Number(a.pagamento?.costo_ricambi) || 0) * quota;
        incassi += incasso;
        spese += spesa;
        const veicolo = [a.veicoli?.marca, a.veicoli?.modello].filter(Boolean).join(' ');
        const altriCitati = citati.filter((n) => n !== nome);
        const notaQuota = altriCitati.length > 0
          ? (citati.length === 2 ? `metà con ${altriCitati.join(', ')}` : `quota ${Math.round(quota * 100)}% con ${altriCitati.join(', ')}`)
          : null;
        dettagli.push({
          id: `app-${a.id}`,
          data: dataIncasso(a),
          label: veicolo || 'Veicolo',
          sub: [a.problema, a.clienti?.nome, notaQuota].filter(Boolean).join(' · '),
          targa: a.veicoli?.targa || undefined,
          clienteId: a.cliente_id || undefined,
          incasso,
          spesa,
          // Valori della lavorazione intera (non divisi a meta'), solo per
          // riferimento: fanno capire da dove viene il guadagno netto
          // (gia' diviso) mostrato come cifra principale.
          totaleLavoro: valoreLavoro(a),
          costoRicambiTotale: Number(a.pagamento?.costo_ricambi) || 0,
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
  }, [appuntamenti, movimenti, navCollab.inRangeSelezionato]);

  // Spese per collaboratore: qui invece il contrario — tutte le spese
  // (titolare, dipendente, anticipi...) prese dalla cassa e assegnate a
  // lui, scelte dal menu a tendina (dipendente_id) o scritte nella
  // descrizione/nota. Esclusi i movimenti Revisione Gianni/Centraline
  // Daniele, che sono gia' contati (come lavorazione) nella finestra
  // "Guadagno". A differenza di "Guadagno" (solo i 4 collaboratori che
  // fanno lavorazioni), qui l'elenco e' TUTTI i dipendenti/titolari
  // registrati nell'officina — chiunque abbia una spesa assegnata deve
  // trovare un posto dove conteggiarla — piu' gli eventuali collaboratori
  // esterni (Gianni/Daniele) non registrati come utenti.
  const persone = useMemo(() => {
    const elenco: { key: string; nome: string; utenteId?: string }[] = dipendenti.map((d) => ({ key: d.id, nome: d.nome, utenteId: d.id }));
    COLLABORATORI.forEach((nome) => {
      if (!elenco.some((p) => menziona(p.nome, nome))) elenco.push({ key: nome, nome });
    });
    return elenco;
  }, [dipendenti]);

  const spesePerCollaboratore = useMemo(() => {
    const movimentiInPeriodo = movimenti.filter(
      (m) =>
        m.tipo !== 'spesa_revisione_gianni' && m.tipo !== 'spesa_centraline_daniele' &&
        navSpese.inRangeSelezionato(dataMovimento(m))
    );

    return persone.map(({ key, nome, utenteId }) => {
      let spese = 0;
      const dettagli: { id: string; data: Date; label: string; sub: string; spesa: number }[] = [];

      movimentiInPeriodo.forEach((m) => {
        const perId = !!utenteId && m.dipendente_id === utenteId;
        const perTestoLibero = !m.dipendente_id && (menziona(m.descrizione, nome) || menziona(m.note, nome));
        if (!perId && !perTestoLibero) return;
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
      return { id: key, nome, spese, voci: dettagli.length, dettagli };
    });
  }, [movimenti, persone, navSpese.inRangeSelezionato]);

  // Andamento del guadagno netto nel tempo (tutto insieme come incasso,
  // niente distinzione fatturato/non fatturato): un blocco per ciascuna
  // delle ultime settimane o mesi, stesso criterio di Incassi officina
  // (sempre il valore pieno del lavoro, pagato o no, meno costo
  // ricambi/lavorazione), per vedere a colpo d'occhio se l'officina sta
  // crescendo o calando periodo su periodo.
  const andamento = useMemo(() => {
    const nBlocchi = granularitaAndamento === 'settimana' ? 8 : 6;
    const oggi = new Date();
    const blocchi: { label: string; inizio: Date; fine: Date }[] = [];

    if (granularitaAndamento === 'settimana') {
      const inizioSettimanaCorrente = new Date(oggi);
      const giornoSettimana = (inizioSettimanaCorrente.getDay() + 6) % 7; // 0 = lunedi
      inizioSettimanaCorrente.setDate(inizioSettimanaCorrente.getDate() - giornoSettimana);
      inizioSettimanaCorrente.setHours(0, 0, 0, 0);
      for (let i = nBlocchi - 1; i >= 0; i--) {
        const inizio = new Date(inizioSettimanaCorrente);
        inizio.setDate(inizio.getDate() - i * 7);
        const fine = new Date(inizio);
        fine.setDate(fine.getDate() + 7);
        blocchi.push({ label: inizio.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), inizio, fine });
      }
    } else {
      for (let i = nBlocchi - 1; i >= 0; i--) {
        const inizio = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
        const fine = new Date(oggi.getFullYear(), oggi.getMonth() - i + 1, 1);
        blocchi.push({ label: inizio.toLocaleDateString('it-IT', { month: 'short' }), inizio, fine });
      }
    }

    const valori = blocchi.map(({ inizio, fine }) => {
      const consegne = appuntamenti.filter(
        (a) => a.stato === 'consegnato' && a.pagamento && dataIncasso(a) >= inizio && dataIncasso(a) < fine
      );
      const lavorazioni = movimenti.filter(
        (m) => TIPI_CON_SPESE_LAVORAZIONE.includes(m.tipo) && m.stato !== 'in_lavorazione' && dataMovimento(m) >= inizio && dataMovimento(m) < fine
      );
      const lordo = consegne.reduce((s, a) => s + valoreLavoro(a), 0) + lavorazioni.reduce((s, m) => s + incassoMovimento(m), 0);
      const costo = consegne.reduce((s, a) => s + (Number(a.pagamento?.costo_ricambi) || 0), 0) + lavorazioni.reduce((s, m) => s + (Number(m.spese_lavorazione) || 0), 0);
      return lordo - costo;
    });

    const max = Math.max(...valori.map((v) => Math.abs(v)), 1);
    const totale = valori.reduce((s, v) => s + v, 0);
    const media = totale / nBlocchi;
    const ultimo = valori[valori.length - 1];
    const precedente = valori[valori.length - 2];
    // Variazione % fra l'ultimo blocco e il precedente, per dare subito un
    // verso al trend (cresce/cala) senza dover leggere tutti i numeri.
    const variazionePct = precedente !== 0 ? ((ultimo - precedente) / Math.abs(precedente)) * 100 : null;

    return {
      serie: blocchi.map((b, i) => ({ ...b, netto: valori[i] })),
      max,
      totale,
      media,
      variazionePct,
    };
  }, [appuntamenti, movimenti, granularitaAndamento]);

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

      {/* Andamento guadagno netto: tutto insieme come incasso, nessuna
          distinzione fatturato/non fatturato, solo il trend nel tempo. */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500">ANDAMENTO GUADAGNO NETTO</h3>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['settimana', 'mese'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularitaAndamento(g)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer ${
                  granularitaAndamento === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                {g === 'settimana' ? 'Settimane' : 'Mesi'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-24 mb-1">
          {andamento.serie.map((b, i) => {
            const h = Math.max(4, (Math.abs(b.netto) / andamento.max) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${b.label}: ${fmtEuro(b.netto)}`}>
                <div
                  className={`w-full rounded-t-sm transition-all ${b.netto >= 0 ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-400 hover:bg-red-500'}`}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mb-3">
          {andamento.serie.map((b, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-gray-400 truncate">{b.label}</div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-gray-100">
          <div>
            <div className="text-sm font-bold text-gray-900">{fmtEuro(andamento.totale)}</div>
            <div className="text-[10px] text-gray-400">Totale periodo</div>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{fmtEuro(andamento.media)}</div>
            <div className="text-[10px] text-gray-400">Media per {granularitaAndamento === 'settimana' ? 'settimana' : 'mese'}</div>
          </div>
          <div>
            <div className={`text-sm font-bold ${
              andamento.variazionePct === null ? 'text-gray-400' : andamento.variazionePct >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {andamento.variazionePct === null ? '—' : `${andamento.variazionePct >= 0 ? '▲' : '▼'} ${Math.abs(andamento.variazionePct).toFixed(0)}%`}
            </div>
            <div className="text-[10px] text-gray-400">vs {granularitaAndamento === 'settimana' ? 'settimana' : 'mese'} prima</div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 mt-2">
          Guadagno netto (lavorazioni svolte meno costo ricambi/lavorazione) delle ultime {andamento.serie.length} {granularitaAndamento === 'settimana' ? 'settimane' : 'mesi'}, contato tutto insieme come incasso a prescindere da quando/se viene davvero pagato — stesso criterio di Incassi officina.
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
        <SelettorePeriodoNavigabile nav={navCollab} />
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
                        const netto = d.incasso - d.spesa;
                        const contenuto = (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-800 truncate">
                                {d.label}{d.targa && <span className="ml-1.5 font-mono text-[10px] text-gray-500">{d.targa}</span>}
                              </span>
                              <span className={`text-xs font-bold shrink-0 ${netto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {netto >= 0 ? '+' : ''}{fmtEuro(netto)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-gray-400 mt-0.5">
                              <span className="truncate">{d.sub} · {d.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                            {d.totaleLavoro !== undefined && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Totale lavoro {fmtEuro(d.totaleLavoro)}{d.costoRicambiTotale ? ` · Ricambi ${fmtEuro(d.costoRicambiTotale)}` : ''}
                              </div>
                            )}
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
          Solo lavorazioni: campo "operaio" della consegna auto e movimenti Revisione Gianni/Centraline Daniele — non spese titolare/dipendente. Se nel campo "operaio" sono scritti più nomi (es. uno smonta, l'altro rimonta), l'importo si divide in parti uguali fra loro. Clicca su un nome per vedere i lavori.
        </div>
      </Card>

      {/* Spese per collaboratore */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">SPESE PER COLLABORATORE</h3>
        <SelettorePeriodoNavigabile nav={navSpese} />
        <div className="space-y-2">
          {spesePerCollaboratore.map((c) => {
            const espanso = speseEspanse === c.id;
            return (
              <div key={c.id} className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
                <button
                  onClick={() => setSpeseEspanse(espanso ? null : c.id)}
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
          Tutte le spese dalla cassa assegnate a dipendenti e titolari (menu a tendina in Movimenti), piu' quelle scritte nella descrizione/nota senza nessuno selezionato. Clicca su un nome per vedere le voci.
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
