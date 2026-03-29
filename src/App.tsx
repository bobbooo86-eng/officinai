import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import '@/stores/themeStore'; // Initialize theme on app load
import { LoginPage } from '@/features/auth/LoginPage';
import { AppOfficina } from '@/features/dashboard/AppOfficina';
import { AppCliente } from '@/features/customer/AppCliente';
import { Loader } from '@/components/ui';

export default function App() {
  const { loading, userType, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader size="lg" text="Caricamento OfficinAI..." />
      </div>
    );
  }

  if (!userType) {
    return <LoginPage />;
  }

  if (userType === 'officina') {
    return <AppOfficina />;
  }

  return <AppCliente />;
}
