import { useEffect, useState, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuthStore } from '@/stores/authStore';
import '@/stores/themeStore'; // Initialize theme on app load
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { AppOfficina } from '@/features/dashboard/AppOfficina';
import { AppCliente } from '@/features/customer/AppCliente';
import { RegisterClientePage } from '@/features/auth/RegisterClientePage';
import { JoinOfficinaPage } from '@/features/auth/JoinOfficinaPage';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { Loader } from '@/components/ui';

type Page = 'landing' | 'login' | 'register' | 'register-cliente' | 'join-officina' | 'choose-register';

export default function App() {
  const { loading, userType, officina, initialize } = useAuthStore();
  const [page, setPage] = useState<Page>('landing');
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  // Browser history integration — back button works across pages
  const navigateTo = useCallback((newPage: Page) => {
    setPage(newPage);
    window.history.pushState({ page: newPage }, '', '/');
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.page) {
        setPage(e.state.page);
      } else {
        setPage('landing');
      }
    };
    window.history.replaceState({ page: 'landing' }, '', '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check if onboarding is needed: use officina.tel as proxy for completed setup
  const needsOnboarding = userType === 'officina' && officina && !officina.tel && !onboardingComplete;

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingComplete(true);
    // Re-initialize to pick up freshly saved officina data
    initialize();
  }, [initialize]);

  const renderContent = () => {
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
          onEnter={() => navigateTo('choose-register')}
          onLogin={() => navigateTo('login')}
        />
      );
    }

    if (page === 'choose-register') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-start sm:items-center justify-center px-4 pt-12 sm:pt-4 pb-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-4 sm:mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl mb-2 shadow-lg">
                <span className="text-2xl sm:text-3xl">🔧</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Inizia gratis</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Come vuoi registrarti?</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-5 sm:p-8 space-y-3 sm:space-y-4">
              <button
                onClick={() => navigateTo('register')}
                className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-100 flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors shrink-0">🏭</div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">Sono un'officina</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Registra la tua officina e gestisci tutto con AI</div>
                </div>
              </button>
              <button
                onClick={() => navigateTo('join-officina')}
                className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-100 flex items-center justify-center text-2xl group-hover:bg-amber-200 transition-colors shrink-0">👷</div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">Lavoro in un'officina</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Sono titolare, operaio o reception di un'officina già registrata</div>
                </div>
              </button>
              <button
                onClick={() => navigateTo('register-cliente')}
                className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:bg-emerald-200 transition-colors shrink-0">🚗</div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">Sono un cliente</div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Segui lo stato della tua auto e prenota appuntamenti</div>
                </div>
              </button>
            </div>
            <div className="text-center mt-5 space-y-2">
              <div>
                <span className="text-sm text-gray-500">Hai gia un account? </span>
                <button onClick={() => navigateTo('login')} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Accedi</button>
              </div>
              <div>
                <button onClick={() => navigateTo('landing')} className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">← Torna al sito</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (page === 'register') {
      return <RegisterPage onGoLogin={() => navigateTo('login')} />;
    }

    if (page === 'register-cliente') {
      return <RegisterClientePage onGoLogin={() => navigateTo('login')} />;
    }

    if (page === 'join-officina') {
      return (
        <JoinOfficinaPage
          onGoLogin={() => navigateTo('login')}
          onGoBack={() => navigateTo('choose-register')}
        />
      );
    }

    return <LoginPage onGoRegister={() => navigateTo('register')} onGoRegisterCliente={() => navigateTo('register-cliente')} onGoLanding={() => navigateTo('landing')} />;
  };

  return (
    <>
      {renderContent()}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
