import { useEffect, useState, useMemo } from 'react';
import { Card, Badge, Loader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro } from '@/lib/format';
import { STATO_CONFIG } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento, Preventivo } from '@/types/database';

export function AnalyticsPage() {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [preventivi, setPreventivi] = useState<Preventivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | 'anno'>('30d');

  useEffect(() => {
    if (!officina) return;
    const fetch = async () => {
      const [{ data: apps }, { data: prev }] = await Promise.all([
        supabase
          .from('appuntamenti')
          .select('*')
          .eq('officina_id', officina.id)
          .order('data_ora', { ascending: false }),
        supabase
          .from('preventivi')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);
      setAppuntamenti(apps || []);
      setPreventivi(prev || []);
      setLoading(false);
    };
    fetch();
  }, [officina]);

  const stats = useMemo(() => {
    const now = new Date();
    const days = periodo === '7d' ? 7 : periodo === '30d' ? 30 : periodo === '90d' ? 90 : 365;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const appsInPeriod = appuntamenti.filter((a) => a.data_ora >= cutoff);
    const prevInPeriod = preventivi.filter((p) => (p.created_at || '') >= cutoff);

    const totalePreventivi = prevInPeriod.reduce((s, p) => s + (p.totale || 0), 0);
    const prevAccettati = prevInPeriod.filter((p) => p.stato === 'accettato');
    const totaleAccettati = prevAccettati.reduce((s, p) => s + (p.totale || 0), 0);
    const tassoAccettazione = prevInPeriod.length > 0
      ? (prevAccettati.length / prevInPeriod.length) * 100
      : 0;

    // Status distribution
    const statusDist: Record<string, number> = {};
    appsInPeriod.forEach((a) => {
      statusDist[a.stato] = (statusDist[a.stato] || 0) + 1;
    });

    // Daily appointments for sparkline
    const dailyApps: Record<string, number> = {};
    for (let i = 0; i < Math.min(days, 30); i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyApps[key] = 0;
    }
    appsInPeriod.forEach((a) => {
      const key = a.data_ora?.slice(0, 10);
      if (key && dailyApps[key] !== undefined) {
        dailyApps[key]++;
      }
    });

    const dailyValues = Object.values(dailyApps).reverse();
    const maxDaily = Math.max(...dailyValues, 1);

    return {
      totaleAppuntamenti: appsInPeriod.length,
      completati: appsInPeriod.filter((a) => a.stato === 'pronto').length,
      inCorso: appsInPeriod.filter((a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi').length,
      totalePreventivi,
      totaleAccettati,
      numPreventivi: prevInPeriod.length,
      numAccettati: prevAccettati.length,
      tassoAccettazione,
      statusDist,
      dailyValues,
      maxDaily,
      mediaGiornaliera: appsInPeriod.length / days,
    };
  }, [appuntamenti, preventivi, periodo]);

  if (loading) return <Loader text="Caricamento analytics..." />;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(['7d', '30d', '90d', 'anno'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer ${
                periodo === p ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {p === '7d' ? '7G' : p === '30d' ? '30G' : p === '90d' ? '90G' : 'Anno'}
            </button>
          ))}
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totaleAppuntamenti}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Appuntamenti</div>
        </Card>
        <Card className="!p-4 text-center">
          <div className="text-3xl font-bold text-emerald-600">{fmtEuro(stats.totaleAccettati)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Fatturato preventivi</div>
        </Card>
      </div>

      {/* Revenue card */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">FATTURATO PREVENTIVI</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">{stats.numPreventivi}</div>
            <div className="text-[10px] text-gray-400">Emessi</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-600">{stats.numAccettati}</div>
            <div className="text-[10px] text-gray-400">Accettati</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.tassoAccettazione.toFixed(0)}%</div>
            <div className="text-[10px] text-gray-400">Conversione</div>
          </div>
        </div>
        {/* Conversion bar */}
        <div className="mt-3 w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${stats.tassoAccettazione}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>Tot. emesso: {fmtEuro(stats.totalePreventivi)}</span>
          <span>Tot. accettato: {fmtEuro(stats.totaleAccettati)}</span>
        </div>
      </Card>

      {/* Mini sparkline chart */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">APPUNTAMENTI GIORNALIERI</h3>
        <div className="flex items-end gap-[2px] h-16">
          {stats.dailyValues.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500 rounded-t-sm min-h-[2px] transition-all hover:bg-blue-600"
              style={{ height: `${(v / stats.maxDaily) * 100}%` }}
              title={`${v} appuntamenti`}
            />
          ))}
        </div>
        <div className="text-[10px] text-gray-400 mt-2">
          Media: {stats.mediaGiornaliera.toFixed(1)} appuntamenti/giorno
        </div>
      </Card>

      {/* Status distribution */}
      <Card className="!p-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3">DISTRIBUZIONE STATI</h3>
        <div className="space-y-2">
          {Object.entries(stats.statusDist).map(([stato, count]) => {
            const cfg = STATO_CONFIG[stato as keyof typeof STATO_CONFIG];
            if (!cfg) return null;
            const pct = stats.totaleAppuntamenti > 0 ? (count / stats.totaleAppuntamenti) * 100 : 0;
            return (
              <div key={stato}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700">{cfg.icon} {cfg.label}</span>
                  <span className="text-xs font-semibold text-gray-900">{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="!p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{stats.completati}</div>
          <div className="text-[10px] text-gray-400">Completati</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-xl font-bold text-amber-500">{stats.inCorso}</div>
          <div className="text-[10px] text-gray-400">In corso</div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-xl font-bold text-gray-600">
            {stats.totaleAppuntamenti > 0
              ? fmtEuro(stats.totaleAccettati / stats.totaleAppuntamenti)
              : '€0'
            }
          </div>
          <div className="text-[10px] text-gray-400">Media/app</div>
        </Card>
      </div>
    </div>
  );
}
