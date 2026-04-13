import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout } from '@/components/Layout';
import { Card, Badge, Loader } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG, STATI_ORDINE } from '@/lib/constants';
import { fmtData, fmtOra, fmtEuro } from '@/lib/format';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { PhotoGallery } from '@/features/photos/PhotoGallery';

const BookingPage = lazy(() => import('./BookingPage').then(m => ({ default: m.BookingPage })));
const OBDScanPage = lazy(() => import('./OBDScanPage').then(m => ({ default: m.OBDScanPage })));
import type { Appuntamento, Veicolo, Preventivo, Recensione } from '@/types/database';

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'prenota', label: 'Richiedi', icon: '📅' },
  { id: 'obd', label: 'OBD', icon: '🔌' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'storico', label: 'Storico', icon: '📋' },
  { id: 'auto', label: 'Auto', icon: '🚗' },
];

export function AppCliente() {
  const [activeTab, setActiveTab] = useState('home');
  const { cliente } = useAuthStore();
  const [appAttivoId, setAppAttivoId] = useState<string | null>(null);
  const [veicoliCliente, setVeicoliCliente] = useState<Veicolo[]>([]);

  // Fetch active appointment ID for chat/photos + vehicles for OBD
  useEffect(() => {
    if (!cliente) return;
    const fetch = async () => {
      const [{ data: apps }, { data: veic }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select('id')
          .eq('cliente_id', cliente.id)
          .not('stato', 'in', '("pronto","annullato")')
          .order('data_ora', { ascending: false })
          .limit(1),
        supabase
          .from('veicoli')
          .select('*')
          .eq('cliente_id', cliente.id),
      ]);
      if (apps && apps.length > 0) setAppAttivoId(apps[0].id);
      setVeicoliCliente(veic || []);
    };
    fetch();
  }, [cliente]);

  return (
    <Layout tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <ClienteHome />}
      {activeTab === 'prenota' && <Suspense fallback={<PageSkeleton />}><BookingPage /></Suspense>}
      {activeTab === 'obd' && (
        <Suspense fallback={<PageSkeleton />}>
          <OBDScanPage veicoli={veicoliCliente} />
        </Suspense>
      )}
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
      {activeTab === 'storico' && <ClienteStorico />}
      {activeTab === 'auto' && <ClienteAuto />}
    </Layout>
  );
}

// ==================== HOME ====================
function ClienteHome() {
  const { cliente, officina } = useAuthStore();
  const [appAttivo, setAppAttivo] = useState<Appuntamento | null>(null);
  const [preventivo, setPreventivo] = useState<Preventivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  // Review
  const [appDaRecensire, setAppDaRecensire] = useState<Appuntamento | null>(null);
  const [voto, setVoto] = useState(0);
  const [commento, setCommento] = useState('');
  const [recensioneInviata, setRecensioneInviata] = useState(false);

  useEffect(() => {
    if (!cliente) return;

    const fetch = async () => {
      // Get active appointments (exclude both 'pronto' and 'annullato')
      const { data: apps } = await supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa,km)')
        .eq('cliente_id', cliente.id)
        .not('stato', 'in', '("pronto","annullato")')
        .order('data_ora', { ascending: false })
        .limit(1);

      if (apps && apps.length > 0) {
        setAppAttivo(apps[0]);
        // Get estimate — use .maybeSingle() to avoid error on zero rows
        const { data: prev } = await supabase
          .from('preventivi')
          .select('*')
          .eq('appuntamento_id', apps[0].id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setPreventivo(prev);
      } else {
        setAppAttivo(null);
        setPreventivo(null);
      }

      // Check for completed appointments without review
      const { data: completati } = await supabase
        .from('appuntamenti')
        .select('*, veicoli(marca,modello,targa)')
        .eq('cliente_id', cliente.id)
        .eq('stato', 'pronto')
        .order('data_ora', { ascending: false })
        .limit(1);

      if (completati && completati.length > 0) {
        // Check if already reviewed
        const { data: rec } = await supabase
          .from('recensioni')
          .select('id')
          .eq('appuntamento_id', completati[0].id)
          .maybeSingle();
        if (!rec) {
          setAppDaRecensire(completati[0]);
        }
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

  const inviaRecensione = async () => {
    if (!appDaRecensire || !cliente || !voto) return;
    const { error } = await supabase.from('recensioni').insert({
      appuntamento_id: appDaRecensire.id,
      officina_id: appDaRecensire.officina_id,
      cliente_id: cliente.id,
      voto,
      commento: commento.trim() || null,
    });
    if (!error) {
      setRecensioneInviata(true);
      setAppDaRecensire(null);
    }
  };

  const ReviewCard = () => {
    if (recensioneInviata) {
      return (
        <Card className="!p-4 bg-emerald-50 border-emerald-200 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <div className="text-sm font-semibold text-emerald-800">Grazie per la tua recensione!</div>
        </Card>
      );
    }
    if (!appDaRecensire) return null;
    return (
      <Card className="!p-4 bg-amber-50 border-amber-200">
        <div className="text-center mb-3">
          <div className="text-2xl mb-1">⭐</div>
          <div className="text-sm font-semibold text-amber-900">Come e andato il lavoro?</div>
          <div className="text-xs text-amber-700">
            {appDaRecensire.veicoli?.marca} {appDaRecensire.veicoli?.modello}
          </div>
        </div>
        <div className="flex justify-center gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setVoto(s)}
              className={`w-10 h-10 rounded-full text-xl cursor-pointer transition-transform ${
                s <= voto ? 'scale-110' : 'opacity-30'
              }`}
            >
              ⭐
            </button>
          ))}
        </div>
        <textarea
          placeholder="Lascia un commento (facoltativo)..."
          value={commento}
          onChange={(e) => setCommento(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
        />
        <Button onClick={inviaRecensione} disabled={!voto} fullWidth>
          Invia recensione
        </Button>
      </Card>
    );
  };

  if (!appAttivo) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🚗</div>
          <h2 className="text-lg font-semibold text-gray-900">Tutto a posto!</h2>
          <p className="text-sm text-gray-500 mt-1">Nessun intervento in corso</p>
        </div>
        <ReviewCard />
      </div>
    );
  }

  const statoIdx = STATI_ORDINE.indexOf(appAttivo.stato);
  const progress = ((statoIdx + 1) / STATI_ORDINE.length) * 100;

  const accettaProposta = async () => {
    if (!appAttivo.data_proposta) return;
    setActionError(null);
    const { error } = await supabase
      .from('appuntamenti')
      .update({ data_ora: appAttivo.data_proposta, stato: 'prenotato', data_proposta: null, nota_officina: null })
      .eq('id', appAttivo.id);
    if (error) setActionError('Errore nell\'accettazione della proposta. Riprova.');
  };

  const rifiutaProposta = async () => {
    setActionError(null);
    const { error } = await supabase
      .from('appuntamenti')
      .update({ data_proposta: null, nota_officina: null })
      .eq('id', appAttivo.id);
    if (error) setActionError('Errore nel rifiuto della proposta. Riprova.');
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">
        {appAttivo.stato === 'richiesta' ? 'La tua richiesta' : 'Il tuo intervento'}
      </h2>

      {actionError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Vehicle */}
      <Card className="!p-3">
        <div className="text-xs text-gray-400">Veicolo</div>
        <div className="font-semibold text-gray-900">
          {appAttivo.veicoli?.marca} {appAttivo.veicoli?.modello}
        </div>
        <div className="text-xs text-gray-500">{appAttivo.veicoli?.targa}</div>
      </Card>

      {/* Pending request banner */}
      {appAttivo.stato === 'richiesta' && !appAttivo.data_proposta && (
        <Card className="!p-4 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔔</div>
            <div>
              <div className="text-sm font-semibold text-purple-900">Richiesta in attesa</div>
              <div className="text-xs text-purple-700 mt-0.5">
                L'officina sta valutando la tua richiesta per il {fmtData(appAttivo.data_ora)} alle {fmtOra(appAttivo.data_ora)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Counter-proposal from officina */}
      {appAttivo.stato === 'richiesta' && appAttivo.data_proposta && (
        <Card className="!p-4 bg-amber-50 border-amber-200">
          <div className="text-sm font-semibold text-amber-900 mb-2">📅 L'officina propone una data alternativa</div>
          {appAttivo.nota_officina && (
            <div className="text-xs text-amber-800 mb-2 italic">"{appAttivo.nota_officina}"</div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-white rounded-lg p-2 text-center border border-amber-200">
              <div className="text-xs text-gray-400">Richiesto</div>
              <div className="text-sm font-semibold text-gray-500 line-through">
                {fmtData(appAttivo.data_ora)} {fmtOra(appAttivo.data_ora)}
              </div>
            </div>
            <div className="text-gray-400">→</div>
            <div className="flex-1 bg-white rounded-lg p-2 text-center border border-amber-300">
              <div className="text-xs text-amber-600">Proposta</div>
              <div className="text-sm font-bold text-amber-900">
                {fmtData(appAttivo.data_proposta)} {fmtOra(appAttivo.data_proposta)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="success" fullWidth onClick={accettaProposta}>
              Accetto la proposta
            </Button>
            <Button variant="secondary" fullWidth onClick={rifiutaProposta}>
              No, grazie
            </Button>
          </div>
        </Card>
      )}

      {/* Progress — only show when not in richiesta */}
      {appAttivo.stato !== 'richiesta' && (
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

          {/* Steps — skip 'richiesta' in progress display */}
          <div className="flex justify-between">
            {STATI_ORDINE.filter(s => s !== 'richiesta').map((stato, i) => {
              const cfg = STATO_CONFIG[stato];
              const realIdx = STATI_ORDINE.indexOf(appAttivo.stato);
              const stIdx = STATI_ORDINE.indexOf(stato);
              const done = stIdx <= realIdx;
              const active = stato === appAttivo.stato;
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
      )}

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
                setActionError(null);
                const { error } = await supabase.from('preventivi').update({ stato: 'accettato' }).eq('id', preventivo.id);
                if (error) { setActionError('Errore nell\'accettazione del preventivo. Riprova.'); return; }
                setPreventivo({ ...preventivo, stato: 'accettato' });
              }}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              ✓ Accetto
            </button>
            <button
              onClick={async () => {
                setActionError(null);
                const { error } = await supabase.from('preventivi').update({ stato: 'rifiutato' }).eq('id', preventivo.id);
                if (error) { setActionError('Errore nel rifiuto del preventivo. Riprova.'); return; }
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

      {/* Recensione */}
      <ReviewCard />
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
