import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Cliente, Veicolo } from '@/types/database';

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

export function NuovoAppuntamento({ onBack, onCreated, initialDate }: NuovoAppuntamentoProps) {
  const { officina } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cliente search/create
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientiResults, setClientiResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newClienteNome, setNewClienteNome] = useState('');
  const [newClienteTel, setNewClienteTel] = useState('');
  const [newClienteEmail, setNewClienteEmail] = useState('');

  // Veicolo search/create
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [selectedVeicolo, setSelectedVeicolo] = useState<Veicolo | null>(null);
  const [showNewVeicolo, setShowNewVeicolo] = useState(false);
  const [newTarga, setNewTarga] = useState('');
  const [newMarca, setNewMarca] = useState('');
  const [newModello, setNewModello] = useState('');

  // Appuntamento fields
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
  const [problema, setProblema] = useState('');
  const [priorita, setPriorita] = useState('normale');

  // Search clienti
  useEffect(() => {
    if (!officina?.id || clienteSearch.length < 2) { setClientiResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('clienti')
        .select('*')
        .eq('officina_id', officina.id)
        .or(`nome.ilike.%${clienteSearch}%,tel.ilike.%${clienteSearch}%,email.ilike.%${clienteSearch}%`)
        .limit(8);
      setClientiResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [clienteSearch, officina?.id]);

  // Fetch veicoli for selected cliente
  useEffect(() => {
    // Reset sempre lo stato veicolo quando cambia il cliente selezionato,
    // per evitare che resti agganciato un veicolo del cliente precedente
    setSelectedVeicolo(null);
    setShowNewVeicolo(false);
    setNewTarga('');
    setNewMarca('');
    setNewModello('');

    if (!selectedCliente) { setVeicoli([]); return; }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('veicoli')
        .select('*')
        .eq('cliente_id', selectedCliente.id);
      if (cancelled) return;
      setVeicoli(data || []);
      if (data?.length === 1) {
        setSelectedVeicolo(data[0]);
      } else if (!data || data.length === 0) {
        // Cliente senza veicoli: attiva il form nuovo veicolo cosi l'utente puo proseguire
        setShowNewVeicolo(true);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCliente]);

  const handleSubmit = async () => {
    if (!officina?.id) return;
    setError('');
    setLoading(true);

    try {
      let clienteId = selectedCliente?.id;
      let veicoloId = selectedVeicolo?.id;

      // Create new cliente if needed
      if (!clienteId && showNewCliente && newClienteNome.trim()) {
        const { data: newCl, error: clErr } = await supabase
          .from('clienti')
          .insert({
            officina_id: officina.id,
            nome: newClienteNome.trim(),
            tel: newClienteTel.trim(),
            email: newClienteEmail.trim(),
          })
          .select()
          .single();
        if (clErr) throw new Error('Errore creazione cliente: ' + clErr.message);
        clienteId = newCl.id;
      }

      if (!clienteId) throw new Error('Seleziona o crea un cliente');

      // Create new veicolo if needed
      if (!veicoloId && showNewVeicolo && newTarga.trim()) {
        const { data: newVe, error: veErr } = await supabase
          .from('veicoli')
          .insert({
            cliente_id: clienteId,
            marca: newMarca.trim() || 'N/D',
            modello: newModello.trim() || 'N/D',
            targa: newTarga.trim().toUpperCase(),
            anno: new Date().getFullYear(),
            km: 0,
            carburante: 'benzina',
          })
          .select()
          .single();
        if (veErr) throw new Error('Errore creazione veicolo: ' + veErr.message);
        veicoloId = newVe.id;
      }

      if (!veicoloId) throw new Error('Seleziona o crea un veicolo');
      if (!problema.trim()) throw new Error('Inserisci una descrizione del lavoro');

      // Create appointment
      const { data: app, error: appErr } = await supabase
        .from('appuntamenti')
        .insert({
          officina_id: officina.id,
          cliente_id: clienteId,
          veicolo_id: veicoloId,
          data_ora: new Date(dataOra).toISOString(),
          stato: 'prenotato',
          priorita,
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
          <p className="text-xs text-gray-500">Inserisci manualmente un appuntamento</p>
        </div>
      </div>

      {/* 1. Cliente */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">👤 Cliente</h3>

        {selectedCliente ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <div>
              <div className="font-bold text-sm text-blue-800 dark:text-blue-300">{selectedCliente.nome}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">{selectedCliente.tel} · {selectedCliente.email}</div>
            </div>
            <button onClick={() => { setSelectedCliente(null); setSelectedVeicolo(null); setClienteSearch(''); }} className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">Cambia</button>
          </div>
        ) : showNewCliente ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Nuovo cliente</span>
              <button onClick={() => setShowNewCliente(false)} className="text-xs text-blue-600 cursor-pointer">Cerca esistente</button>
            </div>
            <input type="text" value={newClienteNome} onChange={(e) => setNewClienteNome(e.target.value)} className={inputClass} placeholder="Nome e cognome *" />
            <div className="grid grid-cols-2 gap-2">
              <input type="tel" value={newClienteTel} onChange={(e) => setNewClienteTel(e.target.value)} className={inputClass} placeholder="Telefono" />
              <input type="email" value={newClienteEmail} onChange={(e) => setNewClienteEmail(e.target.value)} className={inputClass} placeholder="Email" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={clienteSearch}
              onChange={(e) => setClienteSearch(e.target.value)}
              className={inputClass}
              placeholder="Cerca cliente per nome, telefono o email..."
              autoFocus
            />
            {clientiResults.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {clientiResults.map((cl) => (
                  <button
                    key={cl.id}
                    onClick={() => { setSelectedCliente(cl); setClienteSearch(''); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm shrink-0">👤</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{cl.nome}</div>
                      <div className="text-xs text-gray-400">{cl.tel}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setShowNewCliente(true); setShowNewVeicolo(true); }} className="w-full py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors cursor-pointer">
              + Crea nuovo cliente
            </button>
          </div>
        )}
      </div>

      {/* 2. Veicolo */}
      {(selectedCliente || showNewCliente) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">🚗 Veicolo</h3>

          {selectedVeicolo ? (
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl">
              <div>
                <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">{selectedVeicolo.marca} {selectedVeicolo.modello}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">{selectedVeicolo.targa}</div>
              </div>
              <button onClick={() => setSelectedVeicolo(null)} className="text-xs text-emerald-600 hover:text-emerald-800 cursor-pointer">Cambia</button>
            </div>
          ) : showNewVeicolo || veicoli.length === 0 ? (
            <div className="space-y-2">
              {veicoli.length > 0 && (
                <div className="flex justify-end">
                  <button onClick={() => setShowNewVeicolo(false)} className="text-xs text-blue-600 cursor-pointer">Seleziona esistente</button>
                </div>
              )}
              <input type="text" value={newTarga} onChange={(e) => setNewTarga(e.target.value.toUpperCase())} className={inputClass} placeholder="Targa *" maxLength={10} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newMarca} onChange={(e) => setNewMarca(e.target.value)} className={inputClass} placeholder="Marca (es. Fiat)" />
                <input type="text" value={newModello} onChange={(e) => setNewModello(e.target.value)} className={inputClass} placeholder="Modello (es. Panda)" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {veicoli.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVeicolo(v)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm shrink-0">🚗</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{v.marca} {v.modello}</div>
                    <div className="text-xs text-gray-400 font-mono">{v.targa}</div>
                  </div>
                </button>
              ))}
              <button onClick={() => setShowNewVeicolo(true)} className="w-full py-2 text-sm text-emerald-600 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors cursor-pointer">
                + Aggiungi nuovo veicolo
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Dettagli appuntamento */}
      {(selectedCliente || showNewCliente) && (selectedVeicolo || showNewVeicolo) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">📅 Dettagli</h3>

          <div>
            <label className={labelClass}>Data e ora *</label>
            <input type="datetime-local" value={dataOra} onChange={(e) => setDataOra(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Descrizione lavoro *</label>
            <textarea
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="Es: Tagliando completo, cambio olio e filtri..."
            />
          </div>

          <div>
            <label className={labelClass}>Priorità</label>
            <div className="flex gap-2">
              {[
                { val: 'bassa', label: '🟢 Bassa', color: 'border-green-300 bg-green-50 text-green-700' },
                { val: 'normale', label: '🟡 Normale', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
                { val: 'alta', label: '🔴 Alta', color: 'border-red-300 bg-red-50 text-red-700' },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => setPriorita(p.val)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition-all cursor-pointer ${
                    priorita === p.val ? p.color : 'border-gray-200 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Submit */}
      {(selectedCliente || showNewCliente) && (selectedVeicolo || showNewVeicolo) && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Creazione in corso...' : 'Crea Appuntamento'}
        </button>
      )}
    </div>
  );
}
