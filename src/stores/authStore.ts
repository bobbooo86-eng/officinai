import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Utente, Cliente, Officina } from '@/types/database';

const DEMO_SESSION_KEY = 'officinai_demo_session';

type DemoSession = { email: string; userType: 'officina' | 'cliente' };

const readDemoSession = (): DemoSession | null => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DEMO_SESSION_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeDemoSession = (s: DemoSession | null) => {
  try {
    if (typeof window === 'undefined') return;
    if (s) window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
};

interface AuthState {
  loading: boolean;
  sessionUser: { email?: string; id?: string } | null;
  utente: Utente | null;
  cliente: Cliente | null;
  officina: Officina | null;
  userType: 'officina' | 'cliente' | null;

  initialize: () => Promise<void>;
  /** Aggiorna i dati dell'officina gia' caricati (es. dopo il salvataggio delle impostazioni). */
  updateOfficina: (patch: Partial<Officina>) => void;
  loginOfficina: (email: string, password: string) => Promise<{ error?: string }>;
  loginCliente: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  loading: true,
  sessionUser: null,
  utente: null,
  cliente: null,
  officina: null,
  userType: null,

  updateOfficina: (patch) =>
    set((state) => (state.officina ? { officina: { ...state.officina, ...patch } } : state)),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || readDemoSession()?.email;

      if (session?.user) {
        set({ sessionUser: session.user });
      } else if (email) {
        set({ sessionUser: { email } });
      }

      if (email) {
        const { data: utente } = await supabase
          .from('utenti')
          .select('*')
          .eq('email', email)
          .eq('attivo', true)
          .single();

        if (utente) {
          const { data: officina } = await supabase
            .from('officine')
            .select('*')
            .eq('id', utente.officina_id)
            .single();

          set({ utente, officina, userType: 'officina', loading: false });
          return;
        }

        const { data: cliente } = await supabase
          .from('clienti')
          .select('*')
          .eq('email', email)
          .single();

        if (cliente) {
          set({ cliente, userType: 'cliente', loading: false });
          return;
        }

        writeDemoSession(null);
      }

      set({ loading: false });
    } catch (err) {
      console.error('Auth init error:', err);
      set({ loading: false });
    }
  },

  loginOfficina: async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      let authUser = authData?.user ?? null;

      if (authError) {
        const { data: utente } = await supabase
          .from('utenti')
          .select('*')
          .eq('email', email)
          .eq('attivo', true)
          .single();

        if (!utente) {
          return { error: 'Email o password non validi' };
        }

        // Alcuni account creati prima dell'introduzione dell'autenticazione
        // vera non hanno ancora un account Auth: si prova a crearlo ora,
        // una tantum, con la password appena digitata.
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });

        if (signUpError?.message.includes('already registered')) {
          // L'account Auth esiste gia': il fallimento del login sopra
          // significa che la password digitata e' sbagliata. Mostrarlo
          // chiaramente invece di procedere con una sessione non reale,
          // che farebbe fallire in silenzio ogni scrittura protetta piu'
          // avanti (es. "row-level security policy" nella Cassa).
          return { error: 'Password errata.' };
        }
        if (signUpError) {
          return { error: signUpError.message };
        }

        authUser = signUpData?.user ?? null;
        if (!signUpData?.session) {
          // La creazione dell'account Auth puo' non restituire subito una
          // sessione (es. conferma email richiesta): si ritenta il login,
          // che con la stessa password ora dovrebbe riuscire.
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email, password });
          if (retryError) {
            return { error: 'Account creato ma accesso non riuscito: ' + retryError.message };
          }
          authUser = retryData.user;
        }
      }

      const { data: utente } = await supabase
        .from('utenti')
        .select('*')
        .eq('email', email)
        .eq('attivo', true)
        .maybeSingle();

      if (!utente) {
        const { data: pending } = await supabase
          .from('utenti')
          .select('id')
          .eq('email', email)
          .eq('attivo', false)
          .maybeSingle();
        if (pending) {
          await supabase.auth.signOut().catch(() => {});
          return { error: 'Il tuo account è in attesa di approvazione da parte del titolare dell\'officina.' };
        }
        return { error: 'Utente non trovato nel sistema' };
      }

      const { data: officina } = await supabase
        .from('officine')
        .select('*')
        .eq('id', utente.officina_id)
        .single();

      set({
        sessionUser: authUser || { email },
        utente,
        officina,
        userType: 'officina',
      });
      return {};
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore di connessione';
      return { error: msg };
    }
  },

  loginCliente: async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      let authUser = authData?.user ?? null;

      if (authError) {
        const { data: cliente } = await supabase
          .from('clienti')
          .select('*')
          .eq('email', email)
          .single();

        if (!cliente) {
          return { error: 'Email o password non validi' };
        }

        // Come per lo staff: un account gia' esistente + login fallito
        // significa password sbagliata, non un cliente da far entrare lo
        // stesso senza autenticazione reale.
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });

        if (signUpError?.message.includes('already registered')) {
          return { error: 'Password errata.' };
        }
        if (signUpError) {
          return { error: signUpError.message };
        }

        authUser = signUpData?.user ?? null;
        if (!signUpData?.session) {
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email, password });
          if (retryError) {
            return { error: 'Account creato ma accesso non riuscito: ' + retryError.message };
          }
          authUser = retryData.user;
        }

        set({ cliente, userType: 'cliente', sessionUser: authUser || { email } });
        return {};
      }

      const { data: cliente } = await supabase
        .from('clienti')
        .select('*')
        .eq('email', email)
        .single();

      if (!cliente) {
        return { error: 'Cliente non trovato nel sistema' };
      }

      set({
        sessionUser: authUser || { email },
        cliente,
        userType: 'cliente',
      });
      return {};
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore di connessione';
      return { error: msg };
    }
  },

  signUp: async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  },

  logout: async () => {
    await supabase.auth.signOut();
    writeDemoSession(null);
    set({
      sessionUser: null,
      utente: null,
      cliente: null,
      officina: null,
      userType: null,
    });
  },
}));
