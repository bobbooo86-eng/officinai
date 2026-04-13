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
  Modal,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { BRAND_BLUE } from '@/lib/constants';
import { fmtEuro } from '@/lib/format';
import type { Magazzino } from '@/lib/types';

const CATEGORIE = [
  'Filtri',
  'Olio',
  'Freni',
  'Sospensioni',
  'Cinghie',
  'Batterie',
  'Candele',
  'Pneumatici',
  'Elettronica',
  'Carrozzeria',
  'Altro',
] as const;

const FILTER_ALL = 'Tutte';

const emptyForm = {
  nome: '',
  codice: '',
  categoria: 'Altro',
  quantita: '0',
  quantita_minima: '1',
  prezzo_acq: '0',
  prezzo_vend: '0',
};

export default function MagazzinoScreen() {
  const { officina } = useAuthStore();
  const [items, setItems] = useState<Magazzino[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Magazzino | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadItems();
  }, [officina?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  async function loadItems() {
    if (!officina?.id) return;
    const { data, error } = await supabase
      .from('magazzino')
      .select('*')
      .eq('officina_id', officina.id)
      .order('nome', { ascending: true });

    if (!error && data) setItems(data as Magazzino[]);
    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, [officina?.id]);

  const filtered = items.filter((item) => {
    if (categoryFilter !== FILTER_ALL && item.categoria !== categoryFilter) return false;
    if (!debouncedQuery) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      item.nome.toLowerCase().includes(q) ||
      item.codice.toLowerCase().includes(q) ||
      item.categoria.toLowerCase().includes(q)
    );
  });

  const totalItems = items.length;
  const lowStockCount = items.filter((i) => i.quantita <= i.quantita_minima).length;
  const totalValue = items.reduce((sum, i) => sum + i.quantita * i.prezzo_acq, 0);

  function openAdd() {
    setEditingItem(null);
    setForm(emptyForm);
    setModalVisible(true);
  }

  function openEdit(item: Magazzino) {
    setEditingItem(item);
    setForm({
      nome: item.nome,
      codice: item.codice,
      categoria: item.categoria,
      quantita: String(item.quantita),
      quantita_minima: String(item.quantita_minima),
      prezzo_acq: String(item.prezzo_acq),
      prezzo_vend: String(item.prezzo_vend),
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!officina?.id) return;
    if (!form.nome.trim() || !form.codice.trim()) {
      Alert.alert('Errore', 'Nome e codice sono obbligatori.');
      return;
    }
    setSaving(true);
    const payload = {
      officina_id: officina.id,
      nome: form.nome.trim(),
      codice: form.codice.trim(),
      categoria: form.categoria,
      quantita: parseInt(form.quantita, 10) || 0,
      quantita_minima: parseInt(form.quantita_minima, 10) || 0,
      prezzo_acq: parseFloat(form.prezzo_acq) || 0,
      prezzo_vend: parseFloat(form.prezzo_vend) || 0,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('magazzino')
        .update(payload)
        .eq('id', editingItem.id);
      if (error) Alert.alert('Errore', error.message);
    } else {
      const { error } = await supabase.from('magazzino').insert(payload);
      if (error) Alert.alert('Errore', error.message);
    }

    setSaving(false);
    setModalVisible(false);
    await loadItems();
  }

  async function handleDelete() {
    if (!editingItem) return;
    Alert.alert('Conferma', `Eliminare "${editingItem.nome}"?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('magazzino').delete().eq('id', editingItem.id);
          setModalVisible(false);
          await loadItems();
        },
      },
    ]);
  }

  async function adjustQty(item: Magazzino, delta: number) {
    const newQty = Math.max(0, item.quantita + delta);
    const { error } = await supabase
      .from('magazzino')
      .update({ quantita: newQty })
      .eq('id', item.id);
    if (!error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, quantita: newQty } : i))
      );
    }
  }

  function renderItem({ item }: { item: Magazzino }) {
    const isLow = item.quantita <= item.quantita_minima;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <Text style={styles.itemName}>{item.nome}</Text>
            <Text style={styles.itemCode}>{item.codice}</Text>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{item.categoria}</Text>
            </View>
          </View>
          <View style={styles.qtySection}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => adjustQty(item, -1)}
            >
              <Text style={styles.qtyBtnText}>-</Text>
            </TouchableOpacity>
            <View style={[styles.qtyBadge, isLow && styles.qtyBadgeLow]}>
              <Text style={[styles.qtyText, isLow && styles.qtyTextLow]}>
                {item.quantita}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => adjustQty(item, 1)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardPrices}>
          <Text style={styles.priceText}>Acq: {fmtEuro(item.prezzo_acq)}</Text>
          <Text style={styles.priceText}>Vend: {fmtEuro(item.prezzo_vend)}</Text>
          {isLow && <Text style={styles.lowStockLabel}>Scorta bassa</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Magazzino',
            headerStyle: { backgroundColor: '#1e3a5f' },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
          <Text style={styles.loadingText}>Caricamento magazzino...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Magazzino',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalItems}</Text>
          <Text style={styles.statLabel}>Articoli</Text>
        </View>
        <View style={[styles.statCard, lowStockCount > 0 && styles.statCardAlert]}>
          <Text style={[styles.statValue, lowStockCount > 0 && { color: '#ef4444' }]}>
            {lowStockCount}
          </Text>
          <Text style={styles.statLabel}>Scorta bassa</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fmtEuro(totalValue)}</Text>
          <Text style={styles.statLabel}>Valore tot.</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca per nome o codice..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[FILTER_ALL, ...CATEGORIE]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
            onPress={() => setCategoryFilter(cat)}
          >
            <Text
              style={[
                styles.filterChipText,
                categoryFilter === cat && styles.filterChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Items List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>
              {debouncedQuery || categoryFilter !== FILTER_ALL
                ? 'Nessun articolo trovato'
                : 'Magazzino vuoto'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Modifica Articolo' : 'Nuovo Articolo'}
              </Text>

              <Text style={styles.fieldLabel}>Nome *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.nome}
                onChangeText={(v) => setForm({ ...form, nome: v })}
                placeholder="Nome articolo"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>Codice *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.codice}
                onChangeText={(v) => setForm({ ...form, codice: v })}
                placeholder="Codice articolo"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Categoria</Text>
              <TouchableOpacity
                style={styles.fieldInput}
                onPress={() => setShowCatPicker(!showCatPicker)}
              >
                <Text style={{ fontSize: 15, color: '#0f172a' }}>{form.categoria}</Text>
              </TouchableOpacity>
              {showCatPicker && (
                <View style={styles.pickerList}>
                  {CATEGORIE.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.pickerItem,
                        form.categoria === cat && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setForm({ ...form, categoria: cat });
                        setShowCatPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          form.categoria === cat && styles.pickerItemTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Quantita</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.quantita}
                    onChangeText={(v) => setForm({ ...form, quantita: v })}
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Quantita minima</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.quantita_minima}
                    onChangeText={(v) => setForm({ ...form, quantita_minima: v })}
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Prezzo acquisto</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.prezzo_acq}
                    onChangeText={(v) => setForm({ ...form, prezzo_acq: v })}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Prezzo vendita</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form.prezzo_vend}
                    onChangeText={(v) => setForm({ ...form, prezzo_vend: v })}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                {editingItem && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>Elimina</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Salva</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748b' },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statCardAlert: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE },
  filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },

  listContent: { padding: 16, paddingBottom: 80 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemCode: { fontSize: 13, color: '#64748b', marginTop: 2 },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  catBadgeText: { fontSize: 11, color: '#475569', fontWeight: '500' },

  qtySection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '600', color: '#334155' },
  qtyBadge: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
  },
  qtyBadgeLow: { backgroundColor: '#fee2e2' },
  qtyText: { fontSize: 15, fontWeight: '700', color: BRAND_BLUE },
  qtyTextLow: { color: '#ef4444' },

  cardPrices: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 16,
    alignItems: 'center',
  },
  priceText: { fontSize: 12, color: '#64748b' },
  lowStockLabel: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 'auto',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 30 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 4 },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },

  pickerList: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
    maxHeight: 200,
  },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 10 },
  pickerItemActive: { backgroundColor: '#dbeafe' },
  pickerItemText: { fontSize: 14, color: '#334155' },
  pickerItemTextActive: { color: BRAND_BLUE, fontWeight: '600' },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    marginRight: 'auto',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: BRAND_BLUE,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  emptyContainer: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: 14, color: '#94a3b8' },
});
