import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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

const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarioScreen() {
  const router = useRouter();
  const { officina } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(new Date()));
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, Appointment[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (officina?.id) {
      loadMonthAppointments();
    }
  }, [officina?.id, currentMonth]);

  async function loadMonthAppointments() {
    if (!officina?.id) return;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0] + 'T00:00:00';
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0] + 'T23:59:59';

    const { data, error } = await supabase
      .from('appuntamenti')
      .select(SELECT_QUERY)
      .eq('officina_id', officina.id)
      .gte('data_ora', startOfMonth)
      .lte('data_ora', endOfMonth)
      .order('data_ora', { ascending: true });

    if (!error && data) {
      const grouped: Record<string, Appointment[]> = {};
      (data as unknown as Appointment[]).forEach((appt) => {
        const key = appt.data_ora.split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(appt);
      });
      setAppointmentsByDate(grouped);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMonthAppointments();
    setRefreshing(false);
  }, [officina?.id, currentMonth]);

  function goToPrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  // Build calendar grid
  function buildCalendarDays(): (number | null)[] {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    // Convert Sunday=0 to Monday-first: Mon=0, Tue=1, ..., Sun=6
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    // Fill remaining cells to complete the last row
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }

  const calendarDays = buildCalendarDays();
  const todayKey = toDateKey(new Date());
  const selectedAppointments = appointmentsByDate[selectedDate] || [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento calendario...</Text>
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
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTHS_IT[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>{">"}</Text>
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.dayHeaderRow}>
          {DAYS_IT.map((day) => (
            <View key={day} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const dateKey = toDateKey(new Date(year, month, day));
            const hasAppointments = !!appointmentsByDate[dateKey]?.length;
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;

            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[
                  styles.dayCell,
                  isToday && styles.dayCellToday,
                  isSelected && styles.dayCellSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedDate(dateKey)}
              >
                <Text
                  style={[
                    styles.dayText,
                    isToday && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
                {hasAppointments && (
                  <View
                    style={[
                      styles.dot,
                      isSelected && styles.dotSelected,
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Day Appointments */}
        <View style={styles.selectedDaySection}>
          <Text style={styles.selectedDayTitle}>
            {selectedDate === todayKey
              ? 'Oggi'
              : new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'long',
                })}
          </Text>

          {selectedAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nessun appuntamento</Text>
            </View>
          ) : (
            selectedAppointments.map((appt) => (
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
    gap: 12,
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  dayHeaderRow: {
    flexDirection: 'row',
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    padding: 4,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayCellToday: {
    backgroundColor: '#eff6ff',
  },
  dayCellSelected: {
    backgroundColor: BRAND_BLUE,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  dayTextToday: {
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: BRAND_BLUE,
    marginTop: 2,
  },
  dotSelected: {
    backgroundColor: '#ffffff',
  },
  selectedDaySection: {
    gap: 8,
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
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
