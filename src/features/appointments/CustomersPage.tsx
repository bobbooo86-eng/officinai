import { useEffect, useState } from 'react';
import { Card, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Cliente } from '@/types/database';

export function CustomersPage() {
  const { officina } = useAuthStore();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!officina) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('clienti')
        .select('*')
        .eq('officina_id', officina.id)
        .order('nome');
      setClienti(data || []);
      setLoading(false);
    };
    fetch();
  }, [officina]);

  if (loading) return <Loader text="Caricamento clienti..." />;

  const filtered = clienti.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Clienti</h2>

      <input
        type="text"
        placeholder="Cerca cliente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="space-y-2">
        {filtered.map((c) => (
          <Card key={c.id} className="!p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900">{c.nome}</div>
                <div className="text-xs text-gray-400">{c.email}</div>
              </div>
              <div className="flex gap-2">
                {c.tel && (
                  <a
                    href={`tel:${c.tel}`}
                    className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm hover:bg-emerald-200 transition-colors"
                  >
                    📞
                  </a>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm hover:bg-blue-200 transition-colors"
                  >
                    ✉️
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
