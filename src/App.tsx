import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import '@/stores/themeStore'; // Initialize theme on app load
import { LoginPage } from '@/features/auth/LoginPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { AppOfficina } from '@/features/dashboard/AppOfficina';
import { AppCliente } from '@/features/customer/AppCliente';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { Loader } from '@/components/ui';

export default function App() {
  const { loading, userType, officina, initialize } = useAuthStore();
  const [showApp, setShowApp] = useState(false);
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

  if (!userType && !showApp) {
    return <LandingPage onEnter={() => setShowApp(true)} />;
  }

  if (!userType) {
    return <LoginPage />;
  }

  if (userType === 'officina') {
    if (needsOnboarding) {
      return <OnboardingWizard onComplete={handleOnboardingComplete} />;
    }
    return <AppOfficina />;
  }

  return <AppCliente />;
}
