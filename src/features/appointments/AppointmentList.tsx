import { useEffect, useState } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtData, fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento } from '@/types/database';

export function AppointmentList({ onSelect, initialFiltro }: { onSelect: (a: Appuntamento) => void; initialFiltro?: string }) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>(initialFiltro || 'tutti');

  const fetchData = async () => {
    if (!officina) return;
    const { data } = await supabase
      .from('appuntamenti')
      .select('*, clienti(nome,tel), veicoli(marca,modello,targa,km)')
      .eq('officina_id', officina.id)
      .order('data_ora', { ascending: false });
    setAppuntamenti(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('agenda-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => { fetchData(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [officina]);

  const accettaRapida = async (e: React.MouseEvent, app: Appuntamento) => {
    e.stopPropagation();
    await supabase
      .from('appuntamenti')
      .update({ stato: 'prenotato' })
      .eq('id', app.id);
  };

  if (loading) return <Loader text="Caricamento agenda..." />;

  const oggi = new Date().toISOString().slice(0, 10);
  const richieste = appuntamenti.filter((a) => a.stato === 'richiesta');
  const filtered = (() => {
    if (filtro === 'tutti') return appuntamenti;
    if (filtro === 'oggi') return appuntamenti.filter((a) => a.data_ora?.startsWith(oggi));
    if (filtro === 'in_corso') return appuntamenti.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi');
    return appuntamenti.filter((a) => a.stato === filtro);
  })();

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Agenda</h2>

      {/* Pending requests alert */}
      {richieste.length > 0 && filtro !== 'richiesta' && (
        <button
          onClick={() => setFiltro('richiesta')}
          className="w-full p-3 bg-purple-50 border border-purple-200 rounded-xl text-left hover:bg-purple-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <div>
                <div className="text-sm font-semibold text-purple-900">
                  {richieste.length} richiesta{richieste.length > 1 ? 'e' : ''} in attesa
                </div>
                <div className="text-[10px] text-purple-600">Tocca per gestire</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <FilterBtn active={filtro === 'tutti'} onClick={() => setFiltro('tutti')}>
          Tutti ({appuntamenti.length})
        </FilterBtn>
        {Object.entries(STATO_CONFIG).map(([key, cfg]) => {
          const count = appuntamenti.filter((a) => a.stato === key).length;
          if (count === 0 && key !== 'richiesta') return null;
          return (
            <FilterBtn
              key={key}
              active={filtro === key}
              onClick={() => setFiltro(key)}
              highlight={key === 'richiesta' && count > 0}
            >
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
            const isRichiesta = app.stato === 'richiesta';
            return (
              <Card
                key={app.id}
                hover
                className={`!p-3 ${isRichiesta ? '!border-purple-200 bg-purple-50/50' : ''}`}
                onClick={() => onSelect(app)}
              >
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
                    {isRichiesta && (
                      <button
                        onClick={(e) => accettaRapida(e, app)}
                        className="mt-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        ✓ Accetta
                      </button>
                    )}
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

function FilterBtn({ active, onClick, children, highlight }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
        active
          ? highlight ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
          : highlight ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
