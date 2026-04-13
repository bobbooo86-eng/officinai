import { useEffect, useState } from 'react';
import { Card, Loader, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtData, fmtOra, fmtEuro } from '@/lib/format';
import type { Veicolo, Appuntamento, Preventivo } from '@/types/database';

interface Props {
  veicolo: Veicolo;
  clienteNome: string;
  onBack: () => void;
  /** If true, renders compact (no header/back button) for embedding */
  embedded?: boolean;
}

export function StoricoVeicolo({ veicolo, clienteNome, onBack, embedded }: Props) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [preventivi, setPreventivi] = useState<Record<string, Preventivo>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // Fetch all appointments for this vehicle
      const { data: apps } = await supabase
        .from('appuntamenti')
        .select('*, clienti(nome), veicoli(marca,modello,targa)')
        .eq('veicolo_id', veicolo.id)
        .order('data_ora', { ascending: false });

      setAppuntamenti(apps || []);

      // Fetch preventivi for all appointments
      if (apps && apps.length > 0) {
        const ids = apps.map(a => a.id);
        const { data: prevs } = await supabase
          .from('preventivi')
          .select('*')
          .in('appuntamento_id', ids);

        if (prevs) {
          const map: Record<string, Preventivo> = {};
          prevs.forEach(p => { map[p.appuntamento_id] = p; });
          setPreventivi(map);
        }
      }

      setLoading(false);
    };
    fetch();
  }, [veicolo.id]);

  const totaleLavorazioni = appuntamenti.filter(a => a.stato === 'pronto').length;
  const totaleSpeso = Object.values(preventivi).reduce((sum, p) => sum + (p.totale || 0), 0);

  return (
    <div className={embedded ? 'space-y-4' : 'p-4 space-y-4'}>
      {/* Header — only when not embedded */}
      {!embedded && (
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Storico lavorazioni</h2>
            <p className="text-xs text-gray-500">{clienteNome}</p>
          </div>
        </div>
      )}

      {/* Vehicle card */}
      <Card className="!p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-200 flex items-center justify-center text-2xl">🚗</div>
          <div>
            <div className="font-bold text-gray-900">{veicolo.marca} {veicolo.modello}</div>
            <div className="text-xs text-gray-600">
              <span className="font-mono font-bold">{veicolo.targa}</span> · {veicolo.anno} · {veicolo.km?.toLocaleString()} km · {veicolo.carburante}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center !p-3">
          <div className="text-lg font-bold text-blue-600">{appuntamenti.length}</div>
          <div className="text-[10px] text-gray-500">Totale visite</div>
        </Card>
        <Card className="text-center !p-3">
          <div className="text-lg font-bold text-emerald-600">{totaleLavorazioni}</div>
          <div className="text-[10px] text-gray-500">Completate</div>
        </Card>
        <Card className="text-center !p-3">
          <div className="text-lg font-bold text-amber-600">{totaleSpeso > 0 ? fmtEuro(totaleSpeso) : '—'}</div>
          <div className="text-[10px] text-gray-500">Tot. speso</div>
        </Card>
      </div>

      {loading ? (
        <Loader text="Caricamento storico..." />
      ) : appuntamenti.length === 0 ? (
        <Card className="!p-6 text-center">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm text-gray-500">Nessuna lavorazione registrata per questo veicolo</div>
        </Card>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Cronologia ({appuntamenti.length})</h3>

          {appuntamenti.map((app) => {
            const stato = STATO_CONFIG[app.stato] || STATO_CONFIG.prenotato;
            const prev = preventivi[app.id];
            const isExpanded = expandedId === app.id;

            return (
              <Card
                key={app.id}
                hover
                className={`!p-3 ${isExpanded ? '!border-blue-300' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : app.id)}
              >
                {/* Main row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={stato.color} bg={stato.bg}>
                        {stato.icon} {stato.label}
                      </Badge>
                      {prev && (
                        <span className="text-xs font-semibold text-emerald-700">{fmtEuro(prev.totale)}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-700 mt-1 truncate">{app.problema}</div>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="text-xs font-medium text-gray-600">{fmtData(app.data_ora)}</div>
                    <div className="text-xs text-gray-400">{fmtOra(app.data_ora)}</div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {/* Problema */}
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Problema</div>
                      <div className="text-xs text-gray-700">{app.problema}</div>
                    </div>

                    {/* Operazioni */}
                    {app.operazioni && (
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase">Lavorazione eseguita</div>
                        <div className="text-xs text-gray-700">{app.operazioni}</div>
                      </div>
                    )}

                    {/* Codici OBD */}
                    {app.codici_obd && (
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase">Codici OBD</div>
                        <div className="text-xs font-mono text-red-600">{app.codici_obd}</div>
                      </div>
                    )}

                    {/* Preventivo details */}
                    {prev && prev.righe && (
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Dettaglio preventivo</div>
                        {prev.righe.map((riga, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${riga.tipo === 'manodopera' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                              <span className="text-gray-600">{riga.desc}</span>
                            </div>
                            <span className="text-gray-800 font-medium">{fmtEuro(riga.qta * riga.prezzo)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-bold pt-1 mt-1 border-t border-gray-100">
                          <span>Totale</span>
                          <span className="text-emerald-700">{fmtEuro(prev.totale)}</span>
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div className="text-[10px] text-gray-400">
                      Appuntamento: {fmtData(app.data_ora)} alle {fmtOra(app.data_ora)}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
