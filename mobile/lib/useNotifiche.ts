import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export interface Notifica {
  id: string;
  officina_id: string;
  utente_id: string | null;
  cliente_id: string | null;
  tipo: string;
  titolo: string;
  messaggio: string;
  letto: boolean;
  link_tipo: string | null;
  link_id: string | null;
  created_at: string;
}

interface UseNotificheResult {
  notifiche: Notifica[];
  nonLette: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook globale per le notifiche staff sull'app mobile.
 * - carica le ultime 30 al mount
 * - sottoscrive realtime inserts filtrando per utente_id
 * - mostra un Alert nativo quando arriva una nuova notifica
 */
export function useNotifiche(): UseNotificheResult {
  const utente = useAuthStore((s) => s.utente);
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);

  const utenteId = utente?.id;

  const refresh = useCallback(async () => {
    if (!utenteId) return;
    const { data } = await supabase
      .from('notifiche')
      .select('*')
      .eq('utente_id', utenteId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifiche(data as Notifica[]);
  }, [utenteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!utenteId) return;

    const channel = supabase
      .channel(`notifiche-mobile-${utenteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifiche',
          filter: `utente_id=eq.${utenteId}`,
        },
        (payload) => {
          const nuova = payload.new as Notifica;
          setNotifiche((prev) => [nuova, ...prev]);
          Alert.alert(nuova.titolo || 'Nuova notifica', nuova.messaggio || '');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [utenteId]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifiche').update({ letto: true }).eq('id', id);
    setNotifiche((prev) => prev.map((n) => (n.id === id ? { ...n, letto: true } : n)));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!utenteId) return;
    await supabase
      .from('notifiche')
      .update({ letto: true })
      .eq('utente_id', utenteId)
      .eq('letto', false);
    setNotifiche((prev) => prev.map((n) => ({ ...n, letto: true })));
  }, [utenteId]);

  const nonLette = notifiche.filter((n) => !n.letto).length;

  return { notifiche, nonLette, markRead, markAllRead, refresh };
}
