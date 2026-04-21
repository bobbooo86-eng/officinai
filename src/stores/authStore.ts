import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Utente, Cliente, Officina } from '@/types/database';

interface AuthState {
  // State
  loading: boolean;
  sessionUser: any | null; // Supabase auth user
  utente: Utente | null;   // Workshop staff user
  cliente: Cliente | null;  // Customer user
  officina: Officina | null;
  userType: 'officina' | 'cliente' | null;

  // Actions
  initialize: () => Promise<void>;
  loginOfficina: (email: string, password: string) => Promise<{ error?: string }>;
  loginCliente: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, tipo: 'officina' | 'cliente') => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

// --- Fallback persistence ---
// Alcuni utenti (demo / migrati) non hanno un account Supabase Auth vero:
// il login li autentica a livello di tabella `utenti`/`clienti` senza session.
// Senza una copia in localStorage, un refresh della pagina li butta fuori.
//
// Cachiamo l'intero profilo (non solo gli id) perche' senza una sessione
// Supabase le policy RLS bloccano qualsiasi SELECT su utenti/clienti,
// quindi sui refresh il rehydrate non potrebbe ri-leggere il record.
const FALLBACK_KEY = 'officinai-fallback-auth';

interface FallbackAuth {
  userType: 'officina' | 'cliente';
  email: string;
  utente?: Utente | null;
  officina?: Officina | null;
  cliente?: Cliente | null;
}

function saveFallback(data: FallbackAuth) {
  try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(data)); } catch { /* quota / ssr */ }
}
function loadFallback(): FallbackAuth | null {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) as FallbackAuth : null;
  } catch { return null; }
}
function clearFallback() {
  try { localStorage.removeItem(FALLBACK_KEY); } catch { /* */ }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  loading: true,
  sessionUser: null,
  utente: null,
  cliente: null,
  officina: null,
  userType: null,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const user = session.user;
        set({ sessionUser: user });

        // Try to find as workshop staff
        const { data: utente } = await supabase
          .from('utenti')
          .select('*')
          .eq('email', user.email)
          .eq('attivo', true)
          .single();

        if (utente) {
          const { data: officina } = await supabase
            .from('officine')
            .select('*')
            .eq('id', utente.officina_id)
            .single();

          saveFallback({
            userType: 'officina', email: user.email!,
            utente, officina,
          });
          set({ utente, officina, userType: 'officina', loading: false });
          return;
        }

        // Try to find as customer
        const { data: cliente } = await supabase
          .from('clienti')
          .select('*')
          .eq('email', user.email)
          .single();

        if (cliente) {
          saveFallback({
            userType: 'cliente', email: user.email!,
            cliente,
          });
          set({ cliente, userType: 'cliente', loading: false });
          return;
        }
      }

      // Nessuna sessione Supabase: tenta ripristino da fallback localStorage.
      // Usiamo direttamente i dati cachati perche' senza session RLS bloccherebbe
      // la ri-lettura dal DB.
      const fb = loadFallback();
      if (fb) {
        if (fb.userType === 'officina' && fb.utente) {
          set({
            utente: fb.utente,
            officina: fb.officina ?? null,
            userType: 'officina',
            sessionUser: { email: fb.email },
            loading: false,
          });
          return;
        }
        if (fb.userType === 'cliente' && fb.cliente) {
          set({
            cliente: fb.cliente,
            userType: 'cliente',
            sessionUser: { email: fb.email },
            loading: false,
          });
          return;
        }
        // fallback rotto → pulisci
        clearFallback();
      }

      set({ loading: false });
    } catch (err) {
      console.error('Auth init error:', err);
      set({ loading: false });
    }
  },

  loginOfficina: async (email: string, password: string) => {
    try {
      // First try Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Fallback: check if user exists in utenti table (for demo/migration)
        const { data: utente } = await supabase
          .from('utenti')
          .select('*')
          .eq('email', email)
          .eq('attivo', true)
          .single();

        if (!utente) {
          return { error: 'Email o password non validi' };
        }

        // Auto-create auth account for existing demo users
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError && !signUpError.message.includes('already registered')) {
          // If can't create, try simple login for demo
          const { data: officina } = await supabase
            .from('officine')
            .select('*')
            .eq('id', utente.officina_id)
            .single();

          saveFallback({
            userType: 'officina', email,
            utente, officina,
          });
          set({ utente, officina, userType: 'officina', sessionUser: { email } });
          return {};
        }

        // Retry login after signup
        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
        if (retryError) {
          // Fallback to direct DB access for demo
          const { data: officina } = await supabase
            .from('officine')
            .select('*')
            .eq('id', utente.officina_id)
            .single();

          saveFallback({
            userType: 'officina', email,
            utente, officina,
          });
          set({ utente, officina, userType: 'officina', sessionUser: { email } });
          return {};
        }
      }

      // Fetch staff profile
      const { data: utente } = await supabase
        .from('utenti')
        .select('*')
        .eq('email', email)
        .eq('attivo', true)
        .single();

      if (!utente) {
        return { error: 'Utente non trovato nel sistema' };
      }

      const { data: officina } = await supabase
        .from('officine')
        .select('*')
        .eq('id', utente.officina_id)
        .single();

      saveFallback({
        userType: 'officina', email,
        utente, officina,
      });
      set({
        sessionUser: authData?.user || { email },
        utente,
        officina,
        userType: 'officina',
      });
      return {};
    } catch (err: any) {
      return { error: err.message || 'Errore di connessione' };
    }
  },

  loginCliente: async (email: string, password: string) => {
    try {
      // Try Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Fallback for demo customers
        const { data: cliente } = await supabase
          .from('clienti')
          .select('*')
          .eq('email', email)
          .single();

        if (!cliente) {
          return { error: 'Email o password non validi' };
        }

        saveFallback({
          userType: 'cliente', email,
          cliente,
        });
        set({ cliente, userType: 'cliente', sessionUser: { email } });
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

      saveFallback({
        userType: 'cliente', email,
        cliente,
      });
      set({
        sessionUser: authData?.user || { email },
        cliente,
        userType: 'cliente',
      });
      return {};
    } catch (err: any) {
      return { error: err.message || 'Errore di connessione' };
    }
  },

  signUp: async (email: string, password: string, _tipo: 'officina' | 'cliente') => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  },

  logout: async () => {
    clearFallback();
    await supabase.auth.signOut();
    set({
      sessionUser: null,
      utente: null,
      cliente: null,
      officina: null,
      userType: null,
    });
  },
}));

// Mantieni lo store in sync con i cambi di sessione Supabase
// (token refresh, signOut da altra tab, espirazione, ecc.)
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    const store = useAuthStore.getState();
    if (event === 'SIGNED_OUT') {
      clearFallback();
      useAuthStore.setState({
        sessionUser: null,
        utente: null,
        cliente: null,
        officina: null,
        userType: null,
      });
    } else if (event === 'TOKEN_REFRESHED' && session?.user) {
      useAuthStore.setState({ sessionUser: session.user });
    } else if (event === 'SIGNED_IN' && session?.user && !store.userType) {
      // Login avvenuto fuori dal flusso standard → reinizializza
      store.initialize();
    }
  });
}
