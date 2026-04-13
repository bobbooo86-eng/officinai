import { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG, TIPO_LAVORAZIONE, detectTipoLavorazione } from '@/lib/constants';
import { fmtData, fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { VehicleAlerts } from './VehicleAlerts';
import type { Appuntamento, Magazzino } from '@/types/database';

interface DashboardProps {
  onSelectAppuntamento: (a: Appuntamento) => void;
  onNavigateToAgenda?: (filtro?: string) => void;
  onNavigateToPreventivi?: () => void;
  onNavigateToGuida?: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function Dashboard({ onSelectAppuntamento, onNavigateToAgenda, onNavigateToPreventivi, onNavigateToGuida }: DashboardProps) {
  const { officina, utente } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [alertMagazzino, setAlertMagazzino] = useState<Magazzino[]>([]);
  const [obdCount, setObdCount] = useState(0);
  const [preventiviBozzaCount, setPreventiviBozzaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!officina) return;

    try {
      setError(null);

      const [appsResult, magazzinoResult, obdResult, prevResult] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select('*, clienti(nome,tel,email), veicoli(marca,modello,targa,km)')
          .eq('officina_id', officina.id)
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
      ]);

      if (appsResult.error) throw appsResult.error;

      setAppuntamenti(appsResult.data || []);
      setAlertMagazzino(
        (magazzinoResult.data || []).filter((m) => m.quantita <= m.quantita_minima)
      );
      setObdCount(obdResult.count || 0);
      setPreventiviBozzaCount(prevResult.count || 0);
    } catch (err: any) {
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

  const oggi = new Date().toISOString().slice(0, 10);
  const appOggi = appuntamenti
    .filter((a) => a.data_ora?.startsWith(oggi))
    .sort((a, b) => a.data_ora.localeCompare(b.data_ora));
  const richieste = appuntamenti.filter((a) => a.stato === 'richiesta');
  const inCorso = appuntamenti.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi');
  const autoInOfficina = appuntamenti.filter((a) => a.stato === 'in_diagnosi' || a.stato === 'in_lavorazione' || a.stato === 'attesa_ricambi');
  const nonInLavorazione = appuntamenti.filter((a) => a.stato === 'prenotato');
  const pronti = appuntamenti.filter((a) => a.stato === 'pronto');
  const consegnati = appuntamenti.filter((a) => a.stato === 'consegnato');
  const recenti = appuntamenti.slice(0, 8);

  const isNuovoUtente = appuntamenti.length === 0;

  return (
    <div className="p-4 space-y-5">
      {/* Welcome banner for new users */}
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

      {/* Header with dynamic greeting and quick actions */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {utente?.nome?.split(' ')[0] || 'Officina'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/* Buttons removed — use tabs instead */}
      </div>

      {/* Pending requests alert */}
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

      {/* KPIs — larger, with colored borders */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'Richieste', count: richieste.length, color: 'purple', filter: 'richiesta', icon: '🔔' },
          { label: 'Auto in officina', count: autoInOfficina.length, color: 'orange', filter: 'in_corso', icon: '🚗' },
          { label: 'Non in lavorazione', count: nonInLavorazione.length, color: 'amber', filter: 'prenotato', icon: '⏳' },
          { label: 'Pronti', count: pronti.length, color: 'emerald', filter: 'pronto', icon: '✅' },
          { label: 'Consegnati', count: consegnati.length, color: 'gray', filter: 'consegnato', icon: '🏁' },
        ].map((kpi) => (
          <button key={kpi.filter} onClick={() => onNavigateToAgenda?.(kpi.filter)} className="text-left cursor-pointer">
            <Card hover className={`text-center !p-4 border-l-4 !border-l-${kpi.color}-500 ${kpi.count > 0 && kpi.filter === 'in_corso' ? 'animate-pulse-glow' : ''}`}>
              <div className="text-lg mb-1">{kpi.icon}</div>
              <div className={`text-2xl font-black text-${kpi.color}-600 tabular-nums`}>{kpi.count}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{kpi.label}</div>
            </Card>
          </button>
        ))}
      </div>

      {/* Secondary alerts row: OBD + Preventivi bozza */}
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

      {/* Warehouse alerts */}
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

      {/* Vehicle expiry alerts */}
      <VehicleAlerts />

      {/* Today's appointments */}
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
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stato.bg }}>
                      <span className="text-xl">{tipoInfo.icon}</span>
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

      {/* Recent activity */}
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
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
                      <span className="text-lg">{tipoInfo.icon}</span>
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
