// supabase/functions/stripe-checkout/index.ts
// Deno Edge Function — Creates a Stripe Checkout Session or cancels a subscription
// POST { priceId, officinaId, email } => { sessionUrl }
// POST { action: 'cancel', subscriptionId } => { ok: true }

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

    const body = await req.json();

    // --- Cancel subscription ---
    if (body.action === 'cancel' && body.subscriptionId) {
      await stripe.subscriptions.update(body.subscriptionId, {
        cancel_at_period_end: true,
      });
      return jsonResponse({ ok: true });
    }

    // --- Create checkout session ---
    const { priceId, officinaId, email } = body;

    if (!priceId || !officinaId || !email) {
      return jsonResponse(
        {
          error:
            'Parametri mancanti. Sono richiesti: priceId, officinaId, email.',
        },
        400,
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'paypal'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/app/abbonamento?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${SITE_URL}/app/abbonamento?canceled=true`,
      metadata: {
        officina_id: officinaId,
      },
      subscription_data: {
        metadata: {
          officina_id: officinaId,
        },
      },
    });

    return jsonResponse({ sessionUrl: session.url });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Errore sconosciuto del server.';
    console.error('[stripe-checkout]', message);
    return jsonResponse(
      { error: `Errore nella creazione del pagamento: ${message}` },
      500,
    );
  }
});
