import { useEffect, useState } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Magazzino } from '@/types/database';

export function InventoryPage() {
  const { officina } = useAuthStore();
  const [items, setItems] = useState<Magazzino[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!officina) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('magazzino')
        .select('*')
        .eq('officina_id', officina.id)
        .order('nome');
      setItems(data || []);
      setLoading(false);
    };
    fetch();
  }, [officina]);

  if (loading) return <Loader text="Caricamento magazzino..." />;

  const filtered = items.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.codice?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Magazzino</h2>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca articolo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Items */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const lowStock = item.quantita <= item.quantita_minima;
          return (
            <Card key={item.id} className="!p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{item.nome}</div>
                  <div className="text-xs text-gray-400">
                    {item.codice} {item.categoria && `• ${item.categoria}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Badge
                      color={lowStock ? '#991b1b' : '#065f46'}
                      bg={lowStock ? '#fee2e2' : '#d1fae5'}
                    >
                      {lowStock ? '⚠️' : ''} {item.quantita} pz
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Acq: {fmtEuro(item.prezzo_acq)} • Vend: {fmtEuro(item.prezzo_vend)}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
