// supabase/functions/promemoria-cron/index.ts
// Deno Edge Function — chiamata da un cron job (es. ogni ora)
// Invia promemoria email e WhatsApp per appuntamenti di domani
// Deploy: supabase functions deploy promemoria-cron --no-verify-jwt
// Cron: imposta in Supabase Dashboard > Database > Extensions > pg_cron
//   SELECT cron.schedule('promemoria-giornaliero', '0 18 * * *',
//     $$SELECT net.http_post(url:='https://YOUR_PROJECT.supabase.co/functions/v1/promemoria-cron',
//       headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb)$$);

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function supabaseFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

async function invokeFunction(name: string, body: Record<string, any>) {
  return fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Find appointments for tomorrow
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = tomorrow.toISOString().slice(0, 10) + 'T00:00:00';
    const tomorrowEnd = tomorrow.toISOString().slice(0, 10) + 'T23:59:59';

    // Get appointments with client and office info
    const res = await supabaseFetch(
      `appuntamenti?select=*,clienti(nome,email,tel),officine!appuntamenti_officina_id_fkey(nome)&data_ora=gte.${tomorrowStart}&data_ora=lte.${tomorrowEnd}&stato=eq.prenotato`
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Errore query appuntamenti: ${err}`);
    }

    const appuntamenti = await res.json();
    let emailSent = 0;
    let whatsappSent = 0;

    for (const app of appuntamenti) {
      const clienteNome = app.clienti?.nome || 'Cliente';
      const clienteEmail = app.clienti?.email;
      const clienteTel = app.clienti?.tel;
      const officinaNome = app.officine?.nome || 'OfficinAI';
      const dataStr = new Date(app.data_ora).toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const oraStr = new Date(app.data_ora).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit',
      });

      // Send email reminder
      if (clienteEmail) {
        try {
          await invokeFunction('send-email', {
            to: clienteEmail,
            template: 'promemoria',
            data: {
              clienteNome,
              data: dataStr,
              ora: oraStr,
              officinaNome,
            },
          });
          emailSent++;
        } catch (e) {
          console.error(`Errore email promemoria per ${clienteEmail}:`, e);
        }
      }

      // Send WhatsApp reminder
      if (clienteTel) {
        try {
          const msg = `Buongiorno ${clienteNome}, le ricordiamo l'appuntamento di domani ${dataStr} alle ${oraStr} presso ${officinaNome}. La aspettiamo! — OfficinAI`;
          await invokeFunction('send-whatsapp', {
            to: clienteTel,
            message: msg,
            officina_id: app.officina_id,
            cliente_id: app.cliente_id,
            tipo: 'promemoria',
          });
          whatsappSent++;
        } catch (e) {
          console.error(`Errore WhatsApp promemoria per ${clienteTel}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        appuntamenti: appuntamenti.length,
        emailSent,
        whatsappSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Errore promemoria-cron:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
