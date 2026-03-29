import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { GlobalSearch } from '@/features/search/GlobalSearch';

interface LayoutProps {
  children: ReactNode;
  tabs: { id: string; label: string; icon: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, tabs, activeTab, onTabChange }: LayoutProps) {
  const { utente, officina, cliente, userType, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  const userName = userType === 'officina' ? utente?.nome : cliente?.nome;
  const userRole = userType === 'officina' ? utente?.ruolo : 'cliente';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-lg">🔧</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">
              {officina?.nome || 'OfficinAI'}
            </h1>
            <p className="text-[11px] text-gray-400">
              {userName} — <span className="capitalize">{userRole}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GlobalSearch />
          <NotificationBell />
          <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <span className="text-sm">{userName?.charAt(0).toUpperCase()}</span>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-400 capitalize">{userRole}</p>
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
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-4 min-w-[64px] transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
