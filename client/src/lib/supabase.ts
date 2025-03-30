import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let initializationPromise: Promise<ReturnType<typeof createClient>> | null = null;

export async function initSupabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('Fetching Supabase configuration from /api/config');
      const response = await fetch('/api/config');
      
      if (!response.ok) {
        console.error('Config API response not OK, status:', response.status);
        throw new Error(`Failed to fetch Supabase configuration: ${response.status} ${response.statusText}`);
      }
      
      const config = await response.json();
      console.log('Config received, URL prefix:', config.supabaseUrl?.substring(0, 10), 
                  'Key prefix:', config.supabaseAnonKey?.substring(0, 3));

      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        console.error('Missing config values:', { 
          hasUrl: !!config.supabaseUrl, 
          hasKey: !!config.supabaseAnonKey 
        });
        throw new Error('Invalid Supabase configuration received from server');
      }

      console.log('Creating Supabase client with URL and key');
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

      console.log('Supabase client initialized successfully');
      return supabaseClient;
    } catch (error: any) {
      console.error('Failed to initialize Supabase:', error);
      console.error('Stack trace:', error.stack ? error.stack : 'No stack trace available');
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