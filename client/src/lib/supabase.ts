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
      
      // Detailed network diagnostics
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      console.log('Browser user agent:', navigator.userAgent);
      console.log('Current origin:', window.location.origin);
      
      // Add timeout and retry logic
      const fetchWithTimeout = async (url: string, options = {}, timeout = 10000) => {
        const controller = new AbortController();
        const { signal } = controller;
        
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, { ...options, signal });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };
      
      // Try up to 3 times with exponential backoff
      let lastError;
      let response;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          console.log(`Config fetch attempt ${attempt + 1}/3`);
          
          if (attempt > 0) {
            // Wait longer between each retry (500ms, then 1500ms)
            await new Promise(resolve => setTimeout(resolve, Math.pow(3, attempt) * 500));
          }
          
          response = await fetchWithTimeout('/api/config', {}, 10000);
          break; // Successful response, exit loop
        } catch (error: any) {
          console.error(`Config fetch attempt ${attempt + 1} failed:`, error);
          lastError = error;
          
          // Diagnostic checks on failure
          if (error.name === 'AbortError') {
            console.warn('Fetch request timed out after 10 seconds');
          } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.warn('Potential network connection issue or CORS problem');
          }
        }
      }
      
      // If all attempts failed
      if (!response) {
        throw lastError || new Error('Failed to fetch config after multiple attempts');
      }
      
      if (!response.ok) {
        console.error('Config API response not OK, status:', response.status);
        const responseText = await response.text();
        console.error('Error response body:', responseText);
        throw new Error(`Failed to fetch Supabase configuration: ${response.status} ${response.statusText}`);
      }
      
      let config;
      try {
        config = await response.json();
        console.log('Config received, URL status:', config.supabaseUrl ? 
                    `exists (prefix: ${config.supabaseUrl.substring(0, 10)}...)` : 'missing',
                    'Key status:', config.supabaseAnonKey ? 
                    `exists (length: ${config.supabaseAnonKey.length})` : 'missing');
      } catch (jsonError) {
        console.error('Failed to parse config response as JSON:', jsonError);
        throw new Error('Invalid JSON response from config endpoint');
      }

      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        console.error('Missing config values:', { 
          hasUrl: !!config.supabaseUrl, 
          hasKey: !!config.supabaseAnonKey 
        });
        throw new Error('Invalid Supabase configuration received from server');
      }

      console.log('Creating Supabase client with URL and key');
      try {
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
      } catch (initError: any) {
        console.error('Error creating Supabase client:', initError);
        console.error('Error details:', {
          name: initError.name,
          message: initError.message,
          stack: initError.stack
        });
        throw new Error(`Failed to initialize Supabase client: ${initError.message}`);
      }

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