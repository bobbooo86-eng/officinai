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
import StatusBadge from '@/components/StatusBadge';
import { BRAND_BLUE, type AppuntamentoStato } from '@/lib/constants';

interface Appointment {
  id: string;
  data_ora: string;
  stato: AppuntamentoStato;
  problema_descritto: string | null;
  clienti: { nome: string; cognome: string } | null;
  veicoli: { marca: string; modello: string; targa: string } | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const [officinaNome, setOfficinaNome] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [officinaId, setOfficinaId] = useState<string | null>(null);

  useEffect(() => {
    loadOfficina();
  }, []);

  useEffect(() => {
    if (officinaId) {
      loadTodayAppointments();
    }
  }, [officinaId]);

  async function loadOfficina() {
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

    setOfficinaId(utente.officina_id);

    const { data: officina } = await supabase
      .from('officine')
      .select('nome')
      .eq('id', utente.officina_id)
      .single();

    if (officina) {
      setOfficinaNome(officina.nome);
    }
  }

  async function loadTodayAppointments() {
    if (!officinaId) return;

    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const { data, error } = await supabase
      .from('appuntamenti')
      .select(
        'id, data_ora, stato, problema_descritto, clienti(nome, cognome), veicoli(marca, modello, targa)'
      )
      .eq('officina_id', officinaId)
      .gte('data_ora', startOfDay)
      .lte('data_ora', endOfDay)
      .order('data_ora', { ascending: true });

    if (!error && data) {
      setAppointments(data as unknown as Appointment[]);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTodayAppointments();
    setRefreshing(false);
  }, [officinaId]);

  // KPI calculations
  const totalOggi = appointments.length;
  const inCorso = appointments.filter(
    (a) => a.stato === 'in_lavorazione' || a.stato === 'in_diagnosi'
  ).length;
  const pronti = appointments.filter((a) => a.stato === 'pronto').length;

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

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
        {/* Header */}
        <View>
          <Text style={styles.headerTitle}>{officinaNome || 'OfficinAI'}</Text>
          <Text style={styles.headerSubtitle}>Benvenuto nella tua officina</Text>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: BRAND_BLUE }]}>
            <Text style={styles.kpiValue}>{totalOggi}</Text>
            <Text style={styles.kpiLabel}>Oggi</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.kpiValue}>{inCorso}</Text>
            <Text style={styles.kpiLabel}>In Corso</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.kpiValue}>{pronti}</Text>
            <Text style={styles.kpiLabel}>Pronti</Text>
          </View>
        </View>

        {/* Today's Appointments */}
        <View>
          <Text style={styles.sectionTitle}>Appuntamenti di oggi</Text>

          {appointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Nessun appuntamento per oggi</Text>
            </View>
          ) : (
            appointments.map((appt) => (
              <TouchableOpacity
                key={appt.id}
                style={styles.appointmentCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/appointment/${appt.id}`)}
              >
                <View style={styles.appointmentHeader}>
                  <Text style={styles.appointmentTime}>{formatTime(appt.data_ora)}</Text>
                  <StatusBadge status={appt.stato} />
                </View>
                <Text style={styles.appointmentClient}>
                  {appt.clienti
                    ? `${appt.clienti.nome} ${appt.clienti.cognome}`
                    : 'Cliente sconosciuto'}
                </Text>
                {appt.veicoli && (
                  <Text style={styles.appointmentVehicle}>
                    {appt.veicoli.marca} {appt.veicoli.modello} - {appt.veicoli.targa}
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
    gap: 20,
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
});
