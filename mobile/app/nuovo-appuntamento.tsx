import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { BRAND_BLUE } from '@/lib/constants';
import type { Cliente, Veicolo } from '@/lib/types';

const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
];

export default function NuovoAppuntamentoScreen() {
  const { officina } = useAuthStore();
  const router = useRouter();

  // Step 1: Client
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Cliente[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Vehicle
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loadingVeicoli, setLoadingVeicoli] = useState(false);
  const [selectedVeicolo, setSelectedVeicolo] = useState<Veicolo | null>(null);

  // Step 3: Details
  const [data, setData] = useState('');
  const [ora, setOra] = useState('');
  const [priorita, setPriorita] = useState<'normale' | 'urgente'>('normale');
  const [problema, setProblema] = useState('');

  const [saving, setSaving] = useState(false);

  // --- Client search with debounce ---
  useEffect(() => {
    if (selectedClient) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!clientSearch.trim()) {
      setClientResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchClients(clientSearch.trim());
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [clientSearch, selectedClient]);

  async function searchClients(query: string) {
    if (!officina?.id) return;
    setSearchingClients(true);
    const { data, error } = await supabase
      .from('clienti')
      .select('*')
      .eq('officina_id', officina.id)
      .ilike('nome', `%${query}%`)
      .order('nome', { ascending: true })
      .limit(10);

    if (!error && data) setClientResults(data as Cliente[]);
    setSearchingClients(false);
  }

  // --- Load vehicles when client selected ---
  useEffect(() => {
    if (!selectedClient) {
      setVeicoli([]);
      setSelectedVeicolo(null);
      return;
    }
    loadVeicoli(selectedClient.id);
  }, [selectedClient]);

  async function loadVeicoli(clienteId: string) {
    setLoadingVeicoli(true);
    const { data, error } = await supabase
      .from('veicoli')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('marca', { ascending: true });

    if (!error && data) setVeicoli(data as Veicolo[]);
    setLoadingVeicoli(false);
  }

  function handleSelectClient(client: Cliente) {
    setSelectedClient(client);
    setClientSearch('');
    setClientResults([]);
  }

  function handleDeselectClient() {
    setSelectedClient(null);
    setSelectedVeicolo(null);
    setClientSearch('');
  }

  // --- Save ---
  async function handleSave() {
    if (!officina?.id) return;
    if (!selectedClient) {
      Alert.alert('Errore', 'Seleziona un cliente.');
      return;
    }
    if (!data.trim()) {
      Alert.alert('Errore', 'Inserisci la data.');
      return;
    }
    if (!ora) {
      Alert.alert('Errore', 'Seleziona un orario.');
      return;
    }

    // Build ISO date string
    const dataOra = `${data.trim()}T${ora}:00`;
    // Basic date validation
    if (isNaN(new Date(dataOra).getTime())) {
      Alert.alert('Errore', 'Data non valida. Usa il formato YYYY-MM-DD.');
      return;
    }

    setSaving(true);
    const payload = {
      officina_id: officina.id,
      cliente_id: selectedClient.id,
      veicolo_id: selectedVeicolo?.id || null,
      data_ora: dataOra,
      stato: 'prenotato' as const,
      priorita,
      problema: problema.trim(),
    };

    const { error } = await supabase.from('appuntamenti').insert(payload);
    setSaving(false);

    if (error) {
      Alert.alert('Errore', error.message);
      return;
    }

    Alert.alert('Successo', 'Appuntamento creato con successo.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Nuovo Appuntamento',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===== SECTION: Cliente ===== */}
        <Text style={styles.sectionHeader}>Cliente</Text>
        <View style={styles.card}>
          {selectedClient ? (
            <View style={styles.selectedRow}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName}>{selectedClient.nome}</Text>
                {selectedClient.tel ? (
                  <Text style={styles.selectedSub}>{selectedClient.tel}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.deselectBtn} onPress={handleDeselectClient}>
                <Text style={styles.deselectBtnText}>X</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.fieldInput}
                placeholder="Cerca cliente per nome..."
                placeholderTextColor="#94a3b8"
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {searchingClients && (
                <ActivityIndicator size="small" color={BRAND_BLUE} style={{ marginTop: 8 }} />
              )}
              {clientResults.length > 0 && (
                <View style={styles.resultsList}>
                  {clientResults.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.resultItem}
                      onPress={() => handleSelectClient(c)}
                    >
                      <Text style={styles.resultName}>{c.nome}</Text>
                      {c.tel ? <Text style={styles.resultSub}>{c.tel}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {clientSearch.trim().length > 0 &&
                !searchingClients &&
                clientResults.length === 0 && (
                  <Text style={styles.noResults}>Nessun cliente trovato</Text>
                )}
              <TouchableOpacity
                style={styles.newClientBtn}
                onPress={() => router.push('/nuovo-cliente')}
              >
                <Text style={styles.newClientBtnText}>+ Nuovo cliente</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ===== SECTION: Veicolo ===== */}
        {selectedClient && (
          <>
            <Text style={styles.sectionHeader}>Veicolo</Text>
            <View style={styles.card}>
              {loadingVeicoli ? (
                <ActivityIndicator size="small" color={BRAND_BLUE} />
              ) : veicoli.length === 0 ? (
                <Text style={styles.noResults}>Nessun veicolo</Text>
              ) : (
                <View style={styles.veicoliGrid}>
                  {veicoli.map((v) => {
                    const isSelected = selectedVeicolo?.id === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.veicoloCard, isSelected && styles.veicoloCardSelected]}
                        onPress={() => setSelectedVeicolo(isSelected ? null : v)}
                      >
                        <Text style={[styles.veicoloName, isSelected && styles.veicoloNameSelected]}>
                          {v.marca} {v.modello}
                        </Text>
                        <Text style={[styles.veicoloTarga, isSelected && styles.veicoloTargaSelected]}>
                          {v.targa}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {/* ===== SECTION: Dettagli ===== */}
        <Text style={styles.sectionHeader}>Dettagli</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Data</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            value={data}
            onChangeText={setData}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Ora</Text>
          <View style={styles.timeGrid}>
            {TIME_SLOTS.map((slot) => {
              const isSelected = ora === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                  onPress={() => setOra(isSelected ? '' : slot)}
                >
                  <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextSelected]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Priorita</Text>
          <View style={styles.prioritaRow}>
            {(['normale', 'urgente'] as const).map((p) => {
              const isSelected = priorita === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.prioritaBtn,
                    isSelected && (p === 'urgente' ? styles.prioritaBtnUrgente : styles.prioritaBtnSelected),
                  ]}
                  onPress={() => setPriorita(p)}
                >
                  <Text
                    style={[
                      styles.prioritaBtnText,
                      isSelected && styles.prioritaBtnTextSelected,
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Problema</Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldMultiline]}
            placeholder="Descrivi il problema..."
            placeholderTextColor="#94a3b8"
            value={problema}
            onChangeText={setProblema}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ===== Save button ===== */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Crea Appuntamento</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldMultiline: {
    minHeight: 100,
    paddingTop: 12,
  },

  // Client selection
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  selectedSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  deselectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deselectBtnText: { fontSize: 14, fontWeight: '700', color: '#64748b' },

  resultsList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  resultItem: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultName: { fontSize: 15, fontWeight: '500', color: '#0f172a' },
  resultSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  noResults: { fontSize: 13, color: '#94a3b8', marginTop: 10, textAlign: 'center' },

  newClientBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND_BLUE,
    borderStyle: 'dashed',
  },
  newClientBtnText: { fontSize: 14, fontWeight: '600', color: BRAND_BLUE },

  // Vehicles
  veicoliGrid: { gap: 8 },
  veicoloCard: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  veicoloCardSelected: {
    backgroundColor: '#dbeafe',
    borderColor: BRAND_BLUE,
  },
  veicoloName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  veicoloNameSelected: { color: BRAND_BLUE },
  veicoloTarga: { fontSize: 13, color: '#64748b', marginTop: 2 },
  veicoloTargaSelected: { color: '#1e40af' },

  // Time slots
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeSlotSelected: {
    backgroundColor: BRAND_BLUE,
    borderColor: BRAND_BLUE,
  },
  timeSlotText: { fontSize: 13, fontWeight: '500', color: '#334155' },
  timeSlotTextSelected: { color: '#fff' },

  // Priority
  prioritaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  prioritaBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  prioritaBtnSelected: {
    backgroundColor: '#dbeafe',
    borderColor: BRAND_BLUE,
  },
  prioritaBtnUrgente: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  prioritaBtnText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  prioritaBtnTextSelected: { color: '#0f172a', fontWeight: '600' },

  // Save
  saveBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
