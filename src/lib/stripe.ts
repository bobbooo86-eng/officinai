import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Stripe configuration
// ---------------------------------------------------------------------------

const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_KEY || 'pk_test_placeholder';

// Price IDs for each plan (monthly and yearly)
export const STRIPE_PRICES = {
  starter: {
    monthly: 'price_starter_monthly',
    yearly: 'price_starter_yearly',
  },
  professional: {
    monthly: 'price_professional_monthly',
    yearly: 'price_professional_yearly',
  },
  enterprise: {
    monthly: 'price_enterprise_monthly',
    yearly: 'price_enterprise_yearly',
  },
} as const;

export type PianoId = keyof typeof STRIPE_PRICES;
export type Periodo = 'monthly' | 'yearly';

// ---------------------------------------------------------------------------
// Load Stripe.js dynamically
// ---------------------------------------------------------------------------

let stripePromise: Promise<any> | null = null;

export async function loadStripe() {
  if (stripePromise) return stripePromise;

  stripePromise = new Promise((resolve, reject) => {
    if ((window as any).Stripe) {
      resolve((window as any).Stripe(STRIPE_PUBLISHABLE_KEY));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      if ((window as any).Stripe) {
        resolve((window as any).Stripe(STRIPE_PUBLISHABLE_KEY));
      } else {
        reject(new Error('Impossibile caricare Stripe.js'));
      }
    };
    script.onerror = () =>
      reject(new Error('Errore nel caricamento di Stripe.js'));
    document.head.appendChild(script);
  });

  return stripePromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    console.error(`[stripe] Errore ${functionName}:`, error);
    throw new Error(
      (error as any)?.message ||
        'Si è verificato un errore durante la comunicazione con il server di pagamento.',
    );
  }

  if (data?.error) {
    throw new Error(
      data.error ||
        'Il server di pagamento ha restituito un errore. Riprova più tardi.',
    );
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Create Checkout Session via Supabase Edge Function
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  priceId: string,
  officinaId: string,
  email: string,
): Promise<string> {
  const data = await invokeEdgeFunction<{ sessionUrl: string }>(
    'stripe-checkout',
    { priceId, officinaId, email },
  );

  if (!data.sessionUrl) {
    throw new Error(
      'Impossibile creare la sessione di pagamento. Riprova più tardi.',
    );
  }

  return data.sessionUrl;
}

// ---------------------------------------------------------------------------
// Create Customer Portal session for managing subscription
// ---------------------------------------------------------------------------

export async function createPortalSession(
  customerId: string,
): Promise<string> {
  const data = await invokeEdgeFunction<{ portalUrl: string }>(
    'stripe-portal',
    { customerId },
  );

  if (!data.portalUrl) {
    throw new Error(
      'Impossibile aprire il portale di gestione. Riprova più tardi.',
    );
  }

  return data.portalUrl;
}

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await invokeEdgeFunction('stripe-checkout', {
    action: 'cancel',
    subscriptionId,
  });
}
