import { useEffect, useState } from 'react';
import { Card, Badge, Button, Loader, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { insertTolerant, updateTolerant, isMissingTable } from '@/lib/resilientDb';
import { fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Magazzino } from '@/types/database';

const CATEGORIE = [
  'Filtri', 'Olio', 'Freni', 'Sospensioni', 'Cinghie', 'Batterie',
  'Candele', 'Pneumatici', 'Elettronica', 'Carrozzeria', 'Altro',
];

const emptyItem: Partial<Magazzino> = {
  nome: '', codice: '', categoria: 'Altro',
  quantita: 0, quantita_minima: 2,
  prezzo_acq: 0, prezzo_vend: 0,
};

export function InventoryPage({ resetSignal }: { resetSignal?: number } = {}) {
  const { officina } = useAuthStore();
  const [items, setItems] = useState<Magazzino[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Magazzino>>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchItems = async () => {
    // Anche senza officina il loader va spento, altrimenti resta bloccato.
    if (!officina) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('magazzino')
      .select('*')
      .eq('officina_id', officina.id)
      .order('nome');
    // Un errore di lettura mostrato come "Magazzino vuoto" invita a
    // reinserire articoli che in realta' esistono gia'.
    setLoadError(error ? 'Errore nel caricamento del magazzino: ' + error.message : '');
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [officina]);

  // Cliccare di nuovo sul tab Magazzino mentre e' gia' attivo chiude il
  // modulo di modifica/aggiunta invece di lasciarlo a meta'.
  useEffect(() => {
    if (resetSignal === undefined) return;
    setShowForm(false);
    setEditItem(emptyItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const saveItem = async () => {
    if (!officina || !editItem.nome?.trim()) return;
    setSaving(true);
    setFormError('');
    const campi = {
      nome: editItem.nome, codice: editItem.codice || '',
      categoria: editItem.categoria || 'Altro',
      quantita: editItem.quantita || 0,
      quantita_minima: editItem.quantita_minima || 0,
      prezzo_acq: editItem.prezzo_acq || 0,
      prezzo_vend: editItem.prezzo_vend || 0,
    };

    const { error, skipped } = editItem.id
      ? await updateTolerant('magazzino', campi, { column: 'id', value: editItem.id }, ['nome'])
      : await insertTolerant('magazzino', { officina_id: officina.id, ...campi }, ['nome', 'officina_id']);

    if (error) {
      setFormError(
        isMissingTable(error)
          ? 'La tabella magazzino non esiste ancora nel database. Applica le migrazioni Supabase.'
          : (editItem.id ? 'Errore aggiornamento: ' : 'Errore salvataggio: ') + error.message
      );
    } else {
      showToast(
        skipped.length > 0
          ? `Articolo salvato (campi non supportati dal database: ${skipped.join(', ')})`
          : editItem.id ? 'Articolo aggiornato' : 'Articolo aggiunto'
      );
      setShowForm(false);
      setEditItem(emptyItem);
      fetchItems();
    }
    setSaving(false);
  };

  const deleteItem = async (id: string, nome: string) => {
    if (!confirm(`Eliminare "${nome}" dal magazzino?`)) return;
    const { error } = await supabase.from('magazzino').delete().eq('id', id);
    if (error) {
      setLoadError('Articolo non eliminato: ' + error.message);
      return;
    }
    setItems((prev) => prev.filter(i => i.id !== id));
    showToast('Articolo eliminato');
  };

  const adjustQty = async (id: string, delta: number) => {
    // Aggiorna partendo dallo stato corrente, non da quello catturato alla
    // creazione dell'handler: con clic rapidi gli incrementi si perdevano.
    let nuovaQta: number | null = null;
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      nuovaQta = Math.max(0, i.quantita + delta);
      return { ...i, quantita: nuovaQta };
    }));
    if (nuovaQta === null) return;
    const { error } = await supabase.from('magazzino').update({ quantita: nuovaQta }).eq('id', id);
    if (error) {
      setLoadError('Quantita non aggiornata: ' + error.message);
      // Riallinea con il database invece di lasciare a schermo un valore falso.
      fetchItems();
    }
  };

  if (loading) return <Loader text="Caricamento magazzino..." />;

  const filtered = items.filter((m) => {
    const matchSearch = m.nome.toLowerCase().includes(search.toLowerCase()) ||
      m.codice?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || m.categoria === catFilter;
    return matchSearch && matchCat;
  });

  const lowStockCount = items.filter(i => i.quantita <= i.quantita_minima).length;
  const totalValue = items.reduce((sum, i) => sum + ((i.quantita || 0) * (i.prezzo_acq || 0)), 0);
  const categories = [...new Set(items.map(i => i.categoria).filter(Boolean))];

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Magazzino</h2>
        <Button size="sm" onClick={() => { setEditItem(emptyItem); setShowForm(true); }}>
          + Nuovo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="!p-2 text-center">
          <div className="text-lg font-bold text-gray-900">{items.length}</div>
          <div className="text-[10px] text-gray-500">Articoli</div>
        </Card>
        <Card className="!p-2 text-center">
          <div className={`text-lg font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {lowStockCount}
          </div>
          <div className="text-[10px] text-gray-500">Sotto scorta</div>
        </Card>
        <Card className="!p-2 text-center">
          <div className="text-lg font-bold text-blue-700">{fmtEuro(totalValue)}</div>
          <div className="text-[10px] text-gray-500">Valore stock</div>
        </Card>
      </div>

      {/* Search + category filter */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Cerca articolo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-2 py-2 rounded-xl border border-gray-300 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tutte</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="!p-4 border-blue-200 bg-blue-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {editItem.id ? 'Modifica articolo' : 'Nuovo articolo'}
          </h3>
          <div className="space-y-2">
            <Input
              label="Nome articolo *"
              value={editItem.nome || ''}
              onChange={(e) => setEditItem({ ...editItem, nome: e.target.value })}
              placeholder="es. Filtro olio BMW"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Codice"
                value={editItem.codice || ''}
                onChange={(e) => setEditItem({ ...editItem, codice: e.target.value })}
                placeholder="es. FO-1234"
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={editItem.categoria || 'Altro'}
                  onChange={(e) => setEditItem({ ...editItem, categoria: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Quantita"
                type="number"
                value={editItem.quantita?.toString() || '0'}
                onChange={(e) => setEditItem({ ...editItem, quantita: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Scorta minima"
                type="number"
                value={editItem.quantita_minima?.toString() || '0'}
                onChange={(e) => setEditItem({ ...editItem, quantita_minima: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Prezzo acquisto"
                type="number"
                step="0.01"
                value={editItem.prezzo_acq?.toString() || '0'}
                onChange={(e) => setEditItem({ ...editItem, prezzo_acq: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Prezzo vendita"
                type="number"
                step="0.01"
                value={editItem.prezzo_vend?.toString() || '0'}
                onChange={(e) => setEditItem({ ...editItem, prezzo_vend: parseFloat(e.target.value) || 0 })}
              />
            </div>
            {formError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                ⚠️ {formError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={saveItem} disabled={saving || !editItem.nome?.trim()} fullWidth>
                {saving ? 'Salvataggio...' : editItem.id ? 'Aggiorna' : 'Aggiungi'}
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditItem(emptyItem); setFormError(''); }} fullWidth>
                Annulla
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loadError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          ⚠️ {loadError}
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {loadError
              ? 'Impossibile leggere il magazzino.'
              : search || catFilter ? 'Nessun risultato' : 'Magazzino vuoto — aggiungi il primo articolo'}
          </div>
        ) : (
          filtered.map((item) => {
            const lowStock = item.quantita <= item.quantita_minima;
            return (
              <Card key={item.id} className={`!p-3 ${lowStock ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => { setEditItem(item); setShowForm(true); }}
                  >
                    <div className="font-medium text-sm text-gray-900">{item.nome}</div>
                    <div className="text-xs text-gray-400">
                      {item.codice && <span className="font-mono">{item.codice}</span>}
                      {item.codice && item.categoria && ' • '}
                      {item.categoria}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Acq: {fmtEuro(item.prezzo_acq)} • Vend: {fmtEuro(item.prezzo_vend)}
                      {item.quantita > 0 && (
                        <span className="text-gray-300"> • Stock: {fmtEuro((item.quantita || 0) * (item.prezzo_acq || 0))}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      color={lowStock ? '#991b1b' : '#065f46'}
                      bg={lowStock ? '#fee2e2' : '#d1fae5'}
                    >
                      {lowStock ? '⚠️ ' : ''}{item.quantita} pz
                    </Badge>
                    {/* Quick qty adjust */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 flex items-center justify-center cursor-pointer"
                      >
                        −
                      </button>
                      <button
                        onClick={() => adjustQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        onClick={() => deleteItem(item.id, item.nome)}
                        className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-xs text-red-500 flex items-center justify-center cursor-pointer ml-1"
                        title="Elimina"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
