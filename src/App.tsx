import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import '@/stores/themeStore'; // Initialize theme on app load
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { AppOfficina } from '@/features/dashboard/AppOfficina';
import { AppCliente } from '@/features/customer/AppCliente';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { Loader } from '@/components/ui';

type Page = 'landing' | 'login' | 'register';

export default function App() {
  const { loading, userType, officina, initialize } = useAuthStore();
  const [page, setPage] = useState<Page>('landing');
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  // Check if onboarding is needed: use officina.tel as proxy for completed setup
  const needsOnboarding = userType === 'officina' && officina && !officina.tel && !onboardingComplete;

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingComplete(true);
    // Re-initialize to pick up freshly saved officina data
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader size="lg" text="Caricamento OfficinAI..." />
      </div>
    );
  }

  // If user is authenticated, show the app
  if (userType === 'officina') {
    if (needsOnboarding) {
      return <OnboardingWizard onComplete={handleOnboardingComplete} />;
    }
    return <AppOfficina />;
  }

  if (userType === 'cliente') {
    return <AppCliente />;
  }

  // Not authenticated — show landing, login or register
  if (page === 'landing') {
    return (
      <LandingPage
        onEnter={() => setPage('register')}
        onLogin={() => setPage('login')}
      />
    );
  }

  if (page === 'register') {
    return <RegisterPage onGoLogin={() => setPage('login')} />;
  }

  return <LoginPage onGoRegister={() => setPage('register')} onGoLanding={() => setPage('landing')} />;
}
