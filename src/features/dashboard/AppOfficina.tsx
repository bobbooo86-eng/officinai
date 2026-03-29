import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from './Dashboard';
import { AppointmentList } from '@/features/appointments/AppointmentList';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
import { CustomersPage } from '@/features/appointments/CustomersPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import type { Appuntamento } from '@/types/database';

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'clienti', label: 'Clienti', icon: '👥' },
  { id: 'magazzino', label: 'Magazzino', icon: '📦' },
];

export function AppOfficina() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedApp, setSelectedApp] = useState<Appuntamento | null>(null);

  const handleSelectApp = (app: Appuntamento) => {
    setSelectedApp(app);
  };

  const handleBack = () => {
    setSelectedApp(null);
  };

  // If viewing appointment detail, show that instead
  if (selectedApp) {
    return (
      <Layout tabs={TABS} activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); setSelectedApp(null); }}>
        <AppointmentDetail appuntamento={selectedApp} onBack={handleBack} />
      </Layout>
    );
  }

  return (
    <Layout tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'home' && <Dashboard onSelectAppuntamento={handleSelectApp} />}
      {activeTab === 'agenda' && <AppointmentList onSelect={handleSelectApp} />}
      {activeTab === 'clienti' && <CustomersPage />}
      {activeTab === 'magazzino' && <InventoryPage />}
    </Layout>
  );
}
