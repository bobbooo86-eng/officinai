import { useState } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento } from '@/types/database';

interface WhatsAppPanelProps {
  appuntamento: Appuntamento;
}

const TEMPLATES = [
  {
    id: 'stato_aggiornamento',
    label: 'Aggiornamento stato',
    icon: '🔄',
    getMessage: (app: Appuntamento) =>
      `Buongiorno ${app.clienti?.nome}, la informiamo che il suo veicolo ${app.veicoli?.marca} ${app.veicoli?.modello} (${app.veicoli?.targa}) è ora in stato: ${app.stato.replace(/_/g, ' ').toUpperCase()}. — OfficinAI`,
  },
  {
    id: 'preventivo_pronto',
    label: 'Preventivo pronto',
    icon: '💰',
    getMessage: (app: Appuntamento) =>
      `Buongiorno ${app.clienti?.nome}, il preventivo per il suo ${app.veicoli?.marca} ${app.veicoli?.modello} è pronto. Può visualizzarlo e approvarlo direttamente dalla app OfficinAI. — OfficinAI`,
  },
  {
    id: 'veicolo_pronto',
    label: 'Veicolo pronto',
    icon: '✅',
    getMessage: (app: Appuntamento) =>
      `Buongiorno ${app.clienti?.nome}, il suo ${app.veicoli?.marca} ${app.veicoli?.modello} (${app.veicoli?.targa}) è PRONTO per il ritiro! Può passare quando preferisce. Grazie! — OfficinAI`,
  },
  {
    id: 'promemoria',
    label: 'Promemoria appuntamento',
    icon: '📅',
    getMessage: (app: Appuntamento) =>
      `Buongiorno ${app.clienti?.nome}, le ricordiamo l'appuntamento per il suo ${app.veicoli?.marca} ${app.veicoli?.modello}. La aspettiamo! — OfficinAI`,
  },
  {
    id: 'custom',
    label: 'Messaggio personalizzato',
    icon: '✏️',
    getMessage: () => '',
  },
];

export function WhatsAppPanel({ appuntamento }: WhatsAppPanelProps) {
  const { officina } = useAuthStore();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const clienteTel = appuntamento.clienti?.tel;

  const getPreviewMessage = () => {
    if (!selectedTemplate) return '';
    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template) return '';
    if (selectedTemplate === 'custom') return customMsg;
    return template.getMessage(appuntamento);
  };

  const inviaNotifica = async () => {
    if (!selectedTemplate || !clienteTel) return;

    setSending(true);
    const testo = getPreviewMessage();

    // Try Edge Function (Twilio) first, fallback to WhatsApp Web
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: clienteTel,
          message: testo,
          officina_id: officina?.id,
          cliente_id: appuntamento.cliente_id,
          tipo: selectedTemplate,
        },
      });

      if (data?.fallback || error) {
        // Twilio not configured or error — open WhatsApp Web
        const waUrl = `https://wa.me/${clienteTel.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(testo)}`;
        window.open(waUrl, '_blank');
      }
    } catch {
      // Fallback: WhatsApp Web
      const waUrl = `https://wa.me/${clienteTel.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(testo)}`;
      window.open(waUrl, '_blank');
    }

    setSending(false);
    setSent(true);
    setSelectedTemplate(null);

    setTimeout(() => setSent(false), 3000);
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from('notifiche_wa')
      .select('*')
      .eq('cliente_id', appuntamento.cliente_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setHistory(data || []);
    setShowHistory(true);
  };

  if (!clienteTel) {
    return (
      <Card className="!p-4">
        <div className="text-center py-4">
          <div className="text-3xl mb-2">📵</div>
          <p className="text-sm text-gray-500">Nessun numero di telefono per questo cliente</p>
          <p className="text-xs text-gray-400 mt-1">Aggiungi il numero nella scheda cliente</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Success message */}
      {sent && (
        <Card className="!p-3 bg-emerald-50 !border-emerald-200">
          <div className="text-sm font-semibold text-emerald-800">
            ✅ Messaggio inviato con successo!
          </div>
        </Card>
      )}

      {/* Destination */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Destinatario</div>
            <div className="font-semibold text-sm text-gray-900">{appuntamento.clienti?.nome}</div>
            <div className="text-xs text-gray-500">{clienteTel}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-xl">📱</span>
          </div>
        </div>
      </Card>

      {/* Templates */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Scegli il messaggio:</p>
        <div className="space-y-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                selectedTemplate === t.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{t.icon}</span>
                <span className="text-sm font-medium text-gray-700">{t.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom message input */}
      {selectedTemplate === 'custom' && (
        <textarea
          value={customMsg}
          onChange={(e) => setCustomMsg(e.target.value)}
          placeholder="Scrivi il tuo messaggio..."
          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={3}
        />
      )}

      {/* Preview */}
      {selectedTemplate && getPreviewMessage() && (
        <Card className="!p-3 bg-green-50 !border-green-200">
          <div className="text-[10px] text-green-600 font-semibold mb-1">ANTEPRIMA</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{getPreviewMessage()}</div>
        </Card>
      )}

      {/* Send button */}
      {selectedTemplate && (
        <Button
          variant="success"
          fullWidth
          size="lg"
          loading={sending}
          onClick={inviaNotifica}
          disabled={selectedTemplate === 'custom' && !customMsg.trim()}
        >
          📤 Invia su WhatsApp
        </Button>
      )}

      {/* History */}
      <button
        onClick={loadHistory}
        className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-2 cursor-pointer"
      >
        Vedi storico notifiche
      </button>

      {showHistory && history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium">Storico notifiche</p>
          {history.map((n) => (
            <Card key={n.id} className="!p-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-600 truncate">{n.testo}</div>
                </div>
                <Badge color="#065f46" bg="#d1fae5">{n.stato}</Badge>
              </div>
              <div className="text-[10px] text-gray-300 mt-0.5">
                {new Date(n.created_at).toLocaleString('it-IT')}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
