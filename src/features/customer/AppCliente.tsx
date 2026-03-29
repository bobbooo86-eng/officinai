import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG, STATI_ORDINE } from '@/lib/constants';
import { fmtData, fmtOra, fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import type { Appuntamento, Veicolo, Preventivo } from '@/types/database';

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'auto', label: 'La mia auto', icon: '🚗' },
  { id: 'storico', label: 'Storico', icon: '📋' },
];

export function AppCliente() {
  const [activeTab, setActiveTab] = useState('home');
  const { cliente } = useAuthStore();
  const [appAttivoId, setAppAttivoId] = useState<string | null>(null);

  // Fetch active appointment ID for chat/photos
  useEffect(() => {
    if (!cliente) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('appuntamenti')
        .select('id')
        .eq('cliente_id', cliente.id)
        .neq('stato', 'pronto')
        .order('data_ora', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setAppAttivoId(data[0].id);
    };
    fetch();
  }, [cliente]);

  return (
    <Layout tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <ClienteHome />}
      {activeTab === 'chat' && (
        appAttivoId ? (
          <ChatPanel
            appuntamentoId={appAttivoId}
            senderName={cliente?.nome || 'Cliente'}
            senderType="cliente"
          />
        ) : (
          <div className="p-4 text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm text-gray-500">Nessun intervento attivo per chattare</p>
          </div>
        )
      )}
      {activeTab === 'auto' && <ClienteAuto />}
      {activeTab === 'storico' && <ClienteStorico />}
    </Layout>
  );
}

// ==================== HOME ====================
function ClienteHome() {
  const { cliente } = useAuthStore();
  const [appAttivo, setAppAttivo] = useState<Appuntamento | null>(null);
  const [preventivo, setPreventivo] = useState<Preventivo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cliente) return;

    const fetch = async () => {
      // Get active appointments
      const { data: apps } = await supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa,km)')
        .eq('cliente_id', cliente.id)
        .neq('stato', 'pronto')
        .order('data_ora', { ascending: false })
        .limit(1);

      if (apps && apps.length > 0) {
        setAppAttivo(apps[0]);
        // Get estimate
        const { data: prev } = await supabase
          .from('preventivi')
          .select('*')
          .eq('appuntamento_id', apps[0].id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (prev) setPreventivo(prev);
      }
      setLoading(false);
    };
    fetch();

    // Real-time
    const channel = supabase
      .channel('cliente-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => { fetch(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preventivi' }, () => { fetch(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [cliente]);

  if (loading) return <Loader text="Caricamento..." />;

  if (!appAttivo) {
    return (
      <div className="p-4 text-center py-16">
        <div className="text-5xl mb-4">🚗</div>
        <h2 className="text-lg font-semibold text-gray-900">Tutto a posto!</h2>
        <p className="text-sm text-gray-500 mt-1">Nessun intervento in corso</p>
      </div>
    );
  }

  const statoIdx = STATI_ORDINE.indexOf(appAttivo.stato);
  const progress = ((statoIdx + 1) / STATI_ORDINE.length) * 100;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Il tuo intervento</h2>

      {/* Vehicle */}
      <Card className="!p-3">
        <div className="text-xs text-gray-400">Veicolo</div>
        <div className="font-semibold text-gray-900">
          {appAttivo.veicoli?.marca} {appAttivo.veicoli?.modello}
        </div>
        <div className="text-xs text-gray-500">{appAttivo.veicoli?.targa}</div>
      </Card>

      {/* Progress */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">Stato</span>
          <Badge color={STATO_CONFIG[appAttivo.stato].color} bg={STATO_CONFIG[appAttivo.stato].bg}>
            {STATO_CONFIG[appAttivo.stato].icon} {STATO_CONFIG[appAttivo.stato].label}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="flex justify-between">
          {STATI_ORDINE.map((stato, i) => {
            const cfg = STATO_CONFIG[stato];
            const done = i <= statoIdx;
            const active = i === statoIdx;
            return (
              <div key={stato} className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                  active ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                  done ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-[9px] mt-1 ${active ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                  {cfg.label.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Problem */}
      <Card className="!p-3">
        <div className="text-xs text-gray-400 mb-0.5">Problema segnalato</div>
        <div className="text-sm text-gray-700">{appAttivo.problema}</div>
        <div className="text-xs text-gray-400 mt-1">
          {fmtData(appAttivo.data_ora)} alle {fmtOra(appAttivo.data_ora)}
        </div>
      </Card>

      {/* Preventivo ricevuto */}
      {preventivo && preventivo.stato === 'inviato' && (
        <Card className="!p-4 border-blue-200 bg-blue-50">
          <div className="text-sm font-semibold text-blue-900 mb-2">💰 Preventivo ricevuto</div>
          {preventivo.righe?.map((r, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5">
              <span>{r.desc}</span>
              <span>{fmtEuro(r.qta * r.prezzo)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-gray-900 mt-2 pt-2 border-t border-blue-200">
            <span>Totale (IVA incl.)</span>
            <span>{fmtEuro(preventivo.totale)}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => {
                await supabase.from('preventivi').update({ stato: 'accettato' }).eq('id', preventivo.id);
                setPreventivo({ ...preventivo, stato: 'accettato' });
              }}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              ✓ Accetto
            </button>
            <button
              onClick={async () => {
                await supabase.from('preventivi').update({ stato: 'rifiutato' }).eq('id', preventivo.id);
                setPreventivo({ ...preventivo, stato: 'rifiutato' });
              }}
              className="flex-1 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 transition-colors cursor-pointer"
            >
              ✕ Rifiuto
            </button>
          </div>
        </Card>
      )}

      {preventivo && preventivo.stato === 'accettato' && (
        <Card className="!p-3 bg-emerald-50 border-emerald-200">
          <div className="text-sm font-semibold text-emerald-800">✅ Preventivo accettato — {fmtEuro(preventivo.totale)}</div>
        </Card>
      )}

      {/* Foto del lavoro */}
      {appAttivo && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">📸 Foto del lavoro</h3>
          <PhotoGallery appuntamentoId={appAttivo.id} readOnly />
        </div>
      )}
    </div>
  );
}

// ==================== AUTO ====================
function ClienteAuto() {
  const { cliente } = useAuthStore();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cliente) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('veicoli')
        .select('*')
        .eq('cliente_id', cliente.id);
      setVeicoli(data || []);
      setLoading(false);
    };
    fetch();
  }, [cliente]);

  if (loading) return <Loader text="Caricamento veicoli..." />;

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-900">I miei veicoli</h2>
      {veicoli.map((v) => (
        <Card key={v.id} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">
              🚗
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{v.marca} {v.modello}</div>
              <div className="text-xs text-gray-500">
                Targa: <span className="font-mono font-semibold">{v.targa}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="text-gray-400">Anno</span>
              <div className="font-semibold text-gray-700">{v.anno}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="text-gray-400">Km</span>
              <div className="font-semibold text-gray-700">{v.km?.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <span className="text-gray-400">Carburante</span>
              <div className="font-semibold text-gray-700 capitalize">{v.carburante}</div>
            </div>
            {v.scadenze?.revisione && (
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-gray-400">Revisione</span>
                <div className="font-semibold text-gray-700">{v.scadenze.revisione}</div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ==================== STORICO ====================
function ClienteStorico() {
  const { cliente } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cliente) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('appuntamenti')
        .select('*, veicoli(marca,modello,targa)')
        .eq('cliente_id', cliente.id)
        .order('data_ora', { ascending: false });
      setAppuntamenti(data || []);
      setLoading(false);
    };
    fetch();
  }, [cliente]);

  if (loading) return <Loader text="Caricamento storico..." />;

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Storico interventi</h2>
      {appuntamenti.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          Nessun intervento trovato
        </div>
      ) : (
        appuntamenti.map((app) => {
          const stato = STATO_CONFIG[app.stato];
          return (
            <Card key={app.id} className="!p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">
                    {app.veicoli?.marca} {app.veicoli?.modello}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{app.problema}</div>
                </div>
                <div className="text-right">
                  <Badge color={stato.color} bg={stato.bg}>
                    {stato.icon} {stato.label}
                  </Badge>
                  <div className="text-[10px] text-gray-400 mt-0.5">{fmtData(app.data_ora)}</div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
