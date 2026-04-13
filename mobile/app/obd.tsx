import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { BRAND_BLUE } from '@/lib/constants';
import { fmtData } from '@/lib/format';
import type { ScansioneOBD } from '@/lib/types';

export default function OBDScreen() {
  const { officina } = useAuthStore();
  const [scans, setScans] = useState<ScansioneOBD[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadScans();
  }, [officina?.id]);

  async function loadScans() {
    if (!officina?.id) return;
    const { data, error } = await supabase
      .from('scansioni_obd')
      .select('*, clienti(nome), veicoli(marca, modello, targa)')
      .eq('officina_id', officina.id)
      .eq('gestito', false)
      .order('created_at', { ascending: false });

    if (!error && data) setScans(data as ScansioneOBD[]);
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadScans();
    setRefreshing(false);
  }, [officina?.id]);

  async function markAsManaged(scan: ScansioneOBD) {
    setProcessingId(scan.id);
    const { error } = await supabase
      .from('scansioni_obd')
      .update({ gestito: true })
      .eq('id', scan.id);

    if (error) {
      Alert.alert('Errore', error.message);
      setProcessingId(null);
      return;
    }
    setScans((prev) => prev.filter((s) => s.id !== scan.id));
    setProcessingId(null);
  }

  function renderScan({ item }: { item: ScansioneOBD }) {
    const clientName = (item.clienti as any)?.nome ?? 'Cliente sconosciuto';
    const vehicle = item.veicoli
      ? `${(item.veicoli as any).marca} ${(item.veicoli as any).modello} - ${(item.veicoli as any).targa}`
      : 'Veicolo non specificato';
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>OBD</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.clientName}>{clientName}</Text>
            <Text style={styles.vehicleText}>{vehicle}</Text>
          </View>
          <Text style={styles.dateText}>{fmtData(item.created_at)}</Text>
        </View>

        <View style={styles.codesSection}>
          <Text style={styles.codesLabel}>Codici errore:</Text>
          <View style={styles.codesRow}>
            {(item.codici ?? []).map((code, idx) => (
              <View key={idx} style={styles.codeBadge}>
                <Text style={styles.codeText}>{code}</Text>
              </View>
            ))}
          </View>
        </View>

        {item.nota_cliente ? (
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Nota cliente:</Text>
            <Text style={styles.noteText}>{item.nota_cliente}</Text>
          </View>
        ) : null}

        {item.km_scansione ? (
          <Text style={styles.kmText}>Km: {item.km_scansione.toLocaleString('it-IT')}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.manageBtn, isProcessing && { opacity: 0.6 }]}
          onPress={() => markAsManaged(item)}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.manageBtnText}>Segna come gestito</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Scansioni OBD',
            headerStyle: { backgroundColor: '#1e3a5f' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento scansioni...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Scansioni OBD',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      {scans.length > 0 && (
        <View style={styles.counterBar}>
          <Text style={styles.counterText}>
            {scans.length} scansion{scans.length === 1 ? 'e' : 'i'} da gestire
          </Text>
        </View>
      )}

      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        renderItem={renderScan}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Nessuna scansione da gestire</Text>
            <Text style={styles.emptySubtext}>
              Le nuove scansioni OBD dei clienti appariranno qui
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748b' },

  counterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  counterText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  listContent: { padding: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontSize: 12, fontWeight: '800', color: '#d97706' },
  headerInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  vehicleText: { fontSize: 13, color: '#64748b', marginTop: 1 },
  dateText: { fontSize: 12, color: '#94a3b8' },

  codesSection: { marginTop: 12 },
  codesLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 6 },
  codesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  codeBadge: {
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  codeText: { fontSize: 13, fontWeight: '700', color: '#dc2626', fontFamily: 'monospace' },

  noteSection: { marginTop: 10 },
  noteLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  noteText: { fontSize: 13, color: '#334155', marginTop: 2 },

  kmText: { fontSize: 12, color: '#64748b', marginTop: 8 },

  manageBtn: {
    marginTop: 12,
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  emptyContainer: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
  emptySubtext: { fontSize: 13, color: '#94a3b8', textAlign: 'center', maxWidth: 260 },
});
