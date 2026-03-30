import { useEffect, useState } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtData, fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { VehicleAlerts } from './VehicleAlerts';
import type { Appuntamento, Magazzino } from '@/types/database';

interface DashboardProps {
  onSelectAppuntamento: (a: Appuntamento) => void;
  onNavigateToAgenda?: (filtro?: string) => void;
}

export function Dashboard({ onSelectAppuntamento, onNavigateToAgenda }: DashboardProps) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [alertMagazzino, setAlertMagazzino] = useState<Magazzino[]>([]);
  const [obdCount, setObdCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!officina) return;

    const [{ data: apps }, { data: magazzino }, { count: obdPending }] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa,km)')
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
    ]);

    setAppuntamenti(apps || []);
    setAlertMagazzino((magazzino || []).filter((m) => m.quantita <= m.quantita_minima));
    setObdCount(obdPending || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [officina]);

  if (loading) return <Loader text="Caricamento dashboard..." />;

  const oggi = new Date().toISOString().slice(0, 10);
  const appOggi = appuntamenti.filter((a) => a.data_ora?.startsWith(oggi));
  const richieste = appuntamenti.filter((a) => a.stato === 'richiesta');
  const inCorso = appuntamenti.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi');
  const pronti = appuntamenti.filter((a) => a.stato === 'pronto');
  const recenti = appuntamenti.slice(0, 8);

  return (
    <div className="p-4 space-y-4">
      {/* Pending requests alert */}
      {richieste.length > 0 && (
        <Card className="!p-3 bg-purple-50 !border-purple-200">
          <div className="text-xs font-semibold text-purple-700 mb-1">
            🔔 Nuove richieste ({richieste.length})
          </div>
          <div className="space-y-1.5">
            {richieste.slice(0, 3).map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectAppuntamento(r)}
                className="w-full flex items-center justify-between text-left p-2 bg-white rounded-lg border border-purple-100 hover:border-purple-300 transition-colors cursor-pointer"
              >
                <div>
                  <div className="text-xs font-medium text-gray-900">{r.clienti?.nome}</div>
                  <div className="text-[10px] text-gray-500">{r.veicoli?.marca} {r.veicoli?.modello} — {r.problema?.slice(0, 40)}</div>
                </div>
                <div className="text-[10px] text-purple-600 font-medium">{fmtData(r.data_ora)} {fmtOra(r.data_ora)}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* KPIs — clickable */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => onNavigateToAgenda?.('richiesta')} className="text-left cursor-pointer">
          <Card hover className="text-center !p-3">
            <div className="text-xl font-bold text-purple-600">{richieste.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Richieste</div>
          </Card>
        </button>
        <button onClick={() => onNavigateToAgenda?.('oggi')} className="text-left cursor-pointer">
          <Card hover className="text-center !p-3">
            <div className="text-xl font-bold text-blue-600">{appOggi.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Oggi</div>
          </Card>
        </button>
        <button onClick={() => onNavigateToAgenda?.('in_corso')} className="text-left cursor-pointer">
          <Card hover className="text-center !p-3">
            <div className="text-xl font-bold text-amber-500">{inCorso.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">In Corso</div>
          </Card>
        </button>
        <button onClick={() => onNavigateToAgenda?.('pronto')} className="text-left cursor-pointer">
          <Card hover className="text-center !p-3">
            <div className="text-xl font-bold text-emerald-500">{pronti.length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Pronti</div>
          </Card>
        </button>
      </div>

      {/* Alerts */}
      {alertMagazzino.length > 0 && (
        <Card className="!p-3 bg-red-50 !border-red-200">
          <div className="text-xs font-semibold text-red-700 mb-1">
            ⚠️ Alert Magazzino ({alertMagazzino.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alertMagazzino.map((m) => (
              <Badge key={m.id} color="#991b1b" bg="#fecaca">
                {m.nome}: {m.quantita}/{m.quantita_minima}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* OBD scan alerts */}
      {obdCount > 0 && (
        <Card className="!p-3 bg-orange-50 !border-orange-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔌</span>
            <div>
              <div className="text-xs font-semibold text-orange-700">
                {obdCount} scansione{obdCount > 1 ? 'i' : ''} OBD da gestire
              </div>
              <div className="text-[10px] text-orange-600">
                Vai su Altro → Scansioni OBD per vedere i codici
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Vehicle expiry alerts */}
      <VehicleAlerts />

      {/* Recent appointments */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Appuntamenti recenti</h2>
        <div className="space-y-2">
          {recenti.map((app) => {
            const stato = STATO_CONFIG[app.stato];
            return (
              <Card
                key={app.id}
                hover
                className="!p-3"
                onClick={() => onSelectAppuntamento(app)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {app.clienti?.nome || 'Cliente'}
                      </span>
                      <Badge color={stato.color} bg={stato.bg}>
                        {stato.icon} {stato.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {app.veicoli?.marca} {app.veicoli?.modello} — {app.veicoli?.targa}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {app.problema}
                    </div>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="text-xs font-medium text-gray-600">{fmtData(app.data_ora)}</div>
                    <div className="text-xs text-gray-400">{fmtOra(app.data_ora)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
