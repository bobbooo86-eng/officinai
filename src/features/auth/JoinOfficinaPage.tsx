import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface JoinOfficinaPageProps {
  onGoLogin: () => void;
  onGoBack: () => void;
}

interface Officina {
  id: string;
  nome: string;
  indirizzo: string | null;
  citta?: string | null;
}

export function JoinOfficinaPage({ onGoLogin, onGoBack }: JoinOfficinaPageProps) {
  const { initialize } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ruolo, setRuolo] = useState<'titolare' | 'operaio' | 'reception'>('operaio');

  const [officine, setOfficine] = useState<Officina[]>([]);
  const [loadingOfficine, setLoadingOfficine] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOfficinaId, setSelectedOfficinaId] = useState<string>('');

  const [accettaTermini, setAccettaTermini] = useState(false);

  useEffect(() => {
    const fetchOfficine = async () => {
      setLoadingOfficine(true);
      const { data } = await supabase
        .from('officine')
        .select('id, nome, indirizzo')
        .order('nome', { ascending: true });
      setOfficine((data as Officina[]) || []);
      setLoadingOfficine(false);
    };
    fetchOfficine();
  }, []);

  const filteredOfficine = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return officine;
    return officine.filter(
      (o) =>
        o.nome.toLowerCase().includes(s) ||
        (o.indirizzo || '').toLowerCase().includes(s)
    );
  }, [search, officine]);

  const selectedOfficina = officine.find((o) => o.id === selectedOfficinaId);

  const validate = (): string | null => {
    if (!email.includes('@')) return "Inserisci un'email valida";
    if (password.length < 6) return 'La password deve avere almeno 6 caratteri';
    if (password !== confirmPassword) return 'Le password non coincidono';
    if (!nome.trim()) return 'Inserisci il nome';
    if (!cognome.trim()) return 'Inserisci il cognome';
    if (!telefono.trim()) return 'Inserisci il telefono';
    if (!selectedOfficinaId) return "Seleziona l'officina di appartenenza";
    if (!accettaTermini) return 'Devi accettare i termini e le condizioni';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) {
        if (!authError.message.toLowerCase().includes('already')) {
          throw new Error(authError.message);
        }
      }

      const { data: existing } = await supabase
        .from('utenti')
        .select('id, attivo')
        .eq('email', email)
        .eq('officina_id', selectedOfficinaId)
        .maybeSingle();

      if (existing) {
        if (existing.attivo) {
          throw new Error("Sei già registrato in questa officina. Prova ad accedere.");
        } else {
          throw new Error("Hai già una richiesta in attesa di approvazione per questa officina.");
        }
      }

      const { error: userErr } = await supabase.from('utenti').insert({
        officina_id: selectedOfficinaId,
        // Collega la riga all'utente Auth per le policy RLS.
        auth_id: authData.user?.id ?? null,
        nome: `${nome} ${cognome}`.trim(),
        email,
        tel: telefono,
        ruolo,
        attivo: false,
      });
      if (userErr) throw new Error("Errore nella creazione dell'utente: " + userErr.message);

      try {
        const { data: adminUtenti } = await supabase
          .from('utenti')
          .select('id')
          .eq('officina_id', selectedOfficinaId)
          .eq('ruolo', 'titolare')
          .eq('attivo', true);

        if (adminUtenti && adminUtenti.length > 0) {
          const rows = adminUtenti.map((u) => ({
            officina_id: selectedOfficinaId,
            utente_id: u.id,
            tipo: 'staff',
            titolo: 'Nuova richiesta staff',
            messaggio: `${nome} ${cognome} vuole iscriversi come ${ruolo}. Approvala in Impostazioni → Team.`,
          }));
          await supabase.from('notifiche').insert(rows);
        }
      } catch {
        // ignore
      }

      supabase.functions
        .invoke('notify-registration', {
          body: {
            tipo: 'staff-join',
            nome: `${nome} ${cognome}`,
            email,
            telefono,
            ruolo,
            officina: selectedOfficina?.nome || '',
          },
        })
        .catch(() => {});

      setSuccess(true);

      setTimeout(async () => {
        await initialize();
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore durante la registrazione';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">⏳</div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">Richiesta inviata!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Ciao {nome}, la tua richiesta di iscrizione a{' '}
            <strong className="text-gray-900 dark:text-white">{selectedOfficina?.nome}</strong> è stata inviata.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-4 my-6 text-left">
            <div className="text-sm text-amber-800 dark:text-amber-200 font-semibold mb-1">In attesa di approvazione</div>
            <div className="text-xs text-amber-700 dark:text-amber-300">
              L'amministratore dell'officina riceverà una notifica. Potrai accedere non appena il tuo account
              sarà approvato.
            </div>
          </div>
          <button
            onClick={onGoLogin}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            Vai al login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-start sm:items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3 shadow-lg">
            <span className="text-2xl">👷</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unisciti a un'officina</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Se lavori in un'officina già registrata su OfficinAI
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl text-sm text-red-600 dark:text-red-400">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Officina di appartenenza *
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome o città..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-2 text-sm"
            />
            {loadingOfficine ? (
              <div className="text-xs text-gray-400 py-2">Caricamento officine...</div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
                {filteredOfficine.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3 text-center">Nessuna officina trovata</div>
                ) : (
                  filteredOfficine.slice(0, 30).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOfficinaId(o.id)}
                      className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                        selectedOfficinaId === o.id
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {selectedOfficinaId === o.id && <span className="text-blue-600">✓</span>}
                        {o.nome}
                      </div>
                      {o.indirizzo && (
                        <div className="text-[11px] text-gray-500 truncate">{o.indirizzo}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Il tuo ruolo *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'titolare', label: 'Titolare', icon: '👔' },
                  { id: 'operaio', label: 'Operaio', icon: '🔧' },
                  { id: 'reception', label: 'Reception', icon: '📞' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRuolo(r.id)}
                  className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    ruolo === r.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xl mb-0.5">{r.icon}</div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">{r.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nome *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Mario"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Cognome *</label>
              <input
                type="text"
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
                placeholder="Rossi"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Telefono *</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+39 348 123 4567"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuaemail@esempio.it"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 6 caratteri"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Conferma *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ripeti password"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={accettaTermini}
              onChange={(e) => setAccettaTermini(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Accetto i <a href="#" className="text-blue-600 underline">Termini</a> e la{' '}
              <a href="#" className="text-blue-600 underline">Privacy Policy</a>.
            </span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-600/30 cursor-pointer disabled:opacity-50"
          >
            {loading ? '⏳ Invio richiesta...' : "Richiedi iscrizione all'officina"}
          </button>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-center space-y-1">
            <div>
              <span className="text-xs text-gray-500">Hai già un account? </span>
              <button
                onClick={onGoLogin}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Accedi →
              </button>
            </div>
            <div>
              <button
                onClick={onGoBack}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ← Torna indietro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
