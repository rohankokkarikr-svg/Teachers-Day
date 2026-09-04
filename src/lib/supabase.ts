import { createClient } from '@supabase/supabase-js';

// Production Supabase Instance (Project: vtokjwfefespmkvnnpxz)
const DEFAULT_SUPABASE_URL = 'https://vtokjwfefespmkvnnpxz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0b2tqd2ZlZmVzcG1rdm5ucHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjM0NDUsImV4cCI6MjEwMzkzOTQ0NX0.DkQFF7Q2p4rmu4PC5XErxGXX1jeoHByG_AQpZSA4JOc';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl: string =
  envUrl &&
  envUrl.startsWith('https://') &&
  !envUrl.includes('placeholder') &&
  !envUrl.includes('your_supabase_project_url')
    ? envUrl
    : DEFAULT_SUPABASE_URL;

export const supabaseAnonKey: string =
  envAnonKey &&
  !envAnonKey.includes('placeholder') &&
  !envAnonKey.includes('your_supabase_anon_key')
    ? envAnonKey
    : DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});


