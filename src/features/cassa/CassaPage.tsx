import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { insertTolerant, isMissingTable } from '@/lib/resilientDb';
import { useAuthStore } from '@/stores/authStore';
import type { Movimento, MovimentoTipo, MetodoPagamento, Utente } from '@/types/database';

type CassaTab = 'tutti' | 'incasso_extra' | 'spesa_officina' | 'spesa_titolare' | 'dipendenti';

interface TipoConfig {
  id: MovimentoTipo;
  label: string;
  short: string;
  icon: string;
  color: string;
  bg: string;
  sign: 1 | -1; // 1=incasso 0.-1=spesa
}

const TIPI: TipoConfig[] = [
  { id: 'incasso_extra', label: 'Incasso extra', short: 'Incasso', icon: '💵', color: 'text-emerald-700', bg: 'bg-emerald-100', sign: 1 },
  { id: 'spesa_officina', label: 'Spesa officina', short: 'Spesa officina', icon: '🧾', color: 'text-red-700', bg: 'bg-red-100', sign: -1 },
  { id: 'spesa_titolare', label: 'Spesa titolare', short: 'Spesa titolare', icon: '👔', color: 'text-purple-700', bg: 'bg-purple-100', sign: -1 },
  { id: 'anticipo_dipendente', label: 'Anticipo dipendente', short: 'Anticipo', icon: '💶', color: 'text-amber-700', bg: 'bg-amber-100', sign: -1 },
  { id: 'spesa_dipendente', label: 'Spesa dipendente', short: 'Spesa dip.', icon: '👷', color: 'text-blue-700', bg: 'bg-blue-100', sign: -1 },
];

const METODI: { id: MetodoPagamento; label: string; icon: string }[] = [
  { id: 'contanti', label: 'Contanti', icon: '💵' },
  { id: 'carta', label: 'Carta', icon: '💳' },
  { id: 'bonifico', label: 'Bonifico', icon: '🏦' },
  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
  { id: 'assegno', label: 'Assegno', icon: '📝' },
  { id: 'altro', label: 'Altro', icon: '❓' },
];

const findTipo = (id: MovimentoTipo): TipoConfig =>
  TIPI.find((t) => t.id === id) || TIPI[0];

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

// Data odierna in ora locale: con toISOString(), tra le 00:00 e le 02:00
// italiane un nuovo movimento veniva datato al giorno precedente.
const todayISO = () => {
  const d = new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const monthKey = (d: string) => d.slice(0, 7);
const currentMonthKey = () => todayISO().slice(0, 7);

interface CassaPageProps {
  initialOpen?: MovimentoTipo | null;
  onOpenHandled?: () => void;
}

export function CassaPage({ initialOpen, onOpenHandled }: CassaPageProps) {
  const { officina, utente } = useAuthStore();
  const [tab, setTab] = useState<CassaTab>('tutti');
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [dipendenti, setDipendenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());

  // Nuovo movimento
  const [showForm, setShowForm] = useState(false);
  const [newTipo, setNewTipo] = useState<MovimentoTipo>('incasso_extra');
  const [newImporto, setNewImporto] = useState('');
  const [newDescrizione, setNewDescrizione] = useState('');
  const [newMetodo, setNewMetodo] = useState<MetodoPagamento>('contanti');
  const [newData, setNewData] = useState<string>(todayISO());
  const [newDipendenteId, setNewDipendenteId] = useState<string>('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const officinaId = officina?.id;

  const loadMovimenti = useCallback(async () => {
    if (!officinaId) return;
    setLoading(true);
    const { data, error: loadErr } = await supabase
      .from('movimenti')
      .select('*')
      .eq('officina_id', officinaId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    // Senza questo controllo un errore di lettura veniva mostrato come
    // "Nessun movimento", con saldo a zero per un mese che invece ne ha.
    setError(
      loadErr
        ? isMissingTable(loadErr)
          ? 'La tabella della cassa non esiste ancora nel database: applica le migrazioni Supabase e riprova.'
          : 'Errore nel caricamento dei movimenti: ' + loadErr.message
        : ''
    );
    setMovimenti((data as Movimento[]) || []);
    setLoading(false);
  }, [officinaId]);

  useEffect(() => {
    loadMovimenti();
    // Realtime
    if (!officinaId) return;
    const ch = supabase
      .channel('movimenti-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti', filter: `officina_id=eq.${officinaId}` }, () => {
        loadMovimenti();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [officinaId, loadMovimenti]);

  // Carica dipendenti (per select anticipo)
  useEffect(() => {
    if (!officinaId) return;
    const loadDip = async () => {
      const { data } = await supabase
        .from('utenti')
        .select('*')
        .eq('officina_id', officinaId)
        .eq('attivo', true)
        .order('nome');
      setDipendenti((data as Utente[]) || []);
    };
    loadDip();
  }, [officinaId]);

  // Apri modulo prefilled da FAB
  useEffect(() => {
    if (initialOpen) {
      setNewTipo(initialOpen);
      resetForm(initialOpen);
      setShowForm(true);
      onOpenHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpen]);

  const resetForm = (tipo: MovimentoTipo = newTipo) => {
    setNewTipo(tipo);
    setNewImporto('');
    setNewDescrizione('');
    setNewMetodo('contanti');
    setNewData(todayISO());
    setNewDipendenteId('');
    setNewNote('');
    setError('');
  };

  const salvaMovimento = async () => {
    if (!officinaId) return;
    const importo = parseFloat((newImporto || '').replace(',', '.'));
    if (!Number.isFinite(importo) || importo <= 0) { setError('Inserisci un importo valido'); return; }
    if (!newDescrizione.trim()) { setError('Inserisci una descrizione'); return; }
    if ((newTipo === 'anticipo_dipendente' || newTipo === 'spesa_dipendente') && !newDipendenteId) {
      setError('Seleziona il dipendente'); return;
    }
    setSaving(true);
    setError('');
    const { error: err, skipped } = await insertTolerant('movimenti', {
      officina_id: officinaId,
      tipo: newTipo,
      importo,
      descrizione: newDescrizione.trim(),
      metodo_pagamento: newMetodo,
      data: newData,
      dipendente_id: newDipendenteId || null,
      created_by: utente?.id || null,
      note: newNote.trim() || null,
    }, ['officina_id', 'tipo', 'importo']);
    setSaving(false);
    if (err) {
      setError(
        isMissingTable(err)
          ? 'La tabella della cassa non esiste ancora nel database: applica le migrazioni Supabase (supabase/migrations/013_fix_schema_drift.sql) e riprova.'
          : 'Errore: ' + err.message
      );
      return;
    }
    resetForm();
    setShowForm(false);
    showToast(
      skipped.length > 0
        ? `Movimento registrato (campi non supportati dal database: ${skipped.join(', ')})`
        : 'Movimento registrato'
    );
    loadMovimenti();
  };

  const eliminaMovimento = async (id: string) => {
    if (!confirm('Eliminare questo movimento?')) return;
    const { error: delErr } = await supabase.from('movimenti').delete().eq('id', id);
    if (delErr) {
      setError('Movimento non eliminato: ' + delErr.message);
      return;
    }
    setMovimenti((prev) => prev.filter((m) => m.id !== id));
    showToast('Movimento eliminato');
  };

  const filteredByTab = useMemo(() => {
    if (tab === 'tutti') return movimenti;
    if (tab === 'dipendenti') {
      return movimenti.filter((m) => m.tipo === 'anticipo_dipendente' || m.tipo === 'spesa_dipendente');
    }
    return movimenti.filter((m) => m.tipo === tab);
  }, [movimenti, tab]);

  // Lista mostrata sotto: rispetta il filtro per tipo selezionato.
  const monthMovimenti = useMemo(
    () => filteredByTab.filter((m) => monthKey(m.data) === selectedMonth),
    [filteredByTab, selectedMonth]
  );

  // Il riepilogo in cima rappresenta la cassa del mese nel suo complesso:
  // se seguisse il filtro per tipo mostrerebbe incassi o spese sempre a zero.
  const monthTutti = useMemo(
    () => movimenti.filter((m) => monthKey(m.data) === selectedMonth),
    [movimenti, selectedMonth]
  );

  const totalIncassi = useMemo(
    () => monthTutti.filter((m) => findTipo(m.tipo).sign === 1).reduce((a, m) => a + Number(m.importo), 0),
    [monthTutti]
  );
  const totalSpese = useMemo(
    () => monthTutti.filter((m) => findTipo(m.tipo).sign === -1).reduce((a, m) => a + Number(m.importo), 0),
    [monthTutti]
  );
  const saldo = totalIncassi - totalSpese;

  // Raggruppa per giorno
  const byDay = useMemo(() => {
    const map = new Map<string, Movimento[]>();
    monthMovimenti.forEach((m) => {
      if (!map.has(m.data)) map.set(m.data, []);
      map.get(m.data)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthMovimenti]);

  // Available months (from data)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    movimenti.forEach((m) => set.add(monthKey(m.data)));
    set.add(currentMonthKey());
    return Array.from(set).sort().reverse();
  }, [movimenti]);

  const showDipendenteField = newTipo === 'anticipo_dipendente' || newTipo === 'spesa_dipendente';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cassa</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
        >
          {showForm ? '✗ Chiudi' : '+ Nuovo movimento'}
        </button>
      </div>

      {toast && (
        <div className="p-2.5 rounded-lg bg-gray-900 text-white text-xs text-center">{toast}</div>
      )}

      {/* Form nuovo movimento */}
      {showForm && (
        <Card className="!p-4 space-y-3 !border-blue-200 !bg-blue-50/40">
          <div className="text-sm font-bold text-gray-900">Nuovo movimento</div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo movimento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIPI.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setNewTipo(t.id)}
                  className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    newTipo === t.id
                      ? 'border-blue-500 bg-white'
                      : 'border-gray-200 bg-white/50 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg">{t.icon}</div>
                  <div className="text-[11px] font-semibold text-gray-900">{t.short}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Importo + Data */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Importo (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newImporto}
                onChange={(e) => setNewImporto(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Data</label>
              <input
                type="date"
                value={newData}
                onChange={(e) => setNewData(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descrizione *</label>
            <input
              type="text"
              value={newDescrizione}
              onChange={(e) => setNewDescrizione(e.target.value)}
              placeholder="Es: Vendita olio motore / Fattura fornitore / Prelievo cassa"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dipendente (solo per anticipo/spesa dipendente) */}
          {showDipendenteField && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Dipendente *</label>
              <select
                value={newDipendenteId}
                onChange={(e) => setNewDipendenteId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona dipendente...</option>
                {dipendenti.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome} ({d.ruolo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Metodo pagamento */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Metodo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {METODI.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setNewMetodo(m.id)}
                  className={`p-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                    newMetodo === m.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Note (opzionale)</label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Note aggiuntive..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={salvaMovimento} loading={saving} fullWidth>
              💾 Salva movimento
            </Button>
          </div>
        </Card>
      )}

      {/* Selettore mese + Totali */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-500">Riepilogo</div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
          >
            {availableMonths.map((m) => {
              const [y, mm] = m.split('-');
              const monthNames = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
              return (
                <option key={m} value={m}>{monthNames[parseInt(mm)-1]} {y}</option>
              );
            })}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-emerald-700 font-semibold">Incassi</div>
            <div className="text-sm font-bold text-emerald-900">{fmtEuro(totalIncassi)}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
            <div className="text-[10px] text-red-700 font-semibold">Spese</div>
            <div className="text-sm font-bold text-red-900">{fmtEuro(totalSpese)}</div>
          </div>
          <div className={`border rounded-xl p-2.5 text-center ${
            saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <div className={`text-[10px] font-semibold ${saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Saldo</div>
            <div className={`text-sm font-bold ${saldo >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
              {fmtEuro(saldo)}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {([
          { id: 'tutti', label: 'Tutti', icon: '📒' },
          { id: 'incasso_extra', label: 'Incassi', icon: '💵' },
          { id: 'spesa_officina', label: 'Officina', icon: '🧾' },
          { id: 'spesa_titolare', label: 'Titolare', icon: '👔' },
          { id: 'dipendenti', label: 'Dipendenti', icon: '👷' },
        ] as { id: CassaTab; label: string; icon: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Lista movimenti */}
      {loading ? (
        <div className="text-center py-6 text-xs text-gray-400">Caricamento...</div>
      ) : byDay.length === 0 ? (
        <Card className="!p-6 text-center">
          <div className="text-4xl mb-2">📭</div>
          <div className="text-sm text-gray-500">Nessun movimento in questo periodo</div>
          <div className="text-xs text-gray-400 mt-1">Clicca "+ Nuovo movimento" per iniziare</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {byDay.map(([giorno, items]) => {
            const dayIncassi = items.filter((m) => findTipo(m.tipo).sign === 1).reduce((a, m) => a + Number(m.importo), 0);
            const daySpese = items.filter((m) => findTipo(m.tipo).sign === -1).reduce((a, m) => a + Number(m.importo), 0);
            const daySaldo = dayIncassi - daySpese;
            const dt = new Date(giorno + 'T00:00');
            const label = dt.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={giorno}>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</div>
                  <div className={`text-[11px] font-semibold ${daySaldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {daySaldo >= 0 ? '+' : ''}{fmtEuro(daySaldo)}
                  </div>
                </div>
                <Card className="!p-2 divide-y divide-gray-100">
                  {items.map((m) => {
                    const cfg = findTipo(m.tipo);
                    const dip = m.dipendente_id ? dipendenti.find((d) => d.id === m.dipendente_id) : null;
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2 px-1 group">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${cfg.bg}`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{m.descrizione}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {cfg.short}
                            {dip && ` · ${dip.nome}`}
                            {m.metodo_pagamento && ` · ${m.metodo_pagamento}`}
                          </div>
                        </div>
                        <div className={`text-sm font-bold ${cfg.sign === 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {cfg.sign === 1 ? '+' : '−'}{fmtEuro(Number(m.importo))}
                        </div>
                        <button
                          onClick={() => eliminaMovimento(m.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 cursor-pointer text-xs"
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
