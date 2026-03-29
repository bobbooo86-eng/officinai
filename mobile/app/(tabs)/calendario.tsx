import { View, Text, SafeAreaView } from 'react-native';

export default function CalendarioScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#334155' }}>
          Calendario
        </Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
          Vista calendario mensile degli appuntamenti.
        </Text>
      </View>
    </SafeAreaView>
  );
}
