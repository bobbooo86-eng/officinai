import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Messaggio } from '@/types/database';

interface ChatPanelProps {
  appuntamentoId: string;
  /** Who is sending: 'officina' or the client's name */
  senderName: string;
  senderType: 'officina' | 'cliente';
}

export function ChatPanel({ appuntamentoId, senderName, senderType }: ChatPanelProps) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [testo, setTesto] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch messages + real-time subscription
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messaggi')
        .select('*')
        .eq('appuntamento_id', appuntamentoId)
        .order('created_at', { ascending: true });
      setMessaggi(data || []);
    };

    fetchMessages();

    // Real-time: listen for new messages
    const channel = supabase
      .channel(`chat-${appuntamentoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messaggi',
          filter: `appuntamento_id=eq.${appuntamentoId}`,
        },
        (payload) => {
          setMessaggi((prev) => [...prev, payload.new as Messaggio]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appuntamentoId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messaggi]);

  const inviaMessaggio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testo.trim() || sending) return;

    setSending(true);
    const msg = testo.trim();
    setTesto('');

    await supabase.from('messaggi').insert({
      appuntamento_id: appuntamentoId,
      da: senderName,
      mittente_tipo: senderType,
      mittente_nome: senderName,
      testo: msg,
      letto: false,
    });

    setSending(false);
    inputRef.current?.focus();
  };

  const isMyMessage = (msg: Messaggio) => {
    if (senderType === 'officina') {
      // Messages from workshop staff (not from clients)
      return msg.da !== 'cliente' && !msg.da.includes('@');
    }
    return msg.da === senderName || msg.da === 'cliente';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-semibold text-gray-900">
            Chat — {senderType === 'officina' ? 'con il cliente' : 'con l\'officina'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
        style={{ minHeight: '200px', maxHeight: '400px' }}
      >
        {messaggi.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm text-gray-400">Nessun messaggio ancora</p>
            <p className="text-xs text-gray-300 mt-1">Scrivi per iniziare la conversazione</p>
          </div>
        ) : (
          messaggi.map((msg) => {
            const mine = isMyMessage(msg);
            return (
              <div
                key={msg.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    mine
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                  }`}
                >
                  {!mine && (
                    <div className={`text-[10px] font-semibold mb-0.5 ${mine ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.da}
                    </div>
                  )}
                  <div className="text-sm">{msg.testo}</div>
                  <div className={`text-[10px] mt-0.5 text-right ${mine ? 'text-blue-200' : 'text-gray-300'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={inviaMessaggio} className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!testo.trim() || sending}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
