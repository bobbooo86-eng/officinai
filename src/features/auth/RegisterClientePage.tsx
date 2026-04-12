import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useHistoryState } from '@/lib/useHistoryState';

interface RegisterClientePageProps {
  onGoLogin: () => void;
}

interface OfficinaResult {
  id: string;
  nome: string;
  indirizzo: string;
}

export function RegisterClientePage({ onGoLogin }: RegisterClientePageProps) {
  const { initialize } = useAuthStore();
  const [step, setStep] = useHistoryState('register-cliente-step', 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Dati personali
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');

  // Step 2b: Veicolo (opzionale)
  const [marca, setMarca] = useState('');
  const [modello, setModello] = useState('');
  const [targa, setTarga] = useState('');

  // Step 3: Cerca officina
  const [searchQuery, setSearchQuery] = useState('');
  const [officine, setOfficine] = useState<OfficinaResult[]>([]);
  const [selectedOfficina, setSelectedOfficina] = useState<OfficinaResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [accettaTermini, setAccettaTermini] = useState(false);

  // Search officine
  useEffect(() => {
    if (searchQuery.length < 2) { setOfficine([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from('officine')
        .select('id, nome, indirizzo')
        .ilike('nome', `%${searchQuery}%`)
        .limit(10);
      setOfficine(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const validateStep1 = () => {
    if (!email.includes('@')) return 'Inserisci un\'email valida';
    if (password.length < 6) return 'La password deve avere almeno 6 caratteri';
    if (password !== confirmPassword) return 'Le password non coincidono';
    return null;
  };

  const validateStep2 = () => {
    if (!nome.trim()) return 'Inserisci il nome';
    if (!cognome.trim()) return 'Inserisci il cognome';
    if (!telefono.trim()) return 'Inserisci il telefono';
    if (targa && targa.length < 5) return 'Inserisci una targa valida o lascia vuoto';
    return null;
  };

  const handleNext = () => {
    setError('');
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (err) { setError(err); return; }
    setStep(step + 1);
  };

  const handleRegister = async () => {
    if (!selectedOfficina) {
      setError('Seleziona la tua officina');
      return;
    }
    if (!accettaTermini) {
      setError('Devi accettare i termini e le condizioni');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Supabase Auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw new Error(authError.message);

      const userId = authData.user?.id;
      if (!userId) throw new Error('Errore nella creazione dell\'account');

      // 2. Create cliente record
      const { data: cliente, error: clienteErr } = await supabase
        .from('clienti')
        .insert({
          officina_id: selectedOfficina.id,
          nome: `${nome} ${cognome}`,
          email: email,
          tel: telefono,
        })
        .select()
        .single();

      if (clienteErr) throw new Error('Errore nella creazione del profilo: ' + clienteErr.message);

      // 3. Create vehicle if provided
      if (marca.trim() && modello.trim() && targa.trim() && cliente) {
        const { error: veicoloErr } = await supabase
          .from('veicoli')
          .insert({
            cliente_id: cliente.id,
            marca: marca.trim(),
            modello: modello.trim(),
            targa: targa.trim().toUpperCase(),
            anno: new Date().getFullYear(),
            km: 0,
            carburante: 'benzina',
          });
        if (veicoloErr) console.warn('Veicolo non creato:', veicoloErr.message);
      }

      // Notify admin of new registration
      supabase.functions.invoke('notify-registration', {
        body: { tipo: 'cliente', nome: `${nome} ${cognome}`, email, telefono },
      }).catch(() => {});

      setSuccess(true);

      // Auto-login after 2 seconds
      setTimeout(async () => {
        await initialize();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account creato!</h2>
          <p className="text-gray-500 dark:text-gray-400">Accesso in corso alla tua area personale...</p>
          <div className="mt-6">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all";
  const labelClass = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🚗</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrati come Cliente</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Segui lo stato della tua auto e prenota appuntamenti</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6 px-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                s < step ? 'bg-emerald-500 text-white' :
                s === step ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-900/50' :
                'bg-gray-200 dark:bg-gray-700 text-gray-400'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < 3 && <div className={`flex-1 h-1 rounded-full ${s < step ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8">

          {/* Step 1: Account */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">1. Crea il tuo account</h2>
              <div>
                <label className={labelClass}>Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tuaemail@esempio.it" autoFocus />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Minimo 6 caratteri" />
              </div>
              <div>
                <label className={labelClass}>Conferma password *</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Ripeti la password" />
              </div>
            </div>
          )}

          {/* Step 2: Dati personali + Veicolo opzionale */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">2. I tuoi dati</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nome *</label>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Mario" autoFocus />
                </div>
                <div>
                  <label className={labelClass}>Cognome *</label>
                  <input type="text" value={cognome} onChange={(e) => setCognome(e.target.value)} className={inputClass} placeholder="Rossi" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Telefono *</label>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} placeholder="+39 333 1234567" />
              </div>

              {/* Veicolo opzionale */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🚗</span>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dati veicolo <span className="text-gray-400 font-normal">(opzionale)</span></h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Marca</label>
                    <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} className={inputClass} placeholder="Fiat" />
                  </div>
                  <div>
                    <label className={labelClass}>Modello</label>
                    <input type="text" value={modello} onChange={(e) => setModello(e.target.value)} className={inputClass} placeholder="Panda" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={labelClass}>Targa</label>
                  <input type="text" value={targa} onChange={(e) => setTarga(e.target.value.toUpperCase())} className={inputClass} placeholder="AB123CD" maxLength={10} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Cerca officina + Conferma */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">3. La tua officina</h2>
              <div>
                <label className={labelClass}>Cerca la tua officina *</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedOfficina(null); }}
                  className={inputClass}
                  placeholder="Scrivi il nome dell'officina..."
                  autoFocus
                />
                {searchLoading && <p className="text-xs text-gray-400 mt-1">Ricerca in corso...</p>}
              </div>

              {/* Search results */}
              {officine.length > 0 && !selectedOfficina && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {officine.map((off) => (
                    <button
                      key={off.id}
                      onClick={() => { setSelectedOfficina(off); setSearchQuery(off.nome); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg shrink-0">🏭</div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{off.nome}</div>
                        <div className="text-xs text-gray-400">{off.indirizzo}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && officine.length === 0 && !searchLoading && !selectedOfficina && (
                <div className="text-sm text-gray-400 text-center py-3">
                  Nessuna officina trovata. Verifica il nome o chiedi alla tua officina se e registrata su OfficinAI.
                </div>
              )}

              {/* Selected officina */}
              {selectedOfficina && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-lg shrink-0">✅</div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{selectedOfficina.nome}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">{selectedOfficina.indirizzo}</div>
                  </div>
                  <button
                    onClick={() => { setSelectedOfficina(null); setSearchQuery(''); }}
                    className="ml-auto text-emerald-600 hover:text-emerald-800 cursor-pointer text-sm"
                  >
                    Cambia
                  </button>
                </div>
              )}

              {/* Riepilogo */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Riepilogo</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <div>👤 {nome} {cognome}</div>
                  <div>📧 {email}</div>
                  <div>📱 {telefono}</div>
                  {marca && modello && <div>🚗 {marca} {modello} {targa && `— ${targa}`}</div>}
                  {selectedOfficina && <div>🏭 {selectedOfficina.nome}</div>}
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accettaTermini}
                  onChange={(e) => setAccettaTermini(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Accetto i <span className="text-emerald-600 underline">Termini di Servizio</span> e la <span className="text-emerald-600 underline">Privacy Policy</span> di OfficinAI
                </span>
              </label>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                onClick={() => { setStep(step - 1); setError(''); }}
                className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium cursor-pointer transition-all"
              >
                Indietro
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
              >
                Avanti
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={loading || !selectedOfficina || !accettaTermini}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Registrazione in corso...' : 'Crea account'}
              </button>
            )}
          </div>
        </div>

        {/* Login link */}
        <div className="text-center mt-6">
          <span className="text-sm text-gray-500">Hai gia un account? </span>
          <button onClick={onGoLogin} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer">
            Accedi
          </button>
        </div>
      </div>
    </div>
  );
}
