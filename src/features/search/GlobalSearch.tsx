import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fmtData } from '@/lib/format';
import type { Cliente, Veicolo, Appuntamento } from '@/types/database';

// ---- Types ----

type SearchResultType = 'cliente' | 'veicolo' | 'appuntamento';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
}

interface GlobalSearchProps {
  onSelect?: (type: SearchResultType, id: string) => void;
}

// ---- Local Storage helpers ----

const STORAGE_KEY = 'officinai_recent_searches';

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch {
    // ignore
  }
}

// ---- Component ----

export function GlobalSearch({ onSelect }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { officina } = useAuthStore();
  const officinaId = officina?.id;

  // Load recent searches when overlay opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      // Small delay to ensure the overlay is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Debounced search
  const performSearch = useCallback(
    async (term: string) => {
      if (!term.trim() || !officinaId) {
        setResults([]);
        return;
      }

      setLoading(true);
      const pattern = `%${term.trim()}%`;

      try {
        // Search clienti
        const clientiPromise = supabase
          .from('clienti')
          .select('id, nome, tel, email')
          .eq('officina_id', officinaId)
          .or(`nome.ilike.${pattern},tel.ilike.${pattern},email.ilike.${pattern}`)
          .limit(5);

        // Search veicoli (join with clienti for owner name)
        const veicoliPromise = supabase
          .from('veicoli')
          .select('id, targa, marca, modello, cliente_id, clienti(nome)')
          .or(`targa.ilike.${pattern},marca.ilike.${pattern},modello.ilike.${pattern}`)
          .limit(5);

        // Search appuntamenti
        const appuntamentiPromise = supabase
          .from('appuntamenti')
          .select('id, data_ora, problema, codici_obd, clienti(nome)')
          .eq('officina_id', officinaId)
          .or(`problema.ilike.${pattern},codici_obd.ilike.${pattern}`)
          .limit(5);

        const [clientiRes, veicoliRes, appuntamentiRes] = await Promise.all([
          clientiPromise,
          veicoliPromise,
          appuntamentiPromise,
        ]);

        const mapped: SearchResult[] = [];

        // Map clienti
        if (clientiRes.data) {
          for (const c of clientiRes.data as Cliente[]) {
            mapped.push({
              id: c.id,
              type: 'cliente',
              title: c.nome,
              subtitle: c.tel || c.email || '',
            });
          }
        }

        // Map veicoli
        if (veicoliRes.data) {
          for (const v of veicoliRes.data as unknown as (Veicolo & { clienti?: { nome: string } | null })[]) {
            const ownerName = v.clienti?.nome || '';
            mapped.push({
              id: v.id,
              type: 'veicolo',
              title: `${v.targa} — ${v.marca} ${v.modello}`,
              subtitle: ownerName ? `Proprietario: ${ownerName}` : '',
            });
          }
        }

        // Map appuntamenti
        if (appuntamentiRes.data) {
          for (const a of appuntamentiRes.data as unknown as (Appuntamento & { clienti?: { nome: string } | null })[]) {
            const clientName = a.clienti?.nome || '';
            const excerpt = a.problema?.length > 60 ? a.problema.slice(0, 60) + '...' : a.problema;
            mapped.push({
              id: a.id,
              type: 'appuntamento',
              title: `${fmtData(a.data_ora)} — ${clientName}`,
              subtitle: excerpt || '',
            });
          }
        }

        setResults(mapped);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    },
    [officinaId],
  );

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  }

  function handleSelect(result: SearchResult) {
    saveRecentSearch(query.trim());
    setOpen(false);
    onSelect?.(result.type, result.id);
  }

  function handleRecentClick(term: string) {
    setQuery(term);
    performSearch(term);
  }

  // Group results by type
  const clienti = results.filter((r) => r.type === 'cliente');
  const veicoli = results.filter((r) => r.type === 'veicolo');
  const appuntamenti = results.filter((r) => r.type === 'appuntamento');
  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
        aria-label="Cerca"
      >
        <span className="text-sm">🔍</span>
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl mx-auto mt-12 mb-12 flex flex-col max-h-[calc(100vh-6rem)] animate-[slideDown_200ms_ease-out]">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <span className="text-xl">🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Cerca clienti, veicoli, appuntamenti..."
                  className="flex-1 text-lg text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
                />
                {loading && (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer text-gray-500 text-sm font-medium"
                >
                  ✕
                </button>
              </div>

              {/* Results area */}
              <div className="overflow-y-auto flex-1 p-3" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                {/* Recent searches (when no query) */}
                {!hasQuery && recentSearches.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Ricerche recenti
                    </p>
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleRecentClick(term)}
                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span className="text-gray-300 text-sm">🕑</span>
                        <span className="text-sm text-gray-600">{term}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No query state */}
                {!hasQuery && recentSearches.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm">Inizia a digitare per cercare...</p>
                  </div>
                )}

                {/* No results */}
                {hasQuery && !loading && !hasResults && (
                  <div className="text-center py-12">
                    <p className="text-2xl mb-2">😕</p>
                    <p className="text-gray-500 text-sm">Nessun risultato per "{query}"</p>
                  </div>
                )}

                {/* Grouped results */}
                {clienti.length > 0 && (
                  <ResultGroup
                    label="👥 Clienti"
                    items={clienti}
                    onSelect={handleSelect}
                  />
                )}
                {veicoli.length > 0 && (
                  <ResultGroup
                    label="🚗 Veicoli"
                    items={veicoli}
                    onSelect={handleSelect}
                  />
                )}
                {appuntamenti.length > 0 && (
                  <ResultGroup
                    label="📅 Appuntamenti"
                    items={appuntamenti}
                    onSelect={handleSelect}
                  />
                )}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50">
                <p className="text-[11px] text-gray-400 text-center">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">ESC</kbd> per chiudere
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

// ---- ResultGroup sub-component ----

function ResultGroup({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: SearchResult[];
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <div className="mb-2">
      <p className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer group"
        >
          <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
            {item.title}
          </span>
          {item.subtitle && (
            <span className="text-xs text-gray-400">{item.subtitle}</span>
          )}
        </button>
      ))}
    </div>
  );
}
