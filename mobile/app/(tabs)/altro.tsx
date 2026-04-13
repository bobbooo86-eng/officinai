import { View, Text, SafeAreaView, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { APP_VERSION, BRAND_BLUE } from '@/lib/constants';

interface MenuItem {
  icon: string;
  title: string;
  subtitle: string;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: '\uD83D\uDCE6',
    title: 'Magazzino',
    subtitle: 'Gestione ricambi e inventario',
    route: '/magazzino',
  },
  {
    icon: '\uD83D\uDD27',
    title: 'Scansioni OBD',
    subtitle: 'Codici errore e diagnostica',
    route: '/obd',
  },
  {
    icon: '\uD83D\uDCCA',
    title: 'Analytics',
    subtitle: 'Statistiche e report officina',
    route: '/analytics',
  },
  {
    icon: '\u2699\uFE0F',
    title: 'Impostazioni',
    subtitle: 'Preferenze e configurazione',
    route: '/settings',
  },
];

export default function AltroScreen() {
  const router = useRouter();
  const { officina, logout } = useAuthStore();

  function handleLogout() {
    Alert.alert('Esci', 'Sei sicuro di voler uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Officina Info */}
        {officina && (
          <View style={styles.infoCard}>
            <Text style={styles.infoName}>{officina.nome}</Text>
            {officina.indirizzo ? (
              <Text style={styles.infoDetail}>{officina.indirizzo}</Text>
            ) : null}
            {officina.tel ? (
              <Text style={styles.infoDetail}>{officina.tel}</Text>
            ) : null}
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index < MENU_ITEMS.length - 1 && styles.menuItemBorder,
              ]}
              activeOpacity={0.6}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>{">"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogout}>
          <Text style={styles.logoutText}>Esci dall'account</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>OfficinAI v{APP_VERSION}</Text>
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
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuIcon: {
    fontSize: 24,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 22,
    color: '#94a3b8',
    fontWeight: '300',
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
  },
});
