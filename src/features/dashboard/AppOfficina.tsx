import { useState, lazy, Suspense } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from './Dashboard';
import { AppointmentList } from '@/features/appointments/AppointmentList';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
import { CalendarView } from '@/features/appointments/CalendarView';
import { CustomersPage } from '@/features/appointments/CustomersPage';
import { NuovoAppuntamento } from '@/features/appointments/NuovoAppuntamento';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useHistoryState } from '@/lib/useHistoryState';
import type { Appuntamento } from '@/types/database';

const AnalyticsPage = lazy(() => import('./AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const InvoicePage = lazy(() => import('@/features/invoices/InvoicePage').then(m => ({ default: m.InvoicePage })));
const SubscriptionPage = lazy(() => import('@/features/billing/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.SettingsPage })));
const OBDScansPage = lazy(() => import('./OBDScansPage').then(m => ({ default: m.OBDScansPage })));
const GuidaPage = lazy(() => import('@/features/guide/GuidaPage').then(m => ({ default: m.GuidaPage })));

const PreventiviPage = lazy(() => import('@/features/estimates/PreventiviPage').then(m => ({ default: m.PreventiviPage })));

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'agenda', label: 'Appuntamenti', icon: '📅' },
  { id: 'preventivi', label: 'Preventivi', icon: '💰' },
  { id: 'clienti', label: 'Clienti', icon: '👥' },
  { id: 'altro', label: 'Altro', icon: '⚙️' },
];

export function AppOfficina() {
  const [activeTab, setActiveTab] = useHistoryState('officina-tab', 'home');
  const [selectedApp, setSelectedApp] = useState<Appuntamento | null>(null);
  const [subPage, setSubPage] = useState<'calendario' | 'magazzino' | 'analytics' | 'fatture' | 'abbonamento' | 'impostazioni' | 'obd' | 'guida' | null>(null);
  const [agendaFiltro, setAgendaFiltro] = useState<string | undefined>(undefined);
  const [agendaView, setAgendaView] = useState<'calendario' | 'lista'>('calendario');
  const [showNewApp, setShowNewApp] = useState(false);

  const handleSelectApp = (app: Appuntamento) => {
    setSelectedApp(app);
  };

  const handleBack = () => {
    setSelectedApp(null);
  };

  // Appointment detail view
  if (selectedApp) {
    return (
      <Layout tabs={TABS} activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); setSelectedApp(null); setSubPage(null); }}>
        <AppointmentDetail appuntamento={selectedApp} onBack={handleBack} />
      </Layout>
    );
  }

  return (
    <Layout tabs={TABS} activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); setSubPage(null); }}>
      {activeTab === 'home' && (
        <Dashboard
          onSelectAppuntamento={handleSelectApp}
          onNavigateToAgenda={(filtro) => {
            setAgendaFiltro(filtro);
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
            onBack={() => setShowNewApp(false)}
            onCreated={(app) => { setShowNewApp(false); handleSelectApp(app); }}
          />
        ) : (
          <div>
            {/* Toggle Calendario / Lista + Nuovo Appuntamento */}
            <div className="px-4 pt-4 flex items-center justify-between">
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
            {agendaView === 'calendario' ? (
              <CalendarView onSelect={handleSelectApp} />
            ) : (
              <AppointmentList onSelect={handleSelectApp} initialFiltro={agendaFiltro} />
            )}
          </div>
        )
      )}
      {activeTab === 'preventivi' && <Suspense fallback={<PageSkeleton />}><PreventiviPage onSelectAppuntamento={handleSelectApp} /></Suspense>}
      {activeTab === 'clienti' && <CustomersPage />}
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
            onClick={() => setSubPage('calendario')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl">📆</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Calendario</div>
              <div className="text-xs text-gray-500">Vista calendario appuntamenti</div>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setSubPage('magazzino')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">📦</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Magazzino</div>
              <div className="text-xs text-gray-500">Gestisci inventario ricambi</div>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setSubPage('analytics')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl">📊</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Analytics</div>
              <div className="text-xs text-gray-500">Statistiche e report</div>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setSubPage('fatture')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">🧾</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Fatturazione</div>
              <div className="text-xs text-gray-500">Gestisci fatture e incassi</div>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            onClick={() => setSubPage('obd')}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl">🔌</div>
            <div className="text-left">
              <div className="font-semibold text-sm text-gray-900">Scansioni OBD</div>
              <div className="text-xs text-gray-500">Codici errore ricevuti dai clienti</div>
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
      {activeTab === 'altro' && subPage === 'calendario' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <CalendarView onSelect={handleSelectApp} />
        </div>
      )}
      {activeTab === 'altro' && subPage === 'magazzino' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><InventoryPage /></Suspense>
        </div>
      )}
      {activeTab === 'altro' && subPage === 'analytics' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><AnalyticsPage /></Suspense>
        </div>
      )}
      {activeTab === 'altro' && subPage === 'fatture' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><InvoicePage /></Suspense>
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
      {activeTab === 'altro' && subPage === 'obd' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <Suspense fallback={<PageSkeleton />}><OBDScansPage /></Suspense>
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
    </Layout>
  );
}
