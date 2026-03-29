import { useEffect, useState } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtData, fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { VehicleAlerts } from './VehicleAlerts';
import type { Appuntamento, Magazzino } from '@/types/database';

export function Dashboard({ onSelectAppuntamento }: { onSelectAppuntamento: (a: Appuntamento) => void }) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [alertMagazzino, setAlertMagazzino] = useState<Magazzino[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!officina) return;

    const [{ data: apps }, { data: magazzino }] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa,km)')
        .eq('officina_id', officina.id)
        .order('data_ora', { ascending: false }),
      supabase
        .from('magazzino')
        .select('*')
        .eq('officina_id', officina.id),
    ]);

    setAppuntamenti(apps || []);
    setAlertMagazzino((magazzino || []).filter((m) => m.quantita <= m.quantita_minima));
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
  const inCorso = appuntamenti.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi');
  const pronti = appuntamenti.filter((a) => a.stato === 'pronto');
  const recenti = appuntamenti.slice(0, 8);

  return (
    <div className="p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center !p-4">
          <div className="text-2xl font-bold text-blue-600">{appOggi.length}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Oggi</div>
        </Card>
        <Card className="text-center !p-4">
          <div className="text-2xl font-bold text-amber-500">{inCorso.length}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">In Corso</div>
        </Card>
        <Card className="text-center !p-4">
          <div className="text-2xl font-bold text-emerald-500">{pronti.length}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Pronti</div>
        </Card>
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
