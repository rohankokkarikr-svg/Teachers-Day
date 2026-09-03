import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://vtokjwfefespmkvnnpxz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0b2tqd2ZlZmVzcG1rdm5ucHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjM0NDUsImV4cCI6MjEwMzkzOTQ0NX0.DkQFF7Q2p4rmu4PC5XErxGXX1jeoHByG_AQpZSA4JOc';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

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
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
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

