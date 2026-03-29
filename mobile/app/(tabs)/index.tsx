import { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const [officinaNome, setOfficinaNome] = useState<string>('');

  useEffect(() => {
    async function loadOfficina() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: utente } = await supabase
        .from('utenti')
        .select('officina_id')
        .eq('id', user.id)
        .single();

      if (!utente) return;

      const { data: officina } = await supabase
        .from('officine')
        .select('nome')
        .eq('id', utente.officina_id)
        .single();

      if (officina) {
        setOfficinaNome(officina.nome);
      }
    }

    loadOfficina();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Header */}
        <View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#0f172a' }}>
            {officinaNome || 'OfficinAI'}
          </Text>
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            Benvenuto nella tua officina
          </Text>
        </View>

        {/* Placeholder cards */}
        <View style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 20,
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>
            Appuntamenti di oggi
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>
            Nessun appuntamento ancora caricato.
          </Text>
        </View>

        <View style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 20,
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>
            Veicoli in lavorazione
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>
            Nessun veicolo in lavorazione.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
