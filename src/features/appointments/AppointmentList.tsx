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
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = async () => {
    if (!officina) return;
    const { data } = await supabase
      .from('appuntamenti')
      .select('*, clienti(nome,tel,email), veicoli(marca,modello,targa,km)')
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
    const { error } = await supabase
      .from('appuntamenti')
      .update({ stato: 'prenotato' })
      .eq('id', app.id);
    if (error) {
      setToast('Errore nell\'accettazione: ' + error.message);
    } else {
      setToast('Appuntamento accettato');
      fetchData();
    }
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return <Loader text="Caricamento agenda..." />;

  const [searchLocal, setSearchLocal] = useState('');
  const oggi = new Date().toISOString().slice(0, 10);
  const richieste = appuntamenti.filter((a) => a.stato === 'richiesta');
  const filtered = (() => {
    let list = appuntamenti;
    if (filtro === 'oggi') list = list.filter((a) => a.data_ora?.startsWith(oggi));
    else if (filtro === 'in_corso') list = list.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi');
    else if (filtro !== 'tutti') list = list.filter((a) => a.stato === filtro);
    if (searchLocal.trim()) {
      const q = searchLocal.toLowerCase();
      list = list.filter((a) =>
        a.clienti?.nome?.toLowerCase().includes(q) ||
        a.veicoli?.targa?.toLowerCase().includes(q) ||
        a.veicoli?.marca?.toLowerCase().includes(q) ||
        a.veicoli?.modello?.toLowerCase().includes(q) ||
        a.problema?.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  return (
    <div className="p-4 space-y-3">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appuntamenti</h2>

      {/* Local search */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input
          type="text"
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
          placeholder="Cerca per cliente, targa, problema..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
        />
      </div>

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

      {/* Filters — griglia pulsanti quadrati */}
      <div className="grid grid-cols-4 gap-2">
        <FilterBtn
          active={filtro === 'tutti'}
          onClick={() => setFiltro('tutti')}
          icon="📋"
          label="Tutti"
          count={appuntamenti.length}
          color="#3b82f6"
          bg="#dbeafe"
        />
        {Object.entries(STATO_CONFIG).map(([key, cfg]) => {
          const count = appuntamenti.filter((a) => a.stato === key).length;
          if (count === 0 && key !== 'richiesta') return null;
          return (
            <FilterBtn
              key={key}
              active={filtro === key}
              onClick={() => setFiltro(key)}
              icon={cfg.icon}
              label={cfg.label}
              count={count}
              color={cfg.color}
              bg={cfg.bg}
              highlight={key === 'richiesta' && count > 0}
            />
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

function FilterBtn({ active, onClick, icon, label, count, color, bg, highlight }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
  color: string;
  bg: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-xl p-2.5 min-h-[72px] transition-all cursor-pointer border-2 ${
        active
          ? 'shadow-md scale-[1.02]'
          : 'hover:scale-[1.01]'
      } ${highlight && !active ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: active ? bg : '#f9fafb',
        color: active ? color : '#6b7280',
        borderColor: active ? color : '#e5e7eb',
      }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-bold mt-1 leading-tight">{label}</span>
      <span className={`text-sm font-black leading-none mt-0.5 ${active ? '' : 'text-gray-800'}`}>{count}</span>
    </button>
  );
}
