import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sncwrzrzlorzfnfnaxin.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY3dyenJ6bG9yemZuZm5heGluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDI4NzIsImV4cCI6MjA5MDMxODg3Mn0.2nwZ-211OFkMCmq6HfPH1zl873nqS4knsATtqBpX9KU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
