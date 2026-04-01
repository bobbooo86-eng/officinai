import { useState, useMemo } from 'react';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { validateEmail, validatePassword, useFormValidation } from '@/lib/validation';

interface LoginPageProps {
  onGoRegister?: () => void;
  onGoLanding?: () => void;
}

export function LoginPage({ onGoRegister, onGoLanding }: LoginPageProps = {}) {
  const [tipo, setTipo] = useState<'officina' | 'cliente' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { loginOfficina, loginCliente } = useAuthStore();

  const validators = useMemo(() => ({
    email: (v: string) => validateEmail(v),
    password: (v: string) => validatePassword(v),
  }), []);

  const { errors: fieldErrors, validate, validateAll, isValid, clearErrors } = useFormValidation(validators);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo) return;
    if (!validateAll({ email, password })) return;

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🔧</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">OfficinAI</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestione intelligente della tua officina</p>
        </div>

        {/* Selection or Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          {!tipo ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-6">
                Come vuoi accedere?
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => setTipo('officina')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">
                    🏭
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-white">Officina</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Titolare, meccanico o reception</div>
                  </div>
                </button>

                <button
                  onClick={() => setTipo('cliente')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:bg-emerald-200 transition-colors">
                    🚗
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-white">Cliente</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Controlla lo stato della tua auto</div>
                  </div>
                </button>
              </div>

              {/* Demo accounts */}
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                  Demo: luigi@autofix.it / marco.ferretti@email.it
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setTipo(null); setError(''); setEmail(''); setPassword(''); clearErrors(); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                  onBlur={() => validate('email', email)}
                  error={fieldErrors.email ?? undefined}
                  required
                  autoFocus
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="La tua password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => validate('password', password)}
                  error={fieldErrors.password ?? undefined}
                />

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg" disabled={!isValid}>
                  Accedi
                </Button>
              </form>

              {/* Quick demo access */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
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
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
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
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-gray-600 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
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

        {/* Register / Back links */}
        <div className="text-center mt-6 space-y-2">
          {onGoRegister && (
            <div>
              <span className="text-sm text-gray-500">Non hai un account? </span>
              <button onClick={onGoRegister} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                Registrati gratis →
              </button>
            </div>
          )}
          {onGoLanding && (
            <div>
              <button onClick={onGoLanding} className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
                ← Torna al sito
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
