import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from './Dashboard';
import { AppointmentList } from '@/features/appointments/AppointmentList';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
import { CalendarView } from '@/features/appointments/CalendarView';
import { CustomersPage } from '@/features/appointments/CustomersPage';
import { NuovoAppuntamento } from '@/features/appointments/NuovoAppuntamento';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useHistoryState } from '@/lib/useHistoryState';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento, MovimentoTipo } from '@/types/database';

const AnalyticsPage = lazy(() => import('./AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const InvoicePage = lazy(() => import('@/features/invoices/InvoicePage').then(m => ({ default: m.InvoicePage })));
const SubscriptionPage = lazy(() => import('@/features/billing/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.SettingsPage })));
const OBDScansPage = lazy(() => import('./OBDScansPage').then(m => ({ default: m.OBDScansPage })));
const GuidaPage = lazy(() => import('@/features/guide/GuidaPage').then(m => ({ default: m.GuidaPage })));
const CassaPage = lazy(() => import('@/features/cassa/CassaPage').then(m => ({ default: m.CassaPage })));

const PreventiviPage = lazy(() => import('@/features/estimates/PreventiviPage').then(m => ({ default: m.PreventiviPage })));

const TABS = [
  { id: 'agenda', label: 'Appuntamenti', icon: '📅' },
  { id: 'preventivi', label: 'Preventivi', icon: '💰' },
  { id: 'clienti', label: 'Clienti', icon: '👥' },
  { id: 'cassa', label: 'Cassa', icon: '📒' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'magazzino', label: 'Magazzino', icon: '📦' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'fatture', label: 'Fatture', icon: '🧾' },
  { id: 'obd', label: 'OBD', icon: '🔌' },
  { id: 'altro', label: 'Altro', icon: '⚙️' },
];

export function AppOfficina() {
  const { officina } = useAuthStore();
  const [activeTab, setActiveTab] = useHistoryState('officina-tab', 'home', (v) =>
    TABS.some((t) => t.id === v)
  );
  const [selectedApp, setSelectedApp] = useState<Appuntamento | null>(null);
  const [subPage, setSubPage] = useState<'abbonamento' | 'impostazioni' | 'guida' | null>(null);
  const [agendaFiltro, setAgendaFiltro] = useState<string | undefined>(undefined);
  const [agendaView, setAgendaView] = useState<'calendario' | 'lista'>('calendario');
  const [showNewApp, setShowNewApp] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
  const [agendaSearch, setAgendaSearch] = useState('');
  const [preventiviSearch, setPreventiviSearch] = useState<string>('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | undefined>(undefined);
  const [richiesteCount, setRichiesteCount] = useState(0);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [cassaOpenTipo, setCassaOpenTipo] = useState<MovimentoTipo | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const loadRichiesteCount = useCallback(async () => {
    if (!officina) return;
    const { count } = await supabase
      .from('appuntamenti')
      .select('*', { count: 'exact', head: true })
      .eq('officina_id', officina.id)
      .eq('stato', 'richiesta');
    setRichiesteCount(count || 0);
  }, [officina]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRichiesteCount();
    const channel = supabase
      .channel('richieste-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => {
        void loadRichiesteCount();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadRichiesteCount]);

  const handleFab = () => {
    setShowFabMenu(true);
  };

  const fabNuovoAppuntamento = () => {
    setShowFabMenu(false);
    setActiveTab('agenda');
    setSubPage(null);
    setSelectedApp(null);
    setShowNewApp(true);
  };

  const fabApriCassaConTipo = (tipo: MovimentoTipo) => {
    setShowFabMenu(false);
    setCassaOpenTipo(tipo);
    setSubPage(null);
    setSelectedApp(null);
    setShowNewApp(false);
    setActiveTab('cassa');
  };

  const tabsWithBadge = TABS.map((t) => ({
    ...t,
    badge: t.id === 'agenda' ? richiesteCount : undefined,
  }));

  // Se l'utente clicca il tab gia' attivo, torna alla lista principale
  // (invece di restare bloccato nel dettaglio/sotto-pagina).
  const handleTabChange = (t: string) => {
    if (t === activeTab) {
      setResetSignal((c) => c + 1);
      setShowNewApp(false);
      setSelectedClienteId(undefined);
    }
    setActiveTab(t);
    setSubPage(null);
    setSelectedApp(null);
  };

  const handleSelectApp = (app: Appuntamento) => {
    setSelectedApp(app);
    window.history.pushState({ ...window.history.state, selectedAppId: app.id }, '');
  };

  const handleBack = () => {
    setSelectedApp(null);
    window.history.pushState({ ...window.history.state, selectedAppId: null }, '');
  };

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (!e.state?.selectedAppId) {
        setSelectedApp(null);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const handleSearchSelect = async (type: string, id: string) => {
    if (activeTab === 'preventivi' && type === 'cliente') {
      const { data: cl } = await supabase.from('clienti').select('nome').eq('id', id).single();
      if (cl) {
        setPreventiviSearch(cl.nome);
      }
      return;
    }

    let appData: Appuntamento | null = null;

    if (type === 'appuntamento') {
      const { data } = await supabase.from('appuntamenti').select('*').eq('id', id).single();
      appData = data;
    } else if (type === 'cliente') {
      setSelectedClienteId(id);
      setActiveTab('clienti');
      return;
    } else if (type === 'veicolo') {
      const { data } = await supabase
        .from('appuntamenti')
        .select('*')
        .eq('veicolo_id', id)
        .order('data_ora', { ascending: false })
        .limit(1)
        .single();
      appData = data;
      if (!data) { setActiveTab('agenda'); return; }
    }

    if (appData) {
      setCalendarDate(new Date(appData.data_ora));
      setAgendaView('calendario');
      setActiveTab('agenda');
      setShowNewApp(false);
      setSelectedApp(null);
    }
  };

  if (selectedApp) {
    return (
      <Layout tabs={tabsWithBadge} activeTab={activeTab} onTabChange={handleTabChange} onSearchSelect={handleSearchSelect}>
        <AppointmentDetail appuntamento={selectedApp} onBack={handleBack} />
      </Layout>
    );
  }

  return (
    <Layout tabs={tabsWithBadge} activeTab={activeTab} onTabChange={handleTabChange} onSearchSelect={handleSearchSelect} showSearch={activeTab === 'home'} fab={!showNewApp ? { onClick: handleFab } : undefined}>
      {activeTab === 'home' && (
        <Dashboard
          onSelectAppuntamento={handleSelectApp}
          onNavigateToAgenda={(filtro) => {
            setAgendaFiltro(filtro);
            setAgendaView('lista');
            setShowNewApp(false);
            setActiveTab('agenda');
          }}
          onNavigateToPreventivi={() => {
            setActiveTab('preventivi');
          }}
          onNavigateToGuida={() => {
            setActiveTab('altro');
            setSubPage('guida');
          }}
        />
      )}
      {activeTab === 'agenda' && (
        showNewApp ? (
          <NuovoAppuntamento
            initialDate={calendarDate}
            onBack={() => setShowNewApp(false)}
            onCreated={(app) => {
              setShowNewApp(false);
              // Porta il calendario sul giorno dell'appuntamento appena creato,
              // altrimenti restando sul giorno precedente sembra non salvato.
              if (app?.data_ora) setCalendarDate(new Date(app.data_ora));
              handleSelectApp(app);
            }}
          />
        ) : (
          <div>
            <div className="px-4 pt-4 space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  value={agendaSearch}
                  onChange={(e) => setAgendaSearch(e.target.value)}
                  placeholder="Cerca appuntamento per cliente, targa, problema..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAgendaView('calendario')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      agendaView === 'calendario'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📆 Calendario
                  </button>
                  <button
                    onClick={() => setAgendaView('lista')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      agendaView === 'lista'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📋 Lista
                  </button>
                </div>
                <button
                  onClick={() => setShowNewApp(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  + Nuovo
                </button>
              </div>
            </div>
            {agendaView === 'calendario' ? (
              <CalendarView
                onSelect={handleSelectApp}
                initialDate={calendarDate}
                searchQuery={agendaSearch}
                onNuovoAppuntamento={(date) => { setCalendarDate(date); setShowNewApp(true); }}
              />
            ) : (
              <AppointmentList onSelect={handleSelectApp} initialFiltro={agendaFiltro} searchQuery={agendaSearch} />
            )}
          </div>
        )
      )}
      {activeTab === 'preventivi' && <Suspense fallback={<PageSkeleton />}><PreventiviPage onSelectAppuntamento={handleSelectApp} onNavigateToCalendar={(date) => { setCalendarDate(date); setAgendaView('calendario'); setActiveTab('agenda'); }} onNavigateToFatture={() => setActiveTab('fatture')} externalSearch={preventiviSearch} resetSignal={resetSignal} /></Suspense>}
      {activeTab === 'clienti' && <CustomersPage initialClienteId={selectedClienteId} resetSignal={resetSignal} />}
      {activeTab === 'magazzino' && <Suspense fallback={<PageSkeleton />}><InventoryPage /></Suspense>}
      {activeTab === 'analytics' && <Suspense fallback={<PageSkeleton />}><AnalyticsPage /></Suspense>}
      {activeTab === 'fatture' && <Suspense fallback={<PageSkeleton />}><InvoicePage resetSignal={resetSignal} /></Suspense>}
      {activeTab === 'obd' && <Suspense fallback={<PageSkeleton />}><OBDScansPage /></Suspense>}
      {activeTab === 'cassa' && (
        <Suspense fallback={<PageSkeleton />}>
          <CassaPage initialOpen={cassaOpenTipo} onOpenHandled={() => setCassaOpenTipo(null)} />
        </Suspense>
      )}
      {activeTab === 'altro' && !subPage && (
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Altro</h2>
          <button
            onClick={() => setSubPage('guida')}
            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl">📖</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-blue-900">Guida completa</div>
              <div className="text-xs text-blue-600">Come usare OfficinAI — tutorial passo passo</div>
            </div>
            <svg className="w-5 h-5 text-blue-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setSubPage('abbonamento')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-xl">💳</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Abbonamento</div>
              <div className="text-xs text-gray-500">Piano, pagamenti, fatturazione</div>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setSubPage('impostazioni')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl">⚙️</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Impostazioni</div>
              <div className="text-xs text-gray-500">Dati officina, profilo, abbonamento</div>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
      {activeTab === 'altro' && subPage === 'abbonamento' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><SubscriptionPage /></Suspense>
        </div>
      )}
      {activeTab === 'altro' && subPage === 'impostazioni' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense>
        </div>
      )}
      {activeTab === 'altro' && subPage === 'guida' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><GuidaPage /></Suspense>
        </div>
      )}

      {showFabMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[60] animate-fade-in"
            onClick={() => setShowFabMenu(false)}
          />
          <div className="fixed left-1/2 -translate-x-1/2 bottom-24 w-[92%] max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl z-[61] p-3 animate-fade-in">
            <div className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-1.5">
              Cosa vuoi creare?
            </div>
            {([
              { id: 'app', icon: '📅', label: 'Nuovo appuntamento', desc: 'Prenota lavoro per un cliente', onClick: fabNuovoAppuntamento, color: 'from-blue-50 to-indigo-50 border-blue-200' },
              { id: 'incasso', icon: '💵', label: 'Incasso extra', desc: 'Vendita al banco, entrata fuori appuntamento', onClick: () => fabApriCassaConTipo('incasso_extra'), color: 'from-emerald-50 to-green-50 border-emerald-200' },
              { id: 'spesa_off', icon: '🧾', label: 'Spesa officina', desc: 'Fattura fornitore, materiali, bollette', onClick: () => fabApriCassaConTipo('spesa_officina'), color: 'from-red-50 to-rose-50 border-red-200' },
              { id: 'spesa_tit', icon: '👔', label: 'Spesa titolare', desc: 'Prelievo cassa, spesa personale', onClick: () => fabApriCassaConTipo('spesa_titolare'), color: 'from-purple-50 to-fuchsia-50 border-purple-200' },
              { id: 'anticipo', icon: '💶', label: 'Anticipo dipendente', desc: 'Anticipo stipendio o cassa dipendente', onClick: () => fabApriCassaConTipo('anticipo_dipendente'), color: 'from-amber-50 to-yellow-50 border-amber-200' },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={opt.onClick}
                className={`w-full flex items-center gap-3 p-3 mb-1.5 last:mb-0 rounded-2xl border bg-gradient-to-r ${opt.color} hover:shadow-sm transition-all active:scale-98 cursor-pointer text-left`}
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm">
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">{opt.label}</div>
                  <div className="text-[11px] text-gray-500 truncate">{opt.desc}</div>
                </div>
                <span className="text-gray-300">›</span>
              </button>
            ))}
            <button
              onClick={() => setShowFabMenu(false)}
              className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Annulla
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}
