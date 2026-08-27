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

        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError && !signUpError.message.includes('already registered')) {
          const { data: officina } = await supabase
            .from('officine')
            .select('*')
            .eq('id', utente.officina_id)
            .single();

          writeDemoSession({ email, userType: 'officina' });
          set({ utente, officina, userType: 'officina', sessionUser: { email } });
          return {};
        }

        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
        if (retryError) {
          const { data: officina } = await supabase
            .from('officine')
            .select('*')
            .eq('id', utente.officina_id)
            .single();

          writeDemoSession({ email, userType: 'officina' });
          set({ utente, officina, userType: 'officina', sessionUser: { email } });
          return {};
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
        sessionUser: authData?.user || { email },
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

      if (authError) {
        const { data: cliente } = await supabase
          .from('clienti')
          .select('*')
          .eq('email', email)
          .single();

        if (!cliente) {
          return { error: 'Email o password non validi' };
        }

        writeDemoSession({ email, userType: 'cliente' });
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

      set({
        sessionUser: authData?.user || { email },
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
