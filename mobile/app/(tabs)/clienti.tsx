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
  StyleSheet,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { BRAND_BLUE } from '@/lib/constants';

interface Client {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  email: string | null;
}

export default function ClientiScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

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
      .from('clienti')
      .select('id, nome, cognome, telefono, email')
      .eq('officina_id', utente.officina_id)
      .order('cognome', { ascending: true });

    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  }, []);

  const filteredClients = clients.filter((c) => {
    if (!debouncedQuery) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      c.cognome.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  function handleCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function handleEmail(email: string) {
    Linking.openURL(`mailto:${email}`);
  }

  function renderClient({ item }: { item: Client }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.nome.charAt(0)}
              {item.cognome.charAt(0)}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.clientName}>
              {item.nome} {item.cognome}
            </Text>
            {item.telefono && <Text style={styles.clientDetail}>{item.telefono}</Text>}
            {item.email && (
              <Text style={styles.clientDetail} numberOfLines={1}>
                {item.email}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          {item.telefono && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCall(item.telefono!)}
            >
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.actionLabel}>Chiama</Text>
            </TouchableOpacity>
          )}
          {item.email && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEmail(item.email!)}
            >
              <Text style={styles.actionIcon}>✉️</Text>
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
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>
              {debouncedQuery ? 'Nessun cliente trovato' : 'Nessun cliente registrato'}
            </Text>
          </View>
        }
      />
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
    gap: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
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
});
