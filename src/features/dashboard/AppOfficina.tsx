import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from './Dashboard';
import { SettingsPage } from './SettingsPage';
import { AppointmentList } from '@/features/appointments/AppointmentList';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
import { CalendarView } from '@/features/appointments/CalendarView';
import { CustomersPage } from '@/features/appointments/CustomersPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { AnalyticsPage } from './AnalyticsPage';
import { InvoicePage } from '@/features/invoices/InvoicePage';
import { SubscriptionPage } from '@/features/billing/SubscriptionPage';
import type { Appuntamento } from '@/types/database';

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'calendario', label: 'Calendario', icon: '📆' },
  { id: 'clienti', label: 'Clienti', icon: '👥' },
  { id: 'altro', label: 'Altro', icon: '⚙️' },
];

export function AppOfficina() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedApp, setSelectedApp] = useState<Appuntamento | null>(null);
  const [subPage, setSubPage] = useState<'magazzino' | 'analytics' | 'fatture' | 'abbonamento' | 'impostazioni' | null>(null);

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
      {activeTab === 'home' && <Dashboard onSelectAppuntamento={handleSelectApp} />}
      {activeTab === 'agenda' && <AppointmentList onSelect={handleSelectApp} />}
      {activeTab === 'calendario' && <CalendarView onSelect={handleSelectApp} />}
      {activeTab === 'clienti' && <CustomersPage />}
      {activeTab === 'altro' && !subPage && (
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">Altro</h2>
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
      {activeTab === 'altro' && subPage === 'magazzino' && (
        <div>
          <button
            onClick={() => setSubPage(null)}
            className="flex items-center gap-1 px-4 pt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            ← Indietro
          </button>
          <InventoryPage />
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
          <AnalyticsPage />
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
          <InvoicePage />
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
          <SubscriptionPage />
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
          <SettingsPage />
        </div>
      )}
    </Layout>
  );
}
