// supabase/functions/stripe-webhook/index.ts
// Deno Edge Function — Handles Stripe webhook events
// Events: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed

import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Map Stripe subscription status to our Italian status
function mapStato(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'attivo';
    case 'past_due':
    case 'unpaid':
      return 'scaduto';
    case 'canceled':
    case 'incomplete_expired':
      return 'scaduto';
    default:
      return 'attivo';
  }
}

// Map Stripe interval to plan period label
function mapPeriodo(interval: string): string {
  return interval === 'year' ? 'annuale' : 'mensile';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return jsonResponse(
        { error: 'Configurazione Stripe webhook mancante.' },
        500,
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify webhook signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return jsonResponse({ error: 'Firma webhook mancante.' }, 400);
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('[stripe-webhook] Firma non valida:', err);
      return jsonResponse({ error: 'Firma webhook non valida.' }, 400);
    }

    console.log(`[stripe-webhook] Evento ricevuto: ${event.type}`);

    // -----------------------------------------------------------------------
    // checkout.session.completed
    // -----------------------------------------------------------------------
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const officinaId = session.metadata?.officina_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!officinaId) {
        console.error('[stripe-webhook] officina_id mancante nei metadata.');
        return jsonResponse({ received: true });
      }

      // Retrieve subscription details for dates and plan info
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id ?? '';
      const piano = derivePianoFromPriceId(priceId);

      // Upsert abbonamento
      const { error: upsertError } = await supabase
        .from('abbonamenti')
        .upsert(
          {
            officina_id: officinaId,
            piano,
            stato: 'attivo',
            data_inizio: new Date(
              subscription.current_period_start * 1000,
            ).toISOString(),
            data_fine: new Date(
              subscription.current_period_end * 1000,
            ).toISOString(),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          },
          { onConflict: 'officina_id' },
        );

      if (upsertError) {
        console.error('[stripe-webhook] Errore upsert abbonamento:', upsertError);
      }

      // Update officina piano field
      await supabase
        .from('officine')
        .update({ piano })
        .eq('id', officinaId);
    }

    // -----------------------------------------------------------------------
    // customer.subscription.updated
    // -----------------------------------------------------------------------
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const officinaId = subscription.metadata?.officina_id;

      if (!officinaId) {
        console.error('[stripe-webhook] officina_id mancante nei metadata della sottoscrizione.');
        return jsonResponse({ received: true });
      }

      const priceId = subscription.items.data[0]?.price?.id ?? '';
      const piano = derivePianoFromPriceId(priceId);
      const stato = mapStato(subscription.status);

      const { error } = await supabase
        .from('abbonamenti')
        .update({
          piano,
          stato,
          data_inizio: new Date(
            subscription.current_period_start * 1000,
          ).toISOString(),
          data_fine: new Date(
            subscription.current_period_end * 1000,
          ).toISOString(),
        })
        .eq('officina_id', officinaId);

      if (error) {
        console.error('[stripe-webhook] Errore aggiornamento abbonamento:', error);
      }

      // Sync piano on officine table
      await supabase.from('officine').update({ piano }).eq('id', officinaId);
    }

    // -----------------------------------------------------------------------
    // customer.subscription.deleted
    // -----------------------------------------------------------------------
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const officinaId = subscription.metadata?.officina_id;

      if (officinaId) {
        await supabase
          .from('abbonamenti')
          .update({ stato: 'scaduto' })
          .eq('officina_id', officinaId);

        await supabase
          .from('officine')
          .update({ piano: 'starter' })
          .eq('id', officinaId);
      }
    }

    // -----------------------------------------------------------------------
    // invoice.payment_succeeded
    // -----------------------------------------------------------------------
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const officinaId = subscription.metadata?.officina_id;

        if (officinaId) {
          await supabase.from('pagamenti').insert({
            officina_id: officinaId,
            data: new Date((invoice.created ?? 0) * 1000).toISOString(),
            descrizione: `Pagamento abbonamento ${mapPeriodo(
              subscription.items.data[0]?.price?.recurring?.interval ?? 'month',
            )}`,
            importo: (invoice.amount_paid ?? 0) / 100,
            stato: 'completato',
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // invoice.payment_failed
    // -----------------------------------------------------------------------
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const officinaId = subscription.metadata?.officina_id;

        if (officinaId) {
          await supabase.from('pagamenti').insert({
            officina_id: officinaId,
            data: new Date((invoice.created ?? 0) * 1000).toISOString(),
            descrizione: `Pagamento fallito — abbonamento ${mapPeriodo(
              subscription.items.data[0]?.price?.recurring?.interval ?? 'month',
            )}`,
            importo: (invoice.amount_due ?? 0) / 100,
            stato: 'fallito',
          });

          // Mark subscription as scaduto if past_due
          if (subscription.status === 'past_due') {
            await supabase
              .from('abbonamenti')
              .update({ stato: 'scaduto' })
              .eq('officina_id', officinaId);
          }
        }
      }
    }

    return jsonResponse({ received: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Errore sconosciuto.';
    console.error('[stripe-webhook] Errore:', message);
    return jsonResponse({ error: `Errore webhook: ${message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// Derive plan name from Stripe price ID
// ---------------------------------------------------------------------------
function derivePianoFromPriceId(priceId: string): string {
  if (priceId.includes('enterprise')) return 'enterprise';
  if (priceId.includes('professional')) return 'professional';
  if (priceId.includes('starter')) return 'starter';
  // Fallback — keep current plan
  return 'professional';
}
