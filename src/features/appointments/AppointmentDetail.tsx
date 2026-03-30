import { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG, STATI_ORDINE } from '@/lib/constants';
import { fmtEuro, fmtDurata, fmtDataOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { WhatsAppPanel } from '@/features/notifications/WhatsAppPanel';
import { AIDiagnostics } from '@/features/ai/AIDiagnostics';
import { PDFExport } from '@/features/estimates/PDFExport';
import { AccettazioneVeicolo } from './AccettazioneVeicolo';
import type { Appuntamento, Preventivo, PreventivoRiga, FoglioLavoro, RicambioUsato, Difetto } from '@/types/database';

interface Props {
  appuntamento: Appuntamento;
  onBack: () => void;
}

type Tab = 'accettazione' | 'stato' | 'preventivo' | 'foglio' | 'foto' | 'chat' | 'wa' | 'ai';

export function AppointmentDetail({ appuntamento, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('stato');
  const [app, setApp] = useState(appuntamento);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`app-${appuntamento.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'appuntamenti',
        filter: `id=eq.${appuntamento.id}`,
      }, (payload) => {
        setApp((prev) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appuntamento.id]);

  const { utente } = useAuthStore();

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'accettazione', label: 'Accettaz.', icon: '📝' },
    { id: 'stato', label: 'Stato', icon: '📋' },
    { id: 'preventivo', label: 'Preventivo', icon: '💰' },
    { id: 'foglio', label: 'Lavoro', icon: '🔧' },
    { id: 'foto', label: 'Foto', icon: '📸' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'wa', label: 'WhatsApp', icon: '📱' },
    { id: 'ai', label: 'AI', icon: '🤖' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">
            {app.clienti?.nome}
          </h2>
          <p className="text-xs text-gray-500">
            {app.veicoli?.marca} {app.veicoli?.modello} — {app.veicoli?.targa}
          </p>
        </div>
        <Badge color={STATO_CONFIG[app.stato].color} bg={STATO_CONFIG[app.stato].bg}>
          {STATO_CONFIG[app.stato].icon} {STATO_CONFIG[app.stato].label}
        </Badge>
      </div>

      {/* Problem */}
      <Card className="!p-3">
        <div className="text-xs text-gray-400 mb-0.5">Problema</div>
        <div className="text-sm text-gray-700">{app.problema}</div>
        {app.codici_obd && (
          <div className="mt-1">
            <span className="text-[10px] text-gray-400">OBD: </span>
            <span className="text-xs font-mono text-red-600">{app.codici_obd}</span>
          </div>
        )}
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'accettazione' && (
        <AccettazioneVeicolo
          appuntamentoId={app.id}
          veicolo={app.veicoli}
          clienteNome={app.clienti?.nome}
        />
      )}
      {tab === 'stato' && <TabStato app={app} />}
      {tab === 'preventivo' && <TabPreventivo appuntamentoId={app.id} appuntamento={app} />}
      {tab === 'foglio' && <TabFoglioLavoro appuntamentoId={app.id} />}
      {tab === 'foto' && <PhotoGallery appuntamentoId={app.id} />}
      {tab === 'chat' && (
        <ChatPanel
          appuntamentoId={app.id}
          senderName={utente?.nome || 'Officina'}
          senderType="officina"
        />
      )}
      {tab === 'wa' && <WhatsAppPanel appuntamento={app} />}
      {tab === 'ai' && <AIDiagnostics appuntamento={app} />}
    </div>
  );
}

// ==================== TAB STATO ====================
function TabStato({ app }: { app: Appuntamento }) {
  const [updating, setUpdating] = useState(false);
  const [showProposta, setShowProposta] = useState(false);
  const [propostaData, setPropostaData] = useState('');
  const [propostaOra, setPropostaOra] = useState('09:00');
  const [propostaNota, setPropostaNota] = useState('');

  const cambiaStato = async (nuovoStato: string) => {
    setUpdating(true);
    await supabase
      .from('appuntamenti')
      .update({ stato: nuovoStato })
      .eq('id', app.id);
    setUpdating(false);
  };

  const accettaRichiesta = async () => {
    setUpdating(true);
    await supabase
      .from('appuntamenti')
      .update({ stato: 'prenotato' })
      .eq('id', app.id);
    setUpdating(false);
  };

  const inviaControproposta = async () => {
    if (!propostaData) return;
    setUpdating(true);
    await supabase
      .from('appuntamenti')
      .update({
        data_proposta: `${propostaData}T${propostaOra}:00`,
        nota_officina: propostaNota.trim() || null,
      })
      .eq('id', app.id);
    setUpdating(false);
    setShowProposta(false);
  };

  const today = new Date().toISOString().slice(0, 10);

  const orari = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30',
  ];

  // Show request approval UI when stato is 'richiesta'
  if (app.stato === 'richiesta') {
    return (
      <div className="space-y-3">
        <Card className="!p-4 bg-purple-50 border-purple-200">
          <div className="text-sm font-semibold text-purple-900 mb-1">🔔 Richiesta di prenotazione</div>
          <div className="text-xs text-purple-700">
            Il cliente richiede un appuntamento per il <strong>{fmtDataOra(app.data_ora)}</strong>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Problema: {app.problema}
          </div>
        </Card>

        <div className="flex gap-2">
          <button
            onClick={accettaRichiesta}
            disabled={updating}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            ✓ Accetta prenotazione
          </button>
          <button
            onClick={() => setShowProposta(!showProposta)}
            className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer"
          >
            📅 Proponi altra data
          </button>
        </div>

        {showProposta && (
          <Card className="!p-4 space-y-3">
            <div className="text-sm font-medium text-gray-900">Proponi data alternativa</div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
              <input
                type="date"
                value={propostaData}
                min={today}
                onChange={(e) => setPropostaData(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Orario</label>
              <div className="grid grid-cols-4 gap-1.5">
                {orari.map((o) => (
                  <button
                    key={o}
                    onClick={() => setPropostaOra(o)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      propostaOra === o
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opzionale)</label>
              <textarea
                value={propostaNota}
                onChange={(e) => setPropostaNota(e.target.value)}
                placeholder="Es: Il tecnico è disponibile solo nel pomeriggio..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <button
              onClick={inviaControproposta}
              disabled={!propostaData || updating}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              Invia proposta al cliente
            </button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-1">Cambia stato:</p>
      {STATI_ORDINE.filter(s => s !== 'richiesta').map((stato) => {
        const cfg = STATO_CONFIG[stato];
        const isActive = app.stato === stato;
        return (
          <button
            key={stato}
            onClick={() => !isActive && cambiaStato(stato)}
            disabled={updating}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
              isActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{cfg.icon}</span>
              <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                {cfg.label}
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
  );
}

// ==================== TAB PREVENTIVO ====================
function TabPreventivo({ appuntamentoId, appuntamento }: { appuntamentoId: string; appuntamento: Appuntamento }) {
  const [preventivo, setPreventivo] = useState<Preventivo | null>(null);
  const [righe, setRighe] = useState<PreventivoRiga[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('preventivi')
        .select('*')
        .eq('appuntamento_id', appuntamentoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setPreventivo(data);
        setRighe(data.righe || []);
      }
      setLoading(false);
    };
    fetch();
  }, [appuntamentoId]);

  const addRiga = (tipo: 'manodopera' | 'ricambio') => {
    setRighe([...righe, { tipo, desc: '', qta: 1, prezzo: 0 }]);
  };

  const updateRiga = (i: number, field: string, value: any) => {
    const updated = [...righe];
    (updated[i] as any)[field] = value;
    setRighe(updated);
  };

  const removeRiga = (i: number) => {
    setRighe(righe.filter((_, idx) => idx !== i));
  };

  const subtotale = righe.reduce((sum, r) => sum + r.qta * r.prezzo, 0);
  const iva = subtotale * 0.22;
  const totale = subtotale + iva;

  const salva = async (stato: 'bozza' | 'inviato' = 'bozza') => {
    setSaving(true);
    const payload = {
      appuntamento_id: appuntamentoId,
      righe,
      subtotale,
      sconto: 0,
      iva,
      totale,
      stato,
    };

    if (preventivo) {
      await supabase.from('preventivi').update(payload).eq('id', preventivo.id);
    } else {
      const { data } = await supabase.from('preventivi').insert(payload).select().single();
      if (data) setPreventivo(data);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>;

  return (
    <div className="space-y-3">
      {/* Status */}
      {preventivo && (
        <Badge
          color={preventivo.stato === 'accettato' ? '#065f46' : preventivo.stato === 'rifiutato' ? '#991b1b' : '#1e40af'}
          bg={preventivo.stato === 'accettato' ? '#d1fae5' : preventivo.stato === 'rifiutato' ? '#fee2e2' : '#dbeafe'}
        >
          Preventivo: {preventivo.stato.toUpperCase()}
        </Badge>
      )}

      {/* Rows */}
      {righe.map((riga, i) => (
        <Card key={i} className="!p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge
              color={riga.tipo === 'manodopera' ? '#1e40af' : '#92400e'}
              bg={riga.tipo === 'manodopera' ? '#dbeafe' : '#fef3c7'}
            >
              {riga.tipo === 'manodopera' ? '👷 Manodopera' : '⚙️ Ricambio'}
            </Badge>
            <button
              onClick={() => removeRiga(i)}
              className="text-red-400 hover:text-red-600 text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
          <Input
            placeholder="Descrizione"
            value={riga.desc}
            onChange={(e) => updateRiga(i, 'desc', e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Qtà"
              value={riga.qta}
              onChange={(e) => updateRiga(i, 'qta', Number(e.target.value))}
              className="!w-20"
            />
            <Input
              type="number"
              placeholder="Prezzo €"
              value={riga.prezzo}
              onChange={(e) => updateRiga(i, 'prezzo', Number(e.target.value))}
            />
            <div className="flex items-center text-sm font-semibold text-gray-700 min-w-[70px] justify-end">
              {fmtEuro(riga.qta * riga.prezzo)}
            </div>
          </div>
        </Card>
      ))}

      {/* Add buttons */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => addRiga('manodopera')} fullWidth>
          + Manodopera
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addRiga('ricambio')} fullWidth>
          + Ricambio
        </Button>
      </div>

      {/* Totals */}
      {righe.length > 0 && (
        <Card className="!p-3 bg-gray-50">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotale</span><span>{fmtEuro(subtotale)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA 22%</span><span>{fmtEuro(iva)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1 border-t">
              <span>Totale</span><span>{fmtEuro(totale)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => salva('bozza')} loading={saving} fullWidth>
          Salva bozza
        </Button>
        <Button onClick={() => salva('inviato')} loading={saving} fullWidth>
          Invia al cliente
        </Button>
      </div>

      {/* PDF Export */}
      {preventivo && righe.length > 0 && (
        <PDFExport appuntamento={appuntamento} preventivo={{ ...preventivo, righe, subtotale, iva, totale }} />
      )}
    </div>
  );
}

// ==================== TAB FOGLIO LAVORO ====================
function TabFoglioLavoro({ appuntamentoId }: { appuntamentoId: string }) {
  const { utente } = useAuthStore();
  const [foglio, setFoglio] = useState<FoglioLavoro | null>(null);
  const [ricambi, setRicambi] = useState<RicambioUsato[]>([]);
  const [difetti, setDifetti] = useState<Difetto[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerMs, setTimerMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: fl } = await supabase
        .from('foglio_lavoro')
        .select('*')
        .eq('appuntamento_id', appuntamentoId)
        .single();

      if (fl) {
        setFoglio(fl);
        setTimerMs(fl.tempo_lavoro_ms || 0);

        const [{ data: ric }, { data: dif }] = await Promise.all([
          supabase.from('ricambi_usati').select('*').eq('foglio_lavoro_id', fl.id),
          supabase.from('difetti').select('*').eq('foglio_lavoro_id', fl.id),
        ]);
        setRicambi(ric || []);
        setDifetti(dif || []);
      }
      setLoading(false);
    };
    fetch();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appuntamentoId]);

  const creaFoglio = async () => {
    const { data } = await supabase
      .from('foglio_lavoro')
      .insert({
        appuntamento_id: appuntamentoId,
        tecnico_id: utente?.id,
        tempo_lavoro_ms: 0,
        pause: 0,
        chiuso: false,
      })
      .select()
      .single();
    if (data) setFoglio(data);
  };

  const startTimer = () => {
    setTimerActive(true);
    const start = Date.now() - timerMs;
    timerRef.current = setInterval(() => {
      setTimerMs(Date.now() - start);
    }, 1000);
  };

  const pauseTimer = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    if (foglio) {
      await supabase
        .from('foglio_lavoro')
        .update({ tempo_lavoro_ms: timerMs, pause: (foglio.pause || 0) + 1 })
        .eq('id', foglio.id);
    }
  };

  const chiudiFoglio = async () => {
    if (!foglio) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    await supabase
      .from('foglio_lavoro')
      .update({ tempo_lavoro_ms: timerMs, fine: new Date().toISOString(), chiuso: true })
      .eq('id', foglio.id);
    setFoglio({ ...foglio, chiuso: true, fine: new Date().toISOString() });
  };

  // Add ricambio
  const addRicambio = async () => {
    if (!foglio) return;
    const { data } = await supabase
      .from('ricambi_usati')
      .insert({ foglio_lavoro_id: foglio.id, nome: 'Nuovo ricambio', quantita: 1, prezzo: 0 })
      .select()
      .single();
    if (data) setRicambi([...ricambi, data]);
  };

  // Add difetto
  const addDifetto = async () => {
    if (!foglio) return;
    const { data } = await supabase
      .from('difetti')
      .insert({ foglio_lavoro_id: foglio.id, descrizione: '', gravita: 'media', risolto: false })
      .select()
      .single();
    if (data) setDifetti([...difetti, data]);
  };

  if (loading) return <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>;

  if (!foglio) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm mb-4">Nessun foglio di lavoro aperto</p>
        <Button onClick={creaFoglio}>Crea Foglio Lavoro</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timer */}
      <Card className="text-center !p-5">
        <div className="text-4xl font-mono font-bold text-gray-900 mb-1">
          {fmtDurata(timerMs)}
        </div>
        <div className="text-xs text-gray-400 mb-3">
          Pause: {foglio.pause || 0} {foglio.chiuso && '• CHIUSO'}
        </div>
        {!foglio.chiuso && (
          <div className="flex gap-2 justify-center">
            {!timerActive ? (
              <Button onClick={startTimer} variant="success" size="sm">
                ▶ {timerMs > 0 ? 'Riprendi' : 'Avvia'}
              </Button>
            ) : (
              <Button onClick={pauseTimer} variant="secondary" size="sm">
                ⏸ Pausa
              </Button>
            )}
            <Button onClick={chiudiFoglio} variant="danger" size="sm">
              ⏹ Chiudi lavoro
            </Button>
          </div>
        )}
      </Card>

      {/* Ricambi usati */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Ricambi usati ({ricambi.length})</h3>
          {!foglio.chiuso && (
            <Button variant="ghost" size="sm" onClick={addRicambio}>+ Aggiungi</Button>
          )}
        </div>
        {ricambi.map((r) => (
          <Card key={r.id} className="!p-2 mb-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{r.nome}</span>
              <span className="text-gray-500">x{r.quantita} — {fmtEuro(r.prezzo)}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Difetti */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Difetti trovati ({difetti.length})</h3>
          {!foglio.chiuso && (
            <Button variant="ghost" size="sm" onClick={addDifetto}>+ Aggiungi</Button>
          )}
        </div>
        {difetti.map((d) => (
          <Card key={d.id} className="!p-2 mb-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Badge
                color={d.gravita === 'critica' || d.gravita === 'alta' ? '#991b1b' : '#92400e'}
                bg={d.gravita === 'critica' || d.gravita === 'alta' ? '#fee2e2' : '#fef3c7'}
              >
                {d.gravita}
              </Badge>
              <span className="text-gray-700">{d.descrizione || 'Nuovo difetto'}</span>
              {d.risolto && <span className="text-emerald-500 ml-auto">✓</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
