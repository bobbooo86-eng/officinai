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
import { ShareDocument } from '@/components/ShareDocument';
import { sendStatusUpdate, sendAppointmentConfirmation, sendProposalChange } from '@/lib/email';
import { format, parseISO } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { AccettazioneVeicolo } from './AccettazioneVeicolo';
import { StoricoVeicolo } from './StoricoVeicolo';
import type { Appuntamento, Preventivo, PreventivoRiga, FoglioLavoro, RicambioUsato, Difetto, PagamentoInfo, PagamentoStato } from '@/types/database';

interface Props {
  appuntamento: Appuntamento;
  onBack: () => void;
}

type Tab = 'accettazione' | 'stato' | 'preventivo' | 'foglio' | 'foto' | 'chat' | 'wa' | 'ai';

export function AppointmentDetail({ appuntamento, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('stato');
  const [app, setApp] = useState(appuntamento);
  const [arrivando, setArrivando] = useState(false);
  const [erroreArrivo, setErroreArrivo] = useState<string | null>(null);
  const [showStorico, setShowStorico] = useState(false);

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

  // Auto è "in officina" se stato è oltre prenotato (in_diagnosi, in_lavorazione, ecc.)
  const autoInOfficina = app.stato !== 'richiesta' && app.stato !== 'prenotato';

  const handleAutoArrivata = async () => {
    setArrivando(true);
    setErroreArrivo(null);
    try {
      const { error } = await supabase
        .from('appuntamenti')
        .update({ stato: 'in_diagnosi' })
        .eq('id', app.id);
      if (error) throw error;
      setTab('accettazione');
    } catch (err) {
      console.error('Errore registrazione arrivo:', err);
      setErroreArrivo('Errore durante la registrazione dell\'arrivo. Riprova.');
    } finally {
      setArrivando(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: string; disabled?: boolean }[] = [
    { id: 'accettazione', label: 'Accettaz.', icon: '📝', disabled: !autoInOfficina },
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
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">
              {app.veicoli?.marca} {app.veicoli?.modello} — {app.veicoli?.targa}
            </p>
            {app.veicoli && (
              <button
                onClick={() => setShowStorico(true)}
                className="text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer font-medium whitespace-nowrap"
              >
                Storico veicolo
              </button>
            )}
          </div>
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

      {/* "Auto arrivata in officina" button — visible only when prenotato */}
      {app.stato === 'prenotato' && (
        <div className="space-y-2">
          <button
            onClick={handleAutoArrivata}
            disabled={arrivando}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer disabled:opacity-50 shadow-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">🚗</span>
              <div className="text-left">
                <div className="font-bold text-sm">{arrivando ? 'Registrazione...' : 'Auto arrivata in officina'}</div>
                <div className="text-[11px] text-blue-200">Registra l'ingresso e avvia l'accettazione</div>
              </div>
              <span className="text-xl ml-auto">→</span>
            </div>
          </button>
          {erroreArrivo && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {erroreArrivo}
            </div>
          )}
        </div>
      )}

      {/* Indicator: auto in officina */}
      {autoInOfficina && app.stato !== 'pronto' && app.stato !== 'annullato' && (
        <Card className="!p-2 bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🏭</span>
              <span className="text-xs font-semibold text-emerald-800">Auto in officina</span>
            </div>
            <button
              onClick={async () => {
                if (!confirm('Riportare a "Prenotato"? (annulla ingresso in officina)')) return;
                await supabase.from('appuntamenti').update({ stato: 'prenotato' }).eq('id', app.id);
              }}
              className="text-[10px] text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              ↩ Annulla ingresso
            </button>
          </div>
        </Card>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              t.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : tab === t.id
                  ? 'bg-white text-blue-600 shadow-sm cursor-pointer'
                  : 'text-gray-500 hover:text-gray-700 cursor-pointer'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'accettazione' && autoInOfficina && (
        <AccettazioneVeicolo
          appuntamentoId={app.id}
          veicolo={app.veicoli}
          clienteNome={app.clienti?.nome}
        />
      )}
      {tab === 'accettazione' && !autoInOfficina && (
        <Card className="!p-6 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <div className="text-sm font-semibold text-gray-700">Accettazione non disponibile</div>
          <div className="text-xs text-gray-400 mt-1">
            Clicca "Auto arrivata in officina" per avviare l'accettazione
          </div>
        </Card>
      )}
      {tab === 'stato' && <TabStato app={app} />}
      {tab === 'preventivo' && <TabPreventivo appuntamentoId={app.id} appuntamento={app} />}
      {tab === 'foglio' && <TabFoglioLavoro appuntamentoId={app.id} statoAppuntamento={app.stato} veicolo={app.veicoli} clienteNome={app.clienti?.nome} clienteEmail={app.clienti?.email} clienteTel={app.clienti?.tel} clienteId={app.cliente_id} problema={app.problema} />}
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

      {/* Storico veicolo overlay */}
      {showStorico && app.veicoli && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <StoricoVeicolo
            veicolo={app.veicoli}
            clienteNome={app.clienti?.nome || ''}
            onBack={() => setShowStorico(false)}
          />
        </div>
      )}
    </div>
  );
}

// ==================== MODAL PAGAMENTO CONSEGNA ====================
function ModalPagamento({ onConferma, onAnnulla }: {
  onConferma: (pagamento: PagamentoInfo) => void;
  onAnnulla: () => void;
}) {
  const [statoPag, setStatoPag] = useState<PagamentoStato>('pagato');
  const [importoPagato, setImportoPagato] = useState('');
  const [importoTotale, setImportoTotale] = useState('');
  const [note, setNote] = useState('');

  const conferma = () => {
    onConferma({
      stato: statoPag,
      importo_pagato: importoPagato ? parseFloat(importoPagato) : undefined,
      importo_totale: importoTotale ? parseFloat(importoTotale) : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm space-y-4 p-5 animate-fade-in">
        <div className="text-center">
          <div className="text-3xl mb-1">🏁</div>
          <h3 className="text-base font-bold text-gray-900">Consegna auto</h3>
          <p className="text-xs text-gray-500 mt-0.5">Come ha pagato il cliente?</p>
        </div>

        {/* Opzioni pagamento */}
        <div className="space-y-2">
          {([
            { v: 'pagato', icon: '✅', label: 'Pagato completo', color: 'emerald' },
            { v: 'acconto', icon: '💛', label: 'Acconto / parziale', color: 'amber' },
            { v: 'non_pagato', icon: '🔴', label: 'Non pagato', color: 'red' },
          ] as const).map(({ v, icon, label, color }) => (
            <button
              key={v}
              onClick={() => setStatoPag(v)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                statoPag === v
                  ? color === 'emerald' ? 'border-emerald-500 bg-emerald-50'
                    : color === 'amber' ? 'border-amber-400 bg-amber-50'
                    : 'border-red-400 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span className={`text-sm font-semibold ${statoPag === v ? (color === 'emerald' ? 'text-emerald-800' : color === 'amber' ? 'text-amber-800' : 'text-red-800') : 'text-gray-700'}`}>
                {label}
              </span>
              {statoPag === v && <span className="ml-auto text-blue-500">✓</span>}
            </button>
          ))}
        </div>

        {/* Importi (per acconto e non pagato) */}
        {(statoPag === 'acconto' || statoPag === 'non_pagato') && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Totale da pagare (€)</label>
                <input
                  type="number"
                  value={importoTotale}
                  onChange={(e) => setImportoTotale(e.target.value)}
                  placeholder="es. 350"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {statoPag === 'acconto' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Già pagato (€)</label>
                  <input
                    type="number"
                    value={importoPagato}
                    onChange={(e) => setImportoPagato(e.target.value)}
                    placeholder="es. 100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note (opzionale)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="es. paga resto la settimana prossima"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onAnnulla}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 cursor-pointer transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={conferma}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 cursor-pointer transition-colors"
          >
            Conferma consegna
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TAB STATO ====================
function TabStato({ app }: { app: Appuntamento }) {
  const { officina } = useAuthStore();
  const [updating, setUpdating] = useState(false);
  const [showProposta, setShowProposta] = useState(false);
  const [propostaData, setPropostaData] = useState('');
  const [propostaOra, setPropostaOra] = useState('09:00');
  const [propostaNota, setPropostaNota] = useState('');
  const [showConsegnaModal, setShowConsegnaModal] = useState(false);
  const [erroreAzione, setErroreAzione] = useState('');

  // Auto-send email on status change
  const notificaCliente = (nuovoStato: string) => {
    const email = app.clienti?.email;
    if (!email) return;
    const veicolo = app.veicoli ? `${app.veicoli.marca} ${app.veicoli.modello}` : '';
    sendStatusUpdate(email, {
      clienteNome: app.clienti?.nome || 'Cliente',
      veicolo,
      nuovoStato,
      officinaNome: officina?.nome || 'OfficinAI',
    }).catch(() => {}); // Fire and forget
  };

  const cambiaStato = async (nuovoStato: string, pagamento?: PagamentoInfo) => {
    setUpdating(true);
    setErroreAzione('');
    const update: Record<string, unknown> = { stato: nuovoStato };
    if (pagamento) update.pagamento = pagamento;
    const { error: statoErr } = await supabase
      .from('appuntamenti')
      .update(update)
      .eq('id', app.id);
    setUpdating(false);
    // Il cliente non va avvisato di un cambio di stato che non e' avvenuto.
    if (statoErr) {
      setErroreAzione('Stato non aggiornato: ' + statoErr.message);
      return;
    }
    notificaCliente(nuovoStato);
  };

  const handleConsegna = () => {
    setShowConsegnaModal(true);
  };

  const confermaConsegna = async (pagamento: PagamentoInfo) => {
    setShowConsegnaModal(false);
    await cambiaStato('consegnato', pagamento);
  };

  const notifyClienteInApp = async (titolo: string, messaggio: string) => {
    if (!app.cliente_id || !officina?.id) return;
    try {
      await supabase.from('notifiche').insert({
        officina_id: officina.id,
        cliente_id: app.cliente_id,
        tipo: 'appuntamento',
        titolo,
        messaggio,
        link_tipo: 'appuntamento',
        link_id: app.id,
      });
    } catch {
      // notifiche table may not yet support cliente_id — ignore
    }
  };

  const openWhatsApp = (testo: string) => {
    const tel = app.clienti?.tel;
    if (!tel) return;
    const numero = tel.replace(/[^0-9+]/g, '');
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const accettaRichiesta = async (conWhatsapp = false) => {
    setUpdating(true);
    await supabase
      .from('appuntamenti')
      .update({ stato: 'prenotato' })
      .eq('id', app.id);

    const d = parseISO(app.data_ora);
    const dataFmt = format(d, 'dd/MM/yyyy', { locale: itLocale });
    const oraFmt = format(d, 'HH:mm');
    const clienteNome = app.clienti?.nome || 'Cliente';
    const veicoloStr = app.veicoli ? `${app.veicoli.marca} ${app.veicoli.modello}` : '';
    const officinaNome = officina?.nome || 'OfficinAI';

    // Send confirmation email
    const email = app.clienti?.email;
    if (email) {
      sendAppointmentConfirmation(email, {
        clienteNome,
        data: dataFmt,
        ora: oraFmt,
        officinaNome,
        veicolo: veicoloStr || undefined,
      }).catch(() => {});
    }

    // In-app notification for the cliente
    notifyClienteInApp(
      'Appuntamento confermato',
      `Il tuo appuntamento per ${veicoloStr || 'il veicolo'} del ${dataFmt} alle ${oraFmt} è stato confermato.`
    );

    // Optional WhatsApp message
    if (conWhatsapp) {
      const testo = `Buongiorno ${clienteNome}, il suo appuntamento per ${veicoloStr || 'il veicolo'} del ${dataFmt} alle ore ${oraFmt} è stato CONFERMATO. L'aspettiamo! — ${officinaNome}`;
      openWhatsApp(testo);
    }

    setUpdating(false);
  };

  const inviaControproposta = async (conWhatsapp = false) => {
    if (!propostaData) return;
    setUpdating(true);
    setErroreAzione('');
    const nuovaDataIso = new Date(`${propostaData}T${propostaOra}:00`).toISOString();
    const { error: propErr } = await supabase
      .from('appuntamenti')
      .update({
        data_proposta: nuovaDataIso,
        nota_officina: propostaNota.trim() || null,
      })
      .eq('id', app.id);
    // Senza questo controllo il cliente riceveva email e WhatsApp con una
    // data che in realta' non era stata registrata.
    if (propErr) {
      setUpdating(false);
      setErroreAzione('Proposta non salvata: ' + propErr.message);
      return;
    }

    const d = parseISO(nuovaDataIso);
    const dataFmt = format(d, 'dd/MM/yyyy', { locale: itLocale });
    const oraFmt = format(d, 'HH:mm');
    const clienteNome = app.clienti?.nome || 'Cliente';
    const veicoloStr = app.veicoli ? `${app.veicoli.marca} ${app.veicoli.modello}` : '';
    const officinaNome = officina?.nome || 'OfficinAI';
    const nota = propostaNota.trim();

    // Email
    const email = app.clienti?.email;
    if (email) {
      sendProposalChange(email, {
        clienteNome,
        data: dataFmt,
        ora: oraFmt,
        officinaNome,
        veicolo: veicoloStr || undefined,
        nota: nota || undefined,
      }).catch(() => {});
    }

    // In-app notification
    notifyClienteInApp(
      'Nuova data proposta',
      `L'officina propone di spostare l'appuntamento al ${dataFmt} alle ${oraFmt}.${nota ? ` Nota: ${nota}` : ''}`
    );

    // Optional WhatsApp message
    if (conWhatsapp) {
      const testo = `Buongiorno ${clienteNome}, le proponiamo una nuova data per il suo appuntamento${veicoloStr ? ` (${veicoloStr})` : ''}: ${dataFmt} alle ore ${oraFmt}.${nota ? `\n\n${nota}` : ''}\n\nAccede all'app per confermare o contattarci. — ${officinaNome}`;
      openWhatsApp(testo);
    }

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
  const bannerErrore = erroreAzione ? (
    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
      ⚠️ {erroreAzione}
    </div>
  ) : null;

  if (app.stato === 'richiesta') {
    return (
      <div className="space-y-3">
        {bannerErrore}
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
            onClick={() => accettaRichiesta(false)}
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

        {app.clienti?.tel && (
          <button
            onClick={() => accettaRichiesta(true)}
            disabled={updating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span>📱</span> Accetta e avvisa il cliente via WhatsApp
          </button>
        )}

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

            <div className="flex flex-col gap-2">
              <button
                onClick={() => inviaControproposta(false)}
                disabled={!propostaData || updating}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                Invia proposta al cliente
              </button>
              {app.clienti?.tel && (
                <button
                  onClick={() => inviaControproposta(true)}
                  disabled={!propostaData || updating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>📱</span> Invia proposta + WhatsApp
                </button>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }

  const annullaAppuntamento = async () => {
    if (!confirm('Sei sicuro di voler annullare questo appuntamento?')) return;
    setUpdating(true);
    await supabase
      .from('appuntamenti')
      .update({ stato: 'annullato' })
      .eq('id', app.id);
    setUpdating(false);
  };

  const riportaAPrenotato = async () => {
    if (!confirm('Riportare l\'appuntamento a "Prenotato"?')) return;
    setUpdating(true);
    await supabase
      .from('appuntamenti')
      .update({ stato: 'prenotato' })
      .eq('id', app.id);
    setUpdating(false);
  };

  // Annullato view
  if (app.stato === 'annullato') {
    return (
      <div className="space-y-3">
        <Card className="!p-4 bg-gray-50 border-gray-300 text-center">
          <div className="text-3xl mb-2">🚫</div>
          <div className="text-sm font-bold text-gray-700">Appuntamento annullato</div>
        </Card>
        <button
          onClick={() => cambiaStato('prenotato')}
          disabled={updating}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          ↩ Ripristina appuntamento
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bannerErrore}
      {showConsegnaModal && (
        <ModalPagamento
          onConferma={confermaConsegna}
          onAnnulla={() => setShowConsegnaModal(false)}
        />
      )}

      {/* Pagamento info — se già consegnato */}
      {app.stato === 'consegnato' && app.pagamento && (
        <div className={`p-3 rounded-xl border-2 mb-2 ${
          app.pagamento.stato === 'pagato' ? 'bg-emerald-50 border-emerald-300' :
          app.pagamento.stato === 'acconto' ? 'bg-amber-50 border-amber-300' :
          'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {app.pagamento.stato === 'pagato' ? '✅' : app.pagamento.stato === 'acconto' ? '💛' : '🔴'}
            </span>
            <div>
              <div className={`text-sm font-bold ${
                app.pagamento.stato === 'pagato' ? 'text-emerald-800' :
                app.pagamento.stato === 'acconto' ? 'text-amber-800' : 'text-red-800'
              }`}>
                {app.pagamento.stato === 'pagato' ? 'Pagato completo' :
                 app.pagamento.stato === 'acconto' ? 'Pagato parzialmente' : 'Non pagato'}
              </div>
              {app.pagamento.importo_totale != null && (
                <div className="text-xs text-gray-600">
                  Totale: €{app.pagamento.importo_totale.toFixed(2)}
                  {app.pagamento.stato === 'acconto' && app.pagamento.importo_pagato != null && (
                    <> — Acconto: €{app.pagamento.importo_pagato.toFixed(2)} — <span className="font-semibold text-red-600">Resto: €{(app.pagamento.importo_totale - app.pagamento.importo_pagato).toFixed(2)}</span></>
                  )}
                </div>
              )}
              {app.pagamento.note && <div className="text-xs text-gray-500 mt-0.5">{app.pagamento.note}</div>}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mb-1">Cambia stato:</p>
      {STATI_ORDINE.filter(s => s !== 'richiesta').map((stato) => {
        const cfg = STATO_CONFIG[stato];
        const isActive = app.stato === stato;
        return (
          <button
            key={stato}
            onClick={() => !isActive && (stato === 'consegnato' ? handleConsegna() : cambiaStato(stato))}
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

      {/* Undo / Back actions */}
      <div className="pt-3 border-t border-gray-200 space-y-2">
        {/* Riporta a prenotato (undo "auto in officina") */}
        {(app.stato === 'in_diagnosi' || app.stato === 'in_lavorazione') && (
          <button
            onClick={riportaAPrenotato}
            disabled={updating}
            className="w-full py-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            ↩ Riporta a Prenotato (annulla ingresso)
          </button>
        )}

        {/* Annulla appuntamento — sempre disponibile tranne se già pronto */}
        {app.stato !== 'pronto' && (
          <button
            onClick={annullaAppuntamento}
            disabled={updating}
            className="w-full py-2.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            🚫 Annulla appuntamento
          </button>
        )}
      </div>
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
    if (!confirm('Eliminare questa riga?')) return;
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

// ==================== VOICE INPUT HOOK ====================
function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop, supported: !!(typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) };
}

function VoiceButton({ onResult, className }: { onResult: (text: string) => void; className?: string }) {
  const { listening, start, stop, supported } = useVoiceInput(onResult);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
        listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } ${className || ''}`}
      title={listening ? 'Stop registrazione' : 'Parla per inserire'}
    >
      <span className="text-sm">{listening ? '⏹' : '🎤'}</span>
    </button>
  );
}

// ==================== CATALOGO RICAMBI COMUNI ====================
const RICAMBI_COMUNI: { nome: string; cat: string; prezzo?: number }[] = [
  // Tagliando
  { nome: 'Filtro olio', cat: 'Tagliando', prezzo: 12 },
  { nome: 'Filtro aria motore', cat: 'Tagliando', prezzo: 18 },
  { nome: 'Filtro abitacolo / antipolline', cat: 'Tagliando', prezzo: 15 },
  { nome: 'Filtro carburante gasolio', cat: 'Tagliando', prezzo: 22 },
  { nome: 'Olio motore 5W30 (5L)', cat: 'Tagliando', prezzo: 35 },
  { nome: 'Olio motore 5W40 (5L)', cat: 'Tagliando', prezzo: 38 },
  { nome: 'Olio motore 0W20 (5L)', cat: 'Tagliando', prezzo: 42 },
  { nome: 'Candele (set 4)', cat: 'Tagliando', prezzo: 40 },
  { nome: 'Candele (set 6)', cat: 'Tagliando', prezzo: 60 },
  { nome: 'Candelette diesel (set 4)', cat: 'Tagliando', prezzo: 45 },
  // Freni
  { nome: 'Pastiglie freni anteriori', cat: 'Freni', prezzo: 35 },
  { nome: 'Pastiglie freni posteriori', cat: 'Freni', prezzo: 30 },
  { nome: 'Dischi freni anteriori (coppia)', cat: 'Freni', prezzo: 55 },
  { nome: 'Dischi freni posteriori (coppia)', cat: 'Freni', prezzo: 50 },
  { nome: 'Liquido freni DOT4 (500ml)', cat: 'Freni', prezzo: 8 },
  { nome: 'Kit revisione pinza freno ant.', cat: 'Freni', prezzo: 12 },
  { nome: 'Kit revisione pinza freno post.', cat: 'Freni', prezzo: 12 },
  // Distribuzione
  { nome: 'Cinghia distribuzione', cat: 'Distribuzione', prezzo: 45 },
  { nome: 'Kit cinghia distribuzione', cat: 'Distribuzione', prezzo: 80 },
  { nome: 'Kit catena distribuzione', cat: 'Distribuzione', prezzo: 120 },
  { nome: 'Pompa acqua', cat: 'Distribuzione', prezzo: 55 },
  // Raffreddamento
  { nome: 'Termostato', cat: 'Raffreddamento', prezzo: 25 },
  { nome: 'Liquido raffreddamento (1L)', cat: 'Raffreddamento', prezzo: 12 },
  { nome: 'Radiatore acqua', cat: 'Raffreddamento', prezzo: 90 },
  { nome: 'Manicotto tubo raffreddamento', cat: 'Raffreddamento', prezzo: 20 },
  // Sospensioni
  { nome: 'Ammortizzatore anteriore sx', cat: 'Sospensioni', prezzo: 65 },
  { nome: 'Ammortizzatore anteriore dx', cat: 'Sospensioni', prezzo: 65 },
  { nome: 'Ammortizzatore posteriore sx', cat: 'Sospensioni', prezzo: 55 },
  { nome: 'Ammortizzatore posteriore dx', cat: 'Sospensioni', prezzo: 55 },
  { nome: 'Molla anteriore sx', cat: 'Sospensioni', prezzo: 40 },
  { nome: 'Molla anteriore dx', cat: 'Sospensioni', prezzo: 40 },
  { nome: 'Silent block braccio ant.', cat: 'Sospensioni', prezzo: 25 },
  { nome: 'Braccio oscillante ant. sx', cat: 'Sospensioni', prezzo: 55 },
  { nome: 'Braccio oscillante ant. dx', cat: 'Sospensioni', prezzo: 55 },
  { nome: 'Tirante barra stabilizzatrice', cat: 'Sospensioni', prezzo: 18 },
  { nome: 'Cuscinetto ruota anteriore', cat: 'Sospensioni', prezzo: 45 },
  { nome: 'Cuscinetto ruota posteriore', cat: 'Sospensioni', prezzo: 40 },
  // Elettrico
  { nome: 'Batteria 55Ah', cat: 'Elettrico', prezzo: 65 },
  { nome: 'Batteria 60Ah', cat: 'Elettrico', prezzo: 75 },
  { nome: 'Batteria 70Ah', cat: 'Elettrico', prezzo: 85 },
  { nome: 'Batteria 80Ah', cat: 'Elettrico', prezzo: 95 },
  { nome: 'Alternatore', cat: 'Elettrico', prezzo: 120 },
  { nome: 'Motorino avviamento', cat: 'Elettrico', prezzo: 110 },
  { nome: 'Sensore ABS anteriore sx', cat: 'Elettrico', prezzo: 35 },
  { nome: 'Sensore ABS anteriore dx', cat: 'Elettrico', prezzo: 35 },
  { nome: 'Sensore temperatura motore', cat: 'Elettrico', prezzo: 20 },
  // Clima
  { nome: 'Gas climatizzatore R134a (1kg)', cat: 'Clima', prezzo: 45 },
  { nome: 'Gas climatizzatore R1234yf (1kg)', cat: 'Clima', prezzo: 85 },
  { nome: 'Compressore clima', cat: 'Clima', prezzo: 150 },
  { nome: 'Filtro essiccatore clima', cat: 'Clima', prezzo: 25 },
  { nome: 'Liquido sterzo', cat: 'Sterzo', prezzo: 15 },
  // Gomme / varie
  { nome: 'Pneumatico estivo', cat: 'Gomme', prezzo: 85 },
  { nome: 'Pneumatico invernale', cat: 'Gomme', prezzo: 90 },
  { nome: 'Valvola pneumatico', cat: 'Gomme', prezzo: 3 },
  { nome: 'Equilibratura ruota', cat: 'Gomme', prezzo: 6 },
  { nome: 'Tergicristallo anteriore', cat: 'Varie', prezzo: 18 },
  { nome: 'Tergicristallo posteriore', cat: 'Varie', prezzo: 12 },
  { nome: 'Lampadina faro H7', cat: 'Varie', prezzo: 8 },
  { nome: 'Lampadina faro H4', cat: 'Varie', prezzo: 8 },
  { nome: 'Cinghia servizi', cat: 'Varie', prezzo: 18 },
  { nome: 'Olio cambio automatico (1L)', cat: 'Cambio', prezzo: 18 },
  { nome: 'Olio cambio manuale (1L)', cat: 'Cambio', prezzo: 14 },
];

// ==================== TAB FOGLIO LAVORO ====================
function RicambioCard({ r, ricambi, setRicambi, updateRicambio, deleteRicambio }: {
  r: RicambioUsato; ricambi: RicambioUsato[];
  setRicambi: (v: RicambioUsato[]) => void;
  updateRicambio: (id: string, u: Partial<RicambioUsato>) => void;
  deleteRicambio: (id: string) => void;
}) {
  const [showSugg, setShowSugg] = useState(false);

  const suggestions = r.nome.trim().length > 0
    ? RICAMBI_COMUNI.filter((s) =>
        s.nome.toLowerCase().includes(r.nome.toLowerCase()) ||
        s.cat.toLowerCase().includes(r.nome.toLowerCase())
      ).slice(0, 8)
    : RICAMBI_COMUNI.slice(0, 10);

  const applySuggestion = (s: typeof RICAMBI_COMUNI[0]) => {
    const updated = ricambi.map((x) =>
      x.id === r.id
        ? { ...x, nome: s.nome, prezzo: s.prezzo ?? x.prezzo }
        : x
    );
    setRicambi(updated);
    updateRicambio(r.id, { nome: s.nome, prezzo: s.prezzo ?? r.prezzo });
    setShowSugg(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-3 mb-2 bg-white">
      <div className="flex items-center gap-2 mb-2 relative">
        <div className="flex-1 relative">
          <input
            value={r.nome}
            onChange={(e) => setRicambi(ricambi.map((x) => (x.id === r.id ? { ...x, nome: e.target.value } : x)))}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowSugg(false); }}
            placeholder="Cerca ricambio o scrivi nome..."
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Dropdown suggerimenti */}
          {showSugg && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden max-h-60 overflow-y-auto">
              {r.nome.trim() === '' && (
                <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  Ricambi più comuni
                </div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={() => applySuggestion(s)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left transition-colors cursor-pointer border-b border-gray-50 last:border-0"
                >
                  <div>
                    <div className="text-sm text-gray-900">{s.nome}</div>
                    <div className="text-[10px] text-gray-400">{s.cat}</div>
                  </div>
                  {s.prezzo && (
                    <span className="text-xs font-semibold text-blue-600 ml-2 shrink-0">€{s.prezzo}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <VoiceButton onResult={(text) => { const updated = ricambi.map((x) => (x.id === r.id ? { ...x, nome: text } : x)); setRicambi(updated); updateRicambio(r.id, { nome: text }); }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Codice</label>
          <input
            value={r.codice || ''}
            onChange={(e) => setRicambi(ricambi.map((x) => (x.id === r.id ? { ...x, codice: e.target.value } : x)))}
            onBlur={() => updateRicambio(r.id, { codice: r.codice })}
            placeholder="OPT"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Qtà</label>
          <input
            type="number"
            min={1}
            value={r.quantita}
            onChange={(e) => setRicambi(ricambi.map((x) => (x.id === r.id ? { ...x, quantita: parseInt(e.target.value) || 1 } : x)))}
            onBlur={() => updateRicambio(r.id, { quantita: r.quantita })}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 block mb-0.5">Prezzo €</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={r.prezzo}
            onChange={(e) => setRicambi(ricambi.map((x) => (x.id === r.id ? { ...x, prezzo: parseFloat(e.target.value) || 0 } : x)))}
            onBlur={() => updateRicambio(r.id, { prezzo: r.prezzo })}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-100">
        <span className="text-xs font-semibold text-gray-700">Totale: {fmtEuro(r.prezzo * r.quantita)}</span>
        <button onClick={() => deleteRicambio(r.id)} className="text-[11px] text-red-500 hover:text-red-700 cursor-pointer">
          Elimina
        </button>
      </div>
    </div>
  );
}

const GRAVITA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bassa: { label: 'Bassa', color: '#059669', bg: '#d1fae5' },
  media: { label: 'Media', color: '#d97706', bg: '#fef3c7' },
  alta: { label: 'Alta', color: '#dc2626', bg: '#fee2e2' },
  critica: { label: 'Critica', color: '#991b1b', bg: '#fecaca' },
};

// Tariffe orarie per segmento veicolo
const PREZZO_ORA: Record<string, number> = {
  utilitaria: 38, media: 45, premium: 60, commerciale: 42, suv: 50,
};
const SUV_MODELS = ['qashqai', 'tucson', 'sportage', 'tiguan', 'rav4', 'x1', 'x3', 'x5', 'q3', 'q5', 'glc', 'gla', 'stelvio', 'renegade', 'compass', 'duster', 'captur', '2008', '3008', '5008', 'kuga', 'ecosport', 't-cross', 't-roc', 'karoq', 'kodiaq', 'ateca', 'tarraco', 'cx-5', 'cx-30', 'hr-v', 'cr-v'];
function getSegmentoVeicolo2(veicolo?: { marca: string; modello: string }): string {
  if (!veicolo) return 'media';
  const modLow = veicolo.modello.toLowerCase();
  if (SUV_MODELS.some(s => modLow.includes(s))) return 'suv';
  if (['ducato', 'transporter', 'vito', 'sprinter', 'crafter', 'daily', 'boxer', 'jumper', 'master', 'trafic', 'vivaro'].some(s => modLow.includes(s))) return 'commerciale';
  const m = veicolo.marca.toLowerCase();
  if (['fiat', 'dacia', 'citroen', 'peugeot', 'opel', 'renault', 'seat', 'skoda', 'hyundai', 'kia', 'suzuki', 'lancia'].includes(m)) return 'utilitaria';
  if (['bmw', 'audi', 'mercedes', 'alfa romeo', 'volvo', 'lexus', 'mini', 'tesla', 'jaguar', 'land rover', 'porsche', 'maserati'].includes(m)) return 'premium';
  if (['iveco', 'man', 'scania'].includes(m)) return 'commerciale';
  return 'media';
}

function TabFoglioLavoro({ appuntamentoId, statoAppuntamento, veicolo, clienteNome, clienteEmail, clienteTel, clienteId, problema }: { appuntamentoId: string; statoAppuntamento: string; veicolo?: { marca: string; modello: string; targa?: string }; clienteNome?: string; clienteEmail?: string; clienteTel?: string; clienteId?: string; problema?: string }) {
  const { utente, officina } = useAuthStore();
  const [foglio, setFoglio] = useState<FoglioLavoro | null>(null);
  const [ricambi, setRicambi] = useState<RicambioUsato[]>([]);
  const [difetti, setDifetti] = useState<Difetto[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerMs, setTimerMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inline editing
  const [editRicambio, setEditRicambio] = useState<string | null>(null);
  const [editDifetto, setEditDifetto] = useState<string | null>(null);

  // Km uscita & note
  const [kmUscita, setKmUscita] = useState('');
  const [noteFinali, setNoteFinali] = useState('');

  // Modifica tempo manuale
  const [editingTime, setEditingTime] = useState(false);
  const [editHH, setEditHH] = useState('');
  const [editMM, setEditMM] = useState('');
  const [editSS, setEditSS] = useState('');

  // Firma operaio
  const [firmaOperaio, setFirmaOperaio] = useState('');

  // Costo manodopera
  const segmento = getSegmentoVeicolo2(veicolo);
  const tariffaDefault = PREZZO_ORA[segmento] || 45;
  const [tariffaOraria, setTariffaOraria] = useState(tariffaDefault);
  const [costoManodopera, setCostoManodopera] = useState(0);

  // Invio conto / fattura
  const [confermaInvio, setConfermaInvio] = useState<'conto' | 'fattura' | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [contoInviato, setContoInviato] = useState(false);
  const [fatturaGenerata, setFatturaGenerata] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const load = async () => {
      const { data: fl } = await supabase
        .from('foglio_lavoro')
        .select('*')
        .eq('appuntamento_id', appuntamentoId)
        .maybeSingle();

      if (fl) {
        setFoglio(fl);
        setTimerMs(fl.tempo_lavoro_ms || 0);
        setKmUscita(fl.km_uscita?.toString() || '');
        setNoteFinali(fl.note_finali || '');
        setFirmaOperaio(fl.firma_operaio || '');
        if (fl.tariffa_oraria) setTariffaOraria(fl.tariffa_oraria);
        if (fl.costo_manodopera != null) setCostoManodopera(fl.costo_manodopera);

        const [{ data: ric }, { data: dif }] = await Promise.all([
          supabase.from('ricambi_usati').select('*').eq('foglio_lavoro_id', fl.id).order('created_at'),
          supabase.from('difetti').select('*').eq('foglio_lavoro_id', fl.id).order('created_at'),
        ]);
        setRicambi(ric || []);
        setDifetti(dif || []);
      }
      setLoading(false);
    };
    load();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appuntamentoId]);

  const creaFoglio = async () => {
    // tecnico_id e' NOT NULL: senza utente in sessione l'insert verrebbe
    // rifiutato e il pulsante sembrerebbe semplicemente non funzionare.
    if (!utente?.id) {
      showToast('Sessione utente non disponibile: rientra e riprova.');
      return;
    }
    const { data, error } = await supabase
      .from('foglio_lavoro')
      .insert({
        appuntamento_id: appuntamentoId,
        tecnico_id: utente.id,
        inizio: new Date().toISOString(),
        tempo_lavoro_ms: 0,
        pause: 0,
        chiuso: false,
      })
      .select()
      .single();
    if (error || !data) {
      showToast('Foglio lavoro non creato: ' + (error?.message || 'errore sconosciuto'));
      return;
    }
    {
      setFoglio(data);
      // Auto-set stato to in_lavorazione if currently in_diagnosi
      if (statoAppuntamento === 'in_diagnosi') {
        await supabase.from('appuntamenti').update({ stato: 'in_lavorazione' }).eq('id', appuntamentoId);
      }
      showToast('Foglio lavoro creato');
    }
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
      const newPause = (foglio.pause || 0) + 1;
      await supabase
        .from('foglio_lavoro')
        .update({ tempo_lavoro_ms: timerMs, pause: newPause })
        .eq('id', foglio.id);
      setFoglio({ ...foglio, pause: newPause, tempo_lavoro_ms: timerMs });
      showToast('Timer in pausa');
    }
  };

  const salvaTempo = async () => {
    if (!foglio) return;
    await supabase
      .from('foglio_lavoro')
      .update({ tempo_lavoro_ms: timerMs })
      .eq('id', foglio.id);
  };

  // Save km & notes on blur
  const salvaDettagli = async () => {
    if (!foglio) return;
    const { error: dettagliErr } = await supabase
      .from('foglio_lavoro')
      .update({
        km_uscita: kmUscita ? parseInt(kmUscita) : null,
        note_finali: noteFinali || null,
      })
      .eq('id', foglio.id);
    // Km e note venivano persi senza alcun segnale se il salvataggio falliva.
    if (dettagliErr) showToast('Dettagli non salvati: ' + dettagliErr.message);
  };

  // Modifica tempo manuale
  const startEditTime = () => {
    const sec = Math.floor(timerMs / 1000);
    setEditHH(Math.floor(sec / 3600).toString());
    setEditMM(Math.floor((sec % 3600) / 60).toString());
    setEditSS((sec % 60).toString());
    setEditingTime(true);
  };

  const saveEditTime = async () => {
    const newMs = ((parseInt(editHH) || 0) * 3600 + (parseInt(editMM) || 0) * 60 + (parseInt(editSS) || 0)) * 1000;
    setTimerMs(newMs);
    setEditingTime(false);
    // Ricalcola costo manodopera
    const costo = Math.round((newMs / 3600000) * tariffaOraria * 100) / 100;
    setCostoManodopera(costo);
    if (foglio) {
      await supabase.from('foglio_lavoro').update({ tempo_lavoro_ms: newMs, costo_manodopera: costo }).eq('id', foglio.id);
      setFoglio({ ...foglio, tempo_lavoro_ms: newMs, costo_manodopera: costo });
      showToast('Tempo e costo aggiornati');
    }
  };

  // Salva tariffa e ricalcola costo
  const salvaTariffa = async (nuovaTariffa: number) => {
    setTariffaOraria(nuovaTariffa);
    const costo = Math.round((timerMs / 3600000) * nuovaTariffa * 100) / 100;
    setCostoManodopera(costo);
    if (foglio) {
      await supabase.from('foglio_lavoro').update({ tariffa_oraria: nuovaTariffa, costo_manodopera: costo }).eq('id', foglio.id);
    }
  };

  // Salva costo manodopera manuale
  const salvaCostoManuale = async (costo: number) => {
    setCostoManodopera(costo);
    if (foglio) {
      await supabase.from('foglio_lavoro').update({ costo_manodopera: costo }).eq('id', foglio.id);
    }
  };

  // Salva firma operaio
  const salvaFirma = async () => {
    if (!foglio) return;
    await supabase.from('foglio_lavoro').update({ firma_operaio: firmaOperaio || null }).eq('id', foglio.id);
    showToast('Firma salvata');
  };

  // Stampa PDF foglio lavoro
  const stampaPDF = () => {
    if (!foglio) return;
    const ore = (timerMs / 3600000).toFixed(2);
    const righeRicambi = ricambi.filter(r => r.nome).map(r => {
      const tipoLabel = r.tipo === 'nuovo' ? 'Nuovo' : r.tipo === 'consumabile' ? 'Consumo' : 'Usato';
      return `<tr><td>${r.nome}${r.codice ? ` <small>(${r.codice})</small>` : ''}</td><td style="text-align:center">${tipoLabel}</td><td style="text-align:center">${r.quantita}</td><td style="text-align:right">${r.prezzo.toFixed(2)} €</td><td style="text-align:right">${(r.prezzo * r.quantita).toFixed(2)} €</td></tr>`;
    }).join('');
    const righeDifetti = difetti.map(d => {
      const grav = d.gravita.charAt(0).toUpperCase() + d.gravita.slice(1);
      return `<tr><td>${d.descrizione || '—'}</td><td style="text-align:center">${grav}</td><td style="text-align:center">${d.risolto ? '✅ Sì' : '❌ No'}</td><td>${d.consigliato || '—'}</td></tr>`;
    }).join('');
    const totRicambi = ricambi.reduce((s, r) => s + r.prezzo * r.quantita, 0);
    const totGenerale = costoManodopera + totRicambi;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Foglio Lavoro — ${officina?.nome || 'OfficinAI'}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;font-size:12px}
.header{display:flex;justify-content:space-between;margin-bottom:25px;padding-bottom:15px;border-bottom:3px solid #1a56db}
.header-left h1{color:#1a56db;font-size:20px;margin-bottom:3px}.header-left p{color:#666;font-size:11px}
.header-right{text-align:right;font-size:11px;color:#666}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}
.info-box{background:#f8f9fa;border-radius:8px;padding:12px}.info-box h3{font-size:11px;color:#1a56db;margin-bottom:6px;text-transform:uppercase}
.info-box p{font-size:11px;margin-bottom:2px}
table{width:100%;border-collapse:collapse;margin-bottom:15px}th{background:#1a56db;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}
td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px}tr:nth-child(even){background:#f8f9fa}
.totals{text-align:right;margin-top:10px;padding:12px;background:#f0f4ff;border-radius:8px}
.totals p{font-size:12px;margin-bottom:3px}.totals .grand{font-size:16px;font-weight:bold;color:#1a56db;margin-top:5px}
.section{margin-bottom:20px}.section h2{font-size:13px;color:#1a56db;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #ddd}
.firma{margin-top:30px;display:flex;justify-content:space-between;padding-top:20px;border-top:2px solid #ddd}
.firma-box{text-align:center;width:45%}.firma-box .line{border-bottom:1px solid #333;height:40px;margin-bottom:5px}
.firma-box p{font-size:10px;color:#666}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:bold}
.badge-green{background:#d1fae5;color:#065f46}.badge-red{background:#fee2e2;color:#991b1b}
@media print{body{padding:20px}}</style></head><body>
<div class="header"><div class="header-left"><h1>${officina?.nome || 'OfficinAI'}</h1><p>${officina?.indirizzo || ''}</p><p>${officina?.tel || ''} ${officina?.email || ''}</p></div>
<div class="header-right"><h2 style="color:#1a56db;font-size:16px">FOGLIO DI LAVORO</h2><p>Data: ${foglio.inizio ? new Date(foglio.inizio).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT')}</p>
${foglio.fine ? `<p>Chiuso: ${new Date(foglio.fine).toLocaleDateString('it-IT')}</p>` : ''}
<p><span class="badge ${foglio.chiuso ? 'badge-green' : 'badge-red'}">${foglio.chiuso ? 'COMPLETATO' : 'IN CORSO'}</span></p></div></div>
<div class="info-grid"><div class="info-box"><h3>Cliente / Veicolo</h3><p><strong>${clienteNome || '—'}</strong></p>
<p>${veicolo ? `${veicolo.marca} ${veicolo.modello}` : '—'}${veicolo?.targa ? ` — ${veicolo.targa}` : ''}</p>
<p>Problema: ${problema || '—'}</p></div>
<div class="info-box"><h3>Tempi di lavoro</h3><p>Tempo totale: <strong>${fmtDurata(timerMs)}</strong> (${ore} ore)</p>
<p>Pause: ${foglio.pause || 0}</p><p>Tariffa: ${tariffaOraria} €/ora</p>
${kmUscita ? `<p>Km uscita: ${parseInt(kmUscita).toLocaleString('it-IT')}</p>` : ''}</div></div>
${ricambi.length > 0 ? `<div class="section"><h2>Ricambi e Materiali</h2><table><thead><tr><th>Descrizione</th><th style="text-align:center">Tipo</th><th style="text-align:center">Qtà</th><th style="text-align:right">Prezzo</th><th style="text-align:right">Totale</th></tr></thead><tbody>${righeRicambi}</tbody></table></div>` : ''}
${difetti.length > 0 ? `<div class="section"><h2>Difetti Riscontrati</h2><table><thead><tr><th>Descrizione</th><th style="text-align:center">Gravità</th><th style="text-align:center">Risolto</th><th>Azione consigliata</th></tr></thead><tbody>${righeDifetti}</tbody></table></div>` : ''}
${noteFinali ? `<div class="section"><h2>Note Finali</h2><p style="padding:8px;background:#f8f9fa;border-radius:6px">${noteFinali}</p></div>` : ''}
<div class="totals"><p>Manodopera: <strong>${costoManodopera.toFixed(2)} €</strong></p><p>Ricambi e materiali: <strong>${totRicambi.toFixed(2)} €</strong></p>
<p class="grand">TOTALE: ${totGenerale.toFixed(2)} €</p></div>
<div class="firma"><div class="firma-box"><div class="line"></div><p>Firma operaio${firmaOperaio ? `<br><strong>${firmaOperaio}</strong>` : ''}</p></div>
<div class="firma-box"><div class="line"></div><p>Firma cliente</p></div></div>
<p style="text-align:center;margin-top:20px;font-size:9px;color:#999">${officina?.nome || 'OfficinAI'} — P.IVA ${officina?.p_iva || '—'} — Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  // Helper: genera righe dal foglio lavoro
  const generaRigheFoglio = () => {
    const righe: { descrizione: string; tipo: string; qta: number; prezzo: number }[] = [];
    if (costoManodopera > 0) {
      const ore = timerMs / 3600000;
      righe.push({ descrizione: `Manodopera (${ore.toFixed(2)}h × ${tariffaOraria}€/h)`, tipo: 'manodopera', qta: 1, prezzo: costoManodopera });
    }
    ricambi.forEach((r) => {
      if (r.nome && r.prezzo > 0) {
        const tipoLabel = r.tipo === 'nuovo' ? 'Ricambio nuovo' : r.tipo === 'consumabile' ? 'Materiale consumo' : 'Ricambio usato';
        righe.push({ descrizione: `${tipoLabel}: ${r.nome}${r.codice ? ` (${r.codice})` : ''}`, tipo: 'ricambio', qta: r.quantita, prezzo: r.prezzo });
      }
    });
    return righe;
  };

  // Invia conto al cliente (irreversibile)
  const inviaConto = async () => {
    if (!foglio) return;
    setInvioInCorso(true);
    // supabase-js restituisce gli errori nel risultato invece di lanciarli:
    // il try/catch non li intercettava e il conto risultava "inviato"
    // anche quando non era stato salvato nulla.
    const { error: fErr } = await supabase.from('foglio_lavoro').update({
      inviato_al_cliente: true,
      data_invio_cliente: new Date().toISOString(),
      costo_manodopera: costoManodopera,
      tariffa_oraria: tariffaOraria,
      firma_operaio: firmaOperaio || null,
      km_uscita: kmUscita ? parseInt(kmUscita) : null,
      note_finali: noteFinali || null,
    }).eq('id', foglio.id);
    if (fErr) {
      setInvioInCorso(false);
      showToast('Conto non inviato: ' + fErr.message);
      return;
    }
    const { error: aErr } = await supabase.from('appuntamenti').update({ stato: 'pronto' }).eq('id', appuntamentoId);
    setInvioInCorso(false);
    if (aErr) {
      showToast('Conto salvato, ma stato non aggiornato: ' + aErr.message);
      return;
    }
    setContoInviato(true);
    setConfermaInvio(null);
    showToast('Conto inviato al cliente!');
  };

  // Genera fattura elettronica (bozza per SDI)
  const generaFatturaElettronica = async () => {
    if (!foglio) return;
    setInvioInCorso(true);
    try {
      const righe = generaRigheFoglio();
      const subtotale = righe.reduce((s, r) => s + r.qta * r.prezzo, 0);
      const iva = Math.round(subtotale * 0.22 * 100) / 100;
      // Numero progressivo
      const year = new Date().getFullYear();
      const { data: lastFattura } = await supabase
        .from('fatture')
        .select('numero')
        .eq('officina_id', officina?.id)
        .like('numero', `FT-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastNum = lastFattura?.numero ? parseInt(lastFattura.numero.split('-').pop() || '0') : 0;
      const numero = `FT-${year}-${String(lastNum + 1).padStart(3, '0')}`;
      const { error: fattErr } = await supabase.from('fatture').insert({
        officina_id: officina?.id,
        appuntamento_id: appuntamentoId,
        numero,
        data_emissione: new Date().toISOString(),
        cliente_nome: '',
        cliente_cf: '',
        righe,
        subtotale,
        iva,
        totale: subtotale + iva,
        stato: 'bozza',
        note: noteFinali || '',
      });
      if (fattErr) {
        setInvioInCorso(false);
        showToast('Fattura non generata: ' + fattErr.message);
        return;
      }
      // Salva anche i dati sul foglio se non già fatto
      if (!contoInviato) {
        await supabase.from('foglio_lavoro').update({
          costo_manodopera: costoManodopera,
          tariffa_oraria: tariffaOraria,
          firma_operaio: firmaOperaio || null,
        }).eq('id', foglio.id);
      }
      setFatturaGenerata(true);
      setConfermaInvio(null);
      showToast(`Fattura ${numero} generata! Completa i dati in Fatture.`);
    } catch {
      showToast('Errore generazione fattura. Riprova.');
    } finally {
      setInvioInCorso(false);
    }
  };

  const chiudiFoglio = async () => {
    if (!foglio) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    // Calcolo automatico costo manodopera
    const orelavoro = timerMs / 3600000;
    const costo = Math.round(orelavoro * tariffaOraria * 100) / 100;
    setCostoManodopera(costo);
    const { error: chiusuraErr } = await supabase
      .from('foglio_lavoro')
      .update({
        tempo_lavoro_ms: timerMs,
        fine: new Date().toISOString(),
        chiuso: true,
        km_uscita: kmUscita ? parseInt(kmUscita) : null,
        note_finali: noteFinali || null,
        tariffa_oraria: tariffaOraria,
        costo_manodopera: costo,
      })
      .eq('id', foglio.id);
    // Senza questo controllo tempo, km, note e costo manodopera potevano
    // andare persi mentre a schermo il lavoro risultava completato.
    if (chiusuraErr) {
      showToast('Lavoro non chiuso: ' + chiusuraErr.message);
      return;
    }
    setFoglio({ ...foglio, chiuso: true, fine: new Date().toISOString(), tariffa_oraria: tariffaOraria, costo_manodopera: costo });
    // Auto-set stato to pronto
    await supabase.from('appuntamenti').update({ stato: 'pronto' }).eq('id', appuntamentoId);
    showToast(`Lavoro completato — Manodopera: ${fmtEuro(costo)}`);
  };

  const riapriFoglio = async () => {
    if (!foglio) return;
    await supabase
      .from('foglio_lavoro')
      .update({ chiuso: false, fine: null })
      .eq('id', foglio.id);
    setFoglio({ ...foglio, chiuso: false, fine: undefined });
    // Riporta in lavorazione
    await supabase.from('appuntamenti').update({ stato: 'in_lavorazione' }).eq('id', appuntamentoId);
    showToast('Lavoro riaperto — puoi continuare');
  };

  // ---- RICAMBI CRUD ----
  const addRicambio = async (tipo: 'nuovo' | 'usato' | 'consumabile') => {
    if (!foglio) return;
    // Prova con tipo, se fallisce (colonna non esiste) riprova senza
    let { data, error } = await supabase
      .from('ricambi_usati')
      .insert({ foglio_lavoro_id: foglio.id, nome: '', quantita: 1, prezzo: 0, tipo })
      .select()
      .single();
    if (error) {
      console.warn('Insert con tipo fallito, riprovo senza:', error.message);
      const retry = await supabase
        .from('ricambi_usati')
        .insert({ foglio_lavoro_id: foglio.id, nome: '', quantita: 1, prezzo: 0 })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error('Errore aggiunta ricambio:', error);
      showToast('Errore inserimento ricambio');
      return;
    }
    if (data) {
      // Se la colonna tipo non c'è, assegna localmente
      if (!data.tipo) data.tipo = tipo;
      setRicambi([...ricambi, data]);
      setEditRicambio(data.id);
    }
  };

  const updateRicambio = async (id: string, updates: Partial<RicambioUsato>) => {
    await supabase.from('ricambi_usati').update(updates).eq('id', id);
    setRicambi(ricambi.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deleteRicambio = async (id: string) => {
    if (!confirm('Eliminare questo ricambio?')) return;
    await supabase.from('ricambi_usati').delete().eq('id', id);
    setRicambi(ricambi.filter((r) => r.id !== id));
    showToast('Ricambio rimosso');
  };

  // ---- DIFETTI CRUD ----
  const addDifetto = async () => {
    if (!foglio) return;
    const { data } = await supabase
      .from('difetti')
      .insert({ foglio_lavoro_id: foglio.id, descrizione: '', gravita: 'media', risolto: false })
      .select()
      .single();
    if (data) {
      setDifetti([...difetti, data]);
      setEditDifetto(data.id);
    }
  };

  const updateDifetto = async (id: string, updates: Partial<Difetto>) => {
    await supabase.from('difetti').update(updates).eq('id', id);
    setDifetti(difetti.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const deleteDifetto = async (id: string) => {
    if (!confirm('Eliminare questo difetto?')) return;
    await supabase.from('difetti').delete().eq('id', id);
    setDifetti(difetti.filter((d) => d.id !== id));
    showToast('Difetto rimosso');
  };

  const toggleRisolto = async (id: string, current: boolean) => {
    await updateDifetto(id, { risolto: !current });
  };

  const ricambiNuovi = ricambi.filter((r) => r.tipo === 'nuovo');
  const ricambiUsati = ricambi.filter((r) => r.tipo === 'usato' || !r.tipo);
  const materialiConsumo = ricambi.filter((r) => r.tipo === 'consumabile');
  const totaleRicambi = ricambi.reduce((s, r) => s + r.prezzo * r.quantita, 0);
  const totaleNuovi = ricambiNuovi.reduce((s, r) => s + r.prezzo * r.quantita, 0);
  const totaleUsati = ricambiUsati.reduce((s, r) => s + r.prezzo * r.quantita, 0);
  const totaleConsumo = materialiConsumo.reduce((s, r) => s + r.prezzo * r.quantita, 0);

  if (loading) return <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>;

  if (!foglio) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🔧</div>
        <p className="text-gray-500 text-sm mb-1">Nessun foglio di lavoro aperto</p>
        <p className="text-gray-400 text-xs mb-4">Crea un foglio per tracciare tempo, ricambi e difetti</p>
        <Button onClick={creaFoglio}>Crea Foglio Lavoro</Button>
      </div>
    );
  }

  const isChiuso = foglio.chiuso;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Timer */}
      <Card className="text-center !p-5">
        {!editingTime ? (
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className={`text-4xl font-mono font-bold ${timerActive ? 'text-blue-600' : 'text-gray-900'}`}>
              {fmtDurata(timerMs)}
            </div>
            {!timerActive && (
              <button onClick={startEditTime} className="text-gray-400 hover:text-blue-600 cursor-pointer" title="Modifica tempo">
                <span className="text-lg">✏️</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-center justify-center gap-1 mb-2">
              <input type="number" min={0} value={editHH} onChange={(e) => setEditHH(e.target.value)}
                className="w-16 text-2xl font-mono font-bold text-center border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-2xl font-bold">:</span>
              <input type="number" min={0} max={59} value={editMM} onChange={(e) => setEditMM(e.target.value)}
                className="w-16 text-2xl font-mono font-bold text-center border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-2xl font-bold">:</span>
              <input type="number" min={0} max={59} value={editSS} onChange={(e) => setEditSS(e.target.value)}
                className="w-16 text-2xl font-mono font-bold text-center border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={saveEditTime} variant="success" size="sm">✓ Salva</Button>
              <Button onClick={() => setEditingTime(false)} variant="secondary" size="sm">✗ Annulla</Button>
            </div>
          </div>
        )}
        <div className="text-xs text-gray-400 mb-3">
          {foglio.pause ? `${foglio.pause} ${foglio.pause === 1 ? 'pausa' : 'pause'}` : 'Nessuna pausa'}
          {isChiuso && <span className="ml-2 text-emerald-600 font-semibold">COMPLETATO</span>}
        </div>
        {!isChiuso && !editingTime && (
          <div className="flex gap-2 justify-center">
            {!timerActive ? (
              <Button onClick={startTimer} variant="success" size="sm">
                ▶ {timerMs > 0 ? 'Riprendi' : 'Avvia timer'}
              </Button>
            ) : (
              <Button onClick={pauseTimer} variant="secondary" size="sm">
                ⏸ Pausa
              </Button>
            )}
            <Button onClick={chiudiFoglio} variant="danger" size="sm">
              ✓ Chiudi lavoro
            </Button>
          </div>
        )}
        {isChiuso && !editingTime && (
          <div className="space-y-2 mt-2">
            {foglio.inizio && foglio.fine && (
              <div className="text-xs text-gray-400">
                {fmtDataOra(foglio.inizio)} → {fmtDataOra(foglio.fine)}
              </div>
            )}
            <Button onClick={riapriFoglio} variant="secondary" size="sm">
              🔄 Riapri lavoro
            </Button>
          </div>
        )}
      </Card>

      {/* Costo manodopera */}
      <Card className="!p-3 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">💶 Costo manodopera</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Tariffa €/ora</label>
            <input
              type="number"
              step="0.5"
              min={0}
              value={tariffaOraria}
              onChange={(e) => setTariffaOraria(parseFloat(e.target.value) || 0)}
              onBlur={(e) => salvaTariffa(parseFloat(e.target.value) || 0)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-[9px] text-gray-400 mt-0.5">{segmento}</div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Ore lavoro</label>
            <div className="text-sm font-semibold text-gray-900 px-2.5 py-2">
              {(timerMs / 3600000).toFixed(2)} h
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Totale manodopera</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={costoManodopera}
              onChange={(e) => setCostoManodopera(parseFloat(e.target.value) || 0)}
              onBlur={(e) => salvaCostoManuale(parseFloat(e.target.value) || 0)}
              className="w-full text-sm font-bold border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-700"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-400">Ricambi: <span className="font-semibold text-gray-700">{fmtEuro(totaleRicambi)}</span></div>
          <div className="text-sm font-bold text-gray-900">TOTALE: {fmtEuro(costoManodopera + totaleRicambi)}</div>
        </div>
      </Card>

      {/* Km uscita + Note finali */}
      <Card className="!p-3 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Dettagli</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-500 mb-0.5 block">Km uscita</label>
            <input
              type="number"
              value={kmUscita}
              onChange={(e) => setKmUscita(e.target.value)}
              onBlur={salvaDettagli}
              placeholder="Es. 85430"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <div className="text-xs text-gray-400">
              Km ingresso: <span className="font-semibold text-gray-700">{foglio.km_uscita ? '' : '—'}</span>
            </div>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-0.5 block">Note finali</label>
          <textarea
            value={noteFinali}
            onChange={(e) => setNoteFinali(e.target.value)}
            onBlur={salvaDettagli}
            rows={2}
            placeholder="Note sulla lavorazione, consigli al cliente..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </Card>

      {/* Ricambi nuovi */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            🆕 Ricambi nuovi <span className="text-gray-400 font-normal">({ricambiNuovi.length})</span>
            {ricambiNuovi.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">— {fmtEuro(totaleNuovi)}</span>}
          </h3>
          <button onClick={() => addRicambio('nuovo')} className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer">
            + Aggiungi nuovo
          </button>
        </div>
        {ricambiNuovi.length === 0 && (
          <div className="text-center py-3 text-xs text-gray-400">Nessun ricambio nuovo</div>
        )}
        {ricambiNuovi.map((r) => (
          <RicambioCard key={r.id} r={r} ricambi={ricambi} setRicambi={setRicambi} updateRicambio={updateRicambio} deleteRicambio={deleteRicambio} />
        ))}
      </div>

      {/* Ricambi usati */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            ♻️ Ricambi usati <span className="text-gray-400 font-normal">({ricambiUsati.length})</span>
            {ricambiUsati.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">— {fmtEuro(totaleUsati)}</span>}
          </h3>
          <button onClick={() => addRicambio('usato')} className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer">
            + Aggiungi usato
          </button>
        </div>
        {ricambiUsati.length === 0 && (
          <div className="text-center py-3 text-xs text-gray-400">Nessun ricambio usato</div>
        )}
        {ricambiUsati.map((r) => (
          <RicambioCard key={r.id} r={r} ricambi={ricambi} setRicambi={setRicambi} updateRicambio={updateRicambio} deleteRicambio={deleteRicambio} />
        ))}
      </div>

      {/* Materiali di consumo */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            🧴 Materiali di consumo <span className="text-gray-400 font-normal">({materialiConsumo.length})</span>
            {materialiConsumo.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">— {fmtEuro(totaleConsumo)}</span>}
          </h3>
          <button onClick={() => addRicambio('consumabile')} className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer">
            + Aggiungi materiale
          </button>
        </div>
        {materialiConsumo.length === 0 && (
          <div className="text-center py-3 text-xs text-gray-400">Nessun materiale di consumo</div>
        )}
        {materialiConsumo.map((r) => (
          <RicambioCard key={r.id} r={r} ricambi={ricambi} setRicambi={setRicambi} updateRicambio={updateRicambio} deleteRicambio={deleteRicambio} />
        ))}
      </div>

      {/* Difetti */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Difetti trovati <span className="text-gray-400 font-normal">({difetti.length})</span>
          </h3>
          <button onClick={addDifetto} className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer">
            + Aggiungi
          </button>
        </div>
        {difetti.length === 0 && (
          <div className="text-center py-3 text-xs text-gray-400">Nessun difetto registrato</div>
        )}
        {difetti.map((d) => {
          const gCfg = GRAVITA_CONFIG[d.gravita] || GRAVITA_CONFIG.media;
          return (
            <div key={d.id} className="border border-gray-200 rounded-xl p-3 mb-2 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => toggleRisolto(d.id, d.risolto)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    d.risolto ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {d.risolto && <span className="text-xs">✓</span>}
                </button>
                <Badge color={gCfg.color} bg={gCfg.bg}>
                  {gCfg.label}
                </Badge>
                <select
                  value={d.gravita}
                  onChange={(e) => {
                    const g = e.target.value as Difetto['gravita'];
                    setDifetti(difetti.map((x) => (x.id === d.id ? { ...x, gravita: g } : x)));
                    updateDifetto(d.id, { gravita: g });
                  }}
                  className="text-[10px] border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto"
                >
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Critica</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <textarea
                  value={d.descrizione}
                  onChange={(e) => setDifetti(difetti.map((x) => (x.id === d.id ? { ...x, descrizione: e.target.value } : x)))}
                  onBlur={() => updateDifetto(d.id, { descrizione: d.descrizione })}
                  placeholder="Descrizione del difetto..."
                  rows={2}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <VoiceButton onResult={(text) => { const updated = difetti.map((x) => (x.id === d.id ? { ...x, descrizione: text } : x)); setDifetti(updated); updateDifetto(d.id, { descrizione: text }); }} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={d.consigliato || ''}
                  onChange={(e) => setDifetti(difetti.map((x) => (x.id === d.id ? { ...x, consigliato: e.target.value } : x)))}
                  onBlur={() => updateDifetto(d.id, { consigliato: d.consigliato })}
                  placeholder="Azione consigliata (es. Sostituire entro 10.000 km)"
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => deleteDifetto(d.id)} className="text-[11px] text-red-500 hover:text-red-700 cursor-pointer shrink-0">
                  Elimina
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Firma operaio */}
      <Card className="!p-3 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">✍️ Firma operaio</h3>
        <p className="text-[11px] text-gray-400">Nome dell'operaio che ha eseguito la lavorazione</p>
        <div className="flex items-center gap-2">
          <input
            value={firmaOperaio}
            onChange={(e) => setFirmaOperaio(e.target.value)}
            onBlur={salvaFirma}
            placeholder="Nome e cognome operaio"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <VoiceButton onResult={(text) => { setFirmaOperaio(text); setTimeout(salvaFirma, 100); }} />
        </div>
        {firmaOperaio && (
          <div className="text-xs text-emerald-600 font-medium">✓ Firmato da: {firmaOperaio}</div>
        )}
      </Card>

      {/* Riepilogo */}
      {isChiuso && (
        <Card className="!p-3 bg-emerald-50 border-emerald-200">
          <h3 className="text-sm font-semibold text-emerald-900 mb-2">Riepilogo lavoro</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-600">Tempo totale:</div>
            <div className="font-semibold text-gray-900">{fmtDurata(foglio.tempo_lavoro_ms)}</div>
            <div className="text-gray-600">Manodopera:</div>
            <div className="font-semibold text-blue-700">{fmtEuro(costoManodopera)} ({tariffaOraria} €/h)</div>
            <div className="text-gray-600">Ricambi nuovi:</div>
            <div className="font-semibold text-gray-900">{ricambiNuovi.length} pezzi — {fmtEuro(totaleNuovi)}</div>
            <div className="text-gray-600">Ricambi usati:</div>
            <div className="font-semibold text-gray-900">{ricambiUsati.length} pezzi — {fmtEuro(totaleUsati)}</div>
            <div className="text-gray-600">Materiali consumo:</div>
            <div className="font-semibold text-gray-900">{materialiConsumo.length} — {fmtEuro(totaleConsumo)}</div>
            <div className="text-gray-600">Difetti:</div>
            <div className="font-semibold text-gray-900">
              {difetti.filter((d) => d.risolto).length}/{difetti.length} risolti
            </div>
            {kmUscita && (
              <>
                <div className="text-gray-600">Km uscita:</div>
                <div className="font-semibold text-gray-900">{parseInt(kmUscita).toLocaleString('it-IT')} km</div>
              </>
            )}
            {firmaOperaio && (
              <>
                <div className="text-gray-600">Operaio:</div>
                <div className="font-semibold text-gray-900">{firmaOperaio}</div>
              </>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-200 flex justify-between items-center">
            <span className="text-xs text-gray-600">TOTALE LAVORO</span>
            <span className="text-base font-bold text-emerald-900">{fmtEuro(costoManodopera + totaleRicambi)}</span>
          </div>
          {noteFinali && (
            <div className="mt-2 pt-2 border-t border-emerald-200 text-xs text-gray-700">
              {noteFinali}
            </div>
          )}
        </Card>
      )}

      {/* Stampa PDF + Condividi — sempre disponibile */}
      {foglio && (
        <div className="space-y-2">
          <button
            onClick={stampaPDF}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 transition-all cursor-pointer shadow-lg"
          >
            <div className="text-center flex items-center justify-center gap-2">
              <span className="text-lg">🖨️</span>
              <span className="font-bold text-xs">Stampa / Esporta PDF</span>
            </div>
          </button>
          <ShareDocument
            tipo="foglio_lavoro"
            titolo="foglio lavoro"
            clienteEmail={clienteEmail}
            clienteTel={clienteTel}
            clienteNome={clienteNome}
            clienteId={clienteId}
            emailData={{
              clienteNome,
              veicolo: veicolo ? `${veicolo.marca} ${veicolo.modello}` : '',
              nuovoStato: isChiuso ? 'pronto' : statoAppuntamento,
            }}
            whatsappText={`Buongiorno ${clienteNome || ''}, le inviamo il foglio di lavoro per il suo ${veicolo ? `${veicolo.marca} ${veicolo.modello}` : 'veicolo'}${veicolo?.targa ? ` (${veicolo.targa})` : ''}.\nManodopera: €${costoManodopera.toFixed(2)}\nRicambi: €${totaleRicambi.toFixed(2)}\nTOTALE: €${(costoManodopera + totaleRicambi).toFixed(2)}\n— OfficinAI`}
          />
        </div>
      )}

      {/* Azioni invio: Conto + Fattura elettronica */}
      {isChiuso && (
        <div className="space-y-2">
          {/* Pulsanti principali */}
          {!confermaInvio && (
            <div className="grid grid-cols-2 gap-2">
              {/* Invia conto al cliente */}
              {!contoInviato ? (
                <button
                  onClick={() => setConfermaInvio('conto')}
                  className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer shadow-lg"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">📤</div>
                    <div className="font-bold text-xs">Invia conto</div>
                    <div className="text-[10px] text-blue-200 mt-0.5">{fmtEuro(costoManodopera + totaleRicambi)}</div>
                  </div>
                </button>
              ) : (
                <Card className="!p-4 bg-emerald-50 border-emerald-200 text-center">
                  <div className="text-xl mb-1">✅</div>
                  <div className="text-xs font-semibold text-emerald-800">Conto inviato</div>
                </Card>
              )}

              {/* Genera fattura elettronica */}
              {!fatturaGenerata ? (
                <button
                  onClick={() => setConfermaInvio('fattura')}
                  className="p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition-all cursor-pointer shadow-lg"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">🧾</div>
                    <div className="font-bold text-xs">Fattura elettronica</div>
                    <div className="text-[10px] text-purple-200 mt-0.5">Genera per SDI</div>
                  </div>
                </button>
              ) : (
                <Card className="!p-4 bg-purple-50 border-purple-200 text-center">
                  <div className="text-xl mb-1">✅</div>
                  <div className="text-xs font-semibold text-purple-800">Fattura generata</div>
                  <div className="text-[10px] text-purple-600 mt-0.5">Vai in Fatture per completarla</div>
                </Card>
              )}
            </div>
          )}

          {/* Conferma conto */}
          {confermaInvio === 'conto' && (
            <Card className="!p-4 bg-amber-50 border-amber-300">
              <div className="text-center space-y-3">
                <div className="text-2xl">⚠️</div>
                <div className="text-sm font-semibold text-amber-900">Inviare il conto al cliente?</div>
                <div className="text-xs text-amber-700">
                  Questa operazione è <strong>irreversibile</strong>. Il conto con tutti i dettagli
                  della lavorazione verrà inviato al cliente tramite il portale.
                </div>
                <div className="text-xs font-semibold text-gray-900 bg-white rounded-lg p-2">
                  Manodopera: {fmtEuro(costoManodopera)} + Ricambi: {fmtEuro(totaleRicambi)} = <strong>{fmtEuro(costoManodopera + totaleRicambi)}</strong>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={inviaConto} variant="danger" size="sm" disabled={invioInCorso}>
                    {invioInCorso ? 'Invio...' : '✓ Sì, invia conto'}
                  </Button>
                  <Button onClick={() => setConfermaInvio(null)} variant="secondary" size="sm">
                    ✗ Annulla
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Conferma fattura elettronica */}
          {confermaInvio === 'fattura' && (
            <Card className="!p-4 bg-purple-50 border-purple-300">
              <div className="text-center space-y-3">
                <div className="text-2xl">🧾</div>
                <div className="text-sm font-semibold text-purple-900">Generare la fattura elettronica?</div>
                <div className="text-xs text-purple-700">
                  Verrà creata una <strong>fattura bozza</strong> con tutte le righe del foglio lavoro.
                  Potrai completarla con i dati fiscali del cliente e inviarla al SDI dalla sezione Fatture.
                </div>
                <div className="text-xs font-semibold text-gray-900 bg-white rounded-lg p-2">
                  Subtotale: {fmtEuro(costoManodopera + totaleRicambi)} + IVA 22% = <strong>{fmtEuro((costoManodopera + totaleRicambi) * 1.22)}</strong>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={generaFatturaElettronica} variant="danger" size="sm" disabled={invioInCorso}>
                    {invioInCorso ? 'Generazione...' : '✓ Sì, genera fattura'}
                  </Button>
                  <Button onClick={() => setConfermaInvio(null)} variant="secondary" size="sm">
                    ✗ Annulla
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
