import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const [tipo, setTipo] = useState<'officina' | 'cliente' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { loginOfficina, loginCliente } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || !email) return;

    setLoading(true);
    setError('');

    const result = tipo === 'officina'
      ? await loginOfficina(email, password || 'demo123')
      : await loginCliente(email, password || 'demo123');

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🔧</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">OfficinAI</h1>
          <p className="text-gray-500 mt-1">Gestione intelligente della tua officina</p>
        </div>

        {/* Selection or Login Form */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {!tipo ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">
                Come vuoi accedere?
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => setTipo('officina')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">
                    🏭
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Officina</div>
                    <div className="text-sm text-gray-500">Titolare, meccanico o reception</div>
                  </div>
                </button>

                <button
                  onClick={() => setTipo('cliente')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:bg-emerald-200 transition-colors">
                    🚗
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Cliente</div>
                    <div className="text-sm text-gray-500">Controlla lo stato della tua auto</div>
                  </div>
                </button>
              </div>

              {/* Demo accounts */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  Demo: luigi@autofix.it / marco.ferretti@email.it
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setTipo(null); setError(''); setEmail(''); setPassword(''); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-lg font-semibold text-gray-900">
                  {tipo === 'officina' ? '🏭 Accesso Officina' : '🚗 Accesso Cliente'}
                </h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="tuaemail@esempio.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="La tua password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg">
                  Accedi
                </Button>
              </form>

              {/* Quick demo access */}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-400 text-center mb-2">Accesso rapido demo</p>
                {tipo === 'officina' ? (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {[
                      { email: 'luigi@autofix.it', label: 'Titolare' },
                      { email: 'marco@autofix.it', label: 'Meccanico' },
                      { email: 'anna@autofix.it', label: 'Reception' },
                    ].map((demo) => (
                      <button
                        key={demo.email}
                        type="button"
                        onClick={() => { setEmail(demo.email); setPassword('demo123'); }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                      >
                        {demo.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {[
                      { email: 'marco.ferretti@email.it', label: 'Marco F.' },
                      { email: 'sofia.longo@email.it', label: 'Sofia L.' },
                      { email: 'luca.marini@email.it', label: 'Luca M.' },
                    ].map((demo) => (
                      <button
                        key={demo.email}
                        type="button"
                        onClick={() => { setEmail(demo.email); setPassword('demo123'); }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
                      >
                        {demo.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
