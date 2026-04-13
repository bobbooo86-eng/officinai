// supabase/functions/send-whatsapp/index.ts
// Deno Edge Function for sending WhatsApp messages via Twilio API
// Deploy: supabase functions deploy send-whatsapp --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sendViaTwilio(to: string, body: string): Promise<{ success: boolean; error?: string; sid?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return { success: false, error: 'TWILIO_NOT_CONFIGURED' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  // Normalize phone number
  let normalizedTo = to.replace(/[^0-9+]/g, '');
  if (!normalizedTo.startsWith('+')) {
    // Assume Italian number if no country code
    normalizedTo = normalizedTo.startsWith('39') ? `+${normalizedTo}` : `+39${normalizedTo}`;
  }

  const formData = new URLSearchParams();
  formData.append('From', `whatsapp:${TWILIO_WHATSAPP_FROM}`);
  formData.append('To', `whatsapp:${normalizedTo}`);
  formData.append('Body', body);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return { success: false, error: `Twilio error: ${res.status} - ${errorBody}` };
  }

  const data = await res.json();
  return { success: true, sid: data.sid };
}

serve(async (req: Request): Promise<Response> => {
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

    const { to, message, officina_id, cliente_id, tipo } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Campi "to" e "message" obbligatori' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try Twilio
    const result = await sendViaTwilio(to, message);

    // Log to database regardless
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/notifiche_wa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          officina_id,
          cliente_id,
          tipo: tipo || 'custom',
          testo: message,
          stato: result.success ? 'inviato' : (result.error === 'TWILIO_NOT_CONFIGURED' ? 'fallback_wa_web' : 'errore'),
          tel_destinatario: to,
        }),
      });
    }

    if (!result.success && result.error === 'TWILIO_NOT_CONFIGURED') {
      // Return fallback indicator so frontend can open wa.me link
      return new Response(
        JSON.stringify({ success: false, fallback: true, error: 'Twilio non configurato — usa WhatsApp Web' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Errore interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
