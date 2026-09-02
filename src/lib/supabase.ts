import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('your_supabase_project_url') &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('placeholder') &&
    !supabaseAnonKey.includes('your_supabase_anon_key') &&
    supabaseUrl.startsWith('https://')
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: isSupabaseConfigured,
      persistSession: true,
      detectSessionInUrl: isSupabaseConfigured,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

