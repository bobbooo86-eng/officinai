import { useEffect, useState } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtData, fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento } from '@/types/database';

export function AppointmentList({ onSelect }: { onSelect: (a: Appuntamento) => void }) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>('tutti');

  useEffect(() => {
    if (!officina) return;

    const fetch = async () => {
      const { data } = await supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa,km)')
        .eq('officina_id', officina.id)
        .order('data_ora', { ascending: false });
      setAppuntamenti(data || []);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel('agenda-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [officina]);

  if (loading) return <Loader text="Caricamento agenda..." />;

  const filtered = filtro === 'tutti'
    ? appuntamenti
    : appuntamenti.filter((a) => a.stato === filtro);

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Agenda</h2>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <FilterBtn active={filtro === 'tutti'} onClick={() => setFiltro('tutti')}>
          Tutti ({appuntamenti.length})
        </FilterBtn>
        {Object.entries(STATO_CONFIG).map(([key, cfg]) => {
          const count = appuntamenti.filter((a) => a.stato === key).length;
          return (
            <FilterBtn key={key} active={filtro === key} onClick={() => setFiltro(key)}>
              {cfg.icon} {cfg.label} ({count})
            </FilterBtn>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nessun appuntamento trovato
          </div>
        ) : (
          filtered.map((app) => {
            const stato = STATO_CONFIG[app.stato];
            return (
              <Card key={app.id} hover className="!p-3" onClick={() => onSelect(app)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">
                        {app.clienti?.nome}
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
          })
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
