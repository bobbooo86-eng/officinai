import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Loader, Button } from '@/components/ui';
import { SubscriptionPage } from './SubscriptionPage';

interface AbbonamentoRiga {
  stato: 'trial' | 'attivo' | 'scaduto';
  data_fine: string;
}

/**
 * Un'officina senza nessuna riga in abbonamenti (es. creata prima che
 * questa tabella esistesse) non viene mai bloccata: e' il caso delle
 * officine avviate manualmente prima del lancio del pagamento online.
 */
function calcolaBloccato(a: AbbonamentoRiga | null): boolean {
  if (!a) return false;
  if (a.stato === 'scaduto') return true;
  if (a.stato === 'trial' && new Date(a.data_fine) < new Date()) return true;
  return false;
}

export function AbbonamentoGate({ children }: { children: React.ReactNode }) {
  const { officina, utente, logout } = useAuthStore();
  const [abbonamento, setAbbonamento] = useState<AbbonamentoRiga | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officina) return;
    let attivo = true;

    const fetch = async () => {
      const { data } = await supabase
        .from('abbonamenti')
        .select('stato, data_fine')
        .eq('officina_id', officina.id)
        .order('data_inizio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attivo) {
        setAbbonamento((data as AbbonamentoRiga) || null);
        setLoading(false);
      }
    };
    fetch();

    return () => {
      attivo = false;
    };
  }, [officina?.id]);

  if (!officina || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader size="lg" text="Caricamento..." />
      </div>
    );
  }

  const bloccato = calcolaBloccato(abbonamento);

  if (!bloccato) {
    return <>{children}</>;
  }

  if (utente?.ruolo !== 'titolare') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-sm text-center bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Abbonamento scaduto</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            L'abbonamento di {officina.nome} è scaduto. Chiedi al titolare di rinnovarlo per tornare ad accedere.
          </p>
          <Button variant="secondary" fullWidth onClick={() => logout()}>Esci</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-red-600 text-white text-sm font-semibold text-center py-3 px-4">
        Il tuo abbonamento è scaduto: scegli un piano per continuare a usare OfficinAI.
      </div>
      <div className="max-w-5xl mx-auto">
        <SubscriptionPage />
      </div>
      <div className="text-center pb-8">
        <button
          onClick={() => logout()}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Esci
        </button>
      </div>
    </div>
  );
}
