import { useState, useEffect } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// --- Types ---

type Piano = 'starter' | 'professional' | 'enterprise';
type StatoAbbonamento = 'attivo' | 'scaduto' | 'trial';
type StatoPagamento = 'completato' | 'in_attesa' | 'fallito' | 'rimborsato';

interface Abbonamento {
  id: string;
  officina_id: string;
  piano: Piano;
  stato: StatoAbbonamento;
  data_inizio: string;
  data_fine: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

interface Pagamento {
  id: string;
  officina_id: string;
  data: string;
  descrizione: string;
  importo: number;
  stato: StatoPagamento;
}

// --- Plan definitions ---

interface PianoDef {
  id: Piano;
  nome: string;
  prezzo: number;
  consigliato?: boolean;
  funzionalita: string[];
}

const PIANI: PianoDef[] = [
  {
    id: 'starter',
    nome: 'Starter',
    prezzo: 49,
    funzionalita: [
      'Fino a 2 utenti',
      '50 appuntamenti/mese',
      'Chat cliente',
      'Gestione base',
    ],
  },
  {
    id: 'professional',
    nome: 'Professional',
    prezzo: 99,
    consigliato: true,
    funzionalita: [
      'Fino a 5 utenti',
      'Appuntamenti illimitati',
      'AI Diagnostica',
      'Fatturazione elettronica',
      'WhatsApp notifiche',
      'Supporto prioritario',
    ],
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    prezzo: 199,
    funzionalita: [
      'Utenti illimitati',
      'Tutto Professional +',
      'API personalizzate',
      'Multi-sede',
      'Account manager dedicato',
      'SLA garantito',
    ],
  },
];

// --- Helpers ---

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function statoBadge(stato: StatoAbbonamento) {
  switch (stato) {
    case 'attivo':
      return { label: 'Attivo', color: '#065f46', bg: '#d1fae5' };
    case 'trial':
      return { label: 'Trial', color: '#92400e', bg: '#fef3c7' };
    case 'scaduto':
      return { label: 'Scaduto', color: '#991b1b', bg: '#fee2e2' };
    default:
      return { label: stato, color: '#374151', bg: '#f3f4f6' };
  }
}

function pagamentoBadge(stato: StatoPagamento) {
  switch (stato) {
    case 'completato':
      return { label: 'Completato', color: '#065f46', bg: '#d1fae5' };
    case 'in_attesa':
      return { label: 'In attesa', color: '#92400e', bg: '#fef3c7' };
    case 'fallito':
      return { label: 'Fallito', color: '#991b1b', bg: '#fee2e2' };
    case 'rimborsato':
      return { label: 'Rimborsato', color: '#1e40af', bg: '#dbeafe' };
    default:
      return { label: stato, color: '#374151', bg: '#f3f4f6' };
  }
}

// --- Icons ---

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

// --- Component ---

export function SubscriptionPage() {
  const { officina } = useAuthStore();
  const [abbonamento, setAbbonamento] = useState<Abbonamento | null>(null);
  const [pagamenti, setPagamenti] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officina) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch subscription
      const { data: abboData } = await supabase
        .from('abbonamenti')
        .select('*')
        .eq('officina_id', officina.id)
        .order('data_inizio', { ascending: false })
        .limit(1)
        .single();

      if (abboData) {
        setAbbonamento(abboData as Abbonamento);
      }

      // Fetch payments
      const { data: pagData } = await supabase
        .from('pagamenti')
        .select('*')
        .eq('officina_id', officina.id)
        .order('data', { ascending: false })
        .limit(10);

      if (pagData) {
        setPagamenti(pagData as Pagamento[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [officina]);

  const pianoAttuale: Piano = (abbonamento?.piano as Piano) || (officina?.piano as Piano) || 'professional';
  const statoAttuale: StatoAbbonamento = abbonamento?.stato || 'attivo';

  const handleUpgrade = (piano: Piano) => {
    if (piano === pianoAttuale) return;
    alert(`L'integrazione con Stripe per il piano ${piano} sarà disponibile a breve. Contattaci per aggiornare il tuo piano.`);
  };

  const handleUpdatePayment = () => {
    alert('L\'integrazione con Stripe Billing Portal sarà disponibile a breve. Contattaci per aggiornare il metodo di pagamento.');
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Caricamento abbonamento...</p>
        </div>
      </div>
    );
  }

  const badgeStato = statoBadge(statoAttuale);
  const pianoCorrenteDef = PIANI.find((p) => p.id === pianoAttuale);

  return (
    <div className="p-4 space-y-6 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Abbonamento</h2>
        <p className="text-sm text-gray-500 mt-0.5">Gestisci il tuo piano e la fatturazione</p>
      </div>

      {/* Current Plan Summary */}
      <Card className="!bg-gradient-to-br !from-blue-50 !to-indigo-50 !border-blue-200">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Piano attuale</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">
              {pianoCorrenteDef?.nome || pianoAttuale}
            </h3>
          </div>
          <Badge color={badgeStato.color} bg={badgeStato.bg}>
            {badgeStato.label}
          </Badge>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-3xl font-extrabold text-blue-600">
            {formatCurrency(pianoCorrenteDef?.prezzo || 99)}
          </span>
          <span className="text-sm text-gray-500">/mese</span>
        </div>
        {abbonamento && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/70 rounded-xl p-2.5">
              <span className="text-gray-500 block">Inizio</span>
              <span className="font-semibold text-gray-900">{formatDate(abbonamento.data_inizio)}</span>
            </div>
            <div className="bg-white/70 rounded-xl p-2.5">
              <span className="text-gray-500 block">Rinnovo</span>
              <span className="font-semibold text-gray-900">{formatDate(abbonamento.data_fine)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Pricing Cards */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Scegli il tuo piano</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PIANI.map((piano) => {
            const isAttuale = piano.id === pianoAttuale;
            const isConsigliato = piano.consigliato;
            const pianoIndex = PIANI.findIndex((p) => p.id === piano.id);
            const attualeIndex = PIANI.findIndex((p) => p.id === pianoAttuale);
            const isDowngrade = pianoIndex < attualeIndex;

            return (
              <Card
                key={piano.id}
                className={`relative !p-0 overflow-hidden flex flex-col ${
                  isConsigliato && !isAttuale
                    ? '!border-blue-400 !border-2 shadow-md shadow-blue-100'
                    : isAttuale
                    ? '!border-emerald-400 !border-2 shadow-md shadow-emerald-50'
                    : ''
                }`}
              >
                {/* Recommended badge */}
                {isConsigliato && !isAttuale && (
                  <div className="bg-blue-600 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-1">
                    <StarIcon />
                    CONSIGLIATO
                  </div>
                )}
                {/* Current plan badge */}
                {isAttuale && (
                  <div className="bg-emerald-600 text-white text-xs font-bold text-center py-1.5">
                    PIANO ATTUALE
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  {/* Plan name & price */}
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-gray-900">{piano.nome}</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-extrabold text-gray-900">
                        €{piano.prezzo}
                      </span>
                      <span className="text-sm text-gray-500">/mese</span>
                    </div>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {piano.funzionalita.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckIcon />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Action button */}
                  {isAttuale ? (
                    <Button variant="secondary" fullWidth disabled>
                      Piano attuale
                    </Button>
                  ) : (
                    <Button
                      variant={isConsigliato ? 'primary' : 'secondary'}
                      fullWidth
                      onClick={() => handleUpgrade(piano.id)}
                    >
                      {isDowngrade ? 'Cambia piano' : 'Upgrade'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment Method */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Metodo di pagamento</h3>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
          <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <CreditCardIcon />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">Visa •••• 4242</div>
            <div className="text-xs text-gray-500">Scade 12/2027</div>
          </div>
          <Badge color="#065f46" bg="#d1fae5">Predefinita</Badge>
        </div>
        <Button variant="secondary" fullWidth onClick={handleUpdatePayment}>
          Aggiorna metodo di pagamento
        </Button>
      </Card>

      {/* Billing History */}
      <Card padding={false}>
        <div className="p-5 pb-3">
          <h3 className="font-semibold text-gray-900">Cronologia pagamenti</h3>
        </div>

        {pagamenti.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <div className="text-3xl mb-2">🧾</div>
              <p className="text-sm text-gray-500">Nessun pagamento registrato</p>
              <p className="text-xs text-gray-400 mt-1">I pagamenti appariranno qui dopo il primo addebito</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop table */}
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-t border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Data</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Descrizione</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-2.5">Importo</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-2.5">Stato</th>
                </tr>
              </thead>
              <tbody>
                {pagamenti.map((pag) => {
                  const badge = pagamentoBadge(pag.stato);
                  return (
                    <tr key={pag.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDate(pag.data)}</td>
                      <td className="px-5 py-3 text-gray-900 font-medium">{pag.descrizione}</td>
                      <td className="px-5 py-3 text-gray-900 font-semibold text-right whitespace-nowrap">
                        {formatCurrency(pag.importo)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge color={badge.color} bg={badge.bg}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-100">
              {pagamenti.map((pag) => {
                const badge = pagamentoBadge(pag.stato);
                return (
                  <div key={pag.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{pag.descrizione}</span>
                      <span className="text-sm font-semibold text-gray-900 ml-2 whitespace-nowrap">
                        {formatCurrency(pag.importo)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{formatDate(pag.data)}</span>
                      <Badge color={badge.color} bg={badge.bg}>{badge.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Footer note */}
      <div className="text-center text-xs text-gray-400 pt-2">
        <p>I pagamenti sono gestiti in modo sicuro tramite Stripe.</p>
        <p className="mt-1">Per assistenza scrivi a supporto@officinai.it</p>
      </div>
    </div>
  );
}
