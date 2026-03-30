import { useState, useRef, useEffect } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';

interface Props {
  appuntamentoId: string;
  veicolo?: { marca?: string; modello?: string; targa?: string; km?: number };
  clienteNome?: string;
}

interface DannoPoint {
  x: number;
  y: number;
  tipo: string;
  nota: string;
}

interface AccettazioneData {
  km_ingresso: number;
  livello_carburante: number; // 0-100
  danni: DannoPoint[];
  checklist: Record<string, boolean>;
  oggetti_personali: string;
  note_accettazione: string;
  firma_cliente: string | null; // base64 image
}

const CHECKLIST_ITEMS = [
  { key: 'documenti', label: 'Documenti a bordo (libretto, assicurazione)' },
  { key: 'ruota_scorta', label: 'Ruota di scorta / kit riparazione' },
  { key: 'triangolo', label: 'Triangolo di emergenza' },
  { key: 'giubbotto', label: 'Giubbotto catarifrangente' },
  { key: 'antenna', label: 'Antenna presente' },
  { key: 'tappetini', label: 'Tappetini presenti' },
  { key: 'copricerchi', label: 'Copricerchi completi' },
  { key: 'specchietti', label: 'Specchietti integri' },
  { key: 'tergicristalli', label: 'Tergicristalli funzionanti' },
  { key: 'luci', label: 'Luci funzionanti' },
  { key: 'clacson', label: 'Clacson funzionante' },
  { key: 'aria_cond', label: 'Aria condizionata funzionante' },
  { key: 'radio', label: 'Radio / infotainment' },
  { key: 'cinture', label: 'Cinture di sicurezza' },
];

const TIPI_DANNO = [
  { key: 'graffio', label: 'Graffio', color: '#ef4444' },
  { key: 'ammaccatura', label: 'Ammaccatura', color: '#f59e0b' },
  { key: 'rottura', label: 'Rottura', color: '#7c3aed' },
  { key: 'ruggine', label: 'Ruggine', color: '#92400e' },
  { key: 'scheggiatura', label: 'Scheggiatura', color: '#3b82f6' },
];

export function AccettazioneVeicolo({ appuntamentoId, veicolo, clienteNome }: Props) {
  const [step, setStep] = useState<'form' | 'firma' | 'done'>('form');
  const [saving, setSaving] = useState(false);
  const [kmIngresso, setKmIngresso] = useState(veicolo?.km?.toString() || '');
  const [carburante, setCarburante] = useState(50);
  const [danni, setDanni] = useState<DannoPoint[]>([]);
  const [tipoDannoSel, setTipoDannoSel] = useState('graffio');
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.key, true]))
  );
  const [oggettiPersonali, setOggettiPersonali] = useState('');
  const [noteAccettazione, setNoteAccettazione] = useState('');
  const [existing, setExisting] = useState<AccettazioneData | null>(null);

  // Firma
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load existing
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('accettazioni')
        .select('*')
        .eq('appuntamento_id', appuntamentoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setExisting(data);
        setKmIngresso(data.km_ingresso?.toString() || '');
        setCarburante(data.livello_carburante || 50);
        setDanni(data.danni || []);
        setChecklist(data.checklist || {});
        setOggettiPersonali(data.oggetti_personali || '');
        setNoteAccettazione(data.note_accettazione || '');
        if (data.firma_cliente) setStep('done');
      }
    };
    load();
  }, [appuntamentoId]);

  // Car diagram click handler
  const handleCarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const nota = prompt('Descrivi il danno:') || '';
    setDanni(prev => [...prev, { x, y, tipo: tipoDannoSel, nota }]);
  };

  const removeDanno = (index: number) => {
    setDanni(prev => prev.filter((_, i) => i !== index));
  };

  const toggleChecklist = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Signature canvas handlers
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  useEffect(() => {
    if (step === 'firma') {
      setTimeout(initCanvas, 100);
    }
  }, [step]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getCanvasPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearSignature = () => initCanvas();

  const saveAccettazione = async (firma: string | null) => {
    setSaving(true);
    const data: any = {
      appuntamento_id: appuntamentoId,
      km_ingresso: parseInt(kmIngresso) || 0,
      livello_carburante: carburante,
      danni,
      checklist,
      oggetti_personali: oggettiPersonali.trim(),
      note_accettazione: noteAccettazione.trim(),
      firma_cliente: firma,
    };

    if (existing) {
      await supabase.from('accettazioni').update(data).eq('appuntamento_id', appuntamentoId);
    } else {
      await supabase.from('accettazioni').insert(data);
    }
    setSaving(false);
    setStep('done');
  };

  const goToFirma = () => setStep('firma');

  const confirmFirma = () => {
    const canvas = canvasRef.current;
    const firma = canvas ? canvas.toDataURL('image/png') : null;
    saveAccettazione(firma);
  };

  // Fuel gauge visual
  const fuelColor = carburante < 15 ? '#ef4444' : carburante < 30 ? '#f59e0b' : '#10b981';

  // ---- DONE VIEW ----
  if (step === 'done') {
    return (
      <div className="space-y-4">
        <Card className="!p-4 bg-emerald-50 border-emerald-200 text-center">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-sm font-bold text-emerald-900">Accettazione completata</div>
          <div className="text-xs text-emerald-700 mt-1">
            {veicolo?.marca} {veicolo?.modello} — {veicolo?.targa}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-3 text-center">
            <div className="text-xs text-gray-400">Km ingresso</div>
            <div className="text-lg font-bold text-gray-900">{parseInt(kmIngresso)?.toLocaleString() || '—'}</div>
          </Card>
          <Card className="!p-3 text-center">
            <div className="text-xs text-gray-400">Carburante</div>
            <div className="text-lg font-bold" style={{ color: fuelColor }}>{carburante}%</div>
          </Card>
        </div>

        {danni.length > 0 && (
          <Card className="!p-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Danni rilevati ({danni.length})</div>
            {danni.map((d, i) => (
              <div key={i} className="text-xs text-gray-600">
                • {TIPI_DANNO.find(t => t.key === d.tipo)?.label}: {d.nota || 'Nessuna nota'}
              </div>
            ))}
          </Card>
        )}

        <Button variant="secondary" fullWidth onClick={() => setStep('form')}>
          Modifica accettazione
        </Button>
      </div>
    );
  }

  // ---- FIRMA VIEW ----
  if (step === 'firma') {
    return (
      <div className="space-y-4">
        <Card className="!p-4">
          <div className="text-sm font-bold text-gray-900 mb-2">Firma del cliente</div>
          <div className="text-xs text-gray-500 mb-3">
            {clienteNome || 'Il cliente'} conferma lo stato del veicolo al momento della consegna
          </div>
          <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={340}
              height={180}
              className="w-full touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" fullWidth onClick={clearSignature}>
              Cancella
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setStep('form')}>
              Indietro
            </Button>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button fullWidth onClick={confirmFirma} loading={saving}>
            Conferma e salva
          </Button>
          <Button variant="secondary" fullWidth onClick={() => saveAccettazione(null)}>
            Salva senza firma
          </Button>
        </div>
      </div>
    );
  }

  // ---- FORM VIEW ----
  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <Card className="!p-3 bg-blue-50 border-blue-200">
        <div className="text-sm font-bold text-blue-900">Accettazione veicolo</div>
        <div className="text-xs text-blue-700">
          {veicolo?.marca} {veicolo?.modello} — {veicolo?.targa}
        </div>
      </Card>

      {/* KM + Fuel */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Km ingresso"
          type="number"
          value={kmIngresso}
          onChange={(e) => setKmIngresso(e.target.value)}
          placeholder="50000"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Carburante: <span style={{ color: fuelColor, fontWeight: 700 }}>{carburante}%</span>
          </label>
          <div className="relative pt-1">
            <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${carburante}%`, backgroundColor: fuelColor }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={carburante}
              onChange={(e) => setCarburante(parseInt(e.target.value))}
              className="absolute inset-0 w-full h-6 opacity-0 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5 px-0.5">
              <span>E</span><span>1/4</span><span>1/2</span><span>3/4</span><span>F</span>
            </div>
          </div>
        </div>
      </div>

      {/* Car body damage map */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-gray-900">Mappa danni carrozzeria</div>
          <div className="text-[10px] text-gray-400">Tocca sulla sagoma per segnare un danno</div>
        </div>

        {/* Damage type selector */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {TIPI_DANNO.map((tipo) => (
            <button
              key={tipo.key}
              onClick={() => setTipoDannoSel(tipo.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                tipoDannoSel === tipo.key
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={tipoDannoSel === tipo.key ? { backgroundColor: tipo.color } : {}}
            >
              {tipo.label}
            </button>
          ))}
        </div>

        {/* Car silhouette - top-down view */}
        <div
          className="relative bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 cursor-crosshair overflow-hidden"
          style={{ height: 280 }}
          onClick={handleCarClick}
        >
          {/* Car SVG silhouette - top view */}
          <svg viewBox="0 0 200 400" className="absolute inset-0 w-full h-full p-4 opacity-20">
            {/* Body */}
            <rect x="40" y="60" width="120" height="280" rx="30" fill="#64748b" />
            {/* Windshield */}
            <rect x="50" y="90" width="100" height="50" rx="10" fill="#94a3b8" />
            {/* Rear window */}
            <rect x="50" y="260" width="100" height="40" rx="10" fill="#94a3b8" />
            {/* Front */}
            <ellipse cx="100" cy="65" rx="45" ry="15" fill="#475569" />
            {/* Rear */}
            <ellipse cx="100" cy="335" rx="45" ry="15" fill="#475569" />
            {/* Wheels */}
            <rect x="28" y="100" width="15" height="40" rx="5" fill="#334155" />
            <rect x="157" y="100" width="15" height="40" rx="5" fill="#334155" />
            <rect x="28" y="260" width="15" height="40" rx="5" fill="#334155" />
            <rect x="157" y="260" width="15" height="40" rx="5" fill="#334155" />
            {/* Side mirrors */}
            <ellipse cx="32" cy="120" rx="8" ry="5" fill="#475569" />
            <ellipse cx="168" cy="120" rx="8" ry="5" fill="#475569" />
          </svg>

          {/* Labels */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-semibold">ANTERIORE</div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-semibold">POSTERIORE</div>
          <div className="absolute top-1/2 left-1 -translate-y-1/2 text-[9px] text-gray-400 font-semibold" style={{ writingMode: 'vertical-lr' }}>SX</div>
          <div className="absolute top-1/2 right-1 -translate-y-1/2 text-[9px] text-gray-400 font-semibold" style={{ writingMode: 'vertical-lr' }}>DX</div>

          {/* Damage markers */}
          {danni.map((d, i) => {
            const tipo = TIPI_DANNO.find(t => t.key === d.tipo);
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); removeDanno(i); }}
                className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[8px] font-bold transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform cursor-pointer"
                style={{ left: `${d.x}%`, top: `${d.y}%`, backgroundColor: tipo?.color || '#ef4444' }}
                title={`${tipo?.label}: ${d.nota} (clicca per rimuovere)`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Damage list */}
        {danni.length > 0 && (
          <div className="mt-2 space-y-1">
            {danni.map((d, i) => {
              const tipo = TIPI_DANNO.find(t => t.key === d.tipo);
              return (
                <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tipo?.color }} />
                    <span className="font-medium text-gray-700">{tipo?.label}</span>
                    {d.nota && <span className="text-gray-400">— {d.nota}</span>}
                  </div>
                  <button
                    onClick={() => removeDanno(i)}
                    className="text-red-400 hover:text-red-600 cursor-pointer text-xs"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Checklist */}
      <Card className="!p-4">
        <div className="text-sm font-bold text-gray-900 mb-3">Checklist condizioni</div>
        <div className="grid grid-cols-1 gap-1.5">
          {CHECKLIST_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => toggleChecklist(item.key)}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left"
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                checklist[item.key]
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-300 text-transparent'
              }`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className={`text-xs ${checklist[item.key] ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Personal objects */}
      <Card className="!p-4">
        <label className="block text-sm font-bold text-gray-900 mb-2">Oggetti personali a bordo</label>
        <textarea
          value={oggettiPersonali}
          onChange={(e) => setOggettiPersonali(e.target.value)}
          placeholder="Es: GPS sul cruscotto, seggiolino bambino posteriore, cavi batteria nel bagagliaio..."
          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </Card>

      {/* Notes */}
      <Card className="!p-4">
        <label className="block text-sm font-bold text-gray-900 mb-2">Note accettazione</label>
        <textarea
          value={noteAccettazione}
          onChange={(e) => setNoteAccettazione(e.target.value)}
          placeholder="Es: Cliente segnala rumore sospensioni anteriori, consigliato controllo freni..."
          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </Card>

      {/* Actions */}
      <Button fullWidth onClick={goToFirma}>
        Procedi alla firma del cliente
      </Button>
    </div>
  );
}
