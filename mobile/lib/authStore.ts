import { create } from 'zustand';
import { supabase } from './supabase';
import type { Officina, Utente } from './types';

interface AuthState {
  utente: Utente | null;
  officina: Officina | null;
  loading: boolean;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  utente: null,
  officina: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ utente: null, officina: null, loading: false });
        return;
      }

      const { data: utente } = await supabase
        .from('utenti')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!utente) {
        set({ utente: null, officina: null, loading: false });
        return;
      }

      const { data: officina } = await supabase
        .from('officine')
        .select('*')
        .eq('id', utente.officina_id)
        .single();

      set({
        utente: utente as Utente,
        officina: officina as Officina | null,
        loading: false,
      });
    } catch {
      set({ utente: null, officina: null, loading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ utente: null, officina: null });
  },
}));
