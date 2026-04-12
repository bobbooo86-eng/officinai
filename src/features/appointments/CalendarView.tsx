import { useState, useEffect, useMemo } from 'react';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG } from '@/lib/constants';
import { fmtOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type { Appuntamento } from '@/types/database';

interface CalendarViewProps {
  onSelect: (app: Appuntamento) => void;
  initialDate?: Date;
}

export function CalendarView({ onSelect, initialDate }: CalendarViewProps) {
  const { officina } = useAuthStore();
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [viewMode, setViewMode] = useState<'giorno' | 'settimana'>('giorno');

  // Update selected date when initialDate changes (e.g. from search)
  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (!officina) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('appuntamenti')
        .select('*, clienti(nome,tel), veicoli(marca,modello,targa)')
        .eq('officina_id', officina.id)
        .order('data_ora', { ascending: true });
      setAppuntamenti(data || []);
      setLoading(false);
    };
    fetch();
  }, [officina]);

  // Get week dates
  const weekDates = useMemo(() => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
    start.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const dateStr = (d: Date) => d.toISOString().slice(0, 10);
  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  const todayStr = dateStr(new Date());
  const selectedStr = dateStr(selectedDate);

  // Filter appointments for selected date or week
  const filteredApps = useMemo(() => {
    if (viewMode === 'giorno') {
      return appuntamenti.filter((a) => a.data_ora?.startsWith(selectedStr));
    }
    const weekStart = dateStr(weekDates[0]);
    const weekEnd = dateStr(weekDates[6]);
    return appuntamenti.filter((a) => {
      const d = a.data_ora?.slice(0, 10);
      return d && d >= weekStart && d <= weekEnd;
    });
  }, [appuntamenti, selectedStr, viewMode, weekDates]);

  // Group by hour for day view
  const hourSlots = useMemo(() => {
    const slots: Record<string, Appuntamento[]> = {};
    for (let h = 8; h <= 18; h++) {
      const key = `${h.toString().padStart(2, '0')}:00`;
      slots[key] = [];
    }
    if (viewMode === 'giorno') {
      filteredApps.forEach((a) => {
        const hour = a.data_ora?.slice(11, 13) || '09';
        const key = `${hour}:00`;
        if (slots[key]) slots[key].push(a);
        else {
          // Find nearest slot
          const nearestHour = Math.max(8, Math.min(18, parseInt(hour)));
          const nearestKey = `${nearestHour.toString().padStart(2, '0')}:00`;
          if (slots[nearestKey]) slots[nearestKey].push(a);
        }
      });
    }
    return slots;
  }, [filteredApps, viewMode]);

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  const navigateWeek = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset * 7);
    setSelectedDate(d);
  };

  if (loading) return <div className="text-center py-8 text-sm text-gray-400">Caricamento calendario...</div>;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Calendario</h2>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          <button
            onClick={() => setViewMode('giorno')}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
              viewMode === 'giorno' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Giorno
          </button>
          <button
            onClick={() => setViewMode('settimana')}
            className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer ${
              viewMode === 'settimana' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Settimana
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => viewMode === 'giorno' ? navigateDay(-1) : navigateWeek(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <div className="font-semibold text-gray-900">
            {viewMode === 'giorno'
              ? `${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
              : `${weekDates[0].getDate()} - ${weekDates[6].getDate()} ${monthNames[weekDates[6].getMonth()]}`
            }
          </div>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="text-xs text-blue-600 hover:underline cursor-pointer"
          >
            Oggi
          </button>
        </div>
        <button
          onClick={() => viewMode === 'giorno' ? navigateDay(1) : navigateWeek(1)}
          className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Week strip (always visible) */}
      <div className="flex gap-1">
        {weekDates.map((d, i) => {
          const ds = dateStr(d);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedStr;
          const hasApps = appuntamenti.some((a) => a.data_ora?.startsWith(ds));
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
              {hasApps && !isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day view - Hour slots */}
      {viewMode === 'giorno' && (
        <div className="space-y-0.5">
          {Object.entries(hourSlots).map(([hour, apps]) => (
            <div key={hour} className="flex gap-2 min-h-[44px]">
              <div className="w-12 text-xs text-gray-400 pt-1 text-right shrink-0">{hour}</div>
              <div className="flex-1 border-t border-gray-100 pt-1">
                {apps.length > 0 ? (
                  <div className="space-y-1">
                    {apps.map((app) => {
                      const stato = STATO_CONFIG[app.stato];
                      return (
                        <div
                          key={app.id}
                          onClick={() => onSelect(app)}
                          className="p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: stato.bg, borderLeft: `3px solid ${stato.color}` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold" style={{ color: stato.color }}>
                              {fmtOra(app.data_ora)} — {app.clienti?.nome}
                            </div>
                            <span className="text-[10px]">{stato.icon}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
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
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Week view */}
      {viewMode === 'settimana' && (
        <div className="space-y-1.5">
          {weekDates.map((d, i) => {
            const ds = dateStr(d);
            const dayApps = filteredApps.filter((a) => a.data_ora?.startsWith(ds));
            if (dayApps.length === 0) return null;
            return (
              <div key={i}>
                <div className="text-xs text-gray-400 font-medium mb-1">
                  {dayNames[i]} {d.getDate()}
                </div>
                {dayApps.map((app) => {
                  const stato = STATO_CONFIG[app.stato];
                  return (
                    <Card key={app.id} hover className="!p-2 mb-1" onClick={() => onSelect(app)}>
                      <div className="flex items-start gap-2">
                        <div className="text-xs text-gray-500 w-10 shrink-0 pt-0.5">{fmtOra(app.data_ora)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-gray-900">{app.clienti?.nome}</span>
                            <span className="text-[10px] text-gray-400">
                              {app.veicoli?.marca} {app.veicoli?.modello}
                            </span>
                          </div>
                          {app.problema && (
                            <div className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">
                              🔧 {app.problema}
                            </div>
                          )}
                        </div>
                        <Badge color={stato.color} bg={stato.bg}>
                          {stato.icon}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })}
          {filteredApps.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              Nessun appuntamento questa settimana
            </div>
          )}
        </div>
      )}
    </div>
  );
}
