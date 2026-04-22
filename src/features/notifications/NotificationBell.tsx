import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type NotificaTipo = 'appuntamento' | 'preventivo' | 'chat' | 'sistema';

interface Notifica {
  id: string;
  officina_id: string;
  utente_id: string;
  tipo: NotificaTipo;
  titolo: string;
  messaggio: string;
  letto: boolean;
  link_tipo: string | null;
  link_id: string | null;
  created_at: string;
}

const TIPO_ICON: Record<NotificaTipo, string> = {
  appuntamento: '📅',
  preventivo: '📋',
  chat: '💬',
  sistema: '⚙️',
};

function tempoRelativo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'adesso';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffOre = Math.floor(diffMin / 60);
  if (diffOre < 24) return `${diffOre} ${diffOre === 1 ? 'ora' : 'ore'} fa`;
  const diffGiorni = Math.floor(diffOre / 24);
  if (diffGiorni < 7) return `${diffGiorni} ${diffGiorni === 1 ? 'giorno' : 'giorni'} fa`;
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

// Shared AudioContext — initialized on first user interaction
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

// Unlock AudioContext on first user click anywhere on the page
if (typeof document !== 'undefined') {
  const unlock = () => {
    getAudioCtx();
    document.removeEventListener('click', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
}

// Play a short notification beep using Web Audio API
function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    // First beep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.value = 1100;
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Audio not available
  }
}

// Browser push notification helpers
function canUseBrowserNotifications(): boolean {
  return 'Notification' in window;
}

function getBrowserPermission(): NotificationPermission | 'unsupported' {
  if (!canUseBrowserNotifications()) return 'unsupported';
  return Notification.permission;
}

async function requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!canUseBrowserNotifications()) return 'unsupported';
  return Notification.requestPermission();
}

function showBrowserNotification(titolo: string, messaggio: string, tipo: NotificaTipo) {
  if (getBrowserPermission() !== 'granted') return;
  // Only show browser notification if page is hidden (background)
  if (document.visibilityState === 'visible') return;
  try {
    new Notification(titolo, {
      body: messaggio,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: `officinai-${tipo}-${Date.now()}`,
      silent: false,
    });
  } catch {
    // Notification API not available in this context
  }
}

export function NotificationBell() {
  const { officina, utente, cliente, userType } = useAuthStore();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const ref = useRef<HTMLDivElement>(null);

  const officinaId = officina?.id;
  const utenteId = userType === 'officina' ? utente?.id : cliente?.id;
  // Column to filter by: staff usa utente_id, cliente usa cliente_id
  const filterColumn = userType === 'officina' ? 'utente_id' : 'cliente_id';

  // Check browser notification permission on mount
  useEffect(() => {
    setPushPermission(getBrowserPermission());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Fetch notifications
  const fetchNotifiche = useCallback(async () => {
    if (!officinaId || !utenteId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifiche')
        .select('*')
        .eq('officina_id', officinaId)
        .eq(filterColumn, utenteId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) setNotifiche(data as Notifica[]);
    } catch (err) {
      console.error('Errore caricamento notifiche:', err);
    } finally {
      setLoading(false);
    }
  }, [officinaId, utenteId, filterColumn]);

  useEffect(() => {
    fetchNotifiche();
  }, [fetchNotifiche]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!officinaId || !utenteId) return;

    const channel = supabase
      .channel('notifiche-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifiche',
          filter: `${filterColumn}=eq.${utenteId}`,
        },
        (payload) => {
          const nuova = payload.new as Notifica;
          setNotifiche((prev) => [nuova, ...prev]);
          playNotificationSound();
          showBrowserNotification(nuova.titolo, nuova.messaggio, nuova.tipo);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [officinaId, utenteId, filterColumn]);

  // Mark single notification as read
  const segnaLetta = async (id: string) => {
    await supabase.from('notifiche').update({ letto: true }).eq('id', id);
    setNotifiche((prev) =>
      prev.map((n) => (n.id === id ? { ...n, letto: true } : n))
    );
  };

  // Mark all as read
  const segnaTuttoLetto = async () => {
    if (!officinaId || !utenteId) return;
    await supabase
      .from('notifiche')
      .update({ letto: true })
      .eq('officina_id', officinaId)
      .eq(filterColumn, utenteId)
      .eq('letto', false);

    setNotifiche((prev) => prev.map((n) => ({ ...n, letto: true })));
  };

  const nonLette = notifiche.filter((n) => !n.letto).length;

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
        aria-label="Notifiche"
      >
        <span className="text-lg">🔔</span>
        {nonLette > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {nonLette > 99 ? '99+' : nonLette}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Notifiche</h3>
              {nonLette > 0 && (
                <button
                  onClick={segnaTuttoLetto}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Segna tutto come letto
                </button>
              )}
            </div>

            {/* Push notification permission request */}
            {pushPermission === 'default' && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <span className="text-xs text-blue-800">Vuoi ricevere notifiche anche in background?</span>
                <button
                  onClick={async () => {
                    const result = await requestBrowserPermission();
                    setPushPermission(result);
                  }}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Attiva
                </button>
              </div>
            )}

            {/* Notification list */}
            <div className="max-h-96 overflow-y-auto">
              {loading && notifiche.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifiche.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="text-2xl">🔕</span>
                  <p className="text-sm text-gray-400 mt-2">Nessuna notifica</p>
                </div>
              ) : (
                notifiche.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => segnaLetta(n.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0 ${
                      !n.letto ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm">{TIPO_ICON[n.tipo] || '🔔'}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!n.letto ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.titolo}
                        </p>
                        {!n.letto && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {n.messaggio}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {tempoRelativo(n.created_at)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
