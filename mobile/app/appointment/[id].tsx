import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import {
  BRAND_BLUE,
  STATI_ORDINE,
  STATO_CONFIG,
  type AppuntamentoStato,
} from '@/lib/constants';
import { fmtDataOra, fmtEuro, fmtDurata } from '@/lib/format';
import type {
  Appuntamento,
  FoglioLavoro,
  RicambioUsato,
  Foto,
  FotoCategoria,
  Preventivo,
  Messaggio,
} from '@/lib/types';

// --------------- Types ---------------

type TabKey = 'stato' | 'lavoro' | 'foto' | 'preventivo' | 'chat' | 'whatsapp';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'stato', label: 'Stato' },
  { key: 'lavoro', label: 'Lavoro' },
  { key: 'foto', label: 'Foto' },
  { key: 'preventivo', label: 'Preventivo' },
  { key: 'chat', label: 'Chat' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const FOTO_CATEGORIE: { key: FotoCategoria; label: string }[] = [
  { key: 'prima', label: 'Prima' },
  { key: 'durante', label: 'Durante' },
  { key: 'dopo', label: 'Dopo' },
  { key: 'difetto', label: 'Difetto' },
  { key: 'ricambio', label: 'Ricambio' },
];

// --------------- Main Screen ---------------

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [appointment, setAppointment] = useState<Appuntamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('stato');

  // Lavoro state
  const [foglio, setFoglio] = useState<FoglioLavoro | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number>(0);
  const [ricambi, setRicambi] = useState<RicambioUsato[]>([]);
  const [ricambioNome, setRicambioNome] = useState('');
  const [ricambioQta, setRicambioQta] = useState('1');
  const [ricambioPrezzo, setRicambioPrezzo] = useState('');
  const [noteFinali, setNoteFinali] = useState('');

  // Foto state
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [fotoCategoria, setFotoCategoria] = useState<FotoCategoria>('prima');
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Preventivo state
  const [preventivo, setPreventivo] = useState<Preventivo | null>(null);

  // Chat state
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Stato tab: richiesta management
  const [showPropostaForm, setShowPropostaForm] = useState(false);
  const [propostaDate, setPropostaDate] = useState('');
  const [propostaTime, setPropostaTime] = useState('');
  const [propostaNota, setPropostaNota] = useState('');

  // Preventivo editor state
  const [prevRighe, setPrevRighe] = useState<{ tipo: string; desc: string; qta: number; prezzo: number }[]>([]);
  const [prevSaving, setPrevSaving] = useState(false);

  // --------------- Load appointment ---------------

  useEffect(() => {
    if (id) loadAppointment();
  }, [id]);

  async function loadAppointment() {
    setLoading(true);
    const { data, error } = await supabase
      .from('appuntamenti')
      .select('*, clienti(id, nome, tel, email), veicoli(marca, modello, targa, anno, km)')
      .eq('id', id)
      .single();

    if (!error && data) {
      setAppointment(data as unknown as Appuntamento);
    }
    setLoading(false);
  }

  // --------------- Load tab data on tab change ---------------

  useEffect(() => {
    if (!appointment) return;
    if (activeTab === 'lavoro') loadFoglio();
    if (activeTab === 'foto') loadFotos();
    if (activeTab === 'preventivo') loadPreventivo();
    if (activeTab === 'chat') loadMessaggi();
  }, [activeTab, appointment?.id]);

  // --------------- Foglio di Lavoro ---------------

  async function loadFoglio() {
    if (!appointment) return;
    const { data } = await supabase
      .from('foglio_lavoro')
      .select('*')
      .eq('appuntamento_id', appointment.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const fl = data as unknown as FoglioLavoro;
      setFoglio(fl);
      setElapsed(fl.tempo_lavoro_ms || 0);
      setNoteFinali(fl.note_finali || '');
      if (fl.inizio && !fl.fine) {
        const startTime = new Date(fl.inizio).getTime();
        const already = fl.tempo_lavoro_ms || 0;
        timerStartRef.current = Date.now() - already;
        setTimerRunning(true);
      }
      loadRicambi(fl.id);
    } else {
      setFoglio(null);
      setElapsed(0);
      setRicambi([]);
    }
  }

  async function loadRicambi(foglioId: string) {
    const { data } = await supabase
      .from('ricambi_usati')
      .select('*')
      .eq('foglio_lavoro_id', foglioId)
      .order('created_at', { ascending: true });

    if (data) setRicambi(data as unknown as RicambioUsato[]);
  }

  async function ensureFoglio(): Promise<string | null> {
    if (foglio) return foglio.id;
    if (!appointment) return null;

    const { data: user } = await supabase.auth.getUser();
    const email = user?.user?.email || '';
    const { data: utente } = await supabase
      .from('utenti')
      .select('id')
      .eq('email', email)
      .single();
    const tecnicoId = utente?.id || '';

    const { data, error } = await supabase
      .from('foglio_lavoro')
      .insert({
        appuntamento_id: appointment.id,
        tecnico_id: tecnicoId,
        tempo_lavoro_ms: 0,
        pause: 0,
        chiuso: false,
      })
      .select('*')
      .single();

    if (error) {
      Alert.alert('Errore', 'Impossibile creare il foglio di lavoro.');
      return null;
    }

    const fl = data as unknown as FoglioLavoro;
    setFoglio(fl);
    return fl.id;
  }

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - timerStartRef.current);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  async function handleTimerToggle() {
    const foglioId = await ensureFoglio();
    if (!foglioId) return;

    if (!timerRunning) {
      timerStartRef.current = Date.now() - elapsed;
      setTimerRunning(true);
      await supabase
        .from('foglio_lavoro')
        .update({ inizio: new Date().toISOString() })
        .eq('id', foglioId);
    } else {
      setTimerRunning(false);
      const now = Date.now();
      const totalMs = now - timerStartRef.current;
      setElapsed(totalMs);
      await supabase
        .from('foglio_lavoro')
        .update({ fine: new Date().toISOString(), tempo_lavoro_ms: totalMs })
        .eq('id', foglioId);
      setFoglio((prev) => (prev ? { ...prev, tempo_lavoro_ms: totalMs, fine: new Date().toISOString() } : prev));
    }
  }

  async function handleAddRicambio() {
    if (!ricambioNome.trim()) {
      Alert.alert('Errore', 'Inserisci il nome del ricambio.');
      return;
    }
    const foglioId = await ensureFoglio();
    if (!foglioId) return;

    const { data, error } = await supabase
      .from('ricambi_usati')
      .insert({
        foglio_lavoro_id: foglioId,
        nome: ricambioNome.trim(),
        quantita: parseInt(ricambioQta, 10) || 1,
        prezzo: parseFloat(ricambioPrezzo) || 0,
        tipo: 'nuovo',
      })
      .select('*')
      .single();

    if (error) {
      Alert.alert('Errore', 'Impossibile aggiungere il ricambio.');
      return;
    }

    setRicambi((prev) => [...prev, data as unknown as RicambioUsato]);
    setRicambioNome('');
    setRicambioQta('1');
    setRicambioPrezzo('');
  }

  async function handleDeleteRicambio(ricambioId: string) {
    const { error } = await supabase.from('ricambi_usati').delete().eq('id', ricambioId);
    if (!error) {
      setRicambi((prev) => prev.filter((r) => r.id !== ricambioId));
    }
  }

  async function handleSaveNote() {
    if (!foglio) return;
    const { error } = await supabase
      .from('foglio_lavoro')
      .update({ note_finali: noteFinali })
      .eq('id', foglio.id);
    if (!error) {
      Alert.alert('Salvato', 'Note aggiornate.');
    }
  }

  async function handleChiudiFoglio() {
    if (!foglio) return;
    Alert.alert('Chiudi foglio', 'Vuoi chiudere il foglio di lavoro?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Chiudi',
        style: 'destructive',
        onPress: async () => {
          if (timerRunning) {
            setTimerRunning(false);
            const totalMs = Date.now() - timerStartRef.current;
            setElapsed(totalMs);
            await supabase
              .from('foglio_lavoro')
              .update({
                chiuso: true,
                fine: new Date().toISOString(),
                tempo_lavoro_ms: totalMs,
                note_finali: noteFinali,
              })
              .eq('id', foglio.id);
          } else {
            await supabase
              .from('foglio_lavoro')
              .update({ chiuso: true, note_finali: noteFinali })
              .eq('id', foglio.id);
          }
          setFoglio((prev) => (prev ? { ...prev, chiuso: true } : prev));
          Alert.alert('Completato', 'Foglio di lavoro chiuso.');
        },
      },
    ]);
  }

  // --------------- Foto ---------------

  async function loadFotos() {
    if (!appointment) return;
    const { data } = await supabase
      .from('foto')
      .select('*')
      .eq('appuntamento_id', appointment.id)
      .order('created_at', { ascending: false });

    if (data) setFotos(data as unknown as Foto[]);
  }

  async function handlePickImage(source: 'camera' | 'gallery') {
    if (!appointment) return;

    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permesso negato', 'Serve il permesso per usare la fotocamera.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permesso negato', 'Serve il permesso per accedere alla galleria.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        allowsEditing: false,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    setUploadingFoto(true);
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() || 'jpg';
    const fileName = `${appointment.id}/${Date.now()}.${ext}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('foto-lavorazione')
      .upload(fileName, blob, { contentType: `image/${ext}` });

    if (uploadError) {
      setUploadingFoto(false);
      Alert.alert('Errore', 'Upload fallito.');
      return;
    }

    const { data: urlData } = supabase.storage
      .from('foto-lavorazione')
      .getPublicUrl(fileName);

    const { data: fotoRow, error: insertError } = await supabase
      .from('foto')
      .insert({
        appuntamento_id: appointment.id,
        categoria: fotoCategoria,
        url: urlData.publicUrl,
        visibile_cliente: false,
      })
      .select('*')
      .single();

    setUploadingFoto(false);

    if (!insertError && fotoRow) {
      setFotos((prev) => [fotoRow as unknown as Foto, ...prev]);
    }
  }

  async function handleDeleteFoto(foto: Foto) {
    Alert.alert('Elimina foto', 'Vuoi eliminare questa foto?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          const pathMatch = foto.url.split('foto-lavorazione/').pop();
          if (pathMatch) {
            await supabase.storage.from('foto-lavorazione').remove([pathMatch]);
          }
          await supabase.from('foto').delete().eq('id', foto.id);
          setFotos((prev) => prev.filter((f) => f.id !== foto.id));
        },
      },
    ]);
  }

  // --------------- Preventivo ---------------

  async function loadPreventivo() {
    if (!appointment) return;
    const { data } = await supabase
      .from('preventivi')
      .select('*')
      .eq('appuntamento_id', appointment.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setPreventivo(data as unknown as Preventivo | null);
  }

  // --------------- Chat ---------------

  async function loadMessaggi() {
    if (!appointment) return;
    const { data } = await supabase
      .from('messaggi')
      .select('*')
      .eq('appuntamento_id', appointment.id)
      .order('created_at', { ascending: true });

    if (data) setMessaggi(data as unknown as Messaggio[]);
  }

  useEffect(() => {
    if (activeTab !== 'chat' || !appointment) return;

    const channel = supabase
      .channel(`messaggi-${appointment.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messaggi',
          filter: `appuntamento_id=eq.${appointment.id}`,
        },
        (payload) => {
          const newMsg = payload.new as unknown as Messaggio;
          setMessaggi((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, appointment?.id]);

  async function handleSendMessage() {
    if (!chatText.trim() || !appointment) return;
    setSendingChat(true);

    const { error } = await supabase.from('messaggi').insert({
      appuntamento_id: appointment.id,
      da: 'officina',
      testo: chatText.trim(),
      letto: false,
    });

    if (!error) {
      setChatText('');
    } else {
      Alert.alert('Errore', 'Impossibile inviare il messaggio.');
    }
    setSendingChat(false);
  }

  // --------------- Status change ---------------

  async function handleChangeStatus(newStato: AppuntamentoStato) {
    if (!appointment) return;
    const { error } = await supabase
      .from('appuntamenti')
      .update({ stato: newStato })
      .eq('id', appointment.id);

    if (!error) {
      setAppointment({ ...appointment, stato: newStato });
    } else {
      Alert.alert('Errore', 'Impossibile aggiornare lo stato.');
    }
  }

  // --------------- WhatsApp helpers ---------------

  function getWhatsAppUrl(message: string): string {
    const tel = appointment?.clienti?.tel || '';
    let phone = tel.replace(/[^0-9+]/g, '');
    if (phone.startsWith('+')) phone = phone.substring(1);
    else if (!phone.startsWith('39')) phone = '39' + phone;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  function buildWaMessage(template: 'status' | 'reminder' | 'ready'): string {
    const clienteName = appointment?.clienti?.nome || 'Cliente';
    const veicolo = appointment?.veicoli
      ? `${appointment.veicoli.marca} ${appointment.veicoli.modello} (${appointment.veicoli.targa})`
      : 'il veicolo';
    const statoLabel = appointment ? STATO_CONFIG[appointment.stato].label : '';

    switch (template) {
      case 'status':
        return `Buongiorno ${clienteName}, la informiamo che lo stato della lavorazione di ${veicolo} è: ${statoLabel}. Per qualsiasi informazione non esiti a contattarci.`;
      case 'reminder':
        return `Gentile ${clienteName}, le ricordiamo l'appuntamento per ${veicolo} previsto per ${appointment?.data_ora ? fmtDataOra(appointment.data_ora) : 'la data concordata'}. La aspettiamo!`;
      case 'ready':
        return `Buongiorno ${clienteName}, siamo lieti di informarla che ${veicolo} è pronto per il ritiro. Può passare in officina quando preferisce. Grazie!`;
    }
  }

  // --------------- Render loading / error ---------------

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 32 }}>!</Text>
          <Text style={styles.loadingText}>Appuntamento non trovato</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Torna indietro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --------------- Tab renderers ---------------

  const TIME_SLOTS = [
    '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
    '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  ];

  async function handleInviaProposta() {
    if (!appointment || !propostaDate || !propostaTime) {
      Alert.alert('Errore', 'Seleziona data e orario.');
      return;
    }
    const dataProposta = `${propostaDate}T${propostaTime}:00`;
    const { error } = await supabase
      .from('appuntamenti')
      .update({ data_proposta: dataProposta, nota_officina: propostaNota || null })
      .eq('id', appointment.id);
    if (!error) {
      setAppointment({ ...appointment, data_proposta: dataProposta, nota_officina: propostaNota || appointment.nota_officina });
      setShowPropostaForm(false);
      setPropostaDate('');
      setPropostaTime('');
      setPropostaNota('');
      Alert.alert('Inviato', 'Proposta inviata al cliente.');
    } else {
      Alert.alert('Errore', 'Impossibile inviare la proposta.');
    }
  }

  function handleAnnullaAppuntamento() {
    if (!appointment) return;
    Alert.alert(
      'Annulla Appuntamento',
      'Sei sicuro di voler annullare questo appuntamento? Potrai ripristinarlo in seguito.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, annulla',
          style: 'destructive',
          onPress: () => handleChangeStatus('annullato' as AppuntamentoStato),
        },
      ]
    );
  }

  function renderTabStato() {
    const current = appointment!.stato;
    return (
      <View style={styles.tabContent}>
        {/* Current status display */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Stato attuale</Text>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <StatusBadge status={current} size="medium" />
            <Text style={[styles.statoLargeText, { color: STATO_CONFIG[current].color }]}>
              {STATO_CONFIG[current].icon} {STATO_CONFIG[current].label}
            </Text>
          </View>
        </View>

        {/* === RICHIESTA state === */}
        {current === 'richiesta' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Gestisci richiesta</Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
                activeOpacity={0.7}
                onPress={() => handleChangeStatus('prenotato' as AppuntamentoStato)}
              >
                <Text style={styles.primaryBtnText}>Accetta Prenotazione</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#3b82f6' }]}
                activeOpacity={0.7}
                onPress={() => setShowPropostaForm(!showPropostaForm)}
              >
                <Text style={styles.primaryBtnText}>Proponi altra data</Text>
              </TouchableOpacity>

              {showPropostaForm && (
                <View style={styles.propostaForm}>
                  <Text style={styles.propostaFormLabel}>Data</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={propostaDate}
                    onChangeText={setPropostaDate}
                  />

                  <Text style={[styles.propostaFormLabel, { marginTop: 10 }]}>Orario</Text>
                  <View style={styles.timeSlotGrid}>
                    {TIME_SLOTS.map((slot) => (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.timeSlot,
                          propostaTime === slot && styles.timeSlotActive,
                        ]}
                        onPress={() => setPropostaTime(slot)}
                      >
                        <Text
                          style={[
                            styles.timeSlotText,
                            propostaTime === slot && styles.timeSlotTextActive,
                          ]}
                        >
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.propostaFormLabel, { marginTop: 10 }]}>Nota (opzionale)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Nota per il cliente..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    value={propostaNota}
                    onChangeText={setPropostaNota}
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#3b82f6', marginTop: 6 }]}
                    activeOpacity={0.7}
                    onPress={handleInviaProposta}
                  >
                    <Text style={styles.primaryBtnText}>Invia proposta</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* === PRENOTATO state === */}
        {current === 'prenotato' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Azioni</Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
                activeOpacity={0.7}
                onPress={() => handleChangeStatus('in_diagnosi' as AppuntamentoStato)}
              >
                <Text style={styles.primaryBtnText}>Auto arrivata in officina</Text>
              </TouchableOpacity>

              {/* Normal status flow */}
              <View style={styles.statiGrid}>
                {STATI_ORDINE.filter((s) => s !== current && s !== 'in_diagnosi').map((stato) => {
                  const cfg = STATO_CONFIG[stato];
                  return (
                    <TouchableOpacity
                      key={stato}
                      style={[styles.statoButton, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                      activeOpacity={0.7}
                      onPress={() => handleChangeStatus(stato)}
                    >
                      <Text style={[styles.statoButtonText, { color: cfg.color }]}>
                        {cfg.icon} {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* === Non-richiesta, non-prenotato states: normal flow + reversibility === */}
        {current !== 'richiesta' && current !== 'prenotato' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Cambia stato</Text>
            <View style={styles.statiGrid}>
              {STATI_ORDINE.filter((s) => s !== current).map((stato) => {
                const cfg = STATO_CONFIG[stato];
                return (
                  <TouchableOpacity
                    key={stato}
                    style={[styles.statoButton, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                    activeOpacity={0.7}
                    onPress={() => handleChangeStatus(stato)}
                  >
                    <Text style={[styles.statoButtonText, { color: cfg.color }]}>
                      {cfg.icon} {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Reversibility actions for non-richiesta states */}
        {current !== 'richiesta' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Azioni reversibili</Text>
            <View style={{ gap: 10 }}>
              {(current === 'in_diagnosi' || current === 'in_lavorazione') && (
                <TouchableOpacity
                  style={[styles.secondaryBtn]}
                  activeOpacity={0.7}
                  onPress={() => handleChangeStatus('prenotato' as AppuntamentoStato)}
                >
                  <Text style={styles.secondaryBtnText}>Riporta a Prenotato</Text>
                </TouchableOpacity>
              )}

              {current === 'annullato' && (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#3b82f6' }]}
                  activeOpacity={0.7}
                  onPress={() => handleChangeStatus('prenotato' as AppuntamentoStato)}
                >
                  <Text style={styles.primaryBtnText}>Ripristina</Text>
                </TouchableOpacity>
              )}

              {current !== 'annullato' && (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#f97316' }]}
                  activeOpacity={0.7}
                  onPress={handleAnnullaAppuntamento}
                >
                  <Text style={styles.primaryBtnText}>Annulla Appuntamento</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {appointment!.problema ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Problema</Text>
            <Text style={styles.bodyText}>{appointment!.problema}</Text>
          </View>
        ) : null}

        {appointment!.nota_officina ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Nota officina</Text>
            <Text style={styles.bodyText}>{appointment!.nota_officina}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  function renderTabLavoro() {
    const isChiuso = foglio?.chiuso === true;

    return (
      <View style={styles.tabContent}>
        {/* Timer */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Timer lavoro</Text>
          <Text style={styles.timerText}>{fmtDurata(elapsed)}</Text>
          {!isChiuso && (
            <TouchableOpacity
              style={[styles.primaryBtn, timerRunning && styles.dangerBtn]}
              activeOpacity={0.7}
              onPress={handleTimerToggle}
            >
              <Text style={styles.primaryBtnText}>
                {timerRunning ? 'Stop' : 'Start'}
              </Text>
            </TouchableOpacity>
          )}
          {isChiuso && (
            <Text style={styles.chiusoLabel}>Foglio chiuso</Text>
          )}
        </View>

        {/* Ricambi */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ricambi usati</Text>
          {ricambi.map((r) => (
            <View key={r.id} style={styles.ricambioRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ricambioNome}>{r.nome}</Text>
                <Text style={styles.ricambioDetail}>
                  Qta: {r.quantita} - {fmtEuro(r.prezzo)}
                </Text>
              </View>
              {!isChiuso && (
                <TouchableOpacity onPress={() => handleDeleteRicambio(r.id)}>
                  <Text style={styles.deleteIcon}>X</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {ricambi.length === 0 && (
            <Text style={styles.emptyText}>Nessun ricambio aggiunto</Text>
          )}

          {!isChiuso && (
            <View style={styles.addRicambioForm}>
              <TextInput
                style={styles.input}
                placeholder="Nome ricambio"
                placeholderTextColor="#94a3b8"
                value={ricambioNome}
                onChangeText={setRicambioNome}
              />
              <View style={styles.inlineInputs}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Qta"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={ricambioQta}
                  onChangeText={setRicambioQta}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Prezzo"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  value={ricambioPrezzo}
                  onChangeText={setRicambioPrezzo}
                />
              </View>
              <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={handleAddRicambio}>
                <Text style={styles.secondaryBtnText}>+ Aggiungi ricambio</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Note finali */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Note finali</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Note sulla lavorazione..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={noteFinali}
            onChangeText={setNoteFinali}
            editable={!isChiuso}
          />
          {!isChiuso && (
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={handleSaveNote}>
              <Text style={styles.secondaryBtnText}>Salva note</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Chiudi foglio */}
        {foglio && !isChiuso && (
          <TouchableOpacity style={styles.dangerBtn} activeOpacity={0.7} onPress={handleChiudiFoglio}>
            <Text style={styles.primaryBtnText}>Chiudi foglio di lavoro</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderTabFoto() {
    return (
      <View style={styles.tabContent}>
        {/* Category selector */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoriePills}>
              {FOTO_CATEGORIE.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.pill,
                    fotoCategoria === cat.key && styles.pillActive,
                  ]}
                  onPress={() => setFotoCategoria(cat.key)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      fotoCategoria === cat.key && styles.pillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.fotoActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              activeOpacity={0.7}
              onPress={() => handlePickImage('camera')}
            >
              <Text style={styles.primaryBtnText}>Fotocamera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1 }]}
              activeOpacity={0.7}
              onPress={() => handlePickImage('gallery')}
            >
              <Text style={styles.secondaryBtnText}>Galleria</Text>
            </TouchableOpacity>
          </View>

          {uploadingFoto && (
            <ActivityIndicator style={{ marginTop: 8 }} color={BRAND_BLUE} />
          )}
        </View>

        {/* Photo grid */}
        {fotos.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nessuna foto caricata</Text>
          </View>
        ) : (
          <View style={styles.fotoGrid}>
            {fotos.map((foto) => (
              <TouchableOpacity
                key={foto.id}
                style={styles.fotoItem}
                activeOpacity={0.8}
                onLongPress={() => handleDeleteFoto(foto)}
              >
                <Image source={{ uri: foto.url }} style={styles.fotoImage} />
                <View style={styles.fotoCatBadge}>
                  <Text style={styles.fotoCatText}>{foto.categoria}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  async function handleCreaPreventivo() {
    if (!appointment) return;
    const { data, error } = await supabase
      .from('preventivi')
      .insert({
        appuntamento_id: appointment.id,
        righe: [],
        subtotale: 0,
        sconto: 0,
        iva: 0,
        totale: 0,
        stato: 'bozza',
      })
      .select('*')
      .single();

    if (!error && data) {
      const p = data as unknown as Preventivo;
      setPreventivo(p);
      setPrevRighe([]);
    } else {
      Alert.alert('Errore', 'Impossibile creare il preventivo.');
    }
  }

  function handleAddPrevRiga(tipo: 'manodopera' | 'ricambio') {
    setPrevRighe((prev) => [...prev, { tipo, desc: '', qta: 1, prezzo: 0 }]);
  }

  function handleUpdatePrevRiga(index: number, field: string, value: string) {
    setPrevRighe((prev) => {
      const updated = [...prev];
      if (field === 'desc') {
        updated[index] = { ...updated[index], desc: value };
      } else if (field === 'qta') {
        updated[index] = { ...updated[index], qta: parseInt(value, 10) || 0 };
      } else if (field === 'prezzo') {
        updated[index] = { ...updated[index], prezzo: parseFloat(value) || 0 };
      }
      return updated;
    });
  }

  function handleDeletePrevRiga(index: number) {
    setPrevRighe((prev) => prev.filter((_, i) => i !== index));
  }

  function calcPrevTotals() {
    const subtotale = prevRighe.reduce((sum, r) => sum + r.qta * r.prezzo, 0);
    const iva = subtotale * 0.22;
    const totale = subtotale + iva;
    return { subtotale, iva, totale };
  }

  async function handleSalvaPreventivo() {
    if (!preventivo || !appointment) return;
    setPrevSaving(true);
    const { subtotale, iva, totale } = calcPrevTotals();
    const { error } = await supabase
      .from('preventivi')
      .upsert({
        id: preventivo.id,
        appuntamento_id: appointment.id,
        righe: prevRighe,
        subtotale,
        sconto: 0,
        iva,
        totale,
        stato: preventivo.stato === 'inviato' ? 'inviato' : 'bozza',
      });
    setPrevSaving(false);
    if (!error) {
      setPreventivo((prev) => prev ? { ...prev, righe: prevRighe as any, subtotale, iva, totale, sconto: 0 } : prev);
      Alert.alert('Salvato', 'Preventivo aggiornato.');
    } else {
      Alert.alert('Errore', 'Impossibile salvare il preventivo.');
    }
  }

  async function handleInviaPreventivo() {
    if (!preventivo) return;
    // Save first, then mark as sent
    const { subtotale, iva, totale } = calcPrevTotals();
    const { error } = await supabase
      .from('preventivi')
      .update({ righe: prevRighe, subtotale, sconto: 0, iva, totale, stato: 'inviato' })
      .eq('id', preventivo.id);
    if (!error) {
      setPreventivo((prev) => prev ? { ...prev, righe: prevRighe as any, subtotale, iva, totale, sconto: 0, stato: 'inviato' } : prev);
      Alert.alert('Inviato', 'Preventivo inviato al cliente.');
    } else {
      Alert.alert('Errore', 'Impossibile inviare il preventivo.');
    }
  }

  // Sync prevRighe when preventivo loads
  useEffect(() => {
    if (preventivo?.righe) {
      setPrevRighe(preventivo.righe as any);
    } else {
      setPrevRighe([]);
    }
  }, [preventivo?.id]);

  function renderTabPreventivo() {
    if (!preventivo) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nessun preventivo</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 12 }]}
              activeOpacity={0.7}
              onPress={handleCreaPreventivo}
            >
              <Text style={styles.primaryBtnText}>Crea Preventivo</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const statoBadgeColors: Record<string, { color: string; bg: string }> = {
      bozza: { color: '#6b7280', bg: '#f3f4f6' },
      inviato: { color: '#3b82f6', bg: '#dbeafe' },
      accettato: { color: '#10b981', bg: '#d1fae5' },
      rifiutato: { color: '#ef4444', bg: '#fee2e2' },
    };
    const pCfg = statoBadgeColors[preventivo.stato] || statoBadgeColors.bozza;
    const { subtotale, iva, totale } = calcPrevTotals();

    return (
      <View style={styles.tabContent}>
        <View style={styles.card}>
          <View style={styles.prevHeader}>
            <Text style={styles.cardLabel}>Preventivo</Text>
            <View style={[styles.prevBadge, { backgroundColor: pCfg.bg }]}>
              <Text style={[styles.prevBadgeText, { color: pCfg.color }]}>
                {preventivo.stato.charAt(0).toUpperCase() + preventivo.stato.slice(1)}
              </Text>
            </View>
          </View>

          {/* Editable Righe */}
          {prevRighe.map((riga, i) => (
            <View key={i} style={styles.prevEditRiga}>
              <View style={styles.prevEditRigaHeader}>
                <View style={[styles.prevTipoBadge, { backgroundColor: riga.tipo === 'manodopera' ? '#dbeafe' : '#fef3c7' }]}>
                  <Text style={[styles.prevTipoBadgeText, { color: riga.tipo === 'manodopera' ? '#3b82f6' : '#d97706' }]}>
                    {riga.tipo === 'manodopera' ? 'Manodopera' : 'Ricambio'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeletePrevRiga(i)}>
                  <Text style={styles.deleteIcon}>X</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Descrizione"
                placeholderTextColor="#94a3b8"
                value={riga.desc}
                onChangeText={(v) => handleUpdatePrevRiga(i, 'desc', v)}
              />
              <View style={styles.inlineInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prevInputLabel}>Qta</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={String(riga.qta)}
                    onChangeText={(v) => handleUpdatePrevRiga(i, 'qta', v)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prevInputLabel}>Prezzo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                    value={String(riga.prezzo)}
                    onChangeText={(v) => handleUpdatePrevRiga(i, 'prezzo', v)}
                  />
                </View>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={styles.prevInputLabel}>Totale</Text>
                  <Text style={styles.prevRigaTotale}>{fmtEuro(riga.qta * riga.prezzo)}</Text>
                </View>
              </View>
            </View>
          ))}

          {prevRighe.length === 0 && (
            <Text style={styles.emptyText}>Nessuna voce aggiunta</Text>
          )}

          {/* Add buttons */}
          <View style={[styles.inlineInputs, { marginTop: 12 }]}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1 }]}
              activeOpacity={0.7}
              onPress={() => handleAddPrevRiga('manodopera')}
            >
              <Text style={styles.secondaryBtnText}>+ Manodopera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1 }]}
              activeOpacity={0.7}
              onPress={() => handleAddPrevRiga('ricambio')}
            >
              <Text style={styles.secondaryBtnText}>+ Ricambio</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.card}>
          <View style={styles.prevTotali}>
            <View style={styles.prevTotaleRow}>
              <Text style={styles.prevTotaleLabel}>Subtotale</Text>
              <Text style={styles.prevTotaleValue}>{fmtEuro(subtotale)}</Text>
            </View>
            <View style={styles.prevTotaleRow}>
              <Text style={styles.prevTotaleLabel}>IVA (22%)</Text>
              <Text style={styles.prevTotaleValue}>{fmtEuro(iva)}</Text>
            </View>
            <View style={[styles.prevTotaleRow, styles.prevTotaleRowFinal]}>
              <Text style={styles.prevTotaleFinalLabel}>Totale</Text>
              <Text style={styles.prevTotaleFinalValue}>{fmtEuro(totale)}</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={[styles.primaryBtn, prevSaving && { opacity: 0.5 }]}
            activeOpacity={0.7}
            disabled={prevSaving}
            onPress={handleSalvaPreventivo}
          >
            <Text style={styles.primaryBtnText}>{prevSaving ? 'Salvataggio...' : 'Salva'}</Text>
          </TouchableOpacity>

          {preventivo.stato === 'bozza' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
              activeOpacity={0.7}
              onPress={handleInviaPreventivo}
            >
              <Text style={styles.primaryBtnText}>Invia al cliente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  function renderTabChat() {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={140}
      >
        <FlatList
          data={[...messaggi].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={styles.chatList}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={styles.emptyText}>Nessun messaggio</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOfficina = item.da === 'officina';
            return (
              <View
                style={[
                  styles.chatBubble,
                  isOfficina ? styles.chatBubbleOfficina : styles.chatBubbleCliente,
                ]}
              >
                <Text style={[styles.chatBubbleText, isOfficina && { color: '#fff' }]}>
                  {item.testo}
                </Text>
                <Text style={[styles.chatTime, isOfficina && { color: 'rgba(255,255,255,0.7)' }]}>
                  {fmtDataOra(item.created_at)}
                </Text>
              </View>
            );
          }}
        />
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#94a3b8"
            value={chatText}
            onChangeText={setChatText}
            multiline
          />
          <TouchableOpacity
            style={[styles.chatSendBtn, !chatText.trim() && { opacity: 0.4 }]}
            disabled={!chatText.trim() || sendingChat}
            onPress={handleSendMessage}
          >
            <Text style={styles.chatSendBtnText}>Invia</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  function renderTabWhatsApp() {
    const templates: { key: 'status' | 'reminder' | 'ready'; label: string; icon: string }[] = [
      { key: 'status', label: 'Aggiornamento stato', icon: 'i' },
      { key: 'reminder', label: 'Promemoria appuntamento', icon: '!' },
      { key: 'ready', label: 'Veicolo pronto', icon: 'V' },
    ];

    const tel = appointment?.clienti?.tel;

    if (!tel) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.card}>
            <Text style={styles.emptyText}>Numero di telefono non disponibile</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {templates.map((tpl) => {
          const msg = buildWaMessage(tpl.key);
          return (
            <View key={tpl.key} style={styles.card}>
              <View style={styles.waTemplateHeader}>
                <Text style={styles.waTemplateTitle}>{tpl.label}</Text>
              </View>
              <Text style={styles.waPreview}>{msg}</Text>
              <TouchableOpacity
                style={styles.waButton}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(getWhatsAppUrl(msg))}
              >
                <Text style={styles.waButtonText}>Invia su WhatsApp</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.secondaryBtn, { marginTop: 4 }]}
          activeOpacity={0.7}
          onPress={() => Linking.openURL(`tel:${tel}`)}
        >
          <Text style={styles.secondaryBtnText}>Chiama {tel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --------------- Active tab content ---------------

  function renderActiveTab() {
    switch (activeTab) {
      case 'stato':
        return renderTabStato();
      case 'lavoro':
        return renderTabLavoro();
      case 'foto':
        return renderTabFoto();
      case 'preventivo':
        return renderTabPreventivo();
      case 'chat':
        return renderTabChat();
      case 'whatsapp':
        return renderTabWhatsApp();
    }
  }

  // --------------- Main render ---------------

  const cliente = appointment.clienti;
  const veicolo = appointment.veicoli;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {cliente?.nome || 'Cliente'}
          </Text>
          <Text style={styles.headerVehicle} numberOfLines={1}>
            {veicolo ? `${veicolo.marca} ${veicolo.modello} - ${veicolo.targa}` : 'Veicolo'}
          </Text>
        </View>
        <StatusBadge status={appointment.stato} />
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeTab === 'chat' ? (
        renderActiveTab()
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderActiveTab()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --------------- Styles ---------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  linkText: {
    fontSize: 14,
    color: BRAND_BLUE,
    fontWeight: '600',
    marginTop: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerVehicle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 1,
  },

  // Tab bar
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    maxHeight: 48,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 4,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: BRAND_BLUE,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: BRAND_BLUE,
  },

  // Scroll / tab content
  scrollContent: {
    paddingBottom: 40,
  },
  tabContent: {
    padding: 16,
    gap: 14,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },

  // Stato tab
  statoLargeText: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 10,
  },
  statiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statoButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statoButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Lavoro tab
  timerText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 12,
  },
  chiusoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    textAlign: 'center',
    marginTop: 4,
  },
  ricambioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  ricambioNome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  ricambioDetail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  deleteIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addRicambioForm: {
    marginTop: 12,
    gap: 8,
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 80,
    marginBottom: 8,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },

  // Foto tab
  categoriePills: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: BRAND_BLUE,
    borderColor: BRAND_BLUE,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  pillTextActive: {
    color: '#fff',
  },
  fotoActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  fotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fotoItem: {
    width: '48.5%' as unknown as number,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  fotoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fotoCatBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fotoCatText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Preventivo tab
  prevHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  prevBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prevBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  prevRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  prevRigaDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  prevRigaTipo: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  prevRigaQta: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
  prevRigaPrezzo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    width: 80,
    textAlign: 'right',
  },
  prevTotali: {
    marginTop: 14,
    gap: 6,
  },
  prevTotaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prevTotaleRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 6,
  },
  prevTotaleLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  prevTotaleValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  prevTotaleFinalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  prevTotaleFinalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },

  // Chat tab
  chatList: {
    padding: 16,
    gap: 8,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 4,
  },
  chatBubbleOfficina: {
    backgroundColor: BRAND_BLUE,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleCliente: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatBubbleText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  chatTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'right',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#0f172a',
  },
  chatSendBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  chatSendBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // WhatsApp tab
  waTemplateHeader: {
    marginBottom: 8,
  },
  waTemplateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  waPreview: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  waButton: {
    backgroundColor: '#25d366',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  waButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Proposta form (stato tab)
  propostaForm: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  propostaFormLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  timeSlotGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: 4,
  },
  timeSlot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeSlotActive: {
    backgroundColor: BRAND_BLUE,
    borderColor: BRAND_BLUE,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  timeSlotTextActive: {
    color: '#fff',
  },

  // Preventivo editor
  prevEditRiga: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  prevEditRigaHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  prevTipoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prevTipoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  prevInputLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 3,
  },
  prevRigaTotale: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right' as const,
    paddingVertical: 10,
  },

  // Misc
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
