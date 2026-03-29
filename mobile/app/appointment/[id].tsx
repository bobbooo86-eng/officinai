import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { BRAND_BLUE, STATI_ORDINE, STATO_CONFIG, type AppuntamentoStato } from '@/lib/constants';

interface AppointmentDetail {
  id: string;
  data_ora: string;
  stato: AppuntamentoStato;
  problema_descritto: string | null;
  note_interne: string | null;
  clienti: {
    id: string;
    nome: string;
    cognome: string;
    telefono: string | null;
    email: string | null;
  } | null;
  veicoli: {
    marca: string;
    modello: string;
    targa: string;
    anno: number | null;
  } | null;
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadAppointment();
  }, [id]);

  async function loadAppointment() {
    const { data, error } = await supabase
      .from('appuntamenti')
      .select(
        'id, data_ora, stato, problema_descritto, note_interne, clienti(id, nome, cognome, telefono, email), veicoli(marca, modello, targa, anno)'
      )
      .eq('id', id)
      .single();

    if (!error && data) {
      setAppointment(data as unknown as AppointmentDetail);
    }
    setLoading(false);
  }

  async function handleChangeStatus() {
    if (!appointment) return;

    const currentIdx = STATI_ORDINE.indexOf(appointment.stato);
    const availableStates = STATI_ORDINE.filter((_, i) => i !== currentIdx);

    Alert.alert(
      'Cambia stato',
      'Seleziona il nuovo stato:',
      [
        ...availableStates.map((stato) => ({
          text: STATO_CONFIG[stato].label,
          onPress: async () => {
            const { error } = await supabase
              .from('appuntamenti')
              .update({ stato })
              .eq('id', appointment.id);

            if (!error) {
              setAppointment({ ...appointment, stato });
            } else {
              Alert.alert('Errore', 'Impossibile aggiornare lo stato.');
            }
          },
        })),
        { text: 'Annulla', style: 'cancel' },
      ]
    );
  }

  function handleCall() {
    if (appointment?.clienti?.telefono) {
      Linking.openURL(`tel:${appointment.clienti.telefono}`);
    }
  }

  function handleWhatsApp() {
    if (appointment?.clienti?.telefono) {
      const phone = appointment.clienti.telefono.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${phone}`);
    }
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento dettaglio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyIcon}>❌</Text>
          <Text style={styles.loadingText}>Appuntamento non trovato</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Torna indietro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status + Date */}
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <StatusBadge status={appointment.stato} size="medium" />
          </View>
          <Text style={styles.dateText}>{formatDateTime(appointment.data_ora)}</Text>
        </View>

        {/* Client Info */}
        {appointment.clienti && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <View style={styles.card}>
              <Text style={styles.cardMainText}>
                {appointment.clienti.nome} {appointment.clienti.cognome}
              </Text>
              {appointment.clienti.telefono && (
                <Text style={styles.cardDetailText}>{appointment.clienti.telefono}</Text>
              )}
              {appointment.clienti.email && (
                <Text style={styles.cardDetailText}>{appointment.clienti.email}</Text>
              )}
            </View>
          </View>
        )}

        {/* Vehicle Info */}
        {appointment.veicoli && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Veicolo</Text>
            <View style={styles.card}>
              <Text style={styles.cardMainText}>
                {appointment.veicoli.marca} {appointment.veicoli.modello}
              </Text>
              <Text style={styles.cardDetailText}>Targa: {appointment.veicoli.targa}</Text>
              {appointment.veicoli.anno && (
                <Text style={styles.cardDetailText}>Anno: {appointment.veicoli.anno}</Text>
              )}
            </View>
          </View>
        )}

        {/* Problem Description */}
        {appointment.problema_descritto && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Problema descritto</Text>
            <View style={styles.card}>
              <Text style={styles.problemText}>{appointment.problema_descritto}</Text>
            </View>
          </View>
        )}

        {/* Internal Notes */}
        {appointment.note_interne && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note interne</Text>
            <View style={styles.card}>
              <Text style={styles.problemText}>{appointment.note_interne}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: BRAND_BLUE }]}
            activeOpacity={0.7}
            onPress={handleChangeStatus}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionButtonText}>Cambia stato</Text>
          </TouchableOpacity>

          {appointment.clienti?.telefono && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#059669' }]}
                activeOpacity={0.7}
                onPress={handleCall}
              >
                <Text style={styles.actionIcon}>📞</Text>
                <Text style={styles.actionButtonText}>Chiama cliente</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#25d366' }]}
                activeOpacity={0.7}
                onPress={handleWhatsApp}
              >
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </>
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
  emptyIcon: {
    fontSize: 32,
  },
  backLink: {
    fontSize: 14,
    color: BRAND_BLUE,
    fontWeight: '600',
    marginTop: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  section: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardDetailText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  problemText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  actionsSection: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
