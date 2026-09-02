import { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG, TIPO_LAVORAZIONE, detectTipoLavorazione } from '@/lib/constants';
import { fmtData, fmtOra, dayKey, todayKey } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { VehicleAlerts } from './VehicleAlerts';
import { leggiPromemoriaNascosti, nascondiPromemoria } from '@/lib/promemoriaNascosti';
import type { Appuntamento, Magazzino } from '@/types/database';

interface DashboardProps {
  onSelectAppuntamento: (a: Appuntamento) => void;
  onNavigateToAgenda?: (filtro?: string) => void;
  onNavigateToPreventivi?: () => void;
  onNavigateToGuida?: () => void;
}

export function Dashboard({ onSelectAppuntamento, onNavigateToAgenda, onNavigateToPreventivi, onNavigateToGuida }: DashboardProps) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [alertMagazzino, setAlertMagazzino] = useState<Magazzino[]>([]);
  const [obdCount, setObdCount] = useState(0);
  const [preventiviBozzaCount, setPreventiviBozzaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meseStats, setMeseStats] = useState<{ fatturato: number; lavori: number; nonFatturati: number } | null>(null);
  const [creditiNascosti, setCreditiNascosti] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!officina) return;

    try {
      setError(null);

      // Mese in ora locale: con toISOString(), tra le 00:00 e le 02:00 del
      // primo giorno del mese la query puntava ancora al mese precedente.
      const oggiDate = new Date();
      const meseCorrente = todayKey().slice(0, 7);
      // Primo giorno del mese successivo: "${mese}-31" non esiste ad aprile,
      // febbraio, giugno, settembre e novembre e Postgres rifiutava la query,
      // azzerando il fatturato per 5 mesi l'anno.
      const inizioMeseProssimo = dayKey(new Date(oggiDate.getFullYear(), oggiDate.getMonth() + 1, 1));

      const [appsResult, magazzinoResult, obdResult, prevResult, fattureResult, tutteFattureResult, nascosti] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select('*, clienti(nome,tel,email), veicoli(marca,modello,targa,km)')
          .eq('officina_id', officina.id)
          // Segnaposto di un preventivo non ancora confermato: non deve
          // contare ne' apparire tra i lavori della dashboard.
          .neq('stato', 'bozza_preventivo')
          .order('data_ora', { ascending: false }),
        supabase
          .from('magazzino')
          .select('*')
          .eq('officina_id', officina.id),
        supabase
          .from('scansioni_obd')
          .select('*', { count: 'exact', head: true })
          .eq('officina_id', officina.id)
          .eq('gestito', false),
        supabase
          .from('preventivi')
          .select('*', { count: 'exact', head: true })
          .eq('stato', 'bozza'),
        supabase
          .from('fatture')
          .select('totale, stato, appuntamento_id')
          .eq('officina_id', officina.id)
          .gte('data_emissione', `${meseCorrente}-01`)
          .lt('data_emissione', inizioMeseProssimo),
        // Serve l'elenco completo: i lavori "non fatturati" vanno confrontati
        // con tutte le fatture, non solo con quelle del mese corrente.
        supabase
          .from('fatture')
          .select('appuntamento_id')
          .eq('officina_id', officina.id),
        leggiPromemoriaNascosti(officina.id),
      ]);

      if (appsResult.error) throw appsResult.error;
      if (fattureResult.error) throw fattureResult.error;
      setCreditiNascosti(nascosti);

      const apps = appsResult.data || [];
      setAppuntamenti(apps);
      setAlertMagazzino(
        (magazzinoResult.data || []).filter((m) => m.quantita <= m.quantita_minima)
      );
      setObdCount(obdResult.count || 0);
      setPreventiviBozzaCount(prevResult.count || 0);

      const fatture = fattureResult.data || [];
      const fatturatoPagato = fatture
        .filter((f: { stato: string }) => f.stato === 'pagata' || f.stato === 'emessa')
        .reduce((sum: number, f: { totale?: number }) => sum + (f.totale || 0), 0);

      const fattureAppIds = new Set(
        (tutteFattureResult.data || [])
          .map((f: { appuntamento_id?: string }) => f.appuntamento_id)
          .filter(Boolean)
      );
      const nonFatturati = apps.filter(
        (a) => (a.stato === 'pronto' || a.stato === 'consegnato') && !fattureAppIds.has(a.id)
      ).length;

      setMeseStats({ fatturato: fatturatoPagato, lavori: fatture.length, nonFatturati });
    } catch (err: unknown) {
      console.error('Dashboard fetch error:', err);
      setError('Errore nel caricamento dei dati. Riprova.');
    } finally {
      setLoading(false);
    }
  }, [officina]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scansioni_obd' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  if (loading) return <Loader text="Caricamento dashboard..." />;

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <Card className="!p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-red-500 text-lg font-semibold mb-2">Errore</div>
          <p className="text-base text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button variant="primary" size="md" onClick={() => { setLoading(true); fetchData(); }}>
            Riprova
          </Button>
        </Card>
      </div>
    );
  }

  const oggi = todayKey();
  const appOggi = appuntamenti
    .filter((a) => a.data_ora && dayKey(a.data_ora) === oggi)
    .sort((a, b) => a.data_ora.localeCompare(b.data_ora));
  const richieste = appuntamenti.filter((a) => a.stato === 'richiesta');
  const autoInOfficina = appuntamenti.filter((a) => a.stato !== 'consegnato' && a.stato !== 'annullato' && a.stato !== 'richiesta');
  const pronti = appuntamenti.filter((a) => a.stato === 'pronto');
  // La lista e' ordinata per data decrescente: senza filtrare il futuro,
  // "Attivita recente" mostrava le prenotazioni piu' lontane nel tempo.
  const adesso = Date.now();
  const recenti = appuntamenti.filter((a) => new Date(a.data_ora).getTime() <= adesso).slice(0, 8);

  const crediti = appuntamenti.filter((a) =>
    a.stato === 'consegnato' && a.pagamento && a.pagamento.stato !== 'pagato' && !creditiNascosti.has(`credito:${a.id}`)
  );
  const totaleCrediti = crediti.reduce((sum, a) => {
    const p = a.pagamento!;
    if (p.stato === 'non_pagato') return sum + (p.importo_totale || 0);
    if (p.stato === 'acconto') return sum + ((p.importo_totale || 0) - (p.importo_pagato || 0));
    return sum;
  }, 0);

  const isNuovoUtente = appuntamenti.length === 0;

  // Nasconde solo dalla Home: il credito resta sull'appuntamento, ancora
  // modificabile da Cassa > Incassi officina o dallo storico del veicolo.
  const nascondiCredito = async (a: Appuntamento, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!officina) return;
    const chiave = `credito:${a.id}`;
    setCreditiNascosti((prev) => new Set(prev).add(chiave));
    await nascondiPromemoria(officina.id, chiave);
  };

  return (
    <div className="p-4 space-y-5">
      {isNuovoUtente && (
        <Card className="!p-6 bg-gradient-to-r from-blue-600 to-indigo-700 border-0 text-white animate-fade-in">
          <div className="text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold">Benvenuto su OfficinAI!</h2>
            <p className="text-base text-blue-100 mt-2 mb-5">
              La tua piattaforma e pronta. Leggi la guida per iniziare al meglio.
            </p>
            {onNavigateToGuida && (
              <button
                onClick={onNavigateToGuida}
                className="px-6 py-3 bg-white text-blue-700 rounded-xl font-semibold text-base hover:bg-blue-50 transition-colors cursor-pointer min-h-[48px]"
              >
                📖 Apri la guida completa
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {meseStats !== null && (
        <div className="grid grid-cols-3 gap-2 animate-fade-in">
          <Card className="!p-3 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 !border-emerald-200 dark:!border-emerald-700">
            <div className="text-[10px] text-emerald-600 font-semibold mb-1">💶 Fatturato</div>
            <div className="text-lg font-black text-emerald-700 tabular-nums leading-tight">
              {meseStats.fatturato > 0
                ? `€${meseStats.fatturato.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`
                : '—'}
            </div>
            <div className="text-[10px] text-emerald-500 mt-0.5">questo mese</div>
          </Card>

          <Card className="!p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 !border-blue-200 dark:!border-blue-700">
            <div className="text-[10px] text-blue-600 font-semibold mb-1">🧾 Fatturati</div>
            <div className="text-lg font-black text-blue-700 tabular-nums leading-tight">{meseStats.lavori}</div>
            <div className="text-[10px] text-blue-500 mt-0.5">lavori</div>
          </Card>

          <button onClick={() => onNavigateToAgenda?.('non_fatturati')} className="text-left cursor-pointer">
            <Card hover className={`!p-3 ${meseStats.nonFatturati > 0 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 !border-yellow-300' : 'bg-gray-50 !border-gray-200'}`}>
              <div className={`text-[10px] font-semibold mb-1 ${meseStats.nonFatturati > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>
                🔧 Non fatt.
              </div>
              <div className={`text-lg font-black tabular-nums leading-tight ${meseStats.nonFatturati > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>
                {meseStats.nonFatturati}
              </div>
              <div className={`text-[10px] mt-0.5 ${meseStats.nonFatturati > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                {meseStats.nonFatturati > 0 ? 'da fare →' : 'ok ✓'}
              </div>
            </Card>
          </button>
        </div>
      )}

      {richieste.length > 0 && (
        <Card className="!p-4 bg-purple-50 dark:bg-purple-900/20 !border-purple-200 dark:!border-purple-700 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔔</span>
            <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
              {richieste.length} nuov{richieste.length === 1 ? 'a' : 'e'} richiest{richieste.length === 1 ? 'a' : 'e'}
            </span>
          </div>
          <div className="space-y-2">
            {richieste.slice(0, 3).map((r) => {
              const tipo = detectTipoLavorazione(r.problema);
              const tipoInfo = TIPO_LAVORAZIONE[tipo];
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectAppuntamento(r)}
                  className="w-full flex items-center justify-between text-left p-3 bg-white dark:bg-gray-800 rounded-xl border border-purple-100 dark:border-purple-700 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl" title={tipoInfo.label}>{tipoInfo.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{r.clienti?.nome}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {r.veicoli?.marca} {r.veicoli?.modello} — {r.problema?.slice(0, 50)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap ml-3">
                    {fmtData(r.data_ora)} {fmtOra(r.data_ora)}
                  </div>
                </button>
              );
            })}
            {richieste.length > 3 && (
              <button
                onClick={() => onNavigateToAgenda?.('richiesta')}
                className="w-full text-center text-sm text-purple-600 dark:text-purple-400 font-semibold py-2 hover:underline cursor-pointer min-h-[44px]"
              >
                Vedi tutte le {richieste.length} richieste →
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <button onClick={() => onNavigateToAgenda?.('tutti')} className="text-left cursor-pointer col-span-3 sm:col-span-5">
          <Card hover className="!p-4 border-l-4 !border-l-blue-500 flex items-center gap-4">
            <div className="text-3xl">🚗</div>
            <div>
              <div className="text-2xl font-black text-blue-600 tabular-nums">{autoInOfficina.length}</div>
              <div className="text-sm text-gray-500 font-medium">Auto in officina</div>
            </div>
          </Card>
        </button>
        {Object.entries(STATO_CONFIG)
          .filter(([key]) => key !== 'bozza_preventivo')
          .map(([key, cfg]) => {
          const count = appuntamenti.filter((a) => a.stato === key).length;
          return (
            <button key={key} onClick={() => onNavigateToAgenda?.(key)} className="text-left cursor-pointer">
              <Card hover className="text-center !p-3">
                <div className="text-lg mb-1">{cfg.icon}</div>
                <div className="text-xl font-black tabular-nums" style={{ color: cfg.color }}>{count}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium leading-tight">{cfg.label}</div>
              </Card>
            </button>
          );
        })}
        {meseStats !== null && (
          <button onClick={() => onNavigateToAgenda?.('non_fatturati')} className="text-left cursor-pointer">
            <Card hover className="text-center !p-3" style={{ borderColor: meseStats.nonFatturati > 0 ? '#ea580c' : undefined }}>
              <div className="text-lg mb-1">🧾</div>
              <div className="text-xl font-black tabular-nums" style={{ color: meseStats.nonFatturati > 0 ? '#ea580c' : '#6b7280' }}>
                {meseStats.nonFatturati}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium leading-tight">Non fatt.</div>
            </Card>
          </button>
        )}
      </div>

      {pronti.length > 0 && (
        <button
          onClick={() => onNavigateToAgenda?.('pronto')}
          className="w-full text-left cursor-pointer animate-fade-in"
        >
          <Card className="!p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 !border-green-300 dark:!border-green-700 hover:!border-green-400 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-2xl shadow-sm shrink-0">
                ✅
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-green-800 dark:text-green-300">
                  {pronti.length} auto {pronti.length === 1 ? 'pronta' : 'pronte'} da consegnare
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  {pronti.slice(0, 2).map((a) => a.clienti?.nome).filter(Boolean).join(', ')}
                  {pronti.length > 2 && ` +${pronti.length - 2} altri`}
                </div>
              </div>
              <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Card>
        </button>
      )}

      {crediti.length > 0 && (
        <Card className="!p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 !border-red-300 dark:!border-red-700 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">💸</span>
              <span className="text-sm font-bold text-red-800 dark:text-red-300">
                Crediti da incassare
              </span>
            </div>
            {totaleCrediti > 0 && (
              <span className="text-base font-black text-red-700 tabular-nums">
                €{totaleCrediti.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {crediti.map((a) => {
              const p = a.pagamento!;
              const resto = p.stato === 'non_pagato'
                ? p.importo_totale
                : p.stato === 'acconto' ? (p.importo_totale || 0) - (p.importo_pagato || 0) : 0;
              return (
                <div
                  key={a.id}
                  onClick={() => onSelectAppuntamento(a)}
                  className="w-full flex items-center justify-between text-left p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-red-100 hover:border-red-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{p.stato === 'acconto' ? '💛' : '🔴'}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{a.clienti?.nome}</div>
                      <div className="text-[11px] text-gray-500">
                        {a.veicoli?.marca} {a.veicoli?.modello} {a.veicoli?.targa && `· ${a.veicoli.targa}`}
                      </div>
                      {p.note && <div className="text-[11px] text-gray-400 italic mt-0.5">{p.note}</div>}
                    </div>
                  </div>
                  <div className="flex items-start gap-1 shrink-0">
                    <div className="text-right ml-3 shrink-0">
                      {resto != null && resto > 0 && (
                        <div className="text-sm font-black text-red-600">€{resto.toFixed(2)}</div>
                      )}
                      <div className="text-[10px] text-gray-400">
                        {p.stato === 'acconto' ? 'acconto' : 'da pagare'}
                      </div>
                    </div>
                    <button
                      onClick={(e) => nascondiCredito(a, e)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer px-1"
                      title="Nascondi dalla Home"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(obdCount > 0 || preventiviBozzaCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {obdCount > 0 && (
            <Card className="!p-4 bg-orange-50 dark:bg-orange-900/20 !border-orange-200 dark:!border-orange-700">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <div>
                  <div className="text-sm font-bold text-orange-700 dark:text-orange-300">
                    {obdCount} scansion{obdCount > 1 ? 'i' : 'e'} OBD
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    Da gestire
                  </div>
                </div>
              </div>
            </Card>
          )}
          {preventiviBozzaCount > 0 && (
            <button onClick={onNavigateToPreventivi} className="text-left cursor-pointer">
              <Card className="!p-4 bg-yellow-50 dark:bg-yellow-900/20 !border-yellow-200 dark:!border-yellow-700 hover:!border-yellow-300 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  <div>
                    <div className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                      {preventiviBozzaCount} preventiv{preventiviBozzaCount > 1 ? 'i' : 'o'} in bozza
                    </div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                      Da completare
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          )}
        </div>
      )}

      {alertMagazzino.length > 0 && (
        <Card className="!p-4 bg-red-50 dark:bg-red-900/20 !border-red-200 dark:!border-red-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📦</span>
            <span className="text-sm font-bold text-red-700 dark:text-red-300">
              Alert Magazzino ({alertMagazzino.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertMagazzino.map((m) => (
              <Badge key={m.id} color="#991b1b" bg="#fecaca">
                {m.nome}: {m.quantita}/{m.quantita_minima}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <VehicleAlerts />

      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appuntamenti di oggi</h2>
          {appOggi.length > 0 && (
            <button
              onClick={() => onNavigateToAgenda?.('oggi')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold min-h-[44px] flex items-center"
            >
              Vedi tutti →
            </button>
          )}
        </div>
        {appOggi.length === 0 ? (
          <Card className="!p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">Nessun appuntamento per oggi</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Crea un nuovo appuntamento per iniziare</p>
            <Button
              variant="primary"
              size="md"
              className="mt-4 min-h-[48px]"
              onClick={() => onNavigateToAgenda?.('nuovo')}
            >
              + Nuovo appuntamento
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {appOggi.slice(0, 5).map((app) => {
              const stato = STATO_CONFIG[app.stato];
              const tipo = detectTipoLavorazione(app.problema);
              const tipoInfo = TIPO_LAVORAZIONE[tipo];
              return (
                <Card
                  key={app.id}
                  hover
                  className="!p-4"
                  onClick={() => onSelectAppuntamento(app)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stato.bg }}>
                      <span className="text-xl">{tipoInfo.icon}</span>
                      {officina?.logo_url && (
                        <img
                          src={officina.logo_url}
                          alt="Logo officina"
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          {fmtOra(app.data_ora)}
                        </span>
                        <span className="font-bold text-base text-gray-900 dark:text-white truncate">
                          {app.clienti?.nome || 'Cliente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {app.veicoli?.marca} {app.veicoli?.modello}
                        </span>
                        {app.veicoli?.targa && (
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {app.veicoli.targa}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge color={stato.color} bg={stato.bg} className="shrink-0">
                      {stato.icon} {stato.label}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Attività recente</h2>
        {recenti.length === 0 ? (
          <Card className="!p-8 text-center">
            <div className="text-4xl mb-3">🏁</div>
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">Nessuna attività registrata</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Le tue lavorazioni appariranno qui</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recenti.map((app) => {
              const stato = STATO_CONFIG[app.stato];
              const tipo = detectTipoLavorazione(app.problema);
              const tipoInfo = TIPO_LAVORAZIONE[tipo];
              return (
                <Card
                  key={app.id}
                  hover
                  className="!p-4"
                  onClick={() => onSelectAppuntamento(app)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
                      <span className="text-lg">{tipoInfo.icon}</span>
                      {officina?.logo_url && (
                        <img
                          src={officina.logo_url}
                          alt="Logo officina"
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-gray-900 dark:text-white truncate">
                          {app.clienti?.nome || 'Cliente'}
                        </span>
                        <Badge color={stato.color} bg={stato.bg}>
                          {stato.icon} {stato.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {app.veicoli?.marca} {app.veicoli?.modello}
                        </span>
                        {app.veicoli?.targa && (
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {app.veicoli.targa}
                          </span>
                        )}
                      </div>
                      {app.problema && (
                        <div className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {app.problema}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">{fmtData(app.data_ora)}</div>
                      <div className="text-sm text-gray-400 dark:text-gray-500">{fmtOra(app.data_ora)}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
