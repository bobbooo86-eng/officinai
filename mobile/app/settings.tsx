import { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { BRAND_BLUE, APP_VERSION } from '@/lib/constants';

const RUOLO_LABELS: Record<string, string> = {
  titolare: 'Titolare',
  operaio: 'Operaio',
  reception: 'Reception',
};

export default function SettingsScreen() {
  const { officina, utente, logout } = useAuthStore();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert('Logout', 'Vuoi uscire dal tuo account?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Impostazioni',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Workshop Info */}
        <Text style={styles.sectionHeader}>Officina</Text>
        <View style={styles.card}>
          {officina ? (
            <>
              <InfoRow label="Nome" value={officina.nome} />
              <InfoRow label="Indirizzo" value={officina.indirizzo} />
              <InfoRow label="Telefono" value={officina.tel} />
              <InfoRow label="Email" value={officina.email} />
              <InfoRow label="P. IVA" value={officina.p_iva} isLast />
            </>
          ) : (
            <Text style={styles.noDataText}>Dati officina non disponibili</Text>
          )}
        </View>

        {/* User Profile */}
        <Text style={styles.sectionHeader}>Profilo utente</Text>
        <View style={styles.card}>
          {utente ? (
            <>
              <InfoRow label="Nome" value={utente.nome} />
              <InfoRow label="Email" value={utente.email} />
              <InfoRow
                label="Ruolo"
                value={RUOLO_LABELS[utente.ruolo] ?? utente.ruolo}
                isLast
              />
            </>
          ) : (
            <Text style={styles.noDataText}>Dati utente non disponibili</Text>
          )}
        </View>

        {/* Actions */}
        <Text style={styles.sectionHeader}>Account</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.7}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Text style={styles.logoutBtnText}>Esci dall'account</Text>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>OfficinAI Mobile</Text>
          <Text style={styles.versionNumber}>Versione {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || '-'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#0f172a', maxWidth: '60%', textAlign: 'right' },

  noDataText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingVertical: 16 },

  logoutBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },

  versionSection: { alignItems: 'center', marginTop: 32, gap: 2 },
  versionText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  versionNumber: { fontSize: 12, color: '#cbd5e1' },
});
