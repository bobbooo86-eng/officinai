import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Veicolo, Cliente } from '@/types/database';

interface VehicleAlert {
  veicolo: Veicolo;
  cliente?: Cliente;
  tipo: string;
  scadenza: string;
  giorniRimanenti: number;
}

export function VehicleAlerts() {
  const { officina } = useAuthStore();
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officina) return;

    const fetch = async () => {
      // Get all vehicles with their clients
      const { data: clienti } = await supabase
        .from('clienti')
        .select('*, veicoli(*)')
        .eq('officina_id', officina.id);

      if (!clienti) { setLoading(false); return; }

      const oggi = new Date();
      const alertList: VehicleAlert[] = [];

      clienti.forEach((cliente: any) => {
        const veicoli = cliente.veicoli || [];
        veicoli.forEach((v: Veicolo) => {
          if (!v.scadenze) return;

          const scadenze = v.scadenze;
          const checks = [
            { tipo: 'Revisione', data: scadenze.revisione },
            { tipo: 'Assicurazione', data: scadenze.assicurazione },
            { tipo: 'Tagliando', data: scadenze.tagliando },
            { tipo: 'Bollo', data: scadenze.bollo },
          ];

          checks.forEach(({ tipo, data }) => {
            if (!data) return;
            const scadDate = new Date(data);
            const diffMs = scadDate.getTime() - oggi.getTime();
            const giorniRimanenti = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Alert if within 60 days or already expired
            if (giorniRimanenti <= 60) {
              alertList.push({
                veicolo: v,
                cliente,
                tipo,
                scadenza: data,
                giorniRimanenti,
              });
            }
          });
        });
      });

      // Sort by urgency (most urgent first)
      alertList.sort((a, b) => a.giorniRimanenti - b.giorniRimanenti);
      setAlerts(alertList);
      setLoading(false);
    };

    fetch();
  }, [officina]);

  if (loading) return null;
  if (alerts.length === 0) return null;

  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">
          🔔 Scadenze veicoli ({alerts.length})
        </span>
      </div>
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {alerts.map((alert, i) => {
          const isExpired = alert.giorniRimanenti <= 0;
          const isUrgent = alert.giorniRimanenti <= 15;
          return (
            <div
              key={i}
              className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                isExpired ? 'bg-red-50' : isUrgent ? 'bg-amber-50' : 'bg-blue-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {alert.cliente?.nome} — {alert.veicolo.marca} {alert.veicolo.modello}
                </div>
                <div className="text-gray-500">{alert.veicolo.targa}</div>
              </div>
              <div className="text-right ml-2 shrink-0">
                <Badge
                  color={isExpired ? '#991b1b' : isUrgent ? '#92400e' : '#1e40af'}
                  bg={isExpired ? '#fecaca' : isUrgent ? '#fde68a' : '#dbeafe'}
                >
                  {alert.tipo}
                </Badge>
                <div className={`text-[10px] mt-0.5 ${isExpired ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                  {isExpired
                    ? `Scaduto da ${Math.abs(alert.giorniRimanenti)}gg`
                    : `Tra ${alert.giorniRimanenti}gg`
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
