// supabase/functions/send-email/index.ts
// Deno Edge Function for sending templated emails via Resend API
// Deploy: supabase functions deploy send-email --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'OfficinAI <noreply@officinai.it>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Branding constants ────────────────────────────────────────────────
const BRAND_COLOR = '#1e40af';
const BRAND_LIGHT = '#dbeafe';
const BRAND_NAME = 'OfficinAI';

// ── Email layout wrapper ──────────────────────────────────────────────
function wrapHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:28px 32px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background-color:rgba(255,255,255,0.2);border-radius:12px;padding:8px 16px;margin-bottom:8px;">
                      <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${BRAND_NAME}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:4px;">
                    <span style="font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:0.5px;">Gestione Officina Intelligente</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND_LIGHT};padding:20px 32px;border-top:1px solid #bfdbfe;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 4px;font-size:12px;color:#1e3a5f;">
                      Inviato da <strong>${BRAND_NAME}</strong>
                    </p>
                    <p style="margin:0;font-size:11px;color:#64748b;">
                      Questa email è stata generata automaticamente. Per favore non rispondere direttamente.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Helper: info box ──────────────────────────────────────────────────
function infoBox(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 12px;font-size:13px;color:#64748b;white-space:nowrap;border-bottom:1px solid #f1f5f9;">${r.label}</td>
          <td style="padding:8px 12px;font-size:14px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">${r.value}</td>
        </tr>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:16px 0;">
    ${rowsHtml}
  </table>`;
}

// ── Helper: CTA button ────────────────────────────────────────────────
function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:${BRAND_COLOR};border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

// ── Template definitions ──────────────────────────────────────────────

type TemplateName =
  | 'benvenuto'
  | 'appuntamento_confermato'
  | 'controproposta_data'
  | 'preventivo_inviato'
  | 'stato_aggiornato'
  | 'fattura_emessa'
  | 'promemoria'
  | 'reset_password';

interface TemplateResult {
  subject: string;
  html: string;
}

function buildTemplate(template: TemplateName, data: Record<string, any>): TemplateResult {
  switch (template) {
    // ── Benvenuto ───────────────────────────────────────────────
    case 'benvenuto': {
      const nome = data.nome || 'Cliente';
      const officinaNome = data.officinaNome || BRAND_NAME;
      const subject = `Benvenuto su ${BRAND_NAME}!`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Benvenuto, ${nome}!</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Il tuo account su <strong>${officinaNome}</strong> è stato creato con successo.
          Ora puoi accedere alla piattaforma per gestire appuntamenti, preventivi e molto altro.
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
          Ecco cosa puoi fare:
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.8;">
          <li>Prenotare appuntamenti online</li>
          <li>Seguire lo stato delle lavorazioni in tempo reale</li>
          <li>Consultare preventivi e fatture</li>
          <li>Comunicare direttamente con l'officina</li>
        </ul>
        <p style="margin:0;font-size:14px;color:#6b7280;">
          A presto!<br/><strong>Il team di ${officinaNome}</strong>
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Appuntamento confermato ─────────────────────────────────
    case 'appuntamento_confermato': {
      const clienteNome = data.clienteNome || 'Cliente';
      const dataApp = data.data || '';
      const ora = data.ora || '';
      const officinaNome = data.officinaNome || BRAND_NAME;
      const subject = `Appuntamento confermato - ${officinaNome}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Appuntamento confermato</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Gentile <strong>${clienteNome}</strong>, il tuo appuntamento è stato confermato con i seguenti dettagli:
        </p>
        ${infoBox([
          { label: 'Data', value: dataApp },
          { label: 'Ora', value: ora },
          { label: 'Officina', value: officinaNome },
          ...(data.veicolo ? [{ label: 'Veicolo', value: data.veicolo }] : []),
        ])}
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Ti ricordiamo di presentarti con qualche minuto di anticipo.
          Per modifiche o cancellazioni, contattaci direttamente.
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Controproposta nuova data ───────────────────────────────
    case 'controproposta_data': {
      const clienteNome = data.clienteNome || 'Cliente';
      const dataApp = data.data || '';
      const ora = data.ora || '';
      const officinaNome = data.officinaNome || BRAND_NAME;
      const nota = (data.nota || '').toString();
      const subject = `Nuova data proposta per il tuo appuntamento - ${officinaNome}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Nuova data proposta</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Gentile <strong>${clienteNome}</strong>, l'officina <strong>${officinaNome}</strong> ti propone una data diversa per l'appuntamento che hai richiesto.
        </p>
        ${infoBox([
          { label: 'Nuova data', value: dataApp },
          { label: 'Nuova ora', value: ora },
          { label: 'Officina', value: officinaNome },
          ...(data.veicolo ? [{ label: 'Veicolo', value: data.veicolo }] : []),
        ])}
        ${nota ? `<div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;font-size:14px;color:#92400e;"><strong>Nota dall'officina:</strong> ${nota}</p>
        </div>` : ''}
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Accedi all'app per accettare la nuova data o contattare l'officina.
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Preventivo inviato ──────────────────────────────────────
    case 'preventivo_inviato': {
      const clienteNome = data.clienteNome || 'Cliente';
      const totale = typeof data.totale === 'number' ? data.totale.toFixed(2) : '0.00';
      const officinaNome = data.officinaNome || BRAND_NAME;
      const subject = `Nuovo preventivo da ${officinaNome}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Nuovo preventivo disponibile</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Gentile <strong>${clienteNome}</strong>, abbiamo preparato un preventivo per te.
        </p>
        ${infoBox([
          { label: 'Officina', value: officinaNome },
          { label: 'Totale stimato', value: `€ ${totale}` },
          ...(data.veicolo ? [{ label: 'Veicolo', value: data.veicolo }] : []),
        ])}
        ${data.linkPreventivo ? ctaButton('Visualizza preventivo', data.linkPreventivo) : ''}
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Il preventivo è valido per 30 giorni. Per qualsiasi domanda, non esitare a contattarci.
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Stato aggiornato ────────────────────────────────────────
    case 'stato_aggiornato': {
      const clienteNome = data.clienteNome || 'Cliente';
      const veicolo = data.veicolo || 'il tuo veicolo';
      const nuovoStato = data.nuovoStato || '';
      const officinaNome = data.officinaNome || BRAND_NAME;

      const statoLabels: Record<string, string> = {
        prenotato: 'Prenotato',
        in_diagnosi: 'In diagnosi',
        in_lavorazione: 'In lavorazione',
        attesa_ricambi: 'In attesa ricambi',
        pronto: 'Pronto per il ritiro',
      };
      const statoDisplay = statoLabels[nuovoStato] || nuovoStato;

      const subject = `Aggiornamento stato lavorazione - ${officinaNome}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Aggiornamento lavorazione</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Gentile <strong>${clienteNome}</strong>, ti informiamo che lo stato della lavorazione per <strong>${veicolo}</strong> è stato aggiornato.
        </p>
        ${infoBox([
          { label: 'Veicolo', value: veicolo },
          { label: 'Nuovo stato', value: statoDisplay },
          { label: 'Officina', value: officinaNome },
        ])}
        ${
          nuovoStato === 'pronto'
            ? `<div style="background-color:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;font-size:15px;color:#166534;font-weight:600;">
                  Il tuo veicolo è pronto per il ritiro! Puoi passare in officina quando preferisci.
                </p>
              </div>`
            : ''
        }
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Per qualsiasi informazione, contatta l'officina direttamente.
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Fattura emessa ──────────────────────────────────────────
    case 'fattura_emessa': {
      const clienteNome = data.clienteNome || 'Cliente';
      const numero = data.numero || '';
      const totale = typeof data.totale === 'number' ? data.totale.toFixed(2) : '0.00';
      const officinaNome = data.officinaNome || BRAND_NAME;
      const subject = `Fattura n. ${numero} - ${officinaNome}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Fattura emessa</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Gentile <strong>${clienteNome}</strong>, è stata emessa una nuova fattura a tuo nome.
        </p>
        ${infoBox([
          { label: 'Numero fattura', value: numero },
          { label: 'Totale', value: `€ ${totale}` },
          { label: 'Officina', value: officinaNome },
        ])}
        ${data.linkFattura ? ctaButton('Scarica fattura', data.linkFattura) : ''}
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Per domande relative alla fatturazione, contatta l'officina.
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Promemoria ──────────────────────────────────────────────
    case 'promemoria': {
      const clienteNome = data.clienteNome || 'Cliente';
      const dataApp = data.data || '';
      const ora = data.ora || '';
      const officinaNome = data.officinaNome || BRAND_NAME;
      const subject = `Promemoria appuntamento - ${officinaNome}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Promemoria appuntamento</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Gentile <strong>${clienteNome}</strong>, ti ricordiamo che hai un appuntamento domani.
        </p>
        ${infoBox([
          { label: 'Data', value: dataApp },
          { label: 'Ora', value: ora },
          { label: 'Officina', value: officinaNome },
          ...(data.veicolo ? [{ label: 'Veicolo', value: data.veicolo }] : []),
        ])}
        <div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;font-size:14px;color:#92400e;">
            <strong>Ricorda:</strong> Presentati con qualche minuto di anticipo. Se hai bisogno di annullare o spostare l'appuntamento, contattaci il prima possibile.
          </p>
        </div>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    // ── Reset password ──────────────────────────────────────────
    case 'reset_password': {
      const nome = data.nome || 'Utente';
      const resetLink = data.resetLink || '#';
      const subject = `Reimposta la tua password - ${BRAND_NAME}`;
      const body = `
        <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND_COLOR};">Reimposta password</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Ciao <strong>${nome}</strong>, abbiamo ricevuto una richiesta per reimpostare la tua password.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          Clicca il pulsante qui sotto per procedere:
        </p>
        ${ctaButton('Reimposta password', resetLink)}
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
          Se non hai richiesto il reset della password, puoi ignorare questa email.
          Il link scadrà entro 1 ora.
        </p>`;
      return { subject, html: wrapHtml(subject, body) };
    }

    default:
      throw new Error(`Template "${template}" non riconosciuto`);
  }
}

// ── Send via Resend API ───────────────────────────────────────────────
async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY non configurata' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return { success: false, error: `Resend API error: ${res.status} - ${errorBody}` };
  }

  return { success: true };
}

// ── Send via Supabase built-in (fallback) ─────────────────────────────
async function sendViaSupabase(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  // Uses the SMTP configured in Supabase dashboard (Auth > SMTP Settings)
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: 'Supabase service role key non configurata' };
  }

  // Use the admin auth API to send a custom email
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/send_email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ recipient: to, subject, html_body: html }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return { success: false, error: `Supabase email error: ${res.status} - ${errorBody}` };
  }

  return { success: true };
}

// ── Main handler ──────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Metodo non consentito' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, template, data } = await req.json();

    // Validate input
    if (!to || typeof to !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Campo "to" obbligatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template || typeof template !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Campo "template" obbligatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the email from template
    const { subject, html } = buildTemplate(template as TemplateName, data || {});

    // Try Resend first, fall back to Supabase built-in
    let result = await sendViaResend(to, subject, html);

    if (!result.success && result.error?.includes('RESEND_API_KEY non configurata')) {
      console.log('Resend non configurato, fallback su Supabase built-in email...');
      result = await sendViaSupabase(to, subject, html);
    }

    if (!result.success) {
      console.error('Errore invio email:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Errore funzione send-email:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Errore interno del server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
