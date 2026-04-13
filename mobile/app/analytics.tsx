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
import { Stack } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { BRAND_BLUE, STATO_CONFIG } from '@/lib/constants';
import { fmtEuro, fmtData } from '@/lib/format';
import type { AppuntamentoStato } from '@/lib/types';

type PeriodKey = '7G' | '30G' | '90G' | 'Anno';

const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '7G', label: '7G', days: 7 },
  { key: '30G', label: '30G', days: 30 },
  { key: '90G', label: '90G', days: 90 },
  { key: 'Anno', label: 'Anno', days: 365 },
];

interface Review {
  id: string;
  voto: number;
  commento?: string;
  created_at?: string;
  clienti?: { nome: string };
}

export default function AnalyticsScreen() {
  const { officina } = useAuthStore();
  const [period, setPeriod] = useState<PeriodKey>('30G');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [totalAppts, setTotalAppts] = useState(0);
  const [completedAppts, setCompletedAppts] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    loadData();
  }, [officina?.id, period]);

  async function loadData() {
    if (!officina?.id) return;
    setLoading(true);

    const days = PERIODS.find((p) => p.key === period)!.days;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Fetch all data in parallel
    const [apptsRes, prevRes, reviewsRes] = await Promise.all([
      supabase
        .from('appuntamenti')
        .select('id, stato')
        .eq('officina_id', officina.id)
        .gte('data_ora', sinceISO),
      supabase
        .from('preventivi')
        .select('totale, appuntamenti!inner(officina_id, data_ora)')
        .eq('stato', 'accettato')
        .eq('appuntamenti.officina_id', officina.id)
        .gte('appuntamenti.data_ora', sinceISO),
      supabase
        .from('recensioni')
        .select('id, voto, commento, created_at, clienti(nome)')
        .eq('officina_id', officina.id)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Appointments
    const appts = apptsRes.data ?? [];
    setTotalAppts(appts.length);
    setCompletedAppts(appts.filter((a: any) => a.stato === 'pronto').length);

    // Status distribution
    const counts: Record<string, number> = {};
    appts.forEach((a: any) => {
      counts[a.stato] = (counts[a.stato] || 0) + 1;
    });
    setStatusCounts(counts);

    // Revenue
    const rev = (prevRes.data ?? []).reduce((sum: number, p: any) => sum + (p.totale || 0), 0);
    setRevenue(rev);

    // Reviews
    setReviews((reviewsRes.data as any[]) ?? []);

    setLoading(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [officina?.id, period]);

  function renderStars(voto: number) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= voto ? '\u2605' : '\u2606');
    }
    return stars.join('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Statistiche',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_BLUE} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Period Tabs */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodTab, period === p.key && styles.periodTabActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text
                style={[styles.periodText, period === p.key && styles.periodTextActive]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_BLUE} />
          </View>
        ) : (
          <>
            {/* KPI Cards */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{totalAppts}</Text>
                <Text style={styles.kpiLabel}>Appuntamenti</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: '#10b981' }]}>{completedAppts}</Text>
                <Text style={styles.kpiLabel}>Completati</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: BRAND_BLUE }]}>{fmtEuro(revenue)}</Text>
                <Text style={styles.kpiLabel}>Fatturato</Text>
              </View>
            </View>

            {/* Status Distribution */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Distribuzione stati</Text>
              <View style={styles.statusCard}>
                {Object.keys(statusCounts).length === 0 ? (
                  <Text style={styles.noDataText}>Nessun dato nel periodo</Text>
                ) : (
                  Object.entries(statusCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([stato, count]) => {
                      const config = STATO_CONFIG[stato as AppuntamentoStato];
                      return (
                        <View key={stato} style={styles.statusRow}>
                          <View style={styles.statusLeft}>
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: config?.color ?? '#94a3b8' },
                              ]}
                            />
                            <Text style={styles.statusLabel}>
                              {config?.label ?? stato}
                            </Text>
                          </View>
                          <View style={styles.statusRight}>
                            <View
                              style={[
                                styles.statusBar,
                                {
                                  width: `${Math.max(10, (count / totalAppts) * 100)}%`,
                                  backgroundColor: config?.bg ?? '#f1f5f9',
                                } as any,
                              ]}
                            />
                            <Text style={styles.statusCount}>{count}</Text>
                          </View>
                        </View>
                      );
                    })
                )}
              </View>
            </View>

            {/* Recent Reviews */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recensioni recenti</Text>
              {reviews.length === 0 ? (
                <View style={styles.statusCard}>
                  <Text style={styles.noDataText}>Nessuna recensione nel periodo</Text>
                </View>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewStars}>{renderStars(review.voto)}</Text>
                      <Text style={styles.reviewDate}>
                        {review.created_at ? fmtData(review.created_at) : ''}
                      </Text>
                    </View>
                    {(review.clienti as any)?.nome && (
                      <Text style={styles.reviewAuthor}>{(review.clienti as any).nome}</Text>
                    )}
                    {review.commento ? (
                      <Text style={styles.reviewComment}>{review.commento}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { paddingBottom: 24 },
  loadingContainer: { paddingVertical: 64, alignItems: 'center' },

  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  periodTabActive: { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE },
  periodText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  periodTextActive: { color: '#fff' },

  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiValue: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },

  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },

  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 130 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 13, color: '#334155', fontWeight: '500' },
  statusRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  statusBar: { height: 8, borderRadius: 4, minWidth: 8 },
  statusCount: { fontSize: 13, fontWeight: '700', color: '#0f172a', minWidth: 24, textAlign: 'right' },
  noDataText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingVertical: 12 },

  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewStars: { fontSize: 18, color: '#f59e0b' },
  reviewDate: { fontSize: 12, color: '#94a3b8' },
  reviewAuthor: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 4 },
  reviewComment: { fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 18 },
});
