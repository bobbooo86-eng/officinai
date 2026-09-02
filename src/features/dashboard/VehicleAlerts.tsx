import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { leggiPromemoriaNascosti, nascondiPromemoria } from '@/lib/promemoriaNascosti';
import type { Veicolo, Cliente } from '@/types/database';

// Un mese di anticipo, come richiesto: le scadenze piu' lontane non
// interessano ancora il titolare e affollerebbero solo la Home.
const SOGLIA_GIORNI = 30;

interface VehicleAlert {
  veicolo: Veicolo;
  cliente?: Cliente;
  tipo: string;
  scadenza: string;
  giorniRimanenti: number;
  chiave: string;
}

export function VehicleAlerts() {
  const { officina } = useAuthStore();
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officina) return;

    const fetch = async () => {
      // Get all vehicles with their clients, e i promemoria gia' nascosti
      const [{ data: clienti }, nascosti] = await Promise.all([
        supabase.from('clienti').select('*, veicoli(*)').eq('officina_id', officina.id),
        leggiPromemoriaNascosti(officina.id),
      ]);

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

            // Alert if within a month or already expired
            const chiave = `scadenza:${v.id}:${tipo}:${data}`;
            if (giorniRimanenti <= SOGLIA_GIORNI && !nascosti.has(chiave)) {
              alertList.push({
                veicolo: v,
                cliente,
                tipo,
                scadenza: data,
                giorniRimanenti,
                chiave,
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

  // Nasconde solo dalla Home: la scadenza resta sul veicolo, modificabile
  // e ripristinabile da li' in qualsiasi momento (non e' una cancellazione).
  const nascondi = async (alert: VehicleAlert, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!officina) return;
    setAlerts((prev) => prev.filter((a) => a.chiave !== alert.chiave));
    await nascondiPromemoria(officina.id, alert.chiave);
  };

  const inviaPromemoria = (alert: VehicleAlert) => {
    const tel = alert.cliente?.tel;
    if (!tel) return;
    const dataFmt = new Date(alert.scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    const scaduta = alert.giorniRimanenti <= 0;
    const testo = `Buongiorno ${alert.cliente?.nome || ''}, le ricordiamo che ${alert.tipo.toLowerCase()} del suo ${alert.veicolo.marca} ${alert.veicolo.modello}${alert.veicolo.targa ? ` (${alert.veicolo.targa})` : ''} ${scaduta ? `è scaduta il ${dataFmt}` : `scade il ${dataFmt}`}. La contattiamo per fissare un appuntamento.\n— ${officina?.nome || 'OfficinAI'}`;
    const telPulito = tel.replace(/[^0-9+]/g, '');
    window.open(`https://wa.me/${telPulito}?text=${encodeURIComponent(testo)}`, '_blank');
  };

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
        {alerts.map((alert) => {
          const isExpired = alert.giorniRimanenti <= 0;
          const isUrgent = alert.giorniRimanenti <= 15;
          return (
            <div
              key={alert.chiave}
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
              <div className="text-right ml-2 shrink-0 flex items-start gap-1">
                <div>
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
                  {alert.cliente?.tel && (
                    <button
                      onClick={() => inviaPromemoria(alert)}
                      className="mt-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 cursor-pointer transition-colors"
                    >
                      💬 Promemoria
                    </button>
                  )}
                </div>
                <button
                  onClick={(e) => nascondi(alert, e)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer px-1 shrink-0"
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
  );
}
