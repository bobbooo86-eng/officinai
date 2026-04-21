import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { PrintButton } from '@/components/PrintButton';

interface LayoutProps {
  children: ReactNode;
  tabs: { id: string; label: string; icon: string; badge?: number }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSearchSelect?: (type: string, id: string) => void;
  showSearch?: boolean;
  fab?: { onClick: () => void };
}

export function Layout({ children, tabs, activeTab, onTabChange, onSearchSelect, showSearch = false, fab }: LayoutProps) {
  const { utente, officina, cliente, userType, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  const userName = userType === 'officina' ? utente?.nome : cliente?.nome;
  const userRole = userType === 'officina' ? utente?.ruolo : 'cliente';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Vai al contenuto principale
      </a>

      {/* Top bar — sticky with blur */}
      <header role="banner" className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">🔧</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                {officina?.nome || 'OfficinAI'}
              </h1>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {userName} — <span className="capitalize">{userRole}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold dark:text-gray-300">{userName?.charAt(0).toUpperCase()}</span>
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{userName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{userRole}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Esci
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search bar — only on Home */}
        {showSearch && (
          <div className="px-4 pb-3">
            <GlobalSearch onSelect={onSearchSelect} />
          </div>
        )}
      </header>

      {/* Content */}
      <main id="main-content" role="main" className="flex-1 overflow-auto pb-20 dark:bg-gray-900">
        {children}
      </main>

      {/* Print button — floating on every page */}
      <PrintButton />

      {/* FAB — Nuovo appuntamento */}
      {fab && (
        <button
          onClick={fab.onClick}
          className="fixed bottom-[68px] right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-xl flex items-center justify-center text-3xl font-light transition-all cursor-pointer select-none"
          aria-label="Nuovo appuntamento"
          style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.45)' }}
        >
          +
        </button>
      )}

      {/* Bottom navigation — min 48px touch targets, scrollabile se tab > 5 */}
      <nav role="navigation" aria-label="Menu principale" className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center overflow-x-auto scrollbar-hide px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[60px] px-2 transition-all cursor-pointer rounded-xl ${
                activeTab === tab.id
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <div className="relative">
                <span className="text-[20px] leading-none">{tab.icon}</span>
                {tab.badge != null && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none border-2 border-white dark:border-gray-900">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
