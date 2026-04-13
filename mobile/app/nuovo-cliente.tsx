import { useState } from 'react';
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
  Switch,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { BRAND_BLUE } from '@/lib/constants';

const CARBURANTI = ['benzina', 'diesel', 'gpl', 'metano', 'ibrido', 'elettrico'] as const;
type Carburante = (typeof CARBURANTI)[number];

const currentYear = new Date().getFullYear();

export default function NuovoClienteScreen() {
  const router = useRouter();
  const { officina } = useAuthStore();
  const [saving, setSaving] = useState(false);

  // Client fields
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [note, setNote] = useState('');

  // Vehicle toggle + fields
  const [addVeicolo, setAddVeicolo] = useState(false);
  const [targa, setTarga] = useState('');
  const [marca, setMarca] = useState('N/D');
  const [modello, setModello] = useState('N/D');
  const [anno, setAnno] = useState(String(currentYear));
  const [km, setKm] = useState('0');
  const [carburante, setCarburante] = useState<Carburante>('benzina');

  function buildNote(): string | null {
    const parts: string[] = [];
    if (codiceFiscale.trim()) parts.push(`CF: ${codiceFiscale.trim().toUpperCase()}`);
    if (indirizzo.trim()) parts.push(`Indirizzo: ${indirizzo.trim()}`);
    if (note.trim()) parts.push(note.trim());
    return parts.length > 0 ? parts.join(' | ') : null;
  }

  async function handleSave() {
    if (!officina?.id) {
      Alert.alert('Errore', 'Officina non trovata.');
      return;
    }
    if (!nome.trim()) {
      Alert.alert('Errore', 'Il nome del cliente è obbligatorio.');
      return;
    }

    setSaving(true);
    try {
      const clientePayload = {
        officina_id: officina.id,
        nome: nome.trim(),
        email: email.trim() || null,
        tel: tel.trim() || null,
        note: buildNote(),
      };

      const { data: cliente, error: clienteError } = await supabase
        .from('clienti')
        .insert(clientePayload)
        .select('id')
        .single();

      if (clienteError) {
        Alert.alert('Errore', clienteError.message);
        setSaving(false);
        return;
      }

      if (addVeicolo && targa.trim()) {
        const veicoloPayload = {
          cliente_id: cliente.id,
          marca: marca.trim() || 'N/D',
          modello: modello.trim() || 'N/D',
          targa: targa.trim().toUpperCase(),
          anno: parseInt(anno, 10) || currentYear,
          km: parseInt(km, 10) || 0,
          carburante,
          note: null,
        };

        const { error: veicoloError } = await supabase
          .from('veicoli')
          .insert(veicoloPayload);

        if (veicoloError) {
          Alert.alert(
            'Attenzione',
            `Cliente creato, ma errore nel veicolo: ${veicoloError.message}`
          );
          setSaving(false);
          router.back();
          return;
        }
      }

      Alert.alert('Successo', 'Cliente creato con successo.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Errore', err?.message || 'Errore imprevisto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Nuovo Cliente',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Client Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati Cliente</Text>

          <Text style={styles.fieldLabel}>Nome *</Text>
          <TextInput
            style={styles.fieldInput}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome e cognome"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.fieldLabel}>Telefono</Text>
          <TextInput
            style={styles.fieldInput}
            value={tel}
            onChangeText={setTel}
            placeholder="Numero di telefono"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.fieldInput}
            value={email}
            onChangeText={setEmail}
            placeholder="email@esempio.it"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Codice Fiscale</Text>
          <TextInput
            style={styles.fieldInput}
            value={codiceFiscale}
            onChangeText={(v) => setCodiceFiscale(v.toUpperCase())}
            placeholder="RSSMRA80A01H501U"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>Indirizzo</Text>
          <TextInput
            style={styles.fieldInput}
            value={indirizzo}
            onChangeText={setIndirizzo}
            placeholder="Via, numero, città"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.fieldLabel}>Note</Text>
          <TextInput
            style={[styles.fieldInput, styles.multilineInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Note libere..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Vehicle Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <Text style={styles.sectionTitle}>Aggiungi veicolo</Text>
            <Switch
              value={addVeicolo}
              onValueChange={setAddVeicolo}
              trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
              thumbColor={addVeicolo ? BRAND_BLUE : '#f4f3f4'}
            />
          </View>

          {addVeicolo && (
            <View>
              <Text style={styles.fieldLabel}>Targa</Text>
              <TextInput
                style={styles.fieldInput}
                value={targa}
                onChangeText={(v) => setTarga(v.toUpperCase())}
                placeholder="AA000BB"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Marca</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={marca}
                    onChangeText={setMarca}
                    placeholder="N/D"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Modello</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={modello}
                    onChangeText={setModello}
                    placeholder="N/D"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Anno</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={anno}
                    onChangeText={setAnno}
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Km</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={km}
                    onChangeText={setKm}
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Carburante</Text>
              <View style={styles.buttonGroup}>
                {CARBURANTI.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.buttonGroupItem,
                      carburante === c && styles.buttonGroupItemActive,
                    ]}
                    onPress={() => setCarburante(c)}
                  >
                    <Text
                      style={[
                        styles.buttonGroupText,
                        carburante === c && styles.buttonGroupTextActive,
                      ]}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Salva</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
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
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },

  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  buttonGroupItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buttonGroupItemActive: {
    backgroundColor: BRAND_BLUE,
    borderColor: BRAND_BLUE,
  },
  buttonGroupText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  buttonGroupTextActive: {
    color: '#fff',
  },

  saveBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
