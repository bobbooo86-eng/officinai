import { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { STATO_CONFIG, STATI_ORDINE, GRAVITA_CONFIG } from '@/lib/constants';
import { fmtEuro, fmtDataOra } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { WhatsAppPanel } from '@/features/notifications/WhatsAppPanel';
import { AIDiagnostics } from '@/features/ai/AIDiagnostics';
import { PDFExport } from '@/features/estimates/PDFExport';
import { sendStatusUpdate, sendAppointmentConfirmation, sendProposalChange } from '@/lib/email';
import { format, parseISO } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { AccettazioneVeicolo } from './AccettazioneVeicolo';
import { StoricoVeicolo } from './StoricoVeicolo';
import type { Appuntamento, Preventivo, PreventivoRiga, FoglioLavoro, Difetto, PagamentoInfo, PagamentoStato } from '@/types/database';

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
      {tab === 'foglio' && <TabFoglioLavoro appuntamentoId={app.id} statoAppuntamento={app.stato} veicolo={app.veicoli} veicoloKm={app.veicoli?.km} clienteNome={app.clienti?.nome} clienteTel={app.clienti?.tel} />}
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
      data_consegna: new Date().toISOString(),
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

        {/* Importo: sempre richiesto, anche per "pagato completo", altrimenti
            il resoconto incassi in Cassa non avrebbe nessun numero da sommare
            proprio per il caso piu' frequente. */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {statoPag === 'pagato' ? 'Totale incassato (€)' : 'Totale da pagare (€)'}
              </label>
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
          {statoPag !== 'pagato' && (
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
          )}
        </div>

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

// ==================== TAB FOGLIO LAVORO ====================
// Scheda semplificata: niente timer/tariffa/fatturazione da qui (la
// fatturazione vive nel preventivo -> Fatture). Solo cio' che serve al
// banco: dati veicolo, lavorazioni tipiche a crocetta, lavorazioni da
// eseguire, difetti riscontrati, e in fondo nome/operaio/firma.
const LAVORAZIONI_TIPICHE = [
  'Tagliando',
  'Cambio olio e filtri',
  'Cambio pastiglie freni',
  'Cambio dischi freni',
  'Cambio gomme',
  'Cambio batteria',
  'Cambio cinghia distribuzione',
  'Diagnosi elettronica',
  'Revisione',
  'Allineamento/convergenza',
];

function TabFoglioLavoro({ appuntamentoId, statoAppuntamento, veicolo, veicoloKm, clienteNome, clienteTel }: { appuntamentoId: string; statoAppuntamento: string; veicolo?: { marca: string; modello: string; targa?: string }; veicoloKm?: number; clienteNome?: string; clienteTel?: string }) {
  const { utente, officina } = useAuthStore();
  const [foglio, setFoglio] = useState<FoglioLavoro | null>(null);
  const [difetti, setDifetti] = useState<Difetto[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [lavorazioniTipiche, setLavorazioniTipiche] = useState<string[]>([]);
  const [lavorazioniDaEseguire, setLavorazioniDaEseguire] = useState('');
  const [nomeOperaio, setNomeOperaio] = useState('');
  const [firma, setFirma] = useState('');

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
        setLavorazioniTipiche(fl.lavorazioni_tipiche || []);
        setLavorazioniDaEseguire(fl.lavorazioni_da_eseguire || '');
        setNomeOperaio(fl.nome_operaio || '');
        setFirma(fl.firma_operaio || '');

        const { data: dif } = await supabase
          .from('difetti')
          .select('*')
          .eq('foglio_lavoro_id', fl.id)
          .order('created_at');
        setDifetti(dif || []);
      }
      setLoading(false);
    };
    load();
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
      showToast('Scheda non creata: ' + (error?.message || 'errore sconosciuto'));
      return;
    }
    setFoglio(data);
    // Auto-set stato to in_lavorazione if currently in_diagnosi
    if (statoAppuntamento === 'in_diagnosi') {
      await supabase.from('appuntamenti').update({ stato: 'in_lavorazione' }).eq('id', appuntamentoId);
    }
    showToast('Scheda di lavoro creata');
  };

  const toggleLavorazione = async (voce: string) => {
    if (!foglio) return;
    const nuove = lavorazioniTipiche.includes(voce)
      ? lavorazioniTipiche.filter((v) => v !== voce)
      : [...lavorazioniTipiche, voce];
    setLavorazioniTipiche(nuove);
    const { error } = await supabase.from('foglio_lavoro').update({ lavorazioni_tipiche: nuove }).eq('id', foglio.id);
    if (error) showToast('Lavorazione non salvata: ' + error.message);
  };

  const salvaLavorazioniDaEseguire = async () => {
    if (!foglio) return;
    const { error } = await supabase.from('foglio_lavoro').update({ lavorazioni_da_eseguire: lavorazioniDaEseguire || null }).eq('id', foglio.id);
    if (error) showToast('Non salvato: ' + error.message);
  };

  const salvaOperaioFirma = async () => {
    if (!foglio) return;
    const { error } = await supabase
      .from('foglio_lavoro')
      .update({ nome_operaio: nomeOperaio || null, firma_operaio: firma || null })
      .eq('id', foglio.id);
    if (error) showToast('Non salvato: ' + error.message);
  };

  // ---- DIFETTI CRUD ----
  const addDifetto = async () => {
    if (!foglio) return;
    const { data } = await supabase
      .from('difetti')
      .insert({ foglio_lavoro_id: foglio.id, descrizione: '', gravita: 'media', risolto: false })
      .select()
      .single();
    if (data) setDifetti([...difetti, data]);
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

  const chiudiFoglio = async () => {
    if (!foglio) return;
    const { error } = await supabase
      .from('foglio_lavoro')
      .update({ fine: new Date().toISOString(), chiuso: true })
      .eq('id', foglio.id);
    if (error) { showToast('Lavoro non chiuso: ' + error.message); return; }
    setFoglio({ ...foglio, chiuso: true, fine: new Date().toISOString() });
    await supabase.from('appuntamenti').update({ stato: 'pronto' }).eq('id', appuntamentoId);
    showToast('Lavoro completato');
  };

  const riapriFoglio = async () => {
    if (!foglio) return;
    await supabase.from('foglio_lavoro').update({ chiuso: false, fine: null }).eq('id', foglio.id);
    setFoglio({ ...foglio, chiuso: false, fine: undefined });
    await supabase.from('appuntamenti').update({ stato: 'in_lavorazione' }).eq('id', appuntamentoId);
    showToast('Lavoro riaperto');
  };

  const stampaScheda = () => {
    if (!foglio) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Scheda di lavoro — ${officina?.nome || 'OfficinAI'}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;font-size:13px}
.header{display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #1a56db}
.header h1{color:#1a56db;font-size:20px}
.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.info-box{background:#f8f9fa;border-radius:8px;padding:10px}.info-box label{font-size:10px;color:#9ca3af;text-transform:uppercase}.info-box p{font-weight:600;margin-top:2px}
.section{margin-bottom:18px}.section h2{font-size:13px;color:#1a56db;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #ddd}
.checklist{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.check{display:flex;align-items:center;gap:6px;font-size:12px}
.box{width:14px;height:14px;border:2px solid #333;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:11px}
.firme{margin-top:30px;display:flex;justify-content:space-between}
.firma-box{text-align:center;width:30%}.firma-box .line{border-bottom:1px solid #333;height:35px;margin-bottom:5px}
.firma-box p{font-size:10px;color:#666}
@media print{body{padding:15px}}</style></head><body>
<div class="header"><h1>${officina?.nome || 'OfficinAI'}</h1><div style="text-align:right"><strong>SCHEDA DI LAVORO</strong><br>${new Date().toLocaleDateString('it-IT')}</div></div>
<div class="info-grid">
<div class="info-box"><label>Marca</label><p>${veicolo?.marca || '—'}</p></div>
<div class="info-box"><label>Modello</label><p>${veicolo?.modello || '—'}</p></div>
<div class="info-box"><label>Chilometri</label><p>${veicoloKm?.toLocaleString('it-IT') || '—'}</p></div>
<div class="info-box"><label>Telefono</label><p>${clienteTel || '—'}</p></div>
</div>
<div class="section"><h2>Lavorazioni tipiche</h2><div class="checklist">${LAVORAZIONI_TIPICHE.map((v) => `<div class="check"><span class="box">${lavorazioniTipiche.includes(v) ? '✓' : ''}</span>${v}</div>`).join('')}</div></div>
${lavorazioniDaEseguire ? `<div class="section"><h2>Lavorazioni da eseguire</h2><p>${lavorazioniDaEseguire.replace(/\n/g, '<br>')}</p></div>` : ''}
${difetti.length > 0 ? `<div class="section"><h2>Difetti riscontrati</h2>${difetti.map((d) => `<p>• ${d.descrizione || '—'} (${d.gravita})${d.risolto ? ' — risolto' : ''}</p>`).join('')}</div>` : ''}
<div class="firme">
<div class="firma-box"><div class="line"></div><p>Nome cliente${clienteNome ? `<br><strong>${clienteNome}</strong>` : ''}</p></div>
<div class="firma-box"><div class="line"></div><p>Operaio${nomeOperaio ? `<br><strong>${nomeOperaio}</strong>` : ''}</p></div>
<div class="firma-box"><div class="line"></div><p>Firma${firma ? `<br><strong>${firma}</strong>` : ''}</p></div>
</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  if (loading) return <div className="text-center py-4 text-sm text-gray-400">Caricamento...</div>;

  if (!foglio) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🔧</div>
        <p className="text-gray-500 text-sm mb-1">Nessuna scheda di lavoro aperta</p>
        <Button onClick={creaFoglio}>Crea scheda di lavoro</Button>
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

      {/* Dati veicolo */}
      <Card className="!p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Marca</div>
            <div className="text-sm font-semibold text-gray-900">{veicolo?.marca || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Modello</div>
            <div className="text-sm font-semibold text-gray-900">{veicolo?.modello || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Chilometri</div>
            <div className="text-sm font-semibold text-gray-900">{veicoloKm?.toLocaleString('it-IT') || '—'} km</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Telefono</div>
            {clienteTel ? (
              <a href={`tel:${clienteTel}`} className="text-sm font-semibold text-blue-600 hover:underline">{clienteTel}</a>
            ) : (
              <div className="text-sm font-semibold text-gray-900">—</div>
            )}
          </div>
        </div>
        {isChiuso && <div className="mt-2 text-xs font-semibold text-emerald-600">✓ COMPLETATO</div>}
      </Card>

      {/* Lavorazioni tipiche */}
      <Card className="!p-3 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Lavorazioni tipiche</h3>
        <div className="grid grid-cols-2 gap-2">
          {LAVORAZIONI_TIPICHE.map((voce) => {
            const checked = lavorazioniTipiche.includes(voce);
            return (
              <button
                key={voce}
                onClick={() => toggleLavorazione(voce)}
                disabled={isChiuso}
                className={`flex items-center gap-2 p-2 rounded-lg border-2 text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                  {checked && <span className="text-xs">✓</span>}
                </span>
                <span className="text-xs font-medium text-gray-800">{voce}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Lavorazioni da eseguire */}
      <Card className="!p-3 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Lavorazioni da eseguire</h3>
        <textarea
          value={lavorazioniDaEseguire}
          onChange={(e) => setLavorazioniDaEseguire(e.target.value)}
          onBlur={salvaLavorazioniDaEseguire}
          disabled={isChiuso}
          rows={5}
          placeholder="Descrivi qui il lavoro da fare..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
        />
      </Card>

      {/* Difetti riscontrati */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Difetti riscontrati <span className="text-gray-400 font-normal">({difetti.length})</span>
          </h3>
          {!isChiuso && (
            <button onClick={addDifetto} className="text-xs text-blue-600 font-semibold hover:text-blue-700 cursor-pointer">
              + Aggiungi
            </button>
          )}
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

      {/* Nome / Operaio / Firma */}
      <Card className="!p-3 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Nome, operaio, firma</h3>
        <div>
          <label className="text-[11px] text-gray-500 mb-0.5 block">Nome cliente</label>
          <div className="text-sm font-semibold text-gray-900">{clienteNome || '—'}</div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-0.5 block">Operaio</label>
          <input
            value={nomeOperaio}
            onChange={(e) => setNomeOperaio(e.target.value)}
            onBlur={salvaOperaioFirma}
            placeholder="Nome e cognome operaio"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-0.5 block">Firma</label>
          <input
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            onBlur={salvaOperaioFirma}
            placeholder="Firma (nome e cognome)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      <div className="space-y-2">
        <button
          onClick={stampaScheda}
          className="w-full p-3 rounded-2xl bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 transition-all cursor-pointer shadow-lg"
        >
          <div className="text-center flex items-center justify-center gap-2">
            <span className="text-lg">🖨️</span>
            <span className="font-bold text-xs">Stampa scheda</span>
          </div>
        </button>
        {!isChiuso ? (
          <Button onClick={chiudiFoglio} variant="danger" fullWidth>✓ Chiudi lavoro</Button>
        ) : (
          <Button onClick={riapriFoglio} variant="secondary" fullWidth>🔄 Riapri lavoro</Button>
        )}
      </div>
    </div>
  );
}
