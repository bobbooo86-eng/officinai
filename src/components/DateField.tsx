import { useState, useRef, useEffect } from 'react';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const toKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseKey = (key: string): Date => new Date(`${key}T00:00:00`);

interface DateFieldProps {
  /** Data selezionata, formato YYYY-MM-DD. Stringa vuota se nessuna. */
  value: string;
  onChange: (value: string) => void;
  /** Data minima selezionabile, stesso formato. */
  min?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Selettore di data con calendario a griglia, al posto del picker nativo
 * del telefono: quello non indica che giorno della settimana cade una
 * data (bisogna calcolarlo a mente), il calendario qui invece mostra
 * sempre l'intestazione Lun-Dom sopra i numeri.
 */
export function DateField({ value, onChange, min, placeholder = 'Scegli una data', className = '' }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [mese, setMese] = useState(() => {
    const base = value ? parseKey(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const apri = () => {
    const base = value ? parseKey(value) : new Date();
    setMese(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen((o) => !o);
  };

  const giorniGriglia = (() => {
    const y = mese.getFullYear();
    const m = mese.getMonth();
    const first = new Date(y, m, 1);
    const firstDay = first.getDay();
    const offset = firstDay === 0 ? -6 : 1 - firstDay; // la griglia parte di lunedi'
    const start = new Date(y, m, 1 + offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  })();

  const todayKey = toKey(new Date());
  const minDate = min ? parseKey(min) : null;

  const label = value
    ? (() => {
        const d = parseKey(value);
        const giorno = GIORNI[d.getDay() === 0 ? 6 : d.getDay() - 1];
        return `${giorno} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : placeholder;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={apri}
        className={className || 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'}
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500"
              aria-label="Mese precedente"
            >
              ‹
            </button>
            <div className="text-sm font-semibold text-gray-800">{MESI[mese.getMonth()]} {mese.getFullYear()}</div>
            <button
              type="button"
              onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500"
              aria-label="Mese successivo"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {GIORNI.map((g) => (
              <div key={g} className="text-center text-[10px] font-bold text-gray-400">{g}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {giorniGriglia.map((d, i) => {
              const key = toKey(d);
              const isCurrentMonth = d.getMonth() === mese.getMonth();
              const isToday = key === todayKey;
              const isSelected = key === value;
              const disabled = !!minDate && d < minDate;
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                    isSelected ? 'bg-blue-600 text-white cursor-pointer' :
                    disabled ? 'text-gray-300 cursor-not-allowed' :
                    isToday ? 'bg-blue-100 text-blue-700 cursor-pointer' :
                    isCurrentMonth ? 'text-gray-700 hover:bg-gray-100 cursor-pointer' : 'text-gray-300 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
