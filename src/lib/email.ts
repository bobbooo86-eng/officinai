import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────

export type EmailTemplate =
  | 'benvenuto'
  | 'appuntamento_confermato'
  | 'controproposta_data'
  | 'preventivo_inviato'
  | 'stato_aggiornato'
  | 'fattura_emessa'
  | 'promemoria'
  | 'reset_password';

interface SendEmailResponse {
  success: boolean;
  error?: string;
}

// ── Core send function ────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const { data: responseData, error } = await supabase.functions.invoke('send-email', {
      body: { to, template, data },
    });

    if (error) {
      console.error('Errore invocazione funzione email:', error);
      return false;
    }

    const response = responseData as SendEmailResponse;

    if (!response.success) {
      console.error('Errore invio email:', response.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Errore imprevisto invio email:', err);
    return false;
  }
}

// ── Convenience functions ─────────────────────────────────────────────

export async function sendWelcomeEmail(
  email: string,
  nome: string,
  officinaNome: string
): Promise<boolean> {
  return sendEmail(email, 'benvenuto', { nome, officinaNome });
}

export async function sendAppointmentConfirmation(
  email: string,
  data: {
    clienteNome: string;
    data: string;
    ora: string;
    officinaNome: string;
    veicolo?: string;
  }
): Promise<boolean> {
  return sendEmail(email, 'appuntamento_confermato', data);
}

export async function sendProposalChange(
  email: string,
  data: {
    clienteNome: string;
    data: string;
    ora: string;
    officinaNome: string;
    veicolo?: string;
    nota?: string;
  }
): Promise<boolean> {
  // Fallback to appuntamento_confermato wording if backend template isn't deployed yet
  const ok = await sendEmail(email, 'controproposta_data', data);
  if (ok) return true;
  return sendEmail(email, 'appuntamento_confermato', data);
}

export async function sendEstimateEmail(
  email: string,
  data: {
    clienteNome: string;
    totale: number;
    officinaNome: string;
    linkPreventivo?: string;
    veicolo?: string;
  }
): Promise<boolean> {
  return sendEmail(email, 'preventivo_inviato', data);
}

export async function sendStatusUpdate(
  email: string,
  data: {
    clienteNome: string;
    veicolo: string;
    nuovoStato: string;
    officinaNome: string;
  }
): Promise<boolean> {
  return sendEmail(email, 'stato_aggiornato', data);
}

export async function sendInvoiceEmail(
  email: string,
  data: {
    clienteNome: string;
    numero: string;
    totale: number;
    officinaNome: string;
    linkFattura?: string;
  }
): Promise<boolean> {
  return sendEmail(email, 'fattura_emessa', data);
}

export async function sendReminderEmail(
  email: string,
  data: {
    clienteNome: string;
    data: string;
    ora: string;
    officinaNome: string;
    veicolo?: string;
  }
): Promise<boolean> {
  return sendEmail(email, 'promemoria', data);
}

export async function sendPasswordResetEmail(
  email: string,
  data: {
    nome: string;
    resetLink: string;
  }
): Promise<boolean> {
  return sendEmail(email, 'reset_password', data);
}
