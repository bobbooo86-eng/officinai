import { View, Text, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function AltroScreen() {
  async function handleLogout() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: '500' }}>
            Esci dall'account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
