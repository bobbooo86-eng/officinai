import { useEffect, useState } from 'react';
import { Card, Loader, Button, Input, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Cliente, Veicolo } from '@/types/database';

type View = 'list' | 'add' | 'detail' | 'addVeicolo';

export function CustomersPage() {
  const { officina } = useAuthStore();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const fetchClienti = async () => {
    if (!officina) return;
    const { data } = await supabase
      .from('clienti')
      .select('*')
      .eq('officina_id', officina.id)
      .order('nome');
    setClienti(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClienti(); }, [officina]);

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
          setClienti((prev) => prev.filter((c) => c.id !== selectedCliente.id));
          setSelectedCliente(null);
          setView('list');
        }}
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

  const filtered = clienti.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.tel?.includes(search)
  );

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Clienti ({clienti.length})</h2>
        <Button onClick={() => setView('add')}>+ Nuovo cliente</Button>
      </div>

      <input
        type="text"
        placeholder="Cerca per nome, email o telefono..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {search ? 'Nessun cliente trovato' : 'Nessun cliente registrato'}
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
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
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
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errNome, setErrNome] = useState<string | null>(null);

  const submit = async () => {
    if (!nome.trim()) { setErrNome('Il nome è obbligatorio'); return; }
    if (!officina) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('clienti')
      .insert({
        officina_id: officina.id,
        nome: nome.trim(),
        email: email.trim() || null,
        tel: tel.trim() || null,
        note: note.trim() || null,
      })
      .select()
      .single();

    setSaving(false);
    if (data && !error) onSaved(data);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">Nuovo cliente</h2>
      </div>

      <Input
        label="Nome e cognome *"
        value={nome}
        onChange={(e) => { setNome(e.target.value); if (errNome) setErrNome(null); }}
        error={errNome || undefined}
        placeholder="Es: Mario Rossi"
      />

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="mario.rossi@email.com"
      />

      <Input
        label="Telefono"
        type="tel"
        value={tel}
        onChange={(e) => setTel(e.target.value)}
        placeholder="+39 333 1234567"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note aggiuntive sul cliente..."
          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      <Button fullWidth onClick={submit} loading={saving} disabled={!nome.trim()}>
        Salva cliente
      </Button>
    </div>
  );
}

// ==================== CLIENTE DETAIL ====================
function ClienteDetail({ cliente, onBack, onAddVeicolo, onDeleted }: {
  cliente: Cliente;
  onBack: () => void;
  onAddVeicolo: () => void;
  onDeleted: () => void;
}) {
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async () => {
    if (!confirm(`Eliminare il cliente "${cliente.nome}"?`)) return;
    await supabase.from('clienti').delete().eq('id', cliente.id);
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
          {veicoli.map((v) => (
            <Card key={v.id} className="!p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl">🚗</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">{v.marca} {v.modello}</div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono font-semibold">{v.targa}</span> · {v.anno} · {v.km?.toLocaleString()} km · {v.carburante}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete */}
      <Button variant="danger" fullWidth onClick={handleDelete}>
        Elimina cliente
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
  const [saving, setSaving] = useState(false);
  const [errTarga, setErrTarga] = useState<string | null>(null);

  const carburanti = ['benzina', 'diesel', 'gpl', 'metano', 'ibrido', 'elettrico'];

  const submit = async () => {
    if (!targa.trim()) { setErrTarga('La targa è obbligatoria'); return; }

    setSaving(true);
    const { error } = await supabase
      .from('veicoli')
      .insert({
        cliente_id: clienteId,
        marca: marca.trim() || 'N/D',
        modello: modello.trim() || 'N/D',
        targa: targa.trim().toUpperCase(),
        anno: parseInt(anno) || new Date().getFullYear(),
        km: parseInt(km) || 0,
        carburante,
      });

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

      <Button fullWidth onClick={submit} loading={saving} disabled={!targa.trim()}>
        Salva veicolo
      </Button>
    </div>
  );
}
