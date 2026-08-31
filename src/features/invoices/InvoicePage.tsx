import { useState, useEffect } from 'react';
import { Button, Card, Badge, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fmtEuro, fmtData } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { ShareDocument } from '@/components/ShareDocument';
import { buildPreventivoHtml, extractLogoColor } from '@/features/estimates/PDFExport';
import type { Preventivo, PreventivoRiga, Appuntamento } from '@/types/database';

// ============================================
// Types
// ============================================

type FatturaStato = 'bozza' | 'emessa' | 'pagata';

interface FatturaRiga {
  tipo: 'manodopera' | 'ricambio';
  desc: string;
  qta: number;
  prezzo: number;
}

interface Fattura {
  id: string;
  officina_id: string;
  appuntamento_id: string | null;
  preventivo_id: string | null;
  numero: string;
  data_emissione: string;
  cliente_nome: string;
  cliente_cf: string;
  righe: FatturaRiga[];
  subtotale: number;
  iva: number;
  totale: number;
  stato: FatturaStato;
  note: string;
  created_at?: string;
}

// Preventivo with joined data for selection
interface PreventivoConDati extends Preventivo {
  appuntamenti?: Appuntamento & {
    clienti?: { nome: string; id: string };
  };
}

// ============================================
// Stato config for fatture
// ============================================

const FATTURA_STATO_CONFIG: Record<FatturaStato, { label: string; color: string; bg: string; icon: string }> = {
  bozza: { label: 'Bozza', color: '#6b7280', bg: '#f3f4f6', icon: '📝' },
  emessa: { label: 'Emessa', color: '#1e40af', bg: '#dbeafe', icon: '📨' },
  pagata: { label: 'Pagata', color: '#065f46', bg: '#d1fae5', icon: '✅' },
};

const FATTURA_STATI_ORDINE: FatturaStato[] = ['bozza', 'emessa', 'pagata'];

// ============================================
// Filter tabs
// ============================================

type Filtro = 'tutte' | FatturaStato;

const FILTRI: { id: Filtro; label: string }[] = [
  { id: 'tutte', label: 'Tutte' },
  { id: 'bozza', label: 'Bozze' },
  { id: 'emessa', label: 'Emesse' },
  { id: 'pagata', label: 'Pagate' },
];

// ============================================
// Main page
// ============================================

type View = 'list' | 'detail' | 'create';

export function InvoicePage({ resetSignal }: { resetSignal?: number } = {}) {
  const { officina } = useAuthStore();
  const [view, setView] = useState<View>('list');
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('tutte');
  const [selectedFattura, setSelectedFattura] = useState<Fattura | null>(null);

  // Un nuovo tocco sul tab Fatture gia' attivo riporta alla lista.
  useEffect(() => {
    if (resetSignal === undefined) return;
    setView('list');
    setSelectedFattura(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const fetchFatture = async () => {
    if (!officina) return;
    setLoading(true);
    const { data } = await supabase
      .from('fatture')
      .select('*')
      .eq('officina_id', officina.id)
      .order('created_at', { ascending: false });

    setFatture(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchFatture();
  }, [officina]);

  const fattureFiltrate = filtro === 'tutte'
    ? fatture
    : fatture.filter((f) => f.stato === filtro);

  const openDetail = (fattura: Fattura) => {
    setSelectedFattura(fattura);
    setView('detail');
  };

  const goBack = () => {
    setSelectedFattura(null);
    setView('list');
    fetchFatture();
  };

  if (view === 'create') {
    return <CreaFattura onBack={goBack} onCreated={(f) => { setSelectedFattura(f); setView('detail'); }} />;
  }

  if (view === 'detail' && selectedFattura) {
    return <DettaglioFattura fattura={selectedFattura} onBack={goBack} onUpdate={(f) => setSelectedFattura(f)} />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fatture</h1>
          <p className="text-xs text-gray-500">{fatture.length} fatture totali</p>
        </div>
        <Button size="sm" onClick={() => setView('create')}>
          + Nuova fattura
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {FILTRI.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filtro === f.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">Caricamento...</div>
      ) : fattureFiltrate.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🧾</div>
          <p className="text-gray-500 text-sm">
            {filtro === 'tutte'
              ? 'Nessuna fattura ancora. Crea la prima!'
              : `Nessuna fattura in stato "${FATTURA_STATO_CONFIG[filtro as FatturaStato]?.label || filtro}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {fattureFiltrate.map((fattura) => {
            const cfg = FATTURA_STATO_CONFIG[fattura.stato];
            return (
              <Card
                key={fattura.id}
                className="!p-3 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(fattura)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-gray-900">{fattura.numero}</span>
                      <Badge color={cfg.color} bg={cfg.bg}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{fattura.cliente_nome}</p>
                    <p className="text-xs text-gray-400">{fmtData(fattura.data_emissione)}</p>
                  </div>
                  <div className="text-right ml-3">
                    <div className="text-sm font-bold text-gray-900">{fmtEuro(fattura.totale)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Crea fattura da preventivo
// ============================================

function CreaFattura({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (f: Fattura) => void;
}) {
  const { officina } = useAuthStore();
  const [preventivi, setPreventivi] = useState<PreventivoConDati[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clienteCf, setClienteCf] = useState('');

  useEffect(() => {
    const fetch = async () => {
      if (!officina) return;

      // Fetch accepted preventivi that don't already have an invoice
      const { data: prevData } = await supabase
        .from('preventivi')
        .select(`
          *,
          appuntamenti!inner (
            id,
            officina_id,
            problema,
            clienti ( id, nome )
          )
        `)
        .eq('stato', 'accettato')
        .eq('appuntamenti.officina_id', officina.id);

      // Fetch existing invoices to filter out already-invoiced preventivi
      const { data: fattureEsistenti } = await supabase
        .from('fatture')
        .select('preventivo_id')
        .eq('officina_id', officina.id);

      const invoicedIds = new Set((fattureEsistenti || []).map((f) => f.preventivo_id));
      const disponibili = (prevData || []).filter((p) => !invoicedIds.has(p.id));

      setPreventivi(disponibili as PreventivoConDati[]);
      setLoading(false);
    };
    fetch();
  }, [officina]);

  const generaNumero = async (): Promise<string> => {
    if (!officina) return 'FT-0000-001';
    const year = new Date().getFullYear();

    const { data } = await supabase
      .from('fatture')
      .select('numero')
      .eq('officina_id', officina.id)
      .like('numero', `FT-${year}-%`)
      .order('numero', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const last = data[0].numero;
      const parts = last.split('-');
      const seq = parseInt(parts[2] || '0', 10) + 1;
      return `FT-${year}-${seq.toString().padStart(3, '0')}`;
    }
    return `FT-${year}-001`;
  };

  const crea = async () => {
    if (!officina || !selectedId) return;
    setCreating(true);

    const prev = preventivi.find((p) => p.id === selectedId);
    if (!prev) { setCreating(false); return; }

    const numero = await generaNumero();
    const clienteNome = prev.appuntamenti?.clienti?.nome || 'Cliente';

    const subtotale = (prev.righe || []).reduce((sum, r) => sum + r.qta * r.prezzo, 0);
    const iva = subtotale * 0.22;
    const totale = subtotale + iva;

    const payload = {
      officina_id: officina.id,
      appuntamento_id: prev.appuntamenti?.id || null,
      preventivo_id: prev.id,
      numero,
      data_emissione: new Date().toISOString(),
      cliente_nome: clienteNome,
      cliente_cf: clienteCf,
      righe: prev.righe || [],
      subtotale,
      iva,
      totale,
      stato: 'bozza' as FatturaStato,
      note: '',
    };

    const { data, error } = await supabase
      .from('fatture')
      .insert(payload)
      .select()
      .single();

    if (data && !error) {
      onCreated(data as Fattura);
    }
    setCreating(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-bold text-gray-900">Nuova fattura da preventivo</h2>
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">Caricamento preventivi...</div>
      ) : preventivi.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 text-sm">Nessun preventivo approvato disponibile</p>
          <p className="text-xs text-gray-400 mt-1">I preventivi devono essere nello stato "accettato"</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">Seleziona un preventivo approvato:</p>

          <div className="space-y-2">
            {preventivi.map((prev) => {
              const isSelected = selectedId === prev.id;
              const clienteNome = prev.appuntamenti?.clienti?.nome || 'Cliente';
              return (
                <Card
                  key={prev.id}
                  className={`!p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedId(prev.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{clienteNome}</p>
                      <p className="text-xs text-gray-500">
                        {(prev.righe || []).length} voci
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{fmtEuro(prev.totale)}</p>
                      <Badge color="#065f46" bg="#d1fae5">Accettato</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {selectedId && (
            <Card className="!p-3 space-y-3">
              <p className="text-xs text-gray-500 font-medium">Codice fiscale / P.IVA cliente (opzionale):</p>
              <Input
                placeholder="Codice fiscale o P.IVA"
                value={clienteCf}
                onChange={(e) => setClienteCf(e.target.value)}
              />
            </Card>
          )}

          <Button
            onClick={crea}
            loading={creating}
            disabled={!selectedId}
            fullWidth
          >
            Crea fattura
          </Button>
        </>
      )}
    </div>
  );
}

// ============================================
// Dettaglio fattura
// ============================================

function DettaglioFattura({
  fattura,
  onBack,
  onUpdate,
}: {
  fattura: Fattura;
  onBack: () => void;
  onUpdate: (f: Fattura) => void;
}) {
  const { officina } = useAuthStore();
  const [updating, setUpdating] = useState(false);
  const [erroreAggiorna, setErroreAggiorna] = useState('');
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState(fattura.note || '');

  const cambiaStato = async (nuovoStato: FatturaStato) => {
    setUpdating(true);
    const { data, error } = await supabase
      .from('fatture')
      .update({ stato: nuovoStato })
      .eq('id', fattura.id)
      .select()
      .single();

    setUpdating(false);
    // Senza questo controllo il pulsante sembrava inerte: nessun cambiamento
    // a schermo e nessuna spiegazione.
    if (error || !data) {
      setErroreAggiorna('Stato non aggiornato: ' + (error?.message || 'nessuna riga modificata'));
      return;
    }
    setErroreAggiorna('');
    onUpdate(data as Fattura);
  };

  const salvaNote = async () => {
    setUpdating(true);
    const { data, error } = await supabase
      .from('fatture')
      .update({ note })
      .eq('id', fattura.id)
      .select()
      .single();

    setUpdating(false);
    if (error || !data) {
      setErroreAggiorna('Note non salvate: ' + (error?.message || 'nessuna riga modificata'));
      return;
    }
    setErroreAggiorna('');
    onUpdate(data as Fattura);
  };

  const cfg = FATTURA_STATO_CONFIG[fattura.stato];
  const righe = (fattura.righe || []) as FatturaRiga[];

  // ---- PDF Generation ----
  // Riusa esattamente la grafica del preventivo (stesso font, colori,
  // logo): la fattura e' lo stesso documento un passaggio piu' avanti,
  // non un modello a se' stante che rischia di disallinearsi nel tempo.
  const generaPDF = async () => {
    setGenerating(true);
    const { data: app } = fattura.appuntamento_id
      ? await supabase
          .from('appuntamenti')
          .select('*, clienti(id,nome,email,tel), veicoli(marca,modello,targa,km)')
          .eq('id', fattura.appuntamento_id)
          .maybeSingle()
      : { data: null };
    const appBase = app as Appuntamento | null;
    const appuntamentoPerPdf: Appuntamento = appBase
      ? { ...appBase, clienti: { ...(appBase.clienti || { id: '', officina_id: officina?.id || '', email: '', tel: '' }), nome: fattura.cliente_nome || appBase.clienti?.nome || '' } }
      : ({
          id: '', officina_id: officina?.id || '', cliente_id: '', veicolo_id: '',
          data_ora: fattura.data_emissione, stato: 'prenotato', priorita: 'normale', problema: '',
          clienti: { id: '', officina_id: officina?.id || '', nome: fattura.cliente_nome || 'Cliente', email: '', tel: '' },
        } as unknown as Appuntamento);
    const accent = await extractLogoColor(officina?.logo_url);
    const html = buildPreventivoHtml(
      appuntamentoPerPdf,
      {
        id: fattura.id,
        appuntamento_id: fattura.appuntamento_id || '',
        righe: righe as unknown as Preventivo['righe'],
        subtotale: fattura.subtotale,
        sconto: 0,
        iva: fattura.iva,
        totale: fattura.totale,
        stato: 'accettato',
        created_at: fattura.data_emissione,
      },
      officina,
      accent,
      { docType: 'fattura', numero: fattura.numero, clienteCf: fattura.cliente_cf }
    );

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    setGenerating(false);
  };

  return (
    <div className="p-4 space-y-4">
      {erroreAggiorna && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          ⚠️ {erroreAggiorna}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">{fattura.numero}</h2>
          <p className="text-xs text-gray-500">{fmtData(fattura.data_emissione)}</p>
        </div>
        <Badge color={cfg.color} bg={cfg.bg}>
          {cfg.icon} {cfg.label}
        </Badge>
      </div>

      {/* Officina info */}
      <Card className="!p-3 bg-blue-50">
        <div className="text-xs text-blue-400 mb-0.5">Emittente</div>
        <p className="text-sm font-semibold text-blue-900">{officina?.nome}</p>
        <p className="text-xs text-blue-700">{officina?.indirizzo}</p>
        <p className="text-xs text-blue-700">P.IVA: {officina?.p_iva}</p>
      </Card>

      {/* Client info */}
      <Card className="!p-3">
        <div className="text-xs text-gray-400 mb-0.5">Cliente</div>
        <p className="text-sm font-semibold text-gray-900">{fattura.cliente_nome}</p>
        {fattura.cliente_cf && (
          <p className="text-xs text-gray-500">CF/P.IVA: {fattura.cliente_cf}</p>
        )}
      </Card>

      {/* Line items */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Voci ({righe.length})</h3>
        {righe.map((riga, i) => (
          <Card key={i} className="!p-3 mb-1.5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge
                    color={riga.tipo === 'manodopera' ? '#1e40af' : '#92400e'}
                    bg={riga.tipo === 'manodopera' ? '#dbeafe' : '#fef3c7'}
                  >
                    {riga.tipo === 'manodopera' ? 'Manodopera' : 'Ricambio'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 truncate">{riga.desc}</p>
                <p className="text-xs text-gray-400">
                  {riga.qta} x {fmtEuro(riga.prezzo)}
                </p>
              </div>
              <div className="text-sm font-semibold text-gray-900 ml-3">
                {fmtEuro(riga.qta * riga.prezzo)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Totals */}
      <Card className="!p-3 bg-gray-50">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotale</span><span>{fmtEuro(fattura.subtotale)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>IVA 22%</span><span>{fmtEuro(fattura.iva)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-1 border-t">
            <span>Totale</span><span>{fmtEuro(fattura.totale)}</span>
          </div>
        </div>
      </Card>

      {/* Status workflow */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Stato fattura:</p>
        <div className="space-y-2">
          {FATTURA_STATI_ORDINE.map((stato) => {
            const statoCfg = FATTURA_STATO_CONFIG[stato];
            const isActive = fattura.stato === stato;
            const currentIdx = FATTURA_STATI_ORDINE.indexOf(fattura.stato);
            const statoIdx = FATTURA_STATI_ORDINE.indexOf(stato);
            // Only allow advancing forward or staying
            const canClick = statoIdx >= currentIdx;

            return (
              <button
                key={stato}
                onClick={() => canClick && !isActive && cambiaStato(stato)}
                disabled={updating || !canClick}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  canClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                } ${
                  isActive
                    ? 'border-blue-500 bg-blue-50'
                    : canClick
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{statoCfg.icon}</span>
                  <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : canClick ? 'text-gray-700' : 'text-gray-400'}`}>
                    {statoCfg.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-blue-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <Card className="!p-3 space-y-2">
        <div className="text-xs text-gray-400">Note</div>
        <Input
          placeholder="Aggiungi note alla fattura..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {note !== (fattura.note || '') && (
          <Button variant="secondary" size="sm" onClick={salvaNote} loading={updating}>
            Salva note
          </Button>
        )}
      </Card>

      {/* PDF + Condividi */}
      <Button variant="secondary" size="sm" onClick={generaPDF} loading={generating} fullWidth>
        📄 Genera PDF
      </Button>

      <ShareDocument
        tipo="fattura"
        titolo="fattura"
        clienteNome={fattura.cliente_nome}
        emailData={{
          clienteNome: fattura.cliente_nome,
          numero: fattura.numero,
          totale: fattura.totale,
        }}
        whatsappText={`Buongiorno ${fattura.cliente_nome}, le inviamo la fattura n. ${fattura.numero} per un totale di €${fattura.totale.toFixed(2)} (IVA incl.). Può consultarla dalla app OfficinAI. — ${officina?.nome || 'OfficinAI'}`}
      />
    </div>
  );
}
