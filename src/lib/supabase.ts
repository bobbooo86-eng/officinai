import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sncwrzrzlorzfnfnaxin.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY3dyenJ6bG9yemZuZm5heGluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDI4NzIsImV4cCI6MjA5MDMxODg3Mn0.2nwZ-211OFkMCmq6HfPH1zl873nqS4knsATtqBpX9KU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'officinai-auth',
  },
});
