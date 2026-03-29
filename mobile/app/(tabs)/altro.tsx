import { View, Text, SafeAreaView, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { APP_VERSION, BRAND_BLUE } from '@/lib/constants';

interface MenuItem {
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: '📦',
    title: 'Magazzino',
    subtitle: 'Gestione ricambi e inventario',
  },
  {
    icon: '📊',
    title: 'Analytics',
    subtitle: 'Statistiche e report officina',
  },
  {
    icon: '🧾',
    title: 'Fatturazione',
    subtitle: 'Preventivi e fatture',
  },
  {
    icon: '⚙️',
    title: 'Impostazioni',
    subtitle: 'Preferenze e configurazione',
  },
];

export default function AltroScreen() {
  function handleLogout() {
    Alert.alert('Esci', 'Sei sicuro di voler uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
              onPress={item.onPress}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
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
