import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { VoiceButton } from '@/components/VoiceInput';

interface NuovoAppuntamentoProps {
  onBack: () => void;
  onCreated: (app: any) => void;
  /** Giorno preselezionato dal calendario (es. "+ Nuovo appuntamento per 15 Set"). */
  initialDate?: Date;
}

/** Converte una Date nel formato accettato da <input type="datetime-local">, in ora locale. */
function toLocalInputValue(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Una sola schermata: nome, telefono, targa, problema, data e ora. Crea
// subito cliente + veicolo (minimi) + appuntamento in un solo tocco — non
// e' un passaggio separato di "registrazione cliente", si completa la
// scheda dopo, quando l'auto arriva davvero (pulsante "Genera cliente"
// sull'appuntamento).
export function NuovoAppuntamento({ onBack, onCreated, initialDate }: NuovoAppuntamentoProps) {
  const { officina } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [targa, setTarga] = useState('');
  const [problema, setProblema] = useState('');
  const [dataOra, setDataOra] = useState(() => {
    // L'input datetime-local lavora in ora locale: toISOString() darebbe UTC
    // e in Italia proporrebbe un orario 1-2 ore indietro (a notte fonda
    // addirittura il giorno precedente).
    const base = initialDate ? new Date(initialDate) : new Date();
    if (initialDate) {
      const now = new Date();
      const isOggi = base.toDateString() === now.toDateString();
      // Sul giorno scelto dal calendario propone le 9:00; se e' oggi, l'ora successiva.
      if (isOggi) base.setHours(now.getHours() + 1, 0, 0, 0);
      else base.setHours(9, 0, 0, 0);
    } else {
      base.setHours(base.getHours() + 1, 0, 0, 0);
    }
    return toLocalInputValue(base);
  });

  // Un ref invece di solo "loading": lo stato aggiornato da setLoading non e'
  // ancora visibile al render successivo, quindi un doppio tocco molto
  // rapido (tipico su touchscreen) poteva far partire due volte l'inserimento
  // di cliente/veicolo/appuntamento prima che il pulsante si disabilitasse.
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (!officina?.id || submittingRef.current) return;
    if (!nome.trim()) { setError('Inserisci nome e cognome'); return; }
    if (!problema.trim()) { setError('Inserisci una descrizione del problema'); return; }
    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const { data: newCl, error: clErr } = await supabase
        .from('clienti')
        .insert({
          officina_id: officina.id,
          nome: nome.trim(),
          tel: telefono.trim(),
          email: '',
        })
        .select()
        .single();
      if (clErr) throw new Error('Errore creazione cliente: ' + clErr.message);

      const { data: newVe, error: veErr } = await supabase
        .from('veicoli')
        .insert({
          cliente_id: newCl.id,
          marca: 'N/D',
          modello: 'N/D',
          targa: targa.trim().toUpperCase() || 'N/D',
          anno: new Date().getFullYear(),
          km: 0,
          carburante: 'benzina',
        })
        .select()
        .single();
      if (veErr) throw new Error('Errore creazione veicolo: ' + veErr.message);

      const { data: app, error: appErr } = await supabase
        .from('appuntamenti')
        .insert({
          officina_id: officina.id,
          cliente_id: newCl.id,
          veicolo_id: newVe.id,
          data_ora: new Date(dataOra).toISOString(),
          stato: 'prenotato',
          priorita: 'normale',
          problema: problema.trim(),
        })
        .select()
        .single();
      if (appErr) throw new Error('Errore creazione appuntamento: ' + appErr.message);

      onCreated(app);
    } catch (err: any) {
      setError(err.message || 'Errore');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm";
  const labelClass = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nuovo Appuntamento</h2>
          <p className="text-xs text-gray-500">Nome, telefono, targa e problema: il resto lo completi dopo</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div>
          <label className={labelClass}>Nome e cognome *</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Es: Mario Rossi" autoFocus />
        </div>

        <div>
          <label className={labelClass}>Telefono</label>
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} placeholder="Es: 333 1234567" />
        </div>

        <div>
          <label className={labelClass}>Targa</label>
          <input type="text" value={targa} onChange={(e) => setTarga(e.target.value.toUpperCase())} className={inputClass} placeholder="Es: AB123CD" maxLength={10} />
        </div>

        <div>
          <label className={labelClass}>Descrizione del problema *</label>
          <div className="flex items-start gap-2">
            <textarea
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              rows={3}
              className={inputClass + ' resize-none flex-1'}
              placeholder="Es: Tagliando completo, cambio olio e filtri..."
            />
            <VoiceButton onResult={setProblema} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Data e ora *</label>
          <input type="datetime-local" value={dataOra} onChange={(e) => setDataOra(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
      >
        {loading ? 'Creazione in corso...' : 'Crea Appuntamento'}
      </button>
    </div>
  );
}
