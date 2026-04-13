import { useState, useEffect } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { validateRequired } from '@/lib/validation';
import type { Veicolo } from '@/types/database';

export function BookingPage() {
  const { cliente } = useAuthStore();
  const [step, setStep] = useState(1);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedVeicolo, setSelectedVeicolo] = useState<string>('');
  const [data, setData] = useState('');
  const [ora, setOra] = useState('09:00');
  const [problema, setProblema] = useState('');
  const [priorita, setPriorita] = useState('normale');

  // Validation errors
  const [errVeicolo, setErrVeicolo] = useState<string | null>(null);
  const [errData, setErrData] = useState<string | null>(null);
  const [errProblema, setErrProblema] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente) return;
    const fetch = async () => {
      const { data: v } = await supabase
        .from('veicoli')
        .select('*')
        .eq('cliente_id', cliente.id);
      setVeicoli(v || []);
      if (v && v.length > 0) setSelectedVeicolo(v[0].id);
      setLoading(false);
    };
    fetch();
  }, [cliente]);

  // Set minimum date to today
  const today = new Date().toISOString().slice(0, 10);

  const orari = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30',
  ];

  const submit = async () => {
    if (!cliente || !selectedVeicolo || !data || !problema.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    const { error } = await supabase.from('appuntamenti').insert({
      officina_id: cliente.officina_id,
      cliente_id: cliente.id,
      veicolo_id: selectedVeicolo,
      data_ora: `${data}T${ora}:00`,
      stato: 'richiesta',
      priorita,
      problema: problema.trim(),
    });

    setSubmitting(false);

    if (error) {
      setSubmitError('Errore nell\'invio della richiesta. Riprova.');
      return;
    }

    setSuccess(true);
  };

  if (loading) return <div className="text-center py-8 text-sm text-gray-400">Caricamento...</div>;

  if (!loading && veicoli.length === 0 && !success) {
    return (
      <div className="p-4 text-center py-16">
        <div className="text-5xl mb-4">🚗</div>
        <h2 className="text-lg font-semibold text-gray-900">Nessun veicolo registrato</h2>
        <p className="text-sm text-gray-500 mt-2">
          Per richiedere un appuntamento, contatta l'officina per aggiungere il tuo veicolo al sistema.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-4 text-center py-16">
        <div className="text-5xl mb-4">📩</div>
        <h2 className="text-xl font-bold text-gray-900">Richiesta inviata!</h2>
        <p className="text-sm text-gray-500 mt-2">
          Richiesta per il {data} alle {ora}
        </p>
        <p className="text-xs text-gray-400 mt-1">L'officina valuterà la tua richiesta e ti confermerà l'appuntamento</p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => { setSuccess(false); setStep(1); setProblema(''); setData(''); }}
        >
          Invia un'altra richiesta
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Richiedi appuntamento</h2>

      {/* Progress steps */}
      <div className="flex items-center justify-between mb-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {step > s ? '✓' : s}
            </div>
            {s < 3 && (
              <div className={`w-16 h-1 mx-1 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Vehicle */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Seleziona il veicolo:</p>
          {veicoli.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVeicolo(v.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedVeicolo === v.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🚗</div>
                <div>
                  <div className="font-semibold text-gray-900">{v.marca} {v.modello}</div>
                  <div className="text-xs text-gray-500">{v.targa} • {v.anno} • {v.km?.toLocaleString()} km</div>
                </div>
              </div>
            </button>
          ))}
          {errVeicolo && <p className="text-xs text-red-500">{errVeicolo}</p>}
          <Button fullWidth onClick={() => {
            if (!selectedVeicolo) { setErrVeicolo('Seleziona un veicolo'); return; }
            setErrVeicolo(null);
            setStep(2);
          }} disabled={!selectedVeicolo}>
            Continua
          </Button>
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Scegli data e orario:</p>

          <Input
            label="Data"
            type="date"
            value={data}
            min={today}
            onChange={(e) => setData(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orario</label>
            <div className="grid grid-cols-4 gap-1.5">
              {orari.map((o) => (
                <button
                  key={o}
                  onClick={() => setOra(o)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    ora === o
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {errData && <p className="text-xs text-red-500">{errData}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} fullWidth>Indietro</Button>
            <Button onClick={() => {
              const err = validateRequired(data, 'La data');
              setErrData(err);
              if (!err) setStep(3);
            }} disabled={!data} fullWidth>Continua</Button>
          </div>
        </div>
      )}

      {/* Step 3: Problem description */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Descrivi il problema:</p>

          <textarea
            value={problema}
            onChange={(e) => { setProblema(e.target.value); if (errProblema) setErrProblema(null); }}
            onBlur={() => { if (!problema.trim()) setErrProblema('Descrivi il problema riscontrato'); else setErrProblema(null); }}
            placeholder="Es: La macchina fa un rumore strano quando freno, la spia del motore è accesa..."
            className={`w-full px-4 py-3 rounded-xl border bg-white text-sm resize-none focus:outline-none focus:ring-2 ${errProblema ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
            rows={4}
          />
          {errProblema && <p className="text-xs text-red-500">{errProblema}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
            <div className="flex gap-2">
              {[
                { value: 'bassa', label: '🟢 Bassa', desc: 'Quando possibile' },
                { value: 'normale', label: '🟡 Normale', desc: 'Appena c\'è posto' },
                { value: 'urgente', label: '🔴 Urgente', desc: 'Il prima possibile' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriorita(p.value)}
                  className={`flex-1 p-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    priorita === p.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs font-medium">{p.label}</div>
                  <div className="text-[10px] text-gray-400">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <Card className="!p-3 bg-gray-50">
            <div className="text-xs text-gray-400 mb-1">Riepilogo</div>
            <div className="text-sm text-gray-700">
              <strong>{veicoli.find((v) => v.id === selectedVeicolo)?.marca} {veicoli.find((v) => v.id === selectedVeicolo)?.modello}</strong>
              <br />📅 {data} alle {ora}
              {problema && <><br />📝 {problema.slice(0, 80)}{problema.length > 80 ? '...' : ''}</>}
            </div>
          </Card>

          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} fullWidth>Indietro</Button>
            <Button
              onClick={() => {
                if (!problema.trim()) { setErrProblema('Descrivi il problema riscontrato'); return; }
                setErrProblema(null);
                submit();
              }}
              loading={submitting}
              disabled={!problema.trim()}
              fullWidth
            >
              Invia richiesta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
