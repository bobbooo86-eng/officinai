import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { sendEmail, type EmailTemplate } from '@/lib/email';
import { useAuthStore } from '@/stores/authStore';

// ── Types ─────────────────────────────────────────────────────────────

interface EmailPreference {
  key: EmailTemplate;
  label: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_PREFERENCES: EmailPreference[] = [
  {
    key: 'benvenuto',
    label: 'Email di benvenuto',
    description: 'Inviata automaticamente alla registrazione di un nuovo cliente',
    enabled: true,
  },
  {
    key: 'appuntamento_confermato',
    label: 'Conferma appuntamento',
    description: 'Inviata quando un appuntamento viene confermato',
    enabled: true,
  },
  {
    key: 'preventivo_inviato',
    label: 'Invio preventivo',
    description: 'Inviata quando un preventivo viene inviato al cliente',
    enabled: true,
  },
  {
    key: 'stato_aggiornato',
    label: 'Aggiornamento stato lavorazione',
    description: 'Inviata quando cambia lo stato di una lavorazione',
    enabled: true,
  },
  {
    key: 'fattura_emessa',
    label: 'Emissione fattura',
    description: 'Inviata quando viene emessa una fattura',
    enabled: true,
  },
  {
    key: 'promemoria',
    label: 'Promemoria appuntamento',
    description: 'Inviata 24 ore prima dell\'appuntamento',
    enabled: true,
  },
  {
    key: 'reset_password',
    label: 'Reset password',
    description: 'Inviata quando viene richiesto un reset della password',
    enabled: true,
  },
];

// ── Component ─────────────────────────────────────────────────────────

export function EmailSettings() {
  const { officina, utente } = useAuthStore();
  const [preferences, setPreferences] = useState<EmailPreference[]>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ key: string; success: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load saved preferences from Supabase
  const loadPreferences = useCallback(async () => {
    if (!officina?.id) return;

    try {
      const { data, error } = await supabase
        .from('impostazioni_email')
        .select('preferenze')
        .eq('officina_id', officina.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (first time)
        console.error('Errore caricamento preferenze:', error);
        setLoadError('Impossibile caricare le preferenze email');
        return;
      }

      if (data?.preferenze) {
        const savedPrefs = data.preferenze as Record<string, boolean>;
        setPreferences((prev) =>
          prev.map((p) => ({
            ...p,
            enabled: savedPrefs[p.key] !== undefined ? savedPrefs[p.key] : p.enabled,
          }))
        );
      }
    } catch (err) {
      console.error('Errore caricamento preferenze:', err);
      setLoadError('Impossibile caricare le preferenze email');
    }
  }, [officina?.id]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Toggle a preference
  const togglePreference = (key: EmailTemplate) => {
    setPreferences((prev) =>
      prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p))
    );
    setSaved(false);
  };

  // Save preferences
  const savePreferences = async () => {
    if (!officina?.id) return;

    setSaving(true);
    try {
      const preferenze: Record<string, boolean> = {};
      preferences.forEach((p) => {
        preferenze[p.key] = p.enabled;
      });

      const { error } = await supabase
        .from('impostazioni_email')
        .upsert(
          { officina_id: officina.id, preferenze, updated_at: new Date().toISOString() },
          { onConflict: 'officina_id' }
        );

      if (error) {
        console.error('Errore salvataggio preferenze:', error);
        alert('Errore nel salvataggio delle preferenze');
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Errore salvataggio:', err);
      alert('Errore nel salvataggio delle preferenze');
    } finally {
      setSaving(false);
    }
  };

  // Send test email
  const sendTestEmail = async (template: EmailTemplate) => {
    const email = utente?.email || officina?.email;
    if (!email) {
      alert('Nessun indirizzo email configurato');
      return;
    }

    setSendingTest(template);
    setTestResult(null);

    const testData: Record<string, any> = {
      nome: utente?.nome || 'Test',
      clienteNome: 'Mario Rossi',
      officinaNome: officina?.nome || 'OfficinAI',
      data: '15/04/2026',
      ora: '09:30',
      veicolo: 'Fiat Punto 1.3 MJT',
      totale: 850.0,
      numero: 'FT-2026-0042',
      nuovoStato: 'in_lavorazione',
      resetLink: 'https://app.officinai.it/reset-password?token=test',
      linkPreventivo: 'https://app.officinai.it/preventivo/test',
      linkFattura: 'https://app.officinai.it/fattura/test',
    };

    const success = await sendEmail(email, template, testData);
    setTestResult({ key: template, success });
    setSendingTest(null);

    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Notifiche Email</h2>
        <p className="mt-1 text-sm text-gray-500">
          Gestisci quali email vengono inviate automaticamente ai clienti.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">{loadError}</p>
          <p className="text-xs text-amber-600 mt-1">
            Le preferenze predefinite verranno utilizzate. Le modifiche saranno salvate normalmente.
          </p>
        </div>
      )}

      <Card>
        <div className="divide-y divide-gray-100">
          {preferences.map((pref) => (
            <div
              key={pref.key}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{pref.label}</h3>
                  {testResult?.key === pref.key && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        testResult.success
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {testResult.success ? 'Inviata!' : 'Errore invio'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{pref.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={sendingTest !== null}
                  loading={sendingTest === pref.key}
                  onClick={() => sendTestEmail(pref.key)}
                >
                  {sendingTest === pref.key ? 'Invio...' : 'Test'}
                </Button>

                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={pref.enabled}
                  onClick={() => togglePreference(pref.key)}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                    border-2 border-transparent transition-colors duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
                    ${pref.enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-5 w-5 transform rounded-full
                      bg-white shadow ring-0 transition duration-200 ease-in-out
                      ${pref.enabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Save / status bar */}
      <div className="flex items-center justify-between">
        <div>
          {saved && (
            <span className="text-sm text-emerald-600 font-medium">
              Preferenze salvate con successo
            </span>
          )}
        </div>
        <Button
          variant="primary"
          onClick={savePreferences}
          loading={saving}
          disabled={saving}
        >
          {saving ? 'Salvataggio...' : 'Salva preferenze'}
        </Button>
      </div>

      {/* Info box */}
      <Card className="!bg-blue-50 !border-blue-200">
        <div className="flex gap-3">
          <div className="shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">Come funziona</h4>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Le email vengono inviate automaticamente ai clienti quando si verificano gli eventi corrispondenti.
              Disattivando un tipo di notifica, le email relative non verranno inviate.
              Usa il pulsante "Test" per inviare un'email di prova al tuo indirizzo ({utente?.email || officina?.email || 'non configurato'}).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
