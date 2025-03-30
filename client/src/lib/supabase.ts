import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let initializationPromise: Promise<ReturnType<typeof createClient>> | null = null;

export async function initSupabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to fetch Supabase configuration');
      }
      const config = await response.json();

      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('Invalid Supabase configuration received from server');
      }

      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          storageKey: 'career-ai-auth',
          flowType: 'pkce',
          detectSessionInUrl: true
        },
        global: {
          headers: {
            'x-application-name': 'career-ai-platform'
          }
        }
      });

      return supabaseClient;
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      initializationPromise = null; // Reset so we can try again
      throw error;
    }
  })();

  return initializationPromise;
}

export async function getSupabase() {
  if (!supabaseClient) {
    await initSupabase();
  }
  return supabaseClient!;
}

// Don't auto-initialize on import - let components handle initialization