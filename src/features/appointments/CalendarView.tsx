import { useState, useEffect, useMemo } from 'react';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento } from '@/types/database';

type CalendarMode = 'giorno' | 'settimana' | 'mese' | 'anno';

interface CalendarViewProps {
  onSelect: (app: Appuntamento) => void;
  initialDate?: Date;
  searchQuery?: string;
  /** Callback quando l'utente clicca "+ Nuovo" (con la data corrente selezionata) */
  onNuovoAppuntamento?: (date: Date) => void;
}

// Palette di colori distinti per rendere visivamente riconoscibili gli appuntamenti multipli
const APP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
  '#a855f7', '#84cc16', '#eab308', '#f43f5e',
  '#0ea5e9', '#22c55e', '#d946ef', '#f472b6',
];

function colorForApp(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31 + id.charCodeAt(i)) >>> 0) & 0xffffffff;
  return APP_COLORS[h % APP_COLORS.length];
}

// Sfondo tenue derivato dal colore hex primario
function bgForColor(hex: string): string {
  // Usa un semplice sfondo con opacità
  return hex + '15';
}

const dateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * data_ora arriva da Postgres come timestamp UTC. Confrontarne i primi 10
 * caratteri con una data locale sbaglia giorno per gli appuntamenti serali
 * (es. 00:30 del 30 in Italia e' il 29 alle 22:30 UTC), quindi va prima
 * convertito nel fuso locale.
 */
const appDay = (dataOra?: string | null): string => (dataOra ? dateStr(new Date(dataOra)) : '');

/** Ora locale (0-23) dell'appuntamento. */
const appHour = (dataOra?: string | null): number => (dataOra ? new Date(dataOra).getHours() : 9);

/** Minuti dalla mezzanotte, in ora locale. */
const appMinuti = (dataOra?: string | null): number => {
  if (!dataOra) return 9 * 60;
  const d = new Date(dataOra);
  return d.getHours() * 60 + d.getMinutes();
};

// Griglia oraria della vista settimana
const ORA_INIZIO = 7;
const ORA_FINE = 20;
const ALTEZZA_ORA = 56; // px per ora
// Gli appuntamenti non hanno una durata memorizzata: si assume un'ora.
const DURATA_DEFAULT = 60;

export interface BloccoCalendario {
  app: Appuntamento;
  top: number;
  altezza: number;
  /** Posizione orizzontale entro la colonna del giorno, per gli orari sovrapposti. */
  colonna: number;
  colonneTotali: number;
}

/**
 * Dispone gli appuntamenti di un giorno come blocchi posizionati sull'orario.
 * Gli appuntamenti che si sovrappongono vengono affiancati dividendo la
 * larghezza della colonna, invece di coprirsi a vicenda.
 */
export function disponiBlocchi(apps: Appuntamento[]): BloccoCalendario[] {
  const primoMinuto = ORA_INIZIO * 60;
  const ultimoMinuto = (ORA_FINE + 1) * 60;
  const eventi = apps
    .map((app) => {
      // Un orario fuori dalla fascia mostrata verrebbe disegnato sopra o
      // sotto la griglia: viene riportato dentro i limiti.
      const inizio = Math.min(
        Math.max(appMinuti(app.data_ora), primoMinuto),
        ultimoMinuto - DURATA_DEFAULT
      );
      return { app, inizio, fine: inizio + DURATA_DEFAULT };
    })
    .sort((a, b) => a.inizio - b.inizio);

  const blocchi: BloccoCalendario[] = [];
  let gruppo: typeof eventi = [];

  const chiudiGruppo = () => {
    if (gruppo.length === 0) return;
    // Assegna a ogni evento del gruppo la prima corsia libera.
    const corsie: number[] = []; // fine dell'ultimo evento per corsia
    const assegnate = gruppo.map((e) => {
      let idx = corsie.findIndex((fine) => fine <= e.inizio);
      if (idx === -1) { idx = corsie.length; }
      corsie[idx] = e.fine;
      return idx;
    });
    const totali = corsie.length;
    gruppo.forEach((e, i) => {
      const minutiDaInizio = e.inizio - ORA_INIZIO * 60;
      blocchi.push({
        app: e.app,
        top: (minutiDaInizio / 60) * ALTEZZA_ORA,
        altezza: (DURATA_DEFAULT / 60) * ALTEZZA_ORA,
        colonna: assegnate[i],
        colonneTotali: totali,
      });
    });
    gruppo = [];
  };

  eventi.forEach((e) => {
    // Un evento che inizia dopo la fine di tutti i precedenti apre un nuovo gruppo.
    if (gruppo.length > 0 && e.inizio >= Math.max(...gruppo.map((g) => g.fine))) {
      chiudiGruppo();
    }
    gruppo.push(e);
  });
  chiudiGruppo();

  return blocchi;
}

const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const dayNamesShort = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const monthNamesShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function CalendarView({ onSelect, initialDate, searchQuery = '', onNuovoAppuntamento }: CalendarViewProps) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [viewMode, setViewMode] = useState<CalendarMode>('giorno');

  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (!officina) return;
    const load = async () => {
      const { data } = await supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa)')
        .eq('officina_id', officina.id)
        .order('data_ora', { ascending: true });
      setAppuntamenti(data || []);
      setLoading(false);
    };
    load();
    // Realtime updates
    const channel = supabase
      .channel('calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti', filter: `officina_id=eq.${officina.id}` }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [officina]);

  // Get week dates (Lun–Dom)
  const weekDates = useMemo(() => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const todayStr = dateStr(new Date());
  const selectedStr = dateStr(selectedDate);

  // Filter by search query (applica sempre)
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return appuntamenti;
    const q = searchQuery.toLowerCase();
    return appuntamenti.filter((a) =>
      (a as any).clienti?.nome?.toLowerCase().includes(q) ||
      (a as any).veicoli?.targa?.toLowerCase().includes(q) ||
      (a as any).veicoli?.marca?.toLowerCase().includes(q) ||
      (a as any).veicoli?.modello?.toLowerCase().includes(q) ||
      a.problema?.toLowerCase().includes(q)
    );
  }, [appuntamenti, searchQuery]);

  const dayApps = useMemo(
    () => searchFiltered.filter((a) => appDay(a.data_ora) === selectedStr),
    [searchFiltered, selectedStr]
  );

  const weekApps = useMemo(() => {
    const start = dateStr(weekDates[0]);
    const end = dateStr(weekDates[6]);
    return searchFiltered.filter((a) => {
      const d = appDay(a.data_ora);
      return d && d >= start && d <= end;
    });
  }, [searchFiltered, weekDates]);

  // Group by hour for day view
  const hourSlots = useMemo(() => {
    const slots: Record<string, Appuntamento[]> = {};
    for (let h = 7; h <= 20; h++) {
      const key = `${h.toString().padStart(2, '0')}:00`;
      slots[key] = [];
    }
    dayApps.forEach((a) => {
      const hour = appHour(a.data_ora);
      const clamped = Math.max(7, Math.min(20, hour));
      const key = `${clamped.toString().padStart(2, '0')}:00`;
      if (slots[key]) slots[key].push(a);
    });
    return slots;
  }, [dayApps]);

  // Month grid (settimane × 7 colonne, Lun–Dom) — usato per lo strip di navigazione rapida
  const monthGrid = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const first = new Date(y, m, 1);
    const firstDay = first.getDay();
    const startOffset = firstDay === 0 ? -6 : 1 - firstDay; // Lunedi = 1
    const gridStart = new Date(y, m, 1 + startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Tutti i giorni del mese selezionato, per la lista verticale sotto ogni giorno
  const monthDaysList = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1));
  }, [selectedDate]);

  const monthApps = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${y}-${m}`;
    return searchFiltered.filter((a) => appDay(a.data_ora).startsWith(prefix));
  }, [searchFiltered, selectedDate]);

  // Year overview: per each of 12 months, count of appointments
  const yearData = useMemo(() => {
    const y = selectedDate.getFullYear();
    const counts: number[] = Array.from({ length: 12 }, () => 0);
    searchFiltered.forEach((a) => {
      const d = appDay(a.data_ora);
      if (!d) return;
      const [yy, mm] = d.split('-');
      if (parseInt(yy, 10) === y) counts[parseInt(mm, 10) - 1]++;
    });
    return counts;
  }, [searchFiltered, selectedDate]);

  const navigate = (offset: number) => {
    const d = new Date(selectedDate);
    if (viewMode === 'giorno') d.setDate(d.getDate() + offset);
    else if (viewMode === 'settimana') d.setDate(d.getDate() + offset * 7);
    else if (viewMode === 'mese') d.setMonth(d.getMonth() + offset);
    else d.setFullYear(d.getFullYear() + offset);
    setSelectedDate(d);
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'giorno') {
      return `${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    }
    if (viewMode === 'settimana') {
      return `${weekDates[0].getDate()} ${monthNamesShort[weekDates[0].getMonth()]} - ${weekDates[6].getDate()} ${monthNamesShort[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`;
    }
    if (viewMode === 'mese') {
      return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    }
    return `${selectedDate.getFullYear()}`;
  }, [selectedDate, viewMode, weekDates]);

  if (loading) return <div className="text-center py-8 text-sm text-gray-400">Caricamento calendario...</div>;

  return (
    <div className="p-4 space-y-3">
      {/* Header + Toggle vista */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appuntamenti</h2>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(['giorno', 'settimana', 'mese', 'anno'] as CalendarMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                viewMode === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Navigazione periodo + Oggi + Nuovo */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
          aria-label="Precedente"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{periodLabel}</div>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="text-[11px] text-blue-600 hover:underline cursor-pointer"
          >
            Oggi
          </button>
        </div>
        <button
          onClick={() => navigate(1)}
          className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
          aria-label="Successivo"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottone "+ Nuovo appuntamento" sempre visibile */}
      {onNuovoAppuntamento && (
        <button
          onClick={() => onNuovoAppuntamento(selectedDate)}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm active:scale-[0.98] cursor-pointer transition-all"
        >
          + Nuovo appuntamento{viewMode === 'giorno' ? ` per ${selectedDate.getDate()} ${monthNamesShort[selectedDate.getMonth()]}` : ''}
        </button>
      )}

      {/* Strip settimana (solo in vista giorno/settimana) */}
      {(viewMode === 'giorno' || viewMode === 'settimana') && (
        <div className="flex gap-1">
          {weekDates.map((d, i) => {
            const ds = dateStr(d);
            const isToday = ds === todayStr;
            const isSelected = ds === selectedStr;
            const dayAppsForCell = appuntamenti.filter((a) => appDay(a.data_ora) === ds);
            const nApps = dayAppsForCell.length;
            return (
              <button
                key={i}
                onClick={() => { setSelectedDate(d); setViewMode('giorno'); }}
                className={`flex-1 py-2 rounded-xl text-center transition-all cursor-pointer ${
                  isSelected ? 'bg-blue-600 text-white' :
                  isToday ? 'bg-blue-100 text-blue-700' :
                  'hover:bg-gray-100'
                }`}
              >
                <div className={`text-[10px] font-medium ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                  {dayNames[i]}
                </div>
                <div className={`text-sm font-bold ${isSelected ? '' : 'text-gray-700'}`}>
                  {d.getDate()}
                </div>
                {/* Palline colorate per gli appuntamenti (max 3) */}
                {nApps > 0 && (
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {dayAppsForCell.slice(0, 3).map((a) => (
                      <span
                        key={a.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#ffffff' : colorForApp(a.id) }}
                      />
                    ))}
                    {nApps > 3 && (
                      <span className={`text-[8px] leading-none ${isSelected ? 'text-white' : 'text-gray-500'}`}>+{nApps - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Vista GIORNO — slot orari con appuntamenti incolonnati e colori distinti */}
      {viewMode === 'giorno' && (
        <div className="space-y-0.5">
          {Object.entries(hourSlots).map(([hour, apps]) => (
            <div key={hour} className="flex gap-2 min-h-[44px]">
              <div className="w-12 text-xs text-gray-400 pt-1 text-right shrink-0">{hour}</div>
              <div className="flex-1 border-t border-gray-100 pt-1">
                {apps.length > 0 && (
                  <div className="space-y-1">
                    {apps.map((app) => {
                      const c = colorForApp(app.id);
                      const stato = STATO_CONFIG[app.stato];
                      return (
                        <div
                          key={app.id}
                          onClick={() => onSelect(app)}
                          className="p-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                          style={{ backgroundColor: bgForColor(c), borderLeft: `4px solid ${c}` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold" style={{ color: c }}>
                              {fmtOra(app.data_ora)} — {app.clienti?.nome}
                            </div>
                            <span className="text-[10px]" title={stato.label}>{stato.icon}</span>
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {app.veicoli?.marca} {app.veicoli?.modello} {app.veicoli?.targa && `• ${app.veicoli.targa}`}
                          </div>
                          {app.problema && (
                            <div className="text-[11px] text-gray-700 mt-1 font-medium line-clamp-2">
                              🔧 {app.problema}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista SETTIMANA — griglia oraria: ore in verticale, giorni in colonna */}
      {viewMode === 'settimana' && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Su telefono 7 colonne non ci stanno: la griglia scorre in orizzontale */}
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* Intestazione giorni */}
              <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="w-12 shrink-0 border-r border-gray-100" />
                {weekDates.map((d, i) => {
                  const ds = dateStr(d);
                  const isToday = ds === todayStr;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(d); setViewMode('giorno'); }}
                      className={`flex-1 py-1.5 text-center cursor-pointer border-r border-gray-100 last:border-r-0 transition-colors ${
                        isToday ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`text-[10px] font-medium ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                        {dayNames[i]}
                      </div>
                      <div className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                        {d.getDate()}/{d.getMonth() + 1}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Corpo: fascia oraria + colonne giorno */}
              <div className="flex">
                {/* Colonna delle ore */}
                <div className="w-12 shrink-0 border-r border-gray-100">
                  {Array.from({ length: ORA_FINE - ORA_INIZIO + 1 }, (_, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-gray-400 text-right pr-1.5 -translate-y-1.5"
                      style={{ height: ALTEZZA_ORA }}
                    >
                      {(ORA_INIZIO + i).toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {weekDates.map((d, i) => {
                  const ds = dateStr(d);
                  const isToday = ds === todayStr;
                  const blocchi = disponiBlocchi(weekApps.filter((a) => appDay(a.data_ora) === ds));
                  return (
                    <div
                      key={i}
                      className={`flex-1 relative border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-blue-50/30' : ''}`}
                      style={{ height: (ORA_FINE - ORA_INIZIO + 1) * ALTEZZA_ORA }}
                    >
                      {/* Righe orarie di sfondo */}
                      {Array.from({ length: ORA_FINE - ORA_INIZIO + 1 }, (_, h) => (
                        <div
                          key={h}
                          className="border-b border-gray-100"
                          style={{ height: ALTEZZA_ORA }}
                        />
                      ))}

                      {blocchi.map(({ app, top, altezza, colonna, colonneTotali }) => {
                        const c = colorForApp(app.id);
                        const larghezza = 100 / colonneTotali;
                        return (
                          <button
                            key={app.id}
                            onClick={() => onSelect(app)}
                            title={`${fmtOra(app.data_ora)} — ${app.clienti?.nome || ''}${app.problema ? ` — ${app.problema}` : ''}`}
                            className="absolute rounded-md px-1 py-0.5 text-left overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            style={{
                              top: top + 1,
                              height: altezza - 2,
                              left: `calc(${colonna * larghezza}% + 2px)`,
                              width: `calc(${larghezza}% - 4px)`,
                              backgroundColor: bgForColor(c),
                              borderLeft: `3px solid ${c}`,
                            }}
                          >
                            <div className="text-[9px] font-bold leading-tight" style={{ color: c }}>
                              {fmtOra(app.data_ora)}
                            </div>
                            <div className="text-[10px] font-semibold text-gray-900 leading-tight truncate">
                              {app.clienti?.nome}
                            </div>
                            {app.problema && (
                              <div className="text-[9px] text-gray-600 leading-tight truncate">
                                {app.problema}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {weekApps.length === 0 && (
            <div className="text-center py-4 text-xs text-gray-400 border-t border-gray-100">
              Nessun appuntamento questa settimana
            </div>
          )}
        </div>
      )}

      {/* Vista MESE — griglia 7×6 con giorno + pallini colorati per appuntamenti */}
      {viewMode === 'mese' && (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNamesShort.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((d, idx) => {
              const ds = dateStr(d);
              const isCurrentMonth = d.getMonth() === selectedDate.getMonth();
              const isToday = ds === todayStr;
              const isSelected = ds === selectedStr;
              const dApps = searchFiltered.filter((a) => appDay(a.data_ora) === ds);
              return (
                <button
                  key={idx}
                  onClick={() => { setSelectedDate(d); setViewMode('giorno'); }}
                  className={`min-h-[56px] p-1 rounded-lg text-left transition-all cursor-pointer border ${
                    isSelected ? 'border-blue-500 bg-blue-50' :
                    isToday ? 'border-blue-300 bg-blue-50/50' :
                    isCurrentMonth ? 'border-gray-100 hover:border-gray-300 bg-white' :
                    'border-transparent bg-gray-50/50 text-gray-400'
                  }`}
                >
                  <div className={`text-[11px] font-bold mb-0.5 ${
                    isSelected ? 'text-blue-700' :
                    isToday ? 'text-blue-600' :
                    isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {d.getDate()}
                  </div>
                  {dApps.length > 0 && (
                    <div className="space-y-0.5">
                      {dApps.slice(0, 2).map((a) => (
                        <div
                          key={a.id}
                          className="text-[8px] leading-tight truncate px-1 py-0.5 rounded font-semibold"
                          style={{
                            backgroundColor: bgForColor(colorForApp(a.id)),
                            color: colorForApp(a.id),
                            borderLeft: `2px solid ${colorForApp(a.id)}`,
                          }}
                          title={`${fmtOra(a.data_ora)} — ${a.clienti?.nome || ''}`}
                        >
                          {fmtOra(a.data_ora)} {a.clienti?.nome?.slice(0, 8)}
                        </div>
                      ))}
                      {dApps.length > 2 && (
                        <div className="text-[8px] text-gray-500 text-center">+{dApps.length - 2}</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tutti gli appuntamenti del mese, in colonna verticale sotto ogni giorno */}
          <div className="mt-4 space-y-3">
            {monthApps.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">Nessun appuntamento questo mese</div>
            )}
            {monthDaysList.map((d, i) => {
              const ds = dateStr(d);
              const dApps = monthApps.filter((a) => appDay(a.data_ora) === ds);
              if (dApps.length === 0) return null;
              const isToday = ds === todayStr;
              return (
                <div key={i}>
                  <div className={`text-xs font-bold mb-1 px-0.5 ${isToday ? 'text-blue-700' : 'text-gray-500'}`}>
                    {dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()} {monthNamesShort[d.getMonth()]}
                  </div>
                  <div className="space-y-1.5">
                    {dApps.map((app) => {
                      const c = colorForApp(app.id);
                      const stato = STATO_CONFIG[app.stato];
                      return (
                        <Card
                          key={app.id}
                          hover
                          className="!p-2 !border-0"
                          style={{ backgroundColor: bgForColor(c), borderLeft: `4px solid ${c}` }}
                          onClick={() => onSelect(app)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-xs font-bold w-11 shrink-0 pt-0.5" style={{ color: c }}>
                              {fmtOra(app.data_ora)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 truncate">
                                {app.clienti?.nome}
                              </div>
                              <div className="text-[10px] text-gray-500 truncate">
                                {app.veicoli?.marca} {app.veicoli?.modello}
                              </div>
                              {app.problema && (
                                <div className="text-[11px] text-gray-700 mt-1 font-medium line-clamp-2">
                                  🔧 {app.problema}
                                </div>
                              )}
                            </div>
                            <Badge color={stato.color} bg={stato.bg}>{stato.icon}</Badge>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista ANNO — 12 mesi con heatmap conteggio appuntamenti */}
      {viewMode === 'anno' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {yearData.map((count, i) => {
            const intensity = count === 0 ? 0 : Math.min(1, count / 20);
            const bg = intensity === 0 ? '#f9fafb' : `rgba(59,130,246,${0.15 + intensity * 0.5})`;
            return (
              <button
                key={i}
                onClick={() => {
                  const d = new Date(selectedDate.getFullYear(), i, 1);
                  setSelectedDate(d);
                  setViewMode('mese');
                }}
                className="p-3 rounded-xl text-left cursor-pointer border border-gray-100 hover:border-blue-300 transition-colors"
                style={{ backgroundColor: bg }}
              >
                <div className="text-sm font-bold text-gray-800">{monthNamesShort[i]}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {count} appunt.
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
