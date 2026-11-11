import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, Loader } from '@/components/ui';

interface OfficinaRiga {
  id: string;
  nome: string;
  email: string | null;
  tel: string | null;
  comune: string | null;
  provincia: string | null;
  created_at: string;
}

interface AbbonamentoRiga {
  officina_id: string;
  piano: string;
  stato: 'trial' | 'attivo' | 'scaduto';
  data_inizio: string;
  data_fine: string;
}

function formatData(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statoBadge(stato?: string) {
  switch (stato) {
    case 'attivo':
      return { label: 'Attivo (paga)', color: '#065f46', bg: '#d1fae5' };
    case 'trial':
      return { label: 'In prova', color: '#92400e', bg: '#fef3c7' };
    case 'scaduto':
      return { label: 'Scaduto', color: '#991b1b', bg: '#fee2e2' };
    default:
      return { label: 'Nessun abbonamento', color: '#374151', bg: '#f3f4f6' };
  }
}

function giorniRimasti(dataFine?: string): number | null {
  if (!dataFine) return null;
  const ms = new Date(dataFine).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function AdminPage() {
  const [officine, setOfficine] = useState<OfficinaRiga[]>([]);
  const [abbonamenti, setAbbonamenti] = useState<Record<string, AbbonamentoRiga>>({});
  const [loading, setLoading] = useState(true);
  const [ricerca, setRicerca] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const [{ data: off }, { data: abb }] = await Promise.all([
        supabase
          .from('officine')
          .select('id, nome, email, tel, comune, provincia, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('abbonamenti').select('officina_id, piano, stato, data_inizio, data_fine'),
      ]);

      setOfficine((off as OfficinaRiga[]) || []);
      const mappa: Record<string, AbbonamentoRiga> = {};
      ((abb as AbbonamentoRiga[]) || []).forEach((a) => { mappa[a.officina_id] = a; });
      setAbbonamenti(mappa);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[300px]">
        <Loader size="lg" text="Caricamento officine..." />
      </div>
    );
  }

  const filtrate = officine.filter((o) => {
    const s = ricerca.trim().toLowerCase();
    if (!s) return true;
    return (
      o.nome.toLowerCase().includes(s) ||
      (o.email || '').toLowerCase().includes(s) ||
      (o.comune || '').toLowerCase().includes(s)
    );
  });

  const inProva = officine.filter((o) => abbonamenti[o.id]?.stato === 'trial').length;
  const paganti = officine.filter((o) => abbonamenti[o.id]?.stato === 'attivo').length;

  return (
    <div className="p-4 space-y-5 pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">🔒 Pannello amministratore</h2>
        <p className="text-sm text-gray-500 mt-0.5">Tutte le officine registrate su OfficinAI — visibile solo a te.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-gray-900">{officine.length}</div>
          <div className="text-xs text-gray-500">Officine totali</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-amber-600">{inProva}</div>
          <div className="text-xs text-gray-500">In prova</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-extrabold text-emerald-600">{paganti}</div>
          <div className="text-xs text-gray-500">Paganti</div>
        </Card>
      </div>

      <input
        type="text"
        value={ricerca}
        onChange={(e) => setRicerca(e.target.value)}
        placeholder="Cerca per nome, email o città..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />

      <div className="space-y-3">
        {filtrate.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">Nessuna officina trovata.</div>
        ) : (
          filtrate.map((o) => {
            const abb = abbonamenti[o.id];
            const badge = statoBadge(abb?.stato);
            const giorni = abb?.stato === 'trial' ? giorniRimasti(abb.data_fine) : null;
            return (
              <Card key={o.id} className="!p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-bold text-gray-900">{o.nome}</div>
                    <div className="text-xs text-gray-500">{o.comune ? `${o.comune} (${o.provincia || ''})` : 'Città non indicata'}</div>
                  </div>
                  <Badge color={badge.color} bg={badge.bg}>{badge.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {o.email && <a href={`mailto:${o.email}`} className="hover:text-blue-600">{o.email}</a>}
                  {o.tel && <a href={`tel:${o.tel}`} className="hover:text-blue-600">{o.tel}</a>}
                  <span>Registrata il {formatData(o.created_at)}</span>
                  {abb && <span>Piano: {abb.piano}</span>}
                  {giorni !== null && (
                    <span className={giorni <= 7 ? 'text-amber-600 font-semibold' : ''}>
                      {giorni >= 0 ? `${giorni} giorni di prova rimasti` : 'Prova scaduta'}
                    </span>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
