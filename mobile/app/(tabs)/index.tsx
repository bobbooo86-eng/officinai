import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import StatusBadge from '@/components/StatusBadge';
import { BRAND_BLUE, type AppuntamentoStato } from '@/lib/constants';
import { fmtOra } from '@/lib/format';

interface Appointment {
  id: string;
  data_ora: string;
  stato: AppuntamentoStato;
  problema: string | null;
  clienti: { nome: string; tel: string } | null;
  veicoli: { marca: string; modello: string; targa: string } | null;
}

const SELECT_QUERY =
  'id, data_ora, stato, problema, clienti(nome, tel), veicoli(marca, modello, targa)';

export default function HomeScreen() {
  const router = useRouter();
  const { officina } = useAuthStore();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [richieste, setRichieste] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (officina?.id) {
      loadData();
      return subscribeRealtime();
    }
  }, [officina?.id]);

  function subscribeRealtime() {
    if (!officina?.id) return;
    const channel = supabase
      .channel('home-appuntamenti')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appuntamenti',
          filter: `officina_id=eq.${officina.id}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadData() {
    if (!officina?.id) return;

    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    // Load today's appointments
    const { data: todayData } = await supabase
      .from('appuntamenti')
      .select(SELECT_QUERY)
      .eq('officina_id', officina.id)
      .gte('data_ora', startOfDay)
      .lte('data_ora', endOfDay)
      .order('data_ora', { ascending: true });

    // Load pending requests (richieste)
    const { data: richiesteData } = await supabase
      .from('appuntamenti')
      .select(SELECT_QUERY)
      .eq('officina_id', officina.id)
      .eq('stato', 'richiesta')
      .order('data_ora', { ascending: true });

    if (todayData) {
      setTodayAppointments(todayData as unknown as Appointment[]);
    }
    if (richiesteData) {
      setRichieste(richiesteData as unknown as Appointment[]);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [officina?.id]);

  // KPI calculations
  const totalRichieste = richieste.length;
  const totalOggi = todayAppointments.length;
  const inCorso = todayAppointments.filter(
    (a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi'
  ).length;
  const pronti = todayAppointments.filter((a) => a.stato === 'pronto').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
      >
        {/* Welcome Header */}
        <View>
          <Text style={styles.headerTitle}>{officina?.nome || 'OfficinAI'}</Text>
          <Text style={styles.headerSubtitle}>Benvenuto nella tua officina</Text>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: '#8b5cf6' }]}>
            <Text style={[styles.kpiValue, { color: '#8b5cf6' }]}>{totalRichieste}</Text>
            <Text style={styles.kpiLabel}>Richieste</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
            <Text style={[styles.kpiValue, { color: '#3b82f6' }]}>{totalOggi}</Text>
            <Text style={styles.kpiLabel}>Oggi</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{inCorso}</Text>
            <Text style={styles.kpiLabel}>In Corso</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
            <Text style={[styles.kpiValue, { color: '#10b981' }]}>{pronti}</Text>
            <Text style={styles.kpiLabel}>Pronti</Text>
          </View>
        </View>

        {/* Pending Requests Alert */}
        {totalRichieste > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertIcon}>{"\uD83D\uDD14"}</Text>
              <Text style={styles.alertTitle}>
                {totalRichieste} richiest{totalRichieste === 1 ? 'a' : 'e'} in attesa
              </Text>
            </View>
            {richieste.slice(0, 2).map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.alertItem}
                activeOpacity={0.7}
                onPress={() => router.push(`/appointment/${r.id}`)}
              >
                <View style={styles.alertItemContent}>
                  <Text style={styles.alertItemName}>
                    {r.clienti?.nome || 'Cliente sconosciuto'}
                  </Text>
                  <Text style={styles.alertItemDetail} numberOfLines={1}>
                    {r.veicoli
                      ? `${r.veicoli.marca} ${r.veicoli.modello}`
                      : r.problema || 'Nessun dettaglio'}
                  </Text>
                </View>
                <Text style={styles.alertChevron}>{">"}</Text>
              </TouchableOpacity>
            ))}
            {totalRichieste > 2 && (
              <Text style={styles.alertMore}>
                +{totalRichieste - 2} altr{totalRichieste - 2 === 1 ? 'a' : 'e'}
              </Text>
            )}
          </View>
        )}

        {/* Today's Appointments */}
        <View>
          <Text style={styles.sectionTitle}>Appuntamenti di oggi</Text>

          {todayAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>{"\uD83D\uDCCB"}</Text>
              <Text style={styles.emptyText}>Nessun appuntamento per oggi</Text>
            </View>
          ) : (
            todayAppointments.map((appt) => (
              <TouchableOpacity
                key={appt.id}
                style={styles.appointmentCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/appointment/${appt.id}`)}
              >
                <View style={styles.appointmentHeader}>
                  <Text style={styles.appointmentTime}>{fmtOra(appt.data_ora)}</Text>
                  <StatusBadge status={appt.stato} />
                </View>
                <Text style={styles.appointmentClient}>
                  {appt.clienti?.nome || 'Cliente sconosciuto'}
                </Text>
                {appt.veicoli && (
                  <Text style={styles.appointmentVehicle}>
                    {appt.veicoli.marca} {appt.veicoli.modello} - {appt.veicoli.targa}
                  </Text>
                )}
                {appt.problema && (
                  <Text style={styles.appointmentProblem} numberOfLines={2}>
                    {appt.problema}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  alertCard: {
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  alertIcon: {
    fontSize: 18,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5b21b6',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  alertItemContent: {
    flex: 1,
  },
  alertItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  alertItemDetail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  alertChevron: {
    fontSize: 18,
    color: '#94a3b8',
  },
  alertMore: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentTime: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  appointmentClient: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  appointmentVehicle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  appointmentProblem: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    fontStyle: 'italic',
  },
});
