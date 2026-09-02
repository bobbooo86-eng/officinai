import { useEffect, useState } from 'react';
import { Card, Loader, Button, Input, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { insertTolerant } from '@/lib/resilientDb';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtData, fmtOra, fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { StoricoVeicolo } from './StoricoVeicolo';
import type { Cliente, Veicolo, Appuntamento, Preventivo } from '@/types/database';

type View = 'list' | 'add' | 'detail' | 'addVeicolo' | 'storicoVeicolo';

/** Colore/etichetta di una scadenza in base a quanto manca: scaduta (rosso),
 * entro un mese (ambra, coerente con l'anticipo delle notifiche in Home),
 * oltre (grigio, solo informativo). */
function statoScadenza(dataStr?: string): { label: string; color: string; bg: string } | null {
  if (!dataStr) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const d = new Date(dataStr);
  const giorni = Math.round((d.getTime() - oggi.getTime()) / 86400000);
  const dataFmt = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  if (giorni < 0) return { label: `Scaduta il ${dataFmt}`, color: '#991b1b', bg: '#fee2e2' };
  if (giorni <= 30) return { label: `${dataFmt} (tra ${giorni}g)`, color: '#92400e', bg: '#fef3c7' };
  return { label: dataFmt, color: '#374151', bg: '#f3f4f6' };
}

export function CustomersPage({ initialClienteId, resetSignal }: { initialClienteId?: string; resetSignal?: number } = {}) {
  const { officina } = useAuthStore();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedVeicolo, setSelectedVeicolo] = useState<Veicolo | null>(null);
  const [mostraArchiviati, setMostraArchiviati] = useState(false);

  // Quando l'utente clicca di nuovo sul tab Clienti mentre e' gia' attivo,
  // torna alla lista principale invece di restare nel dettaglio.
  useEffect(() => {
    if (resetSignal === undefined) return;
    setView('list');
    setSelectedCliente(null);
    setSelectedVeicolo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const fetchClienti = async () => {
    // Senza officina non c'e' nulla da caricare, ma il loader va comunque
    // spento o la pagina resta bloccata su "Caricamento clienti...".
    if (!officina) { setLoading(false); return; }
    const { data } = await supabase
      .from('clienti')
      .select('*')
      .eq('officina_id', officina.id)
      .order('nome');
    setClienti(data || []);
    setLoading(false);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchClienti();
      // Se nel frattempo l'utente e' tornato alla lista (resetSignal), non
      // riaprire il dettaglio con un risultato ormai obsoleto.
      if (cancelled || !initialClienteId || !data) return;
      const cl = data.find((c) => c.id === initialClienteId);
      if (cl) {
        setSelectedCliente(cl);
        setView('detail');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officina, initialClienteId]);

  if (loading) return <Loader text="Caricamento clienti..." />;

  if (view === 'add') {
    return (
      <AddClienteForm
        onBack={() => setView('list')}
        onSaved={(c) => {
          setClienti((prev) => [...prev, c].sort((a, b) => a.nome.localeCompare(b.nome)));
          setSelectedCliente(c);
          setView('detail');
        }}
      />
    );
  }

  if (view === 'detail' && selectedCliente) {
    return (
      <ClienteDetail
        cliente={selectedCliente}
        onBack={() => { setView('list'); setSelectedCliente(null); }}
        onAddVeicolo={() => setView('addVeicolo')}
        onDeleted={() => {
          // Non rimosso dall'elenco: resta come archiviato, ripristinabile.
          setClienti((prev) => prev.map((c) => (c.id === selectedCliente.id ? { ...c, attivo: false } : c)));
          setSelectedCliente(null);
          setView('list');
        }}
        onSelectVeicolo={(v) => { setSelectedVeicolo(v); setView('storicoVeicolo'); }}
      />
    );
  }

  if (view === 'addVeicolo' && selectedCliente) {
    return (
      <AddVeicoloForm
        clienteId={selectedCliente.id}
        onBack={() => setView('detail')}
        onSaved={() => setView('detail')}
      />
    );
  }

  if (view === 'storicoVeicolo' && selectedVeicolo && selectedCliente) {
    return (
      <StoricoVeicolo
        veicolo={selectedVeicolo}
        clienteNome={selectedCliente.nome}
        onBack={() => { setSelectedVeicolo(null); setView('detail'); }}
      />
    );
  }

  const attivi = clienti.filter((c) => c.attivo !== false);
  const archiviati = clienti.filter((c) => c.attivo === false);
  const listaBase = mostraArchiviati ? archiviati : attivi;
  const filtered = listaBase.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.tel?.includes(search)
  );

  const ripristinaCliente = async (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('clienti').update({ attivo: true }).eq('id', c.id);
    if (error) { alert('Errore ripristino: ' + error.message); return; }
    setClienti((prev) => prev.map((x) => (x.id === c.id ? { ...x, attivo: true } : x)));
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Clienti ({attivi.length})</h2>
        <Button onClick={() => setView('add')}>+ Nuovo cliente</Button>
      </div>

      <input
        type="text"
        placeholder="Cerca per nome, email o telefono..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {archiviati.length > 0 && (
        <button
          onClick={() => setMostraArchiviati((v) => !v)}
          className="text-xs text-gray-500 font-semibold hover:text-gray-700 cursor-pointer"
        >
          {mostraArchiviati ? '← Torna ai clienti attivi' : `🗄️ Clienti archiviati (${archiviati.length})`}
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {search ? 'Nessun cliente trovato' : mostraArchiviati ? 'Nessun cliente archiviato' : 'Nessun cliente registrato'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card
              key={c.id}
              hover
              className="!p-3"
              onClick={() => { setSelectedCliente(c); setView('detail'); }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{c.nome}</div>
                  <div className="text-xs text-gray-400">
                    {c.email}{c.tel ? ` · ${c.tel}` : ''}
                  </div>
                </div>
                {mostraArchiviati ? (
                  <button
                    onClick={(e) => ripristinaCliente(c, e)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 cursor-pointer px-2 py-1"
                  >
                    ↩ Ripristina
                  </button>
                ) : (
                  <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== ADD CLIENTE FORM ====================
function AddClienteForm({ onBack, onSaved }: { onBack: () => void; onSaved: (c: Cliente) => void }) {
  const { officina } = useAuthStore();
  // Cliente fields
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [note, setNote] = useState('');
  // Veicolo fields
  const [targa, setTarga] = useState('');
  const [marca, setMarca] = useState('');
  const [modello, setModello] = useState('');
  const [anno, setAnno] = useState(new Date().getFullYear().toString());
  const [km, setKm] = useState('');
  const [carburante, setCarburante] = useState('benzina');
  const [cilindrata, setCilindrata] = useState('');
  const [telaio, setTelaio] = useState('');
  const [colore, setColore] = useState('');
  const [scadenzaRevisione, setScadenzaRevisione] = useState('');
  const [scadenzaTagliando, setScadenzaTagliando] = useState('');
  const [scadenzaAssicurazione, setScadenzaAssicurazione] = useState('');
  const [scadenzaBollo, setScadenzaBollo] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errNome, setErrNome] = useState<string | null>(null);

  const carburanti = ['benzina', 'diesel', 'gpl', 'metano', 'ibrido', 'elettrico'];

  const submit = async () => {
    if (!nome.trim()) { setErrNome('Il nome è obbligatorio'); return; }
    if (!officina) return;

    setSaving(true);
    setSaveError('');

    // Insert cliente
    // codice_fiscale e indirizzo hanno colonne dedicate: vanno li', non
    // concatenati dentro note, altrimenti non sono piu' consultabili.
    const { data: cliente, error } = await insertTolerant<Cliente>('clienti', {
      officina_id: officina.id,
      nome: nome.trim(),
      // email e tel sono NOT NULL con default '': passare null darebbe
      // errore 23502 e impedirebbe di salvare un cliente senza contatti.
      email: email.trim(),
      tel: tel.trim(),
      codice_fiscale: codiceFiscale.trim() || null,
      indirizzo: indirizzo.trim() || null,
      note: note.trim() || null,
    }, ['officina_id', 'nome'], { returning: true });

    if (error || !cliente) {
      setSaving(false);
      setSaveError('Errore salvataggio cliente: ' + (error?.message || 'nessun dato restituito'));
      return;
    }

    // Insert veicolo if targa provided
    if (targa.trim()) {
      // La tabella veicoli non ha una colonna note: cilindrata e colore
      // finivano li' e l'intero insert veniva rifiutato, perdendo il veicolo.
      const dettagli = [
        cilindrata ? `Cilindrata: ${cilindrata}` : '',
        colore ? `Colore: ${colore}` : '',
      ].filter(Boolean).join(' | ');
      const scadenze = (scadenzaRevisione || scadenzaTagliando || scadenzaAssicurazione || scadenzaBollo) ? {
        revisione: scadenzaRevisione || undefined,
        tagliando: scadenzaTagliando || undefined,
        assicurazione: scadenzaAssicurazione || undefined,
        bollo: scadenzaBollo || undefined,
      } : null;
      const { error: vErr } = await insertTolerant('veicoli', {
        cliente_id: cliente.id,
        marca: marca.trim() || 'N/D',
        modello: modello.trim() || 'N/D',
        targa: targa.trim().toUpperCase(),
        anno: parseInt(anno) || new Date().getFullYear(),
        km: parseInt(km) || 0,
        carburante,
        telaio: [telaio.trim(), dettagli].filter(Boolean).join(' | ') || null,
        scadenze,
      }, ['cliente_id', 'targa']);
      if (vErr) {
        setSaving(false);
        setSaveError('Cliente salvato, ma il veicolo non e stato registrato: ' + vErr.message);
        return;
      }
    }

    setSaving(false);
    onSaved(cliente);
  };

  const BackBtn = () => (
    <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );

  const SectionTitle = ({ icon, title }: { icon: string; title: string }) => (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-lg">{icon}</span>
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );

  return (
    <div className="p-4 space-y-3 pb-8">
      <div className="flex items-center gap-3">
        <BackBtn />
        <h2 className="text-lg font-bold text-gray-900">Nuovo cliente</h2>
      </div>

      {/* ---- Dati cliente ---- */}
      <SectionTitle icon="👤" title="Dati cliente" />

      <Input
        label="Nome e cognome *"
        value={nome}
        onChange={(e) => { setNome(e.target.value); if (errNome) setErrNome(null); }}
        error={errNome || undefined}
        placeholder="Es: Mario Rossi"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Telefono"
          type="tel"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="+39 333 1234567"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mario@email.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Codice Fiscale"
          value={codiceFiscale}
          onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
          placeholder="RSSMRA80A01H501Z"
        />
        <Input
          label="Indirizzo"
          value={indirizzo}
          onChange={(e) => setIndirizzo(e.target.value)}
          placeholder="Via Roma 1, Milano"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Note cliente</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note aggiuntive..."
          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
        />
      </div>

      {/* ---- Dati veicolo ---- */}
      <SectionTitle icon="🚗" title="Veicolo (opzionale)" />

      <Input
        label="Targa"
        value={targa}
        onChange={(e) => setTarga(e.target.value.toUpperCase())}
        placeholder="AB123CD"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Marca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Fiat"
        />
        <Input
          label="Modello"
          value={modello}
          onChange={(e) => setModello(e.target.value)}
          placeholder="Panda"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Anno"
          type="number"
          value={anno}
          onChange={(e) => setAnno(e.target.value)}
          min="1980"
          max={new Date().getFullYear().toString()}
        />
        <Input
          label="Chilometri"
          type="number"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="50000"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Cilindrata (cc)"
          value={cilindrata}
          onChange={(e) => setCilindrata(e.target.value)}
          placeholder="1200"
        />
        <Input
          label="Colore"
          value={colore}
          onChange={(e) => setColore(e.target.value)}
          placeholder="Rosso"
        />
      </div>

      <Input
        label="Numero telaio (VIN)"
        value={telaio}
        onChange={(e) => setTelaio(e.target.value.toUpperCase())}
        placeholder="ZFA31200002345678"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Carburante</label>
        <div className="grid grid-cols-3 gap-1.5">
          {carburanti.map((c) => (
            <button
              key={c}
              onClick={() => setCarburante(c)}
              className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                carburante === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Scadenze veicolo ---- */}
      <SectionTitle icon="📅" title="Scadenze" />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Scadenza revisione"
          type="date"
          value={scadenzaRevisione}
          onChange={(e) => setScadenzaRevisione(e.target.value)}
        />
        <Input
          label="Scadenza tagliando"
          type="date"
          value={scadenzaTagliando}
          onChange={(e) => setScadenzaTagliando(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Scadenza assicurazione"
          type="date"
          value={scadenzaAssicurazione}
          onChange={(e) => setScadenzaAssicurazione(e.target.value)}
        />
        <Input
          label="Scadenza bollo"
          type="date"
          value={scadenzaBollo}
          onChange={(e) => setScadenzaBollo(e.target.value)}
        />
      </div>

      {saveError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          ⚠️ {saveError}
        </div>
      )}

      <Button fullWidth onClick={submit} loading={saving} disabled={!nome.trim()}>
        Salva cliente{targa.trim() ? ' e veicolo' : ''}
      </Button>
    </div>
  );
}

// ==================== CLIENTE DETAIL ====================
function ClienteDetail({ cliente, onBack, onAddVeicolo, onDeleted, onSelectVeicolo }: {
  cliente: Cliente;
  onBack: () => void;
  onAddVeicolo: () => void;
  onDeleted: () => void;
  onSelectVeicolo: (v: Veicolo) => void;
}) {
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editScadenzeId, setEditScadenzeId] = useState<string | null>(null);
  const [editRevisione, setEditRevisione] = useState('');
  const [editTagliando, setEditTagliando] = useState('');
  const [editAssicurazione, setEditAssicurazione] = useState('');
  const [editBollo, setEditBollo] = useState('');
  const [savingScadenze, setSavingScadenze] = useState(false);

  const apriScadenze = (v: Veicolo) => {
    setEditScadenzeId(v.id);
    setEditRevisione(v.scadenze?.revisione || '');
    setEditTagliando(v.scadenze?.tagliando || '');
    setEditAssicurazione(v.scadenze?.assicurazione || '');
    setEditBollo(v.scadenze?.bollo || '');
  };

  const salvaScadenze = async (v: Veicolo) => {
    setSavingScadenze(true);
    const scadenze = {
      revisione: editRevisione || undefined,
      tagliando: editTagliando || undefined,
      assicurazione: editAssicurazione || undefined,
      bollo: editBollo || undefined,
    };
    const { error } = await supabase.from('veicoli').update({ scadenze }).eq('id', v.id);
    setSavingScadenze(false);
    if (!error) {
      setVeicoli((prev) => prev.map((x) => (x.id === v.id ? { ...x, scadenze } : x)));
      setEditScadenzeId(null);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('veicoli')
        .select('*')
        .eq('cliente_id', cliente.id);
      setVeicoli(data || []);
      setLoading(false);
    };
    fetch();
  }, [cliente.id]);

  // Non cancella davvero: appuntamenti_cliente_id_fkey e
  // recensioni_cliente_id_fkey non hanno CASCADE, quindi quasi ogni
  // cliente con storico verrebbe rifiutato dal database, e cancellare
  // in cascata perderebbe comunque tutto quello storico. "Elimina"
  // archivia il cliente (nascosto dalla lista, ripristinabile da
  // "Clienti archiviati").
  const handleDelete = async () => {
    if (!confirm(`Archiviare il cliente "${cliente.nome}"? Non sarà più visibile in elenco, ma potrai ripristinarlo in qualsiasi momento da "Clienti archiviati".`)) return;
    const { error } = await supabase.from('clienti').update({ attivo: false }).eq('id', cliente.id);
    if (error) { alert('Errore archiviazione: ' + error.message); return; }
    onDeleted();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">{cliente.nome}</h2>
      </div>

      {/* Contact info */}
      <Card className="!p-4">
        <div className="space-y-2">
          {cliente.email && (
            <div className="flex items-center gap-3">
              <span className="text-sm">✉️</span>
              <a href={`mailto:${cliente.email}`} className="text-sm text-blue-600 hover:underline">{cliente.email}</a>
            </div>
          )}
          {cliente.tel && (
            <div className="flex items-center gap-3">
              <span className="text-sm">📞</span>
              <a href={`tel:${cliente.tel}`} className="text-sm text-blue-600 hover:underline">{cliente.tel}</a>
            </div>
          )}
          {cliente.note && (
            <div className="flex items-center gap-3">
              <span className="text-sm">📝</span>
              <span className="text-sm text-gray-600">{cliente.note}</span>
            </div>
          )}
          {!cliente.email && !cliente.tel && (
            <div className="text-xs text-gray-400">Nessun contatto registrato</div>
          )}
        </div>
      </Card>

      {/* Veicoli */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Veicoli ({veicoli.length})</h3>
        <Button variant="secondary" onClick={onAddVeicolo}>+ Aggiungi veicolo</Button>
      </div>

      {loading ? (
        <Loader text="Caricamento veicoli..." />
      ) : veicoli.length === 0 ? (
        <Card className="!p-4 text-center">
          <div className="text-3xl mb-2">🚗</div>
          <div className="text-sm text-gray-500">Nessun veicolo registrato</div>
          <Button variant="secondary" className="mt-3" onClick={onAddVeicolo}>
            Aggiungi il primo veicolo
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {veicoli.map((v) => {
            const revisione = statoScadenza(v.scadenze?.revisione);
            const tagliando = statoScadenza(v.scadenze?.tagliando);
            const assicurazione = statoScadenza(v.scadenze?.assicurazione);
            const bollo = statoScadenza(v.scadenze?.bollo);
            return (
              <Card key={v.id} className="!p-3">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectVeicolo(v)}>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">🚗</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{v.marca} {v.modello}</div>
                    <div className="text-xs text-gray-500">
                      <span className="font-mono font-semibold">{v.targa}</span> · {v.anno} · {v.km?.toLocaleString()} km · {v.carburante}
                    </div>
                    <div className="text-[10px] text-blue-500 mt-0.5">Tocca per vedere lo storico lavorazioni →</div>
                  </div>
                </div>
                {(revisione || tagliando || assicurazione || bollo) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {revisione && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: revisione.color, backgroundColor: revisione.bg }}>Revisione: {revisione.label}</span>}
                    {tagliando && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: tagliando.color, backgroundColor: tagliando.bg }}>Tagliando: {tagliando.label}</span>}
                    {assicurazione && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: assicurazione.color, backgroundColor: assicurazione.bg }}>Assicurazione: {assicurazione.label}</span>}
                    {bollo && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: bollo.color, backgroundColor: bollo.bg }}>Bollo: {bollo.label}</span>}
                  </div>
                )}
                {editScadenzeId === v.id ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Revisione" type="date" value={editRevisione} onChange={(e) => setEditRevisione(e.target.value)} />
                      <Input label="Tagliando" type="date" value={editTagliando} onChange={(e) => setEditTagliando(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Assicurazione" type="date" value={editAssicurazione} onChange={(e) => setEditAssicurazione(e.target.value)} />
                      <Input label="Bollo" type="date" value={editBollo} onChange={(e) => setEditBollo(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => salvaScadenze(v)} loading={savingScadenze}>Salva</Button>
                      <Button variant="secondary" onClick={() => setEditScadenzeId(null)}>Annulla</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => apriScadenze(v)}
                    className="text-[11px] text-blue-600 font-semibold hover:text-blue-800 cursor-pointer mt-2"
                  >
                    📅 Modifica scadenze
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete (in realta' archivia: vedi handleDelete) */}
      <Button variant="danger" fullWidth onClick={handleDelete}>
        🗄️ Archivia cliente
      </Button>
    </div>
  );
}

// ==================== ADD VEICOLO FORM ====================
function AddVeicoloForm({ clienteId, onBack, onSaved }: {
  clienteId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [marca, setMarca] = useState('');
  const [modello, setModello] = useState('');
  const [targa, setTarga] = useState('');
  const [anno, setAnno] = useState(new Date().getFullYear().toString());
  const [km, setKm] = useState('');
  const [carburante, setCarburante] = useState('benzina');
  const [scadenzaRevisione, setScadenzaRevisione] = useState('');
  const [scadenzaTagliando, setScadenzaTagliando] = useState('');
  const [scadenzaAssicurazione, setScadenzaAssicurazione] = useState('');
  const [scadenzaBollo, setScadenzaBollo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errTarga, setErrTarga] = useState<string | null>(null);

  const carburanti = ['benzina', 'diesel', 'gpl', 'metano', 'ibrido', 'elettrico'];

  const submit = async () => {
    if (!targa.trim()) { setErrTarga('La targa è obbligatoria'); return; }

    setSaving(true);
    const scadenze = (scadenzaRevisione || scadenzaTagliando || scadenzaAssicurazione || scadenzaBollo) ? {
      revisione: scadenzaRevisione || undefined,
      tagliando: scadenzaTagliando || undefined,
      assicurazione: scadenzaAssicurazione || undefined,
      bollo: scadenzaBollo || undefined,
    } : null;
    const { error } = await insertTolerant('veicoli', {
        cliente_id: clienteId,
        marca: marca.trim() || 'N/D',
        modello: modello.trim() || 'N/D',
        targa: targa.trim().toUpperCase(),
        anno: parseInt(anno) || new Date().getFullYear(),
        km: parseInt(km) || 0,
        carburante,
        scadenze,
      }, ['cliente_id', 'targa']);

    setSaving(false);
    if (!error) onSaved();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">Nuovo veicolo</h2>
      </div>

      <Input
        label="Targa *"
        value={targa}
        onChange={(e) => { setTarga(e.target.value); if (errTarga) setErrTarga(null); }}
        error={errTarga || undefined}
        placeholder="AA000BB"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Marca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Fiat"
        />
        <Input
          label="Modello"
          value={modello}
          onChange={(e) => setModello(e.target.value)}
          placeholder="Panda"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Anno"
          type="number"
          value={anno}
          onChange={(e) => setAnno(e.target.value)}
          min="1980"
          max={new Date().getFullYear().toString()}
        />
        <Input
          label="Km"
          type="number"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="50000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Carburante</label>
        <div className="grid grid-cols-3 gap-1.5">
          {carburanti.map((c) => (
            <button
              key={c}
              onClick={() => setCarburante(c)}
              className={`py-2 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                carburante === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scadenze</label>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Revisione" type="date" value={scadenzaRevisione} onChange={(e) => setScadenzaRevisione(e.target.value)} />
          <Input label="Tagliando" type="date" value={scadenzaTagliando} onChange={(e) => setScadenzaTagliando(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Input label="Assicurazione" type="date" value={scadenzaAssicurazione} onChange={(e) => setScadenzaAssicurazione(e.target.value)} />
          <Input label="Bollo" type="date" value={scadenzaBollo} onChange={(e) => setScadenzaBollo(e.target.value)} />
        </div>
      </div>

      <Button fullWidth onClick={submit} loading={saving} disabled={!targa.trim()}>
        Salva veicolo
      </Button>
    </div>
  );
}

// StoricoVeicolo is now imported from ./StoricoVeicolo.tsx
