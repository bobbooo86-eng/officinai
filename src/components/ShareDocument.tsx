import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { useAuthStore } from '@/stores/authStore';

// wa.me richiede il numero completo con prefisso internazionale (39 per
// l'Italia), senza "+" davanti: un numero italiano digitato senza prefisso
// (es. "3402571805") apriva una chat non valida e il messaggio non partiva.
function toWhatsAppNumber(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  return digits.startsWith('39') ? digits : `39${digits}`;
}

interface ShareDocumentProps {
  /** Tipo documento per il template email */
  tipo: 'preventivo' | 'fattura' | 'foglio_lavoro' | 'conto';
  /** Titolo mostrato nel dialog */
  titolo: string;
  /** Dati per l'email */
  emailData: Record<string, any>;
  /** Testo per WhatsApp */
  whatsappText: string;
  /** Email destinatario (pre-compilata) */
  clienteEmail?: string;
  /** Tel destinatario */
  clienteTel?: string;
  /** Nome cliente */
  clienteNome?: string;
  /** ID officina */
  officinaId?: string;
  /** ID cliente */
  clienteId?: string;
  /** URL al PDF/pagina del documento (viene aggiunto al messaggio) */
  pdfUrl?: string | null;
  /**
   * Contenuto del documento, usato quando non esiste un URL condivisibile
   * (bucket Storage non configurato): permette di allegare o scaricare il
   * file invece di inviare un messaggio senza documento.
   */
  getDocumentHtml?: () => string | Promise<string>;
  /** Nome del file proposto per l'allegato/download. */
  fileName?: string;
  /**
   * Genera il PDF vero (binario) del documento: se presente, e' questo che
   * viene allegato davvero a WhatsApp/email tramite la condivisione nativa
   * del telefono, invece di mandare solo un link a una pagina web.
   */
  getPdfBlob?: () => Blob | Promise<Blob>;
  /** Oggetto email (se non specificato, usa "Il tuo {titolo}") */
  emailSubject?: string;
  /** Callback dopo invio */
  onSent?: () => void;
}

export function ShareDocument({
  tipo, titolo, emailData, whatsappText,
  clienteEmail, clienteTel, clienteNome,
  officinaId, clienteId, pdfUrl, emailSubject, onSent,
  getDocumentHtml, fileName, getPdfBlob,
}: ShareDocumentProps) {
  const { officina } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<'email' | 'whatsapp' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [emailTo, setEmailTo] = useState(clienteEmail || '');
  const [condividendo, setCondividendo] = useState(false);
  const [telTo, setTelTo] = useState(clienteTel || '');

  /**
   * Genera il PDF e lo passa alla condivisione nativa del telefono: l'utente
   * scegie l'app (WhatsApp, Gmail, Mail...) e il file vero arriva allegato,
   * non solo un link. Su desktop (dove il telefono non offre questa
   * condivisione) il PDF viene scaricato, cosi' si puo' allegare a mano.
   */
  const inviaPdfDiretto = async () => {
    if (!getPdfBlob) return;
    setCondividendo(true);
    setResult(null);
    try {
      const blob = await getPdfBlob();
      const nome = fileName || `${titolo}.pdf`;
      const file = new File([blob], nome, { type: 'application/pdf' });

      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: titolo, text: whatsappText });
        setResult({ ok: true, msg: 'PDF condiviso' });
        onSent?.();
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = nome;
        a.click();
        URL.revokeObjectURL(url);
        setResult({ ok: true, msg: 'PDF scaricato: allegalo tu al messaggio, oppure usa Email/WhatsApp qui sotto (senza allegato).' });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setResult({ ok: false, msg: 'Generazione PDF non riuscita' });
      }
    } finally {
      setCondividendo(false);
    }
  };

  // Aggiungi il link PDF (se presente) ai messaggi
  const finalWhatsappText = pdfUrl
    ? `${whatsappText}\n\n📄 Documento in PDF:\n${pdfUrl}`
    : whatsappText;

  const emailBody = pdfUrl
    ? `${whatsappText}\n\nDocumento completo (apri il link per scaricare/stampare in PDF):\n${pdfUrl}`
    : whatsappText;

  /**
   * Senza URL pubblico il documento viene condiviso come file: sui telefoni
   * si allega direttamente a WhatsApp o alla mail, altrove viene scaricato
   * per essere allegato a mano.
   */
  const condividiFile = async () => {
    if (!getDocumentHtml) return;
    setCondividendo(true);
    try {
      const html = await getDocumentHtml();
      const nome = fileName || `${titolo}.html`;
      const file = new File([html], nome, { type: 'text/html' });

      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: titolo, text: whatsappText });
        setResult({ ok: true, msg: 'Documento condiviso' });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = nome;
        a.click();
        URL.revokeObjectURL(url);
        setResult({ ok: true, msg: 'Documento scaricato: allegalo al messaggio' });
      }
    } catch (e) {
      // L'utente puo' annullare la condivisione: non e' un errore da segnalare.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setResult({ ok: false, msg: 'Condivisione non riuscita' });
      }
    } finally {
      setCondividendo(false);
    }
  };

  const openMailtoFallback = () => {
    const subject = emailSubject || `Il tuo ${titolo}${officina?.nome ? ' — ' + officina.nome : ''}`;
    const body = emailBody;
    const url = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const inviaEmail = async () => {
    if (!emailTo) return;
    setSending('email');
    setResult(null);

    const templateMap: Record<string, string> = {
      preventivo: 'preventivo_inviato',
      fattura: 'fattura_emessa',
      foglio_lavoro: 'stato_aggiornato',
      conto: 'stato_aggiornato',
    };

    // Include il link PDF nei dati (i template lo usano se disponibile)
    const linkKey = tipo === 'preventivo' ? 'linkPreventivo'
      : tipo === 'fattura' ? 'linkFattura'
      : 'linkDocumento';

    const ok = await sendEmail(
      emailTo,
      templateMap[tipo] as any,
      {
        ...emailData,
        officinaNome: officina?.nome || 'OfficinAI',
        ...(pdfUrl ? { [linkKey]: pdfUrl, pdfUrl } : {}),
      }
    );

    setSending(null);
    if (ok) {
      setResult({ ok: true, msg: 'Email inviata con successo!' });
      if (onSent) onSent();
    } else {
      // Fallback: apre il client mail del sistema con body pre-compilato
      openMailtoFallback();
      setResult({
        ok: true,
        msg: 'Servizio email server non disponibile. Ho aperto il tuo client mail con il testo pronto: premi Invia.',
      });
    }
  };

  const inviaWhatsApp = async () => {
    if (!telTo) return;
    setSending('whatsapp');
    setResult(null);

    // Try Edge Function first
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: telTo,
          message: finalWhatsappText,
          officina_id: officinaId || officina?.id,
          cliente_id: clienteId,
          tipo,
        },
      });

      if (data?.fallback) {
        // Twilio not configured, open WhatsApp Web
        window.open(`https://wa.me/${toWhatsAppNumber(telTo)}?text=${encodeURIComponent(finalWhatsappText)}`, '_blank');
        setResult({ ok: true, msg: 'Aperto WhatsApp Web' });
      } else if (data?.success) {
        setResult({ ok: true, msg: 'WhatsApp inviato!' });
      } else {
        throw new Error(data?.error || error?.message || 'Errore');
      }
    } catch {
      // Fallback: open WhatsApp Web directly
      window.open(`https://wa.me/${toWhatsAppNumber(telTo)}?text=${encodeURIComponent(finalWhatsappText)}`, '_blank');
      setResult({ ok: true, msg: 'Aperto WhatsApp Web' });
    }

    setSending(null);
    if (onSent) onSent();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium cursor-pointer transition-colors"
      >
        <span>📤</span> Invia {titolo}
      </button>
    );
  }

  return (
    <Card className="!p-4 border-blue-200 bg-blue-50/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Invia {titolo}</h4>
        <button
          onClick={() => { setOpen(false); setResult(null); }}
          className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg"
        >×</button>
      </div>

      {clienteNome && (
        <div className="text-xs text-gray-500 mb-3">Destinatario: <strong>{clienteNome}</strong></div>
      )}

      {/* Result message */}
      {result && (
        <div className={`p-2 rounded-lg text-xs font-medium mb-3 ${
          result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {result.ok ? '✅' : '❌'} {result.msg}
        </div>
      )}

      {/* Invio diretto del PDF vero, allegato tramite la condivisione nativa
          del telefono (WhatsApp, Gmail, Mail...): l'opzione principale. */}
      {getPdfBlob && (
        <div className="mb-3">
          <Button fullWidth onClick={inviaPdfDiretto} loading={condividendo} className="!bg-emerald-600 hover:!bg-emerald-700">
            📎 Invia PDF (WhatsApp, Email...)
          </Button>
          <div className="text-[11px] text-gray-500 mt-1">
            Apre la condivisione del telefono con il PDF vero allegato. Su desktop lo scarica: allegalo tu al messaggio.
          </div>
        </div>
      )}

      {/* Allegato HTML: solo se non c'e' ancora un generatore di PDF vero. */}
      {!getPdfBlob && !pdfUrl && getDocumentHtml && (
        <div className="mb-3">
          <Button variant="secondary" fullWidth onClick={condividiFile} loading={condividendo}>
            📎 Allega documento
          </Button>
          <div className="text-[11px] text-gray-500 mt-1">
            Il messaggio non contiene un link: allega il documento da qui.
          </div>
        </div>
      )}

      {/* Email */}
      <div className="space-y-2 mb-3">
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Email destinatario"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            size="sm"
            onClick={inviaEmail}
            disabled={!emailTo || sending === 'email'}
          >
            {sending === 'email' ? '...' : '📧 Email'}
          </Button>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="flex gap-2">
        <input
          type="tel"
          placeholder="Numero WhatsApp"
          value={telTo}
          onChange={(e) => setTelTo(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <Button
          size="sm"
          variant="success"
          onClick={inviaWhatsApp}
          disabled={!telTo || sending === 'whatsapp'}
        >
          {sending === 'whatsapp' ? '...' : '💬 WhatsApp'}
        </Button>
      </div>
    </Card>
  );
}
