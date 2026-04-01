import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface RegisterPageProps {
  onGoLogin: () => void;
}

const tipiOfficina = [
  'Officina meccanica auto',
  'Officina moto',
  'Carrozzeria',
  'Gommista',
  'Centro revisione',
  'Officina nautica (barche/moto d\'acqua)',
  'Officina veicoli agricoli/trattori',
  'Officina veicoli pesanti/camion',
  'Elettrauto',
  'Altro',
];

export function RegisterPage({ onGoLogin }: RegisterPageProps) {
  const { initialize } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Titolare
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');

  // Step 3: Officina
  const [nomeOfficina, setNomeOfficina] = useState('');
  const [pIva, setPIva] = useState('');
  const [tipoOfficina, setTipoOfficina] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [citta, setCitta] = useState('');
  const [cap, setCap] = useState('');
  const [provincia, setProvincia] = useState('');

  // Step 4: Conferma
  const [accettaTermini, setAccettaTermini] = useState(false);

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
    return null;
  };

  const validateStep3 = () => {
    if (!nomeOfficina.trim()) return 'Inserisci il nome dell\'officina';
    if (!pIva.trim() || pIva.length < 11) return 'Inserisci una Partita IVA valida (11 cifre)';
    if (!tipoOfficina) return 'Seleziona il tipo di officina';
    if (!indirizzo.trim()) return 'Inserisci l\'indirizzo';
    if (!citta.trim()) return 'Inserisci la città';
    return null;
  };

  const handleNext = () => {
    setError('');
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();
    if (err) { setError(err); return; }
    setStep(step + 1);
  };

  const handleRegister = async () => {
    if (!accettaTermini) {
      setError('Devi accettare i termini e le condizioni per procedere');
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

      // 2. Create officina record
      const { data: officina, error: offErr } = await supabase
        .from('officine')
        .insert({
          nome: nomeOfficina,
          indirizzo: `${indirizzo}, ${cap} ${citta} (${provincia})`,
          tel: telefono,
          email: email,
          p_iva: pIva,
          piano: 'trial',
        })
        .select()
        .single();

      if (offErr) throw new Error('Errore nella creazione dell\'officina: ' + offErr.message);

      // 3. Create utente (titolare) record
      const { error: userErr } = await supabase
        .from('utenti')
        .insert({
          officina_id: officina.id,
          nome: `${nome} ${cognome}`,
          email: email,
          tel: telefono,
          ruolo: 'titolare',
          attivo: true,
        });

      if (userErr) throw new Error('Errore nella creazione dell\'utente: ' + userErr.message);

      // 4. Create trial subscription (14 days)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const { error: subErr } = await supabase.from('abbonamenti').insert({
        officina_id: officina.id,
        piano: 'professional',
        stato: 'trial',
        data_inizio: new Date().toISOString(),
        data_fine: trialEnd.toISOString(),
        stripe_subscription_id: null,
      });
      if (subErr) console.warn('Trial subscription not created (table may not exist):', subErr.message);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✅</div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Registrazione completata!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">Benvenuto in OfficinAI, {nome}!</p>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Hai <strong className="text-blue-600">14 giorni gratuiti</strong> per provare tutte le funzionalità.
            Nessun addebito automatico.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-6 mb-6">
            <div className="text-sm text-blue-700 dark:text-blue-300 font-semibold mb-1">Il tuo account</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{nomeOfficina}</div>
            <div className="text-sm text-gray-500">{email}</div>
          </div>
          <p className="text-sm text-gray-400 animate-pulse">Accesso in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3 shadow-lg">
            <span className="text-2xl">🔧</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrati su OfficinAI</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">14 giorni gratis · Nessuna carta richiesta</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {['Account', 'Titolare', 'Officina', 'Conferma'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i + 1 < step ? 'bg-green-500 text-white' :
                i + 1 === step ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' :
                'bg-gray-200 dark:bg-gray-700 text-gray-400'
              }`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i + 1 === step ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
              {i < 3 && <div className={`w-6 h-0.5 ${i + 1 < step ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl text-sm text-red-600 dark:text-red-400">
              ⚠️ {error}
            </div>
          )}

          {/* Step 1: Account */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Crea il tuo account</h2>
              <p className="text-sm text-gray-500 mb-4">Questi dati serviranno per accedere alla piattaforma.</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="info@tuaofficina.it"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Password *</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Almeno 6 caratteri"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Conferma Password *</label>
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Step 2: Titolare */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Dati del titolare</h2>
              <p className="text-sm text-gray-500 mb-4">Chi è il responsabile dell'officina?</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nome *</label>
                  <input
                    type="text" value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Mario"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Cognome *</label>
                  <input
                    type="text" value={cognome} onChange={e => setCognome(e.target.value)}
                    placeholder="Rossi"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Telefono *</label>
                <input
                  type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
                  placeholder="+39 348 123 4567"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Step 3: Officina */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Dati dell'officina</h2>
              <p className="text-sm text-gray-500 mb-4">Inserisci i dati della tua attività.</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nome officina *</label>
                <input
                  type="text" value={nomeOfficina} onChange={e => setNomeOfficina(e.target.value)}
                  placeholder="AutoService Milano"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Partita IVA *</label>
                <input
                  type="text" value={pIva} onChange={e => setPIva(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="12345678901"
                  maxLength={11}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">{pIva.length}/11 cifre</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tipo officina *</label>
                <select
                  value={tipoOfficina} onChange={e => setTipoOfficina(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Seleziona...</option>
                  {tipiOfficina.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Indirizzo *</label>
                <input
                  type="text" value={indirizzo} onChange={e => setIndirizzo(e.target.value)}
                  placeholder="Via Roma 123"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">CAP</label>
                  <input
                    type="text" value={cap} onChange={e => setCap(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="20100"
                    maxLength={5}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Città *</label>
                  <input
                    type="text" value={citta} onChange={e => setCitta(e.target.value)}
                    placeholder="Milano"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Prov.</label>
                  <input
                    type="text" value={provincia} onChange={e => setProvincia(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="MI"
                    maxLength={2}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Conferma */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Conferma registrazione</h2>
              <p className="text-sm text-gray-500 mb-4">Controlla i tuoi dati prima di procedere.</p>

              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Account</div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{email}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Titolare</div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{nome} {cognome}</div>
                  <div className="text-xs text-gray-500">{telefono}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Officina</div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{nomeOfficina}</div>
                  <div className="text-xs text-gray-500">P.IVA: {pIva} · {tipoOfficina}</div>
                  <div className="text-xs text-gray-500">{indirizzo}, {cap} {citta} ({provincia})</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Il tuo piano</div>
                  <div className="text-sm text-gray-900 dark:text-white font-bold">🎁 14 giorni gratuiti — Piano Professional</div>
                  <div className="text-xs text-gray-500 mt-1">Nessun addebito. Dopo 14 giorni scegli il piano che preferisci o cancella gratis.</div>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={accettaTermini}
                  onChange={e => setAccettaTermini(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  Accetto i <a href="#" className="text-blue-600 underline">Termini e Condizioni</a> e la{' '}
                  <a href="#" className="text-blue-600 underline">Privacy Policy</a> di OfficinAI.
                  Confermo che i dati inseriti sono corretti.
                </span>
              </label>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={() => { setStep(step - 1); setError(''); }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                ← Indietro
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-600/30 cursor-pointer"
              >
                Avanti →
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={loading}
                className="px-6 py-2.5 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 active:scale-95 transition-all shadow-sm shadow-green-600/30 cursor-pointer disabled:opacity-50"
              >
                {loading ? '⏳ Creazione in corso...' : '✅ Registrati gratis'}
              </button>
            )}
          </div>
        </div>

        {/* Link to login */}
        <div className="text-center mt-6">
          <span className="text-sm text-gray-500">Hai già un account? </span>
          <button onClick={onGoLogin} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
            Accedi qui →
          </button>
        </div>
      </div>
    </div>
  );
}
