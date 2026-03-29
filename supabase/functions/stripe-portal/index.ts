// supabase/functions/stripe-portal/index.ts
// Deno Edge Function — Creates a Stripe Customer Portal session
// POST { customerId } => { portalUrl }

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return jsonResponse(
        { error: 'Chiave Stripe non configurata sul server.' },
        500,
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { customerId } = await req.json();

    if (!customerId) {
      return jsonResponse(
        { error: 'Parametro customerId mancante.' },
        400,
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/app/abbonamento`,
    });

    return jsonResponse({ portalUrl: portalSession.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Errore sconosciuto del server.';
    console.error('[stripe-portal]', message);
    return jsonResponse(
      {
        error: `Errore nell'apertura del portale di gestione: ${message}`,
      },
      500,
    );
  }
});
