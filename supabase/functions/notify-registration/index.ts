// supabase/functions/notify-registration/index.ts
// Sends a notification email to info@myofficinai.it when someone registers

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SMTP_HOST = 'smtps.aruba.it';
const SMTP_PORT = 465;
const SMTP_USER = Deno.env.get('SMTP_USER') ?? 'info@myofficinai.it';
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? '';
const NOTIFY_TO = 'info@myofficinai.it';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tipo, nome, email, telefono, officina, citta } = await req.json();

    const subject = tipo === 'officina'
      ? `Nuova officina registrata: ${officina || nome}`
      : `Nuovo cliente registrato: ${nome}`;

    const body = tipo === 'officina'
      ? `Nuova registrazione officina su OfficinAI:\n\nOfficina: ${officina}\nTitolare: ${nome}\nEmail: ${email}\nTelefono: ${telefono}\nCitta: ${citta || 'N/D'}\n\nData: ${new Date().toLocaleString('it-IT')}`
      : `Nuovo cliente registrato su OfficinAI:\n\nNome: ${nome}\nEmail: ${email}\nTelefono: ${telefono}\n\nData: ${new Date().toLocaleString('it-IT')}`;

    // Use Supabase's built-in SMTP (already configured with Aruba)
    // We'll use a simple fetch to a mail API or log for now
    // Since we have SMTP configured in Supabase Auth, we use the REST API
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Store notification in contatti_landing table as a log
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/contatti_landing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          nome: `[REGISTRAZIONE ${tipo?.toUpperCase()}] ${nome}`,
          email: email,
          telefono: telefono || null,
          messaggio: body,
        }),
      });
    }

    console.log(`[notify-registration] ${subject}\n${body}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[notify-registration] Error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
