import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Errore di accesso', error.message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      >
        {/* Logo / Title */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Text style={{ fontSize: 36, fontWeight: '700', color: '#1e3a5f' }}>
            OfficinAI
          </Text>
          <Text style={{ fontSize: 16, color: '#64748b', marginTop: 8 }}>
            Gestione officina intelligente
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#334155', marginBottom: 6 }}>
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="nome@officina.it"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={{
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: '#0f172a',
              }}
            />
          </View>

          <View>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#334155', marginBottom: 6 }}>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="La tua password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: '#0f172a',
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#1e3a5f',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                Accedi
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
