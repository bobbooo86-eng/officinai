import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { BRAND_BLUE } from '@/lib/constants';

interface Client {
  id: string;
  nome: string;
  tel: string | null;
  email: string | null;
}

export default function ClientiScreen() {
  const { officina } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (officina?.id) {
      loadClients();
    }
  }, [officina?.id]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  async function loadClients() {
    if (!officina?.id) return;

    const { data, error } = await supabase
      .from('clienti')
      .select('id, nome, tel, email')
      .eq('officina_id', officina.id)
      .order('nome', { ascending: true });

    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  }, [officina?.id]);

  const filteredClients = clients.filter((c) => {
    if (!debouncedQuery) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.tel && c.tel.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  function handleCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function handleWhatsApp(phone: string) {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    let waNumber = cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;
    if (!waNumber.startsWith('39')) waNumber = '39' + waNumber;
    Linking.openURL(`https://wa.me/${waNumber}`).catch(() => {
      Alert.alert('Errore', 'WhatsApp non disponibile su questo dispositivo');
    });
  }

  function handleEmail(email: string) {
    Linking.openURL(`mailto:${email}`);
  }

  function handleAddClient() {
    // Future: navigate to add client form
    router.push('/nuovo-cliente');
  }

  function getInitials(nome: string): string {
    const parts = nome.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return nome.charAt(0).toUpperCase();
  }

  function renderClient({ item }: { item: Client }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.clientName}>{item.nome}</Text>
            {item.tel && <Text style={styles.clientDetail}>{item.tel}</Text>}
            {item.email && (
              <Text style={styles.clientDetail} numberOfLines={1}>
                {item.email}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          {item.tel && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCall(item.tel!)}
            >
              <Text style={styles.actionIcon}>{"\uD83D\uDCDE"}</Text>
              <Text style={styles.actionLabel}>Chiama</Text>
            </TouchableOpacity>
          )}
          {item.tel && (
            <TouchableOpacity
              style={[styles.actionButton, styles.whatsappButton]}
              onPress={() => handleWhatsApp(item.tel!)}
            >
              <Text style={styles.actionIcon}>{"\uD83D\uDCAC"}</Text>
              <Text style={[styles.actionLabel, { color: '#16a34a' }]}>WhatsApp</Text>
            </TouchableOpacity>
          )}
          {item.email && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEmail(item.email!)}
            >
              <Text style={styles.actionIcon}>{"\u2709\uFE0F"}</Text>
              <Text style={styles.actionLabel}>Email</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento clienti...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca cliente..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id}
        renderItem={renderClient}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{"\uD83D\uDC65"}</Text>
            <Text style={styles.emptyText}>
              {debouncedQuery ? 'Nessun cliente trovato' : 'Nessun cliente registrato'}
            </Text>
          </View>
        }
      />

      {/* FAB - Add new client */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={handleAddClient}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  clientDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  whatsappButton: {
    backgroundColor: '#dcfce7',
  },
  actionIcon: {
    fontSize: 14,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
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
