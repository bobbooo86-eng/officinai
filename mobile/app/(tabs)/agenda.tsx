import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { BRAND_BLUE, FILTER_TABS, type AppuntamentoStato } from '@/lib/constants';

interface Appointment {
  id: string;
  data_ora: string;
  stato: AppuntamentoStato;
  problema_descritto: string | null;
  clienti: { nome: string; cognome: string } | null;
  veicoli: { marca: string; modello: string; targa: string } | null;
}

type FilterKey = (typeof FILTER_TABS)[number]['key'];

export default function AgendaScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('tutti');

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: utente } = await supabase
      .from('utenti')
      .select('officina_id')
      .eq('id', user.id)
      .single();

    if (!utente) return;

    const { data, error } = await supabase
      .from('appuntamenti')
      .select(
        'id, data_ora, stato, problema_descritto, clienti(nome, cognome), veicoli(marca, modello, targa)'
      )
      .eq('officina_id', utente.officina_id)
      .order('data_ora', { ascending: false });

    if (!error && data) {
      setAppointments(data as unknown as Appointment[]);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  }, []);

  const filteredAppointments = appointments.filter((a) => {
    if (activeFilter === 'tutti') return true;
    if (activeFilter === 'in_attesa') return a.stato === 'prenotato' || a.stato === 'attesa_ricambi';
    if (activeFilter === 'in_corso')
      return a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi';
    if (activeFilter === 'completato') return a.stato === 'pronto';
    return true;
  });

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderAppointment({ item }: { item: Appointment }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/appointment/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{formatDate(item.data_ora)}</Text>
          <StatusBadge status={item.stato} />
        </View>
        <Text style={styles.cardClient}>
          {item.clienti
            ? `${item.clienti.nome} ${item.clienti.cognome}`
            : 'Cliente sconosciuto'}
        </Text>
        {item.veicoli && (
          <Text style={styles.cardVehicle}>
            {item.veicoli.marca} {item.veicoli.modello} - {item.veicoli.targa}
          </Text>
        )}
        {item.problema_descritto && (
          <Text style={styles.cardProblem} numberOfLines={2}>
            {item.problema_descritto}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento appuntamenti...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Nessun appuntamento trovato</Text>
          </View>
        }
      />

      {/* FAB - Add new appointment */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => {
          // Navigate to new appointment form (future implementation)
        }}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterTabActive: {
    backgroundColor: BRAND_BLUE,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_BLUE,
  },
  cardClient: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardVehicle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  cardProblem: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  fabText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
    marginTop: -2,
  },
});
