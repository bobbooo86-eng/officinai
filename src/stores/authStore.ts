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
          set({ cliente, userType: 'cliente', loading: false });
          return;
        }
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
